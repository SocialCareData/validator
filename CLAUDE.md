# Social Care Data Validator

Validates social care records against the published Social Care MAIS SHACL
shapes. This repo is the GitHub Pages app plus the Social Care layer over
**[@theodi/data-standard-validator](https://github.com/theodi/data-standard-validator)**, the generic engine, which lives in
its own repository (locally `../data-standard-validator`). Nothing here is
published to npm.

```bash
npm test                # conformance, integrity, cross-checks - needs a network
npm run typecheck       # src/, test/, scripts/
npm run expectations    # regenerate examples/*/expectations.json - read the diff
npm run dev:web         # http://localhost:5173/validator/  (mind the base path)
npm run test:web        # real Chromium; `npx playwright install chromium` once
```

## Things you cannot infer from the code

**Engine changes belong in the library.** Wording, skolemization, context
handling, the report contract and the formatters are all in
`@theodi/data-standard-validator`. Here there are only four files in `src/`:
the catalogue, the cross-checks, the pattern names and `profile.ts`. If a
change to how issues read seems to need code here, it probably belongs
upstream as an option.

**Until the library is on npm, the dependency is `file:../data-standard-validator`.**
Rebuild the library (`npm run build` there) for changes to show up here. Once
0.1.0 is published, switch to `"^0.1.0"`, because CI cannot resolve a `file:`
link.

**Shapes are never vendored.** `src/catalogue.ts` holds URLs into
SocialCareData/ontology, which are fetched at run time. Never add a local copy
of a `.ttl` or a `context.jsonld`. The page must not be able to disagree with
the published standard. `DEFAULT_REF` is `main` until that repo cuts its first
tag.

**`src/catalogue.ts` must not import the engine.** The page's main thread
imports it for the profile picker, and pulling in the RDF stack would add
around 500 kB to that bundle. That is why cross-checks are named by string and
resolved in `profile.ts`.

**A profile's context always replaces the record's own `@context`.** The
examples name the ontology's released combined context by URL, and validating
against the profile context is what matches the shapes.

**`--profile` cannot be inferred.** `"@type": "Person"` maps to both
`person:subject-of-care` and `person:connected`, which hold it to deliberately
different standards.

**`sh:closed` is always false.** The upstream generator runs with `--non-closed`.

## The conformance suite

`examples/` holds 44 records, and they are the test suite: `valid-*` must
conform, `invalid-*` must not. Each folder has exactly two valid records:
`valid-<name>.jsonld` with only the required properties, and
`valid-<name>-full.jsonld` with every property the shape defines. Standards with
several record types (safeguarding, assessments-and-plans) hold one node per
type in a top-level `@graph`. `examples/<module>/expectations.json` also pins
the issue code and JSON path each invalid example should produce, so a
regression in wording fails the build.

The 34 invalid verdicts match a baseline captured from the original
`validate.js`, and the move to the generic library did not change any of them.
**If a change flips a verdict, that is a regression, not an improvement.** Find
out why before going further. The same applies to an engine upgrade.

## Conventions

An issue's `title` and `hint` are the human layer and must never contain a raw
IRI. A test enforces this. IRIs belong in `issue.technical`. Comments explain
why something is the way it is, not what the line does.
