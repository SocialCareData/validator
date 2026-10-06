# Social Care Data Validator

Validates social care records against the published Social Care MAIS SHACL
shapes. This repo is the GitHub Pages app: a generic validator UI component
(`src/component/`), the Social Care config it is mounted with
(`src/config.ts`), and the page around it. The engine is
**[@theodi/data-standard-validator](https://github.com/theodi/data-standard-validator)**, which lives in
its own repository (locally `../data-standard-validator`). Nothing here is
published to npm.

```bash
npm test                # conformance, integrity, config - needs a network and the ontology checkout
npm run typecheck       # src/, test/, scripts/ - the app included
npm run expectations    # regenerate test/expectations/*.json - read the diff
npm run dev             # http://localhost:5173/validator/  (mind the base path)
npm run test:web        # real Chromium; `npx playwright install chromium` once
```

## Things you cannot infer from the code

**Engine changes belong in the library.** Wording, skolemization, context
handling, the report contract and the formatters are all in
`@theodi/data-standard-validator`. Here the only Social Care code is
`src/config.ts`; the rest of `src/` is the UI component and the page. If a
change to how issues read seems to need code here, it probably belongs
upstream as an option.

**`src/component/` is domain-free.** It is being prepared to move into its
own package, so it imports nothing outside itself except the engine, and holds
nothing specific to Social Care: no names, URLs, copy or storage keys.
Anything about a particular standard goes in the config.

**Until the library is on npm, the dependency is `file:../data-standard-validator`.**
Rebuild the library (`npm run build` there) for changes to show up here. Once
0.1.0 is published, switch to `"^0.1.0"`, because CI cannot resolve a `file:`
link.

**Shapes are never vendored.** `src/config.ts` holds GitHub URLs into
SocialCareData/ontology, which are fetched at run time from
`raw.githubusercontent.com` (the only GitHub host that sends CORS headers).
Never add a local copy of a `.ttl` or a `context.jsonld`. The page must not be
able to disagree with the published standard. The URLs say `blob/main`; the
page's ref box replaces that ref in every shape and context URL.

**`src/config.ts` and `component/config.ts` take only types from the engine.**
The page's main thread imports them for the pickers, and pulling in the RDF
stack would add around 500 kB to that bundle. The engine loads in the worker,
through `component/engine.ts`.

**A configured context replaces the record's own `@context`; without one, the
record's own is used.** Every Social Care standard configures its module
context, because the examples' released combined context defines `outcome`
twice (safeguarding vs assessments-and-plans; the later wins and fails
valid-safeguarding-full) and browsers cannot fetch GitHub release assets. Do
not drop them until the ontology fixes both.

**The standard cannot be inferred from the record.** `"@type": "Person"` maps
to both Person standards, which hold it to deliberately different rules.

**`sh:closed` is always false.** The upstream generator runs with `--non-closed`.

## The conformance suite

The records live in `examples/` of
[SocialCareData/ontology](https://github.com/SocialCareData/ontology), not
here. The tests read a local checkout: `ONTOLOGY_DIR`, or `../ontology` beside
this repo (CI checks out `main`). Its 40 records are the test suite: `valid-*`
must conform, `invalid-*` must not. Each folder has exactly two valid records:
`valid-<name>.jsonld` with only the required properties, and
`valid-<name>-full.jsonld` with every property the shape defines. Standards with
several record types (safeguarding, assessments-and-plans) hold one node per
type in a top-level `@graph`. `src/config.ts` lists the two valid ones per
standard (the page fetches them from the ontology's `main`, whatever the ref
box says), and the tests find each folder from those URLs and fail if list and
folder disagree. `test/expectations/<module>.json` also pins the issue code and
JSON path each invalid example should produce, so a regression in wording fails
the build. They stay here because they pin this validator's wording.

The ontology repo is otherwise generated: `SocialCareData/standard`'s sync
`rsync --delete`s over it, excluding `/examples/`. Keep that exclusion.

The 34 invalid verdicts match a baseline captured from the original
`validate.js`, and the move to the generic library did not change any of them.
**If a change flips a verdict, that is a regression, not an improvement.** Find
out why before going further. The same applies to an engine upgrade.

## Conventions

An issue's `title` and `hint` are the human layer and must never contain a raw
IRI. A test enforces this. IRIs belong in `issue.technical`. Comments explain
why something is the way it is, not what the line does.
