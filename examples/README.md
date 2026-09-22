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

`expectations.json` in each folder pins the issue codes and JSON paths every
invalid example should produce, so a change that degrades a message fails the
build rather than passing quietly.

```bash
npm run test:conformance
# or, with the CLI:
scd-validate -p placements --expect auto examples/placements/*.jsonld
```

Each file declares a relative `@context` inherited from its original home. That
path no longer resolves and is not meant to — the validator substitutes the
profile's published context, which is the same behaviour anyone gets when
validating a file that references a context we do not have.
