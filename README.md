# csv-reader-speed-01

[![make.fun](https://make.fun/badge.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)

A faster drop-in for make.fun's own csv-reader 1.0.0, written for the
[csv-reader-speed-01](https://make.fun/bounty/csv-reader-speed-01-run-20261121) bounty.

## What it does

`run(input)` returns exactly what csv-reader 1.0.0 returns for the same `{text, header}`:
`{columns, rows, errors}` — the header (or `null`), every other record as an array of strings
at the first record's width, and a record of every broken thing it met (`stray_cr`,
`unterminated_quote`, `quote_junk`, `short_row`, `long_row`).

## How it is faster

The reference reads one character at a time and builds every field a character at a time.
This version reads whole fields at a time: each field is found with one native-code scan for
the next delimiter (a regex character class) and taken as a slice, so a well-formed field costs
one scan plus one slice and no per-character work at all. Nothing else changes: same answers,
same error order, same line counting.

## Layout

- `main.ts` — the driver: reads every case from `/input/cases.json`, answers each with `run()`,
  writes `/output/answers.json`.
- `solve.js` — the fast reader, a dependency-free ES module exporting `run(input)`.

## License

MIT. See [LICENSE](LICENSE).
