# Examples

Worked records for every profile, moved here from
[SocialCareData/standard](https://github.com/SocialCareData/standard) when the
validator became its own project.

They serve three purposes: they show what a conforming record looks like, they are
the "load an example" fixtures in the web app, and they are this repository's
conformance suite.

The naming convention is load-bearing:

- **`valid-*.jsonld`** must conform.
- **`invalid-*.jsonld`** must not.

Each folder has exactly two valid records, and they are the ones the web app
offers under "Load an example":

- **`valid-<name>.jsonld`** carries only what the standard requires - the
  smallest record that conforms.
- **`valid-<name>-full.jsonld`** gives every property the shape defines at least
  one value.

Where a standard covers several record types (safeguarding, assessments and
plans), both files hold one node per type in a top-level `@graph`.

A JSON key the context does not define is silently dropped by JSON-LD, so a
misspelt property in a "full" example still conforms while testing nothing.
Check a new property actually reaches the RDF.

`expectations.json` in each folder pins the issue codes and JSON paths every
invalid example should produce, so a change that degrades a message fails the
build rather than passing quietly.

```bash
npm run test:conformance
```

Each file declares the ontology's released combined context,
`https://github.com/SocialCareData/ontology/releases/latest/download/context.jsonld`,
so it resolves for any JSON-LD processor. The validator itself never fetches a
document's context: it substitutes the profile's published context, the one
matching the shapes, and reports `substituted-context`.
