# Contributing

```bash
npm install
npm run typecheck           # src/ and test/
npm test                    # the config against the ontology's examples
```

The tests read the example records from a local checkout of
[SocialCareData/ontology](https://github.com/SocialCareData/ontology): clone it
next to this repository (`../ontology`), or point `ONTOLOGY_DIR` at one.
Keep it on `main`, the ref the page fetches examples from.

The UI is [@theodi/data-standard-validator-component](https://github.com/theodi/data-standard-validator-component),
and the validation engine is [@theodi/data-standard-validator](https://github.com/theodi/data-standard-validator).
Each is in its own repository. Changes to the toolbar, editor, results or
styles go in the component. Changes to wording, skolemization, the report
format and the formatters go in the engine. This repo holds the Social Care
configuration and the page around the element. The examples, and the
violations each invalid one must produce, are checked in
[SocialCareData/ontology](https://github.com/SocialCareData/ontology/blob/main/examples/README.md).

## Running the web app locally

```bash
npm run dev
```

Then open **<http://localhost:5173/validator/>**. Mind the `/validator/` — the
app is built with that base path because it is served from
`socialcaredata.github.io/validator/`, and the bare `/` just redirects there.

Vite reloads on save, including changes to `src/`. To try an unpushed
component change on the page, install a local checkout, and repeat after each
change:

```bash
npm install --install-links ../data-standard-validator-component
```

`--install-links` copies the package instead of symlinking it. Vite's dev
server will not serve the component's worker from outside this repo. Put
`package.json` back to the `github:` dependency before committing.

To check the real production bundle - the thing GitHub Pages actually serves:

```bash
npm run build
npm run preview             # http://localhost:4173/validator/
```

Worth doing after a component or engine upgrade: the dev server and the
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

`npm run typecheck` checks the app and the tests together.

## Layout

```
index.html      the Social Care header and footer, around <data-standard-validator>
public/         static files copied as-is into the build
src/
  config.ts       the Social Care standards: shape, context and example URLs,
                  descriptions, and plain-English names for the regexes
  main.ts         gives the element src/config.ts
  site.css        the header and footer
test/           config, web
```

`src/config.ts` imports nothing but types, from the component's `/config`
entry point. The page's main thread imports it, and keeping the RDF stack out
keeps that bundle small. The validator itself only ever loads in the element's
worker.

## Adding a standard

1. Put examples under `examples/<name>/` in
   [SocialCareData/ontology](https://github.com/SocialCareData/ontology):
   `valid-<name>.jsonld` with only the required properties,
   `valid-<name>-full.jsonld` with all of them, and one `invalid-*.jsonld` per
   defect. See its [examples/README.md](https://github.com/SocialCareData/ontology/blob/main/examples/README.md).
2. Add an entry to `src/config.ts`: a name, a one-line description, the shape
   and context URLs, and the two `valid-*` example URLs.
3. Run `npm test`. It finds the folder from the example URLs, and fails
   if the listed examples and the folder's `valid-*` files disagree.
4. Update the expected number of standards in `test/web.test.ts`, and run
   `npm run test:web`.

## Adding a plain-English message

Messages are built by the engine, in
[`src/report/messages.ts`](https://github.com/theodi/data-standard-validator/blob/main/src/report/messages.ts) of the library
repository. Change them there, with a test and an entry in its
`docs/error-reference.md`.

The one thing that stays here is `patterns` in `src/config.ts`. It holds names for the
regexes the Social Care shapes use, such as "a UK postcode in upper case, with
an optional space". Add an entry when a new `sh:pattern` reads badly.

After any wording change, run `npm run dev` and load the invalid examples to
read the result as a user would.

## Deploying

Nothing here is published to npm. `pages.yml` builds the app into `dist/` and deploys
it to GitHub Pages on every push to `main` that touches the app (`src/`,
`public/`, `index.html`). Examples are fetched from the ontology repository
at run time, so a change there needs no redeploy. It needs Settings → Pages → Source: **GitHub Actions**, once.

Both packages are git dependencies on `main`, pinned to a commit by
`package-lock.json`. To pick up newer ones, run
`npm update @theodi/data-standard-validator-component @theodi/data-standard-validator`,
then `npm test` and `npm run test:web`.

To pin the page to an ontology tag, set `ref` in `src/config.ts` (or change
`main` in its URLs), and run `npm test`.
