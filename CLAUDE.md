# Social Care Data Validator

Validates social care records against the published Social Care MAIS SHACL
shapes. This repo is the GitHub Pages app: the Social Care config
(`src/config.ts`) and the page around the `<data-standard-validator>` element.
The UI is
**[@theodi/data-standard-validator-component](https://github.com/theodi/data-standard-validator-component)**
(locally `../data-standard-validator-component`), and the engine underneath it
is **[@theodi/data-standard-validator](https://github.com/theodi/data-standard-validator)**
(locally `../data-standard-validator`). Both live in their own repositories.
Nothing here is published to npm.

```bash
npm test                # config against the examples - needs the ontology checkout
npm run typecheck       # src/ and test/
npm run dev             # http://localhost:5173/validator/  (mind the base path)
npm run test:web        # real Chromium; `npx playwright install chromium` once
```

## Things you cannot infer from the code

**Engine changes belong in the library.** Wording, skolemization, context
handling, the report contract and the formatters are all in
`@theodi/data-standard-validator`. If a change to how issues read seems to
need code here, it probably belongs upstream as an option.

**UI changes belong in the component.** The toolbar, editor, results, worker,
styles and theme tokens all live in `@theodi/data-standard-validator-component`,
which holds nothing specific to Social Care. Here there is only `src/config.ts`,
`src/main.ts`, `src/site.css` and `index.html`. Restyle the element through
`--dsv-*` custom properties, not by reaching into its shadow root.

**Both packages are git dependencies** (`github:theodi/<repo>#main`), built
on install by their `prepare` scripts; the lockfile pins the commit, so run
`npm update <name>` to pick up a newer one. To try an unpushed component
change, `npm install --install-links ../data-standard-validator-component`
(a plain `file:` symlink sits outside Vite's root and the dev server will not
serve its worker). Never commit a `file:` dependency: CI cannot resolve it.

**`vite.config.ts` excludes the component from pre-bundling and re-includes
the engine.** Pre-bundling breaks the component's `new URL('./worker.js', ...)`
in dev, and the engine's CommonJS dependencies need pre-bundling.

**Shapes are never vendored.** `src/config.ts` holds GitHub URLs into
SocialCareData/ontology, which are fetched at run time from
`raw.githubusercontent.com` (the only GitHub host that sends CORS headers).
Never add a local copy of a `.ttl` or a `context.jsonld`. The page must not be
able to disagree with the published standard. The URLs say `blob/main`; the
page's ref box replaces that ref in every shape and context URL.

**`src/config.ts` imports only types, from `@theodi/data-standard-validator-component/config`.**
The page's main thread imports it, and pulling in the RDF stack would add
around 500 kB to that bundle. The engine loads only in the element's worker;
tests load it the same way through `.../engine`.

**A configured context replaces the record's own `@context`; without one, the
record's own is used.** Every Social Care standard configures its module
context, because the examples' released combined context defines `outcome`
twice (safeguarding vs assessments-and-plans; the later wins and fails
valid-safeguarding-full) and browsers cannot fetch GitHub release assets. Do
not drop them until the ontology fixes both.

**The standard cannot be inferred from the record.** `"@type": "Person"` maps
to both Person standards, which hold it to deliberately different rules.

**`sh:closed` is always false.** The upstream generator runs with `--non-closed`.

## The examples

The records live in `examples/` of
[SocialCareData/ontology](https://github.com/SocialCareData/ontology), not
here, and are checked there: `valid-*` must conform, `invalid-*` must not, and
each folder's `expectations.json` pins the violations every invalid record must
produce (pySHACL, `.github/scripts/validate_examples.py`). Each folder has
exactly two valid records, `valid-<name>.jsonld` with only the required
properties and `valid-<name>-full.jsonld` with every property the shape
defines. `src/config.ts` lists those two per standard (the page fetches them
from the ontology's `main`, whatever the ref box says). The tests here read a
local checkout (`ONTOLOGY_DIR`, or `../ontology` beside this repo; CI checks
out `main`), find each folder from those URLs, and fail if list and folder
disagree. `test/web.test.ts` also loads a few of the records.

The ontology repo is otherwise generated: `SocialCareData/standard`'s sync
`rsync --delete`s over it, excluding `/examples/` and `/.github/`. Keep those
exclusions.

## Conventions

An issue's `title` and `hint` are the human layer and must never contain a raw
IRI (the web test checks a few). IRIs belong in `issue.technical`. Comments
explain why something is the way it is, not what the line does.
