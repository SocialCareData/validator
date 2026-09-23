# Contributing

```bash
npm install
npm run typecheck           # src only - what gets published
npm test                    # unit, conformance, integrity, cross-record
npm run typecheck:web
npx playwright install chromium
npm run test:web            # drives the page in a real browser
npm run dev:web             # the page, locally
```

Tests fetch real shapes from the ontology repository, so they need a network.

## Layout

```
src/        the published package - the library and the CLI
web/        the GitHub Pages app - never published to npm
examples/   the conformance fixtures
```

`src/` is flat, one job per file:

| File | Job |
| --- | --- |
| `catalogue.ts` | which profiles exist and which files each one loads |
| `fetch.ts` | fetching a text file over HTTPS |
| `profile.ts` | loading a profile: shapes, context, cross-checks |
| `validate.ts` | the pipeline, from JSON to a report |
| `skolemize.ts` | naming anonymous nodes, and locating pointers in the source |
| `context.ts` | reading a JSON-LD context backwards |
| `jsonld.ts` | choosing a context, and converting to RDF |
| `rdf.ts` / `shacl.ts` | parsing Turtle, running the engine |
| `shape-facts.ts` | reading constraints back off the shape that raised them |
| `messages.ts` | turning a constraint into a sentence |
| `report.ts` | the report types, building issues, grouping them |
| `pretty.ts` | terminal output |
| `cli.ts` | the command |
| `cross-checks.ts` | constraints that span a whole set of records |

**Two rules about the split.** `src/` is what gets published, so nothing that
exists only for the web page belongs there — the profile descriptions in the
`<select>`, for instance, live in `web/src/descriptions.ts`. And only `cli.ts`
may import `node:` builtins; everything else has to run in a browser.

## Adding a profile

1. Add an entry to `src/catalogue.ts` — shape files, context, and any
   cross-record checks. If it should appear in the web picker, add a line to
   `web/src/descriptions.ts` too.
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

`src/messages.ts` maps SHACL constraint components to sentences. Add a case
there, a test in `test/unit/messages.test.ts`, and a section in
`docs/error-reference.md` — the code is a documented interface.

Two rules for the wording:

- **No IRIs in the human layer.** A test enforces this. IRIs go in `technical`.
- **Say what would be right**, not only what is wrong. "must be one of: home,
  work, temp" beats "value not allowed".

## Releasing

1. Update the version in `package.json` and open a pull request.
2. Once merged, create a GitHub Release tagged `vX.Y.Z`.
3. `release.yml` checks the tag matches `package.json`, runs the src-only
   test suite, builds and publishes to npm with provenance. The web app is not
   built or shipped.

Publishing needs the `@socialcaredata` scope on npm and this repository allowed
to publish to it; prefer
[trusted publishing](https://docs.npmjs.com/trusted-publishers), which needs no
secret. GitHub Pages needs Settings → Pages → Source: **GitHub Actions**, once.

When the ontology repo cuts its first tag, change `DEFAULT_REF` in
`src/catalogue.ts` from `main` to that tag, run `npm run test:conformance`, and
release.
