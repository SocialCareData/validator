# Contributing

```bash
npm install
npm run typecheck
npm test                    # unit, conformance, integrity, cross-record
npx playwright install chromium
npm run test:web            # drives the page in a real browser
npm run dev:web             # the page, locally
```

Tests fetch real shapes from the ontology repository and cache them in
`.cache/shapes` (gitignored), so only the first run needs a network.

## Layout

```
src/core/       parsing, skolemization, the SHACL run   - isomorphic
src/catalogue/  which shapes exist and how to fetch them - isomorphic
src/report/     turning results into sentences           - isomorphic
src/cli/        the command line                         - Node only
src/node.ts     filesystem, stdin, disk cache            - Node only
web/            the GitHub Pages app
examples/       the conformance fixtures
```

**`node:` imports are only allowed in `src/cli/` and `src/node.ts`.** Everything
else has to run in a browser. A test asserts the built `dist/index.js` pulls in no
Node builtins; please keep it that way.

## Adding a profile

1. Add an entry to `src/catalogue/entries.ts` — module, shape files, context,
   any cross-record checks, and a one-sentence `describes` for the picker.
2. Put examples under `examples/<name>/`, named `valid-*.jsonld` and
   `invalid-*.jsonld`.
3. Run `npm run test:conformance`. The suite discovers the new folder
   automatically.
4. Regenerate `examples/<name>/expectations.json` and **read it**. See below.

## The expectations files

`examples/<module>/expectations.json` pins, for every invalid example, the issue
codes and JSON paths it should produce:

```json
{
  "invalid-bad-postcode.jsonld": [
    { "code": "bad-format", "jsonPath": "address[0].postcode" }
  ]
}
```

The old validator this replaces could only assert *that* an example failed. These
files assert *what it says*, which is the part users read — so a change that
quietly degrades a message into "other", or that points at the wrong field, fails
the build.

Generate them from a run, then review them by hand. A generated expectation that
nobody has read is just a record of current behaviour, including its bugs.

## Adding a plain-English message

`src/report/messages.ts` maps SHACL constraint components to sentences. Add a
case there, a test in `test/unit/messages.test.ts`, and a section in
`docs/error-reference.md` — the code is a documented interface, linked from SARIF
output and printed by `scd-validate explain`.

Two rules for the wording:

- **No IRIs in the human layer.** A test enforces this. IRIs go in `technical`.
- **Say what would be right**, not only what is wrong. "must be one of: home,
  work, temp" beats "value not allowed".

## Releasing

See [releasing.md](releasing.md).
