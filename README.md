# Social Care Data Validator

Check social care records against the published
[Social Care MAIS](https://standard.socialcaredata.io) SHACL shapes in your
browser.

**[Open the validator →](https://socialcaredata.github.io/validator/)** Paste a
record, pick a standard, and see what needs fixing.

## What lives where

This repository is the web application only. The UI is the generic
**[`<data-standard-validator-component>`](https://github.com/theodi/data-standard-validator-component)**
web component, and validation itself is done by
**[@theodi/data-standard-validator](https://github.com/theodi/data-standard-validator)**,
a generic SHACL validator for JSON and JSON-LD. To validate from the command
line or in a pipeline, use that package directly; its documentation covers it.

This repository holds:

| Path | What it holds |
| --- | --- |
| `src/config.ts` | The five standards: their shape, context and example URLs, plus plain-English names for the regexes the shapes use |
| `index.html`, `src/main.ts`, `src/site.css` | The GitHub Pages app: the Social Care header and footer around the `<data-standard-validator>` element, configured with `src/config.ts` |
| `test/` | Checks that the config offers each folder's valid examples in [SocialCareData/ontology](https://github.com/SocialCareData/ontology/tree/main/examples), and a browser test of the built page. The examples themselves, and the violations each invalid one must produce, are checked in that repository |

Nothing here is published to npm.

## Standards

| Standard | Covers |
| --- | --- |
| Person - subject of care | A person receiving care |
| Person - connected person | A relative, carer or contact |
| Children's Social Care Placements | Children's social care placements |
| Safeguarding | Organisations, services, professionals, service episodes |
| Care Needs Assessments and Care Plans | Care needs assessments and care plans |

See [standards and shapes](docs/standards.md).

## Documentation

- [Getting started](docs/getting-started.md)
- [Standards and shapes](docs/standards.md)
- [Limitations](docs/limitations.md)
- [Contributing](docs/contributing.md)
- [What the messages mean](https://github.com/theodi/data-standard-validator/blob/main/docs/error-reference.md)
  (in the engine's documentation)

## Licence

MIT. The standards themselves are published under the
[Open Government Licence](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/).
