---
name: adding-a-standard
description: Add a standard to the validator's config, or change which SHACL shapes an existing standard loads. Use when wiring up a shape published to SocialCareData/ontology, adding its examples, or when a standard needs a second shape file merged in.
---

# Adding a standard

A standard pairs one or more SHACL shapes with the JSON-LD context that names
their fields, and offers two example records on the page. All of it is one
entry in `src/config.ts`; the `<data-standard-validator>` element does not change.

## 1. Confirm the files are published

Shapes are fetched, never vendored. Before writing anything, check the files
exist at the ref you intend to use:

```bash
curl -sI https://raw.githubusercontent.com/SocialCareData/ontology/main/<module>/<file>.ttl | head -1
curl -sI https://raw.githubusercontent.com/SocialCareData/ontology/main/<module>/context.jsonld | head -1
```

Every configured shape is required: a 404 fails the run. Do not add a shape
that is not published yet.

## 2. Add examples

`examples/<name>/` in SocialCareData/ontology (a checkout at `ONTOLOGY_DIR`,
or `../ontology`), named `valid-*.jsonld` and `invalid-*.jsonld`. `valid-*`
must conform and `invalid-*` must not; the ontology's *Validate examples*
workflow checks this.

Write exactly two valid examples: `valid-<name>.jsonld` with only the required
properties, and `valid-<name>-full.jsonld` giving every shape property a value.
If the standard has several record types, put one node per type in a top-level
`@graph`. Keys the context does not define are dropped without a word, so
confirm every property of the full example reaches the RDF.

Give each invalid example exactly one defect where you can, named after it
(`invalid-bad-postcode.jsonld`). Examples that fail for several unrelated
reasons still pass the check but stop documenting anything.

Declare the same `@context` as the other examples. The configured context
replaces it, and the report says so.

## 3. Add the config entry

`src/config.ts`. Shapes merge into one dataset in the order listed. URLs are
GitHub page links; the page turns them into raw links and swaps in the ref
from **Advanced**.

```ts
{
  name: 'Safeguarding',
  description: 'Organisations, services, professionals and service episodes involved in safeguarding.',
  shapes: `${ONTOLOGY}/safeguarding/safeguarding-standard-shape.ttl`,
  context: `${ONTOLOGY}/safeguarding/context.jsonld`,
  examples: [
    `${EXAMPLES}/safeguarding/valid-safeguarding.jsonld`,
    `${EXAMPLES}/safeguarding/valid-safeguarding-full.jsonld`,
  ],
}
```

Keep `context`. Without it the page falls back to each record's own
`@context`, and the one the examples declare cannot be used yet (see the
comment in `src/config.ts`).

The test suite finds the examples folder from the first example URL, and fails
if the listed examples and the folder's `valid-*` files disagree. The page
fetches the examples from the ontology's `main` on GitHub, so they appear there
once merged into that repository.

If the new shapes use an `sh:pattern` that reads badly as its description,
add a `PatternHint` to `patterns` in the same file.

## 4. Pin the expectations in the ontology

In the ontology checkout:

```bash
python .github/scripts/validate_examples.py --update
git diff examples/
```

This writes `examples/<name>/expectations.json`, the violations each invalid
example produces (focus type, property, SHACL constraint). It records current
behaviour, bugs included. **Read the diff.** Each invalid example should show
the defect its filename promises and nothing else.

## 5. Verify here

```bash
npm test                   # the config test picks the new folder up
npm run test:web           # update the expected number of standards there
```
