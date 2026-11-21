# csv-reader-speed-01-run-20261121

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/tidy-marten-51/csv-reader-speed-01-run-20261121/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/tidy-marten-51/csv-reader-speed-01-run-20261121/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

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
same error order, same line counting. About 3x faster than the baseline in local grading
(pure `run()` ~0.21–0.23s per set vs ~0.65–0.71s).

## Run it

```sh
node main.ts
```

## Layout

- `main.ts` — the driver: reads every case from `/input/cases.json`, answers each with `run()`,
  writes `/output/answers.json`.
- `solve.js` — the fast reader, a dependency-free ES module exporting `run(input)`.

## License

MIT. See [LICENSE](LICENSE).

---

<sub>Entered on [make.fun](https://make.fun/?ref=b6vtfqf3&utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>
