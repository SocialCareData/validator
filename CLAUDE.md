# @socialcaredata/validator

Validates social care records against the published Social Care MAIS SHACL
shapes. Ships as an npm package (library + `scd-validate` CLI) and a GitHub
Pages app.

```bash
npm test             # unit, conformance, integrity, structure - needs a network
npm run typecheck    # src/ only, which is what gets published
npm run dev:web      # http://localhost:5173/validator/  (mind the base path)
npm run test:web     # real Chromium; `npx playwright install chromium` once
```

## Things you cannot infer from the code

**Shapes are never vendored.** `src/shapes/catalogue.ts` holds URLs into
SocialCareData/ontology and fetches them at run time. Never add a local copy of a
`.ttl` or a `context.jsonld`: a release must not be able to disagree with the
published standard. `DEFAULT_REF` is `main` until that repo cuts its first tag.

**`src/` is the published package.** Anything existing only for the web page
belongs in `web/` — profile descriptions, for instance, live in
`web/src/descriptions.ts`. Only `src/cli.ts` may import `node:` builtins;
everything else has to run in a browser.

**Folders are layered `rdf/ <- document/ <- report/ <- shapes/`,** a DAG, with
`index.ts`/`cli.ts`/`validator.ts` above them. `test/architecture.test.ts`
enforces the layering, the absence of cycles and the `node:` rule.

**Skolemization is load-bearing.** `src/document/skolemize.ts` gives every
anonymous node a `urn:scd:node:N` identity before `jsonld.toRDF`, which is the
only reason a SHACL result can be reported as `address[0].postcode` instead of
`_:b3`. It is safe *because it adds no triples* — never make it add any. Guards:
`loadProfile` disables it if a shape wants `sh:nodeKind sh:BlankNode`, and tests
assert verdicts are identical with and without it and that no `urn:scd:node:`
ever reaches output.

**Generated shapes declare zero `sh:message`.** The strings a SHACL engine emits
("Less than 1 values") are its own defaults — do not parse them. Read the source
shape's `sh:description` and constraint parameters instead, via
`src/report/shape-facts.ts`.

**`sh:closed` is always false.** The upstream generator runs with `--non-closed`,
so `ClosedConstraintComponent` can never fire. Do not add handling for it.

**`--profile` cannot be inferred.** `"@type": "Person"` maps to both
`person:subject-of-care` and `person:connected`, which hold it to deliberately
different standards.

## The conformance suite

`examples/` holds 49 records moved here from SocialCareData/standard, and they
are the test suite: `valid-*` must conform, `invalid-*` must not.
`examples/<module>/expectations.json` additionally pins the issue code and JSON
path each invalid example should produce, so a regression in wording fails the
build.

Those 49 verdicts match a baseline captured from the original `validate.js`
before any of this was moved. **If a change flips one, that is a regression, not
an improvement** — find out why before going further.

## Conventions

An issue's `title` and `hint` are the human layer and must never contain a raw
IRI; a test enforces this. IRIs belong in `issue.technical`. Comments explain
why something is the way it is, not what the line does.
