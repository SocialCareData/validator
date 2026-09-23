# Contributing

```bash
npm install
npm run typecheck           # src only - what gets published
npm test                    # unit, conformance, integrity, cross-record, structure
```

Tests fetch real shapes from the ontology repository, so they need a network.

## Running the web app locally

```bash
npm run dev:web
```

Then open **<http://localhost:5173/validator/>**. Mind the `/validator/` — the
app is built with that base path because it is served from
`socialcaredata.github.io/validator/`, and the bare `/` just redirects there.

Vite reloads on save, and that includes `src/`: the page imports the library
source directly rather than the built `dist/`, so a change to a message or a
shape-fact is on screen as soon as you save it. No `npm run build` in the loop.

To check the real production bundle - the thing GitHub Pages actually serves:

```bash
npm run build:web
npm run preview             # http://localhost:4173/validator/
```

Worth doing before touching anything in the worker: the dev server and the
production bundle resolve dependencies differently, and the browser-only
failures this project has hit (`window is not defined` inside the worker) showed
up in bundling, not in source.

The page fetches shapes from `raw.githubusercontent.com` at run time, so it needs
a network. If validation fails with a fetch error, check the ref in **Advanced**.

## Testing the web app

```bash
npx playwright install chromium    # once
npm run test:web
```

Six tests drive a real Chromium against a real dev server: every profile is
listed, a bad postcode reports the field name and line number, a valid record
passes, a controlled vocabulary renders its permitted values, malformed JSON is
explained rather than swallowed, and the browser console stays clean throughout.

That last one is not padding. It is what caught `window is not defined` - the
worker died on load, and every other assertion had simply timed out without
saying why.

To watch it happen rather than read a stack trace:

```bash
HEADED=1 npm run test:web              # opens a real window
HEADED=1 SLOWMO=250 npm run test:web   # slowly enough to follow
npx vitest run test/web.test.ts --reporter verbose
```

`npm run typecheck:web` typechecks the app. It is deliberately separate from
`npm run typecheck`, which covers only `src/` - what gets published.

## Layout

```
src/        the published package - the library and the CLI
web/        the GitHub Pages app - never published to npm
examples/   the conformance fixtures
```

`src/` is laid out as the path a record takes through the tool:

```
src/
  index.ts            the public API
  cli.ts              the command line
  validator.ts        the pipeline that ties the four stages together

  shapes/             1. where the shapes come from
    catalogue.ts        which profiles exist, and which files each one loads
    fetch.ts            fetching a text file over HTTPS
    profile.ts          a profile, loaded and ready to validate against

  document/           2. the user's JSON, on its way to RDF - and back
    skolemize.ts        naming anonymous nodes; locating pointers in the source
    context.ts          reading a JSON-LD context backwards
    jsonld.ts           choosing a context, and converting to RDF

  rdf/                3. the RDF layer
    parse.ts            Turtle and N-Quads into a dataset
    shacl.ts            the engine, and the guard skolemization depends on
    cross-checks.ts     constraints that span a whole set of records

  report/             4. results, in English
    types.ts            the report contract
    shape-facts.ts      reading constraints back off the shape that raised them
    messages.ts         a constraint, as a sentence
    build.ts            SHACL results -> issues, and grouping them
    pretty.ts           terminal output

  types/vendor.d.ts   ambient declarations for the untyped RDF stack
```

That reading order is the pipeline, not the dependency order. Imports form a DAG
with no cycles, and it runs the other way: `rdf/` depends on nothing else here,
`document/` builds on `rdf/`, `report/` builds on both, and `shapes/` uses all
three to assemble a profile. `validator.ts` is the only module that reaches into
every folder. `test/architecture.test.ts` checks this, so a new import that
breaks it fails the build rather than quietly eroding the structure.

**Two rules about the split.** `src/` is what gets published, so nothing that
exists only for the web page belongs there — the profile descriptions in the
`<select>`, for instance, live in `web/src/descriptions.ts`. And only `cli.ts`
may import `node:` builtins; everything else has to run in a browser.

## Adding a profile

1. Add an entry to `src/shapes/catalogue.ts` — shape files, context, and any
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

`src/report/messages.ts` maps SHACL constraint components to sentences. Add a case
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
`src/shapes/catalogue.ts` from `main` to that tag, run `npm run test:conformance`, and
release.
