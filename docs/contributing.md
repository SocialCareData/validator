# Contributing

```bash
npm install
npm run typecheck           # src/, test/ and scripts/
npm test                    # conformance, integrity, config
```

Tests fetch real shapes from the ontology repository, so they need a network.

The validation engine is [@theodi/data-standard-validator](https://github.com/theodi/data-standard-validator), in its own
repository. Wording, skolemization, the report format and the formatters are
changed there. This repo holds the validator UI as a generic component, the
Social Care configuration and page around it, and the conformance suite that
keeps the engine honest against real standards.

## Running the web app locally

```bash
npm run dev
```

Then open **<http://localhost:5173/validator/>**. Mind the `/validator/` — the
app is built with that base path because it is served from
`socialcaredata.github.io/validator/`, and the bare `/` just redirects there.

Vite reloads on save, including changes to `src/`. To try an engine change on
the page before it is released, link a local checkout of the library:
`npm install ../data-standard-validator`, then rebuild the library
(`npm run build` there) after each change.

To check the real production bundle - the thing GitHub Pages actually serves:

```bash
npm run build
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

Seven tests drive a real Chromium against the production build: every standard is
listed, a configured example loads and passes, a bad postcode reports the field name and line number, a valid record
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

`npm run typecheck` checks the app, the tests and the scripts together.

## Layout

```
index.html      the Social Care header and footer, around a mount point
public/         static files copied as-is into the build
src/
  config.ts       the Social Care standards: shape, context and example URLs,
                  descriptions, and plain-English names for the regexes
  main.ts         mounts the component with src/config.ts
  site.css        the header and footer
  component/      the validator UI, with nothing specific to Social Care
    config.ts       the config's types, and how its URLs become fetchable
    engine.ts       a configured standard, loaded into a ready validator (memoised)
    mount.ts        the toolbar, editor and results, wired together
    report.ts       a report, as DOM
    worker.ts       where validation runs
examples/       the conformance suite
scripts/        update-expectations.ts
test/           conformance, integrity, config, context fallback, web
```

`src/component/` imports nothing from outside itself except the engine, so
it can move into its own package unchanged. Keep it that way: anything
specific to a standard belongs in the config.

`src/config.ts` and `component/config.ts` import nothing from the engine but
types. The page's main thread imports them to fill the pickers, and keeping the
RDF stack out of them keeps that bundle small. The validator itself only ever
loads in the worker.

## Adding a standard

1. Put examples under `examples/<name>/`: `valid-<name>.jsonld` with only the
   required properties, `valid-<name>-full.jsonld` with all of them, and one
   `invalid-*.jsonld` per defect. See [examples/README.md](../examples/README.md).
2. Add an entry to `src/config.ts`: a name, a one-line description, the shape
   and context URLs, and the two `valid-*` example URLs.
3. Run `npm test`. The suite finds the folder from the example URLs, and fails
   if the listed examples and the folder's `valid-*` files disagree.
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

Generate them with `npm run expectations`, then review them by hand. A generated expectation that
nobody has read is just a record of current behaviour, including its bugs.

## Adding a plain-English message

Messages are built by the engine, in
[`src/report/messages.ts`](https://github.com/theodi/data-standard-validator/blob/main/src/report/messages.ts) of the library
repository. Change them there, with a test and an entry in its
`docs/error-reference.md`.

The one thing that stays here is `patterns` in `src/config.ts`. It holds names for the
regexes the Social Care shapes use, such as "a UK postcode in upper case, with
an optional space". Add an entry when a new `sh:pattern` reads badly.

After any wording change, run `npm run expectations && git diff examples/`.
The pinned codes and paths should not move.

## Deploying

Nothing here is published to npm. `pages.yml` builds the app into `dist/` and deploys
it to GitHub Pages on every push to `main` that touches the app (`src/`,
`public/`, `index.html`) or the examples. It needs Settings → Pages → Source: **GitHub Actions**, once.

To pick up a new engine release, bump `@theodi/data-standard-validator` in
`package.json`. Then run `npm test` and `npm run test:web`. A flipped verdict
in the conformance suite is a regression in the engine, not an improvement.

To pin the page to an ontology tag, set `ref` in `src/config.ts` (or change
`main` in its URLs), and run `npm test`.
