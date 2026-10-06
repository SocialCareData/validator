# Examples

Worked records for every standard, moved here from
[SocialCareData/standard](https://github.com/SocialCareData/standard) when the
validator became its own project.

They serve three purposes: they show what a conforming record looks like, they are
the "load an example" fixtures in the web app, and they are this repository's
conformance suite. The web app fetches them from `main` on GitHub, by the URLs
listed in `src/config.ts`, so a new or changed example reaches the page once
it is merged.

The naming convention is load-bearing:

- **`valid-*.jsonld`** must conform.
- **`invalid-*.jsonld`** must not.

Each folder has exactly two valid records, and they are the ones the web app
offers under "Load an example". `src/config.ts` lists them, and a test fails if
the list and the folder disagree:

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
so it resolves for any JSON-LD processor. The validator does not use it: it
substitutes the standard's published module context, the one matching the
shapes, and reports `substituted-context`. See `src/config.ts` for why.
