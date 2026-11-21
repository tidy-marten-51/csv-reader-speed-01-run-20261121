// A faster drop-in for csv-reader 1.0.0 (make.fun's own CSV reader).
//
// Same answer as csv-reader 1.0.0 for every input {text, header}: {columns, rows, errors}.
// The reference reads one character at a time and builds every field a character at a time.
// This version reads whole fields at a time instead: each field is found with one scan for the
// next delimiter (a regex character class, scanned in native code) and taken as a slice, so a
// well-formed field costs one scan plus one slice and no per-character work at all.
//
// Semantics (csv-reader 1.0.0's broken-row policy, kept exactly):
//   - a U+FEFF at the very start of the text is dropped;
//   - a record ends at LF or CRLF, and a line left with no characters is no record;
//   - outside quotes a CR not followed by LF is dropped (error stray_cr);
//   - a field that opens with a quote runs to the next quote that is not doubled, "" inside it
//     one quote, and each CRLF or lone CR inside it read as LF; what follows its closing quote,
//     up to the next comma or line break, is appended as it stands (quote_junk, when the field
//     ends); a quote that never closes is a literal character, and the text after it is read
//     again as an unquoted field (unterminated_quote);
//   - a quote inside an unquoted field is a literal character; fields stay strings, never
//     trimmed or converted;
//   - columns is the first record when header is true, else null; rows holds the records after
//     it (every record when header is false), each padded with "" (short_row, with fields: its
//     count) or cut (long_row, with extra: the cut fields) to the first record's width;
//   - each error is {code, line, row}: line the 1-based line its record starts on (every LF,
//     CRLF and lone CR inside a quoted field counted), row its record's index in rows (null for
//     the header), in the order met, a field's quote_junk when the field ends and a record's
//     short_row or long_row when the record ends.
//
// Pure: no clock, no randomness, no locale, nothing kept from one call to the next.

/** The next delimiter of an unquoted field: comma, CR or LF. */
const FIELD_RE = /[,\r\n]/g;
/** The next character that matters inside a quoted field: quote, CR or LF. */
const QUOTED_RE = /["\r\n]/g;

/** How a field ended: 0 at a comma (the record goes on), 1 at a line break, 2 at the end. */
const COMMA = 0;
const LINE_BREAK = 1;
const END = 2;

/** csv-reader 1.0.0's answer for one case's input. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  let pos = 0; // the next character to read
  let line = 1; // the line that character is on
  const n = text.length;
  if (n > 0 && text.charCodeAt(0) === 0xfeff) pos = 1;

  // The record being read: the line it starts on and the index in rows it takes (null: the header).
  let recordLine = 1;
  let recordRow = null;

  // The field just read, written by readUnquoted/readQuoted so no object is built per field.
  let fValue = '';
  let fEnded = END;
  let fAdded = 0; // characters readUnquoted kept (only the junk check reads it)

  // Reads unquoted characters onto `value` up to the next comma or line break: a CR not followed
  // by LF is dropped (stray_cr). A slice is taken per clean run, never per character.
  function readUnquoted(value) {
    fAdded = 0;
    let seg = pos; // start of the current clean run
    FIELD_RE.lastIndex = pos;
    let m;
    while ((m = FIELD_RE.exec(text)) !== null) {
      const i = m.index;
      const c = text.charCodeAt(i);
      if (c === 44) {
        // Comma: the field ends here.
        pos = i + 1;
        fValue = value + text.slice(seg, i);
        fAdded += i - seg;
        fEnded = COMMA;
        return;
      }
      if (c === 10) {
        // LF: the record ends here.
        pos = i + 1;
        line += 1;
        fValue = value + text.slice(seg, i);
        fAdded += i - seg;
        fEnded = LINE_BREAK;
        return;
      }
      // CR: a CRLF ends the record, a lone CR is dropped (stray_cr) and the field goes on.
      if (text.charCodeAt(i + 1) === 10) {
        pos = i + 2;
        line += 1;
        fValue = value + text.slice(seg, i);
        fAdded += i - seg;
        fEnded = LINE_BREAK;
        return;
      }
      errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
      value += text.slice(seg, i);
      fAdded += i - seg;
      pos = i + 1;
      seg = pos;
      FIELD_RE.lastIndex = pos;
    }
    pos = n;
    fValue = value + text.slice(seg, n);
    fAdded += n - seg;
    fEnded = END;
  }

  // Reads a quoted field whose opening quote is at pos.
  function readQuoted() {
    const open = pos;
    const openLine = line;
    let value = '';
    pos += 1;
    let seg = pos; // start of the current clean run inside the quotes
    QUOTED_RE.lastIndex = pos;
    let m;
    while ((m = QUOTED_RE.exec(text)) !== null) {
      const i = m.index;
      const c = text.charCodeAt(i);
      if (c === 34) {
        // Quote: doubled it is one quote, else it closes the field.
        if (text.charCodeAt(i + 1) === 34) {
          value += text.slice(seg, i) + '"';
          pos = i + 2;
          seg = pos;
          QUOTED_RE.lastIndex = pos;
          continue;
        }
        value += text.slice(seg, i);
        pos = i + 1;
        if (pos >= n) {
          fValue = value;
          fEnded = END;
          return;
        }
        const d = text.charCodeAt(pos);
        if (d === 44) {
          pos += 1;
          fValue = value;
          fEnded = COMMA;
          return;
        }
        if (d === 10) {
          pos += 1;
          line += 1;
          fValue = value;
          fEnded = LINE_BREAK;
          return;
        }
        if (d === 13 && text.charCodeAt(pos + 1) === 10) {
          pos += 2;
          line += 1;
          fValue = value;
          fEnded = LINE_BREAK;
          return;
        }
        // What follows the closing quote is appended as it stands, up to the next comma or
        // line break.
        readUnquoted(value);
        if (fAdded > 0) errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
        return;
      }
      // CRLF and a lone CR inside quotes are each one LF; a bare LF is one LF.
      value += text.slice(seg, i) + '\n';
      line += 1;
      pos = c === 13 && text.charCodeAt(i + 1) === 10 ? i + 2 : i + 1;
      seg = pos;
      QUOTED_RE.lastIndex = pos;
    }
    // The quote never closes: it is a literal character, and the text after it is read again as
    // an unquoted field (unterminated_quote).
    pos = open + 1;
    line = openLine;
    errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
    readUnquoted('"');
  }

  while (true) {
    // Lines with no characters are no records.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos += 1;
        line += 1;
      } else if (c === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= n) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let quoted;
    do {
      quoted = text.charCodeAt(pos) === 34;
      if (quoted) readQuoted();
      else readUnquoted('');
      fields.push(fValue);
    } while (fEnded === COMMA);

    // A line that held only stray CRs is left with no characters: no record (its stray_cr errors stay).
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
