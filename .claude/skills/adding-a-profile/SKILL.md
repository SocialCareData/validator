---
name: adding-a-profile
description: Add a standard to the validator's catalogue, or change which SHACL shapes an existing profile loads. Use when wiring up a shape published to SocialCareData/ontology, adding its examples, or when a profile needs a second shape file merged in.
---

# Adding a profile

A profile pairs one or more SHACL shapes with the JSON-LD context that names
their fields, plus any checks spanning a whole record set.

## 1. Confirm the files are published

Shapes are fetched, never vendored. Before writing anything, check the files
exist at the ref you intend to use:

```bash
curl -sI https://raw.githubusercontent.com/SocialCareData/ontology/main/<module>/<file>.ttl | head -1
curl -sI https://raw.githubusercontent.com/SocialCareData/ontology/main/<module>/context.jsonld | head -1
```

A shape that is not published yet goes in with `optional: true` and a `provides:`
line saying what is lost — a 404 then degrades to a visible warning instead of
failing the run. The placements rules shape is the worked example.

## 2. Add the catalogue entry

`src/catalogue.ts`. Shapes merge into one dataset in the order listed.

```ts
{
  id: 'safeguarding',
  label: 'Safeguarding',
  shapes: [{ file: 'safeguarding/safeguarding-standard-shape.ttl' }],
  context: 'safeguarding/context.jsonld',
  crossChecks: [],
  examples: 'examples/safeguarding',
}
```

`crossChecks` names entries in `CROSS_CHECKS` (`src/cross-checks.ts`). Use it
only for constraints SHACL Core genuinely cannot express, which means those
spanning several records. They are names, not imports, because the catalogue
must stay free of the RDF stack (see CLAUDE.md).

If the new shapes use an `sh:pattern` that reads badly as its description,
add a `PatternHint` to `src/patterns.ts`.

## 3. Add examples

`examples/<name>/`, named `valid-*.jsonld` and `invalid-*.jsonld`. The
conformance suite discovers the folder automatically; `valid-*` must conform and
`invalid-*` must not.

Write exactly two valid examples: `valid-<name>.jsonld` with only the required
properties, and `valid-<name>-full.jsonld` giving every shape property a value.
If the standard has several record types, put one node per type in a top-level
`@graph`. Keys the context does not define are dropped without a word, so
confirm every property of the full example reaches the RDF.

Give each invalid example exactly one defect where you can, named after it
(`invalid-bad-postcode.jsonld`). Examples that fail for several unrelated
reasons still pass the suite but stop documenting anything.

A relative `@context` is fine and does not need rewriting. The profile's
published context always replaces it, and the report says so.

## 4. Pin the expectations

```bash
npm run expectations
git diff examples/
```

This records current behaviour, bugs included. **Read the diff.** Each invalid
example should show the code and path its filename promises; anything reported
as `other` means the constraint has no plain-English wording yet — see the
`validation-messages` skill.

## 5. Web picker

If it should appear in the browser app, add a one-sentence entry to
`web/src/descriptions.ts`. It lives there rather than in the catalogue because
a `<select>` blurb is page copy, not data about the standard.

## 6. Verify

```bash
npm test                   # conformance picks the new folder up automatically
npm run test:web           # the picker lists it
```
