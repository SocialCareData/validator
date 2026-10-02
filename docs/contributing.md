# Contributing

```bash
npm install
npm run typecheck           # src/, test/ and scripts/
npm test                    # conformance, integrity, cross-record
```

Tests fetch real shapes from the ontology repository, so they need a network.

The validation engine is [@theodi/data-standard-validator](https://github.com/theodi/data-standard-validator), in its own
repository. Wording, skolemization, the report format and the formatters are
changed there. This repo holds what is specific to Social Care, plus the
conformance suite that keeps the engine honest against real standards.

## Running the web app locally

```bash
npm run dev:web
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

`npm run typecheck:web` typechecks the app, and `npm run typecheck` checks
everything else.

## Layout

```
src/            the Social Care layer, shared by the page and the tests
  catalogue.ts    which profiles exist, and which files each one loads
  cross-checks.ts constraints that span a whole set of records
  patterns.ts     plain-English names for the regexes the shapes use
  profile.ts      a profile, loaded into a ready validator (memoised)
web/            the GitHub Pages app
examples/       the conformance suite
scripts/        update-expectations.ts
test/           conformance, integrity, cross-checks, web
```

`src/catalogue.ts` deliberately imports nothing from the engine. The page's
main thread imports it to fill the profile picker, and keeping the RDF stack
out of it keeps that bundle small. The validator itself only ever loads in the
worker. Profile descriptions for the `<select>` live in
`web/src/descriptions.ts`.

## Adding a profile

1. Add an entry to `src/catalogue.ts`: shape files, context, and any
   cross-record checks (by name, from `src/cross-checks.ts`). If it should appear in the web picker, add a line to
   `web/src/descriptions.ts` too.
2. Put examples under `examples/<name>/`: `valid-<name>.jsonld` with only the
   required properties, `valid-<name>-full.jsonld` with all of them, and one
   `invalid-*.jsonld` per defect. See [examples/README.md](../examples/README.md).
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

Generate them with `npm run expectations`, then review them by hand. A generated expectation that
nobody has read is just a record of current behaviour, including its bugs.

## Adding a plain-English message

Messages are built by the engine, in
[`src/report/messages.ts`](https://github.com/theodi/data-standard-validator/blob/main/src/report/messages.ts) of the library
repository. Change them there, with a test and an entry in its
`docs/error-reference.md`.

The one thing that stays here is `src/patterns.ts`. It holds names for the
regexes the Social Care shapes use, such as "a UK postcode in upper case, with
an optional space". Add an entry when a new `sh:pattern` reads badly.

After any wording change, run `npm run expectations && git diff examples/`.
The pinned codes and paths should not move.

## Deploying

Nothing here is published to npm. `pages.yml` builds `web/` and deploys it to
GitHub Pages on every push to `main` that touches the app, `src/` or the
examples. It needs Settings → Pages → Source: **GitHub Actions**, once.

To pick up a new engine release, bump `@theodi/data-standard-validator` in
`package.json`. Then run `npm test` and `npm run test:web`. A flipped verdict
in the conformance suite is a regression in the engine, not an improvement.

When the ontology repo cuts its first tag, change `DEFAULT_REF` in
`src/catalogue.ts` from `main` to that tag, and run `npm run test:conformance`.
