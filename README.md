# Social Care Data Validator

Check social care records against the published
[Social Care MAIS](https://standard.socialcaredata.io) SHACL shapes in your
browser.

**[Open the validator →](https://socialcaredata.github.io/validator/)** Paste a
record, pick a standard, and see what needs fixing. Nothing leaves your
browser.

The point of this tool is how it reports problems. A conformant SHACL engine
will tell you that `https://ontology.socialcaredata.io/postcode` failed
`sh:PatternConstraintComponent` at `_:b3`. That is true and nearly useless.
This tool tells you which field it is, on which line, and what it should look
like, with an example.

## What lives where

The validation engine is
**[@theodi/data-standard-validator](https://github.com/theodi/data-standard-validator)**. It is a generic SHACL validator for
JSON and JSON-LD, with a CLI (`dsv`) and a library that runs in Node and the
browser. This repository is the Social Care layer on top of it:

| Path | What it holds |
| --- | --- |
| `src/catalogue.ts` | The five profiles, and the shape and context URLs each one loads |
| `src/cross-checks.ts` | Rules across a set of records, such as duplicate `childId` |
| `src/patterns.ts` | Plain-English names for the regexes the shapes use, such as UK postcode |
| `src/profile.ts` | A profile turned into a ready validator |
| `web/` | The GitHub Pages app |
| `examples/` | The conformance suite: 44 records that must pass or fail |

Nothing here is published to npm.

## Profiles

| Profile | Covers |
| --- | --- |
| `person:subject-of-care` | A person receiving care |
| `person:connected` | A relative, carer or contact |
| `placements` | Children's social care placements |
| `safeguarding` | Organisations, services, professionals, service episodes |
| `assessments-and-plans` | Care needs assessments and care plans |

See [profiles and shapes](docs/profiles.md).

## On the command line or in CI

Use the generic CLI with a profile's published shape and context:

```bash
ONT=https://raw.githubusercontent.com/SocialCareData/ontology/main
npx @theodi/data-standard-validator \
  -s $ONT/person/person-subject-of-care-shape.ttl \
  -c $ONT/person/context.jsonld \
  mydata.jsonld
```

[Getting started](docs/getting-started.md) lists the URLs for every profile.
The [`dsv` reference](https://github.com/theodi/data-standard-validator/blob/main/docs/cli.md) covers formats, exit codes and
CI recipes.

## Where the shapes come from

**Nothing is bundled.** The shapes and JSON-LD contexts are generated from the
LinkML schemas in
[SocialCareData/standard](https://github.com/SocialCareData/standard) and
published to [SocialCareData/ontology](https://github.com/SocialCareData/ontology).
They are fetched at run time, so you are always checking against the published
standard and never against a stale copy.

## Documentation

- [Getting started](docs/getting-started.md)
- [Profiles and shapes](docs/profiles.md)
- [Limitations](docs/limitations.md)
- [Contributing](docs/contributing.md)
- Engine: [issue codes](https://github.com/theodi/data-standard-validator/blob/main/docs/error-reference.md),
  [how it works](https://github.com/theodi/data-standard-validator/blob/main/docs/how-it-works.md),
  [library API](https://github.com/theodi/data-standard-validator/blob/main/docs/api.md)

## Licence

MIT. The standards themselves are published under the
[Open Government Licence](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/).
