# Social Care Data Validator

Check social care records against the published
[Social Care MAIS](https://standard.socialcaredata.io) SHACL shapes — in your
browser, in your terminal, or in CI.

**[Open the validator →](https://socialcaredata.github.io/validator/)** — paste a
record, pick a standard, see what needs fixing. Nothing leaves your browser.

```console
$ npx @socialcaredata/validator -p person:subject-of-care mydata.jsonld

Person - subject of care · ref main · 1 document(s)

mydata.jsonld -> fails
  in Address (address[0])
    x postcode is not in the expected format - you gave not a postcode
      at address[0].postcode  line 34
         34 |       "postcode": "not a postcode",
            |                   ^^^^^^^^^^^^^^^^
      It should be a UK postcode in upper case, with an optional space, for example `AB1 2CD`.
  i No @context in this document, so the selected profile's context was used

1 problem
  1 bad format
```

The point of this tool is that last part. A conformant SHACL engine will tell you
that `https://ontology.socialcaredata.io/postcode` failed
`sh:PatternConstraintComponent` at `_:b3`. That is true and nearly useless. This
one tells you which field, on which line, what it should look like, and gives you
an example.

## Install

```bash
npm install --global @socialcaredata/validator   # or use npx, as above
```

Node 22 or newer.

## Usage

```
scd-validate [files...] -p <profile> [--ref <ref>] [--json]
```

| Profile | Covers |
| --- | --- |
| `person:subject-of-care` | A person receiving care |
| `person:connected` | A relative, carer or contact |
| `placements` | Children's social care placements |
| `safeguarding` | Organisations, services, professionals, service episodes |
| `assessments-and-plans` | Care needs assessments and care plans |

With no files, or `-`, it reads stdin. Exit codes: `0` clean, `1` problems found,
`2` bad usage, `3` shapes could not be loaded. See [the CLI reference](docs/cli.md).

## Where the shapes come from

**Nothing is bundled.** The shapes and JSON-LD contexts are generated from the
LinkML schemas in
[SocialCareData/standard](https://github.com/SocialCareData/standard) and
published to [SocialCareData/ontology](https://github.com/SocialCareData/ontology);
this tool fetches them at run time. So you are always checking against the
published standard, never a stale copy baked into a release.

The revision is controlled by `--ref`, which defaults to `main`:

```bash
scd-validate -p placements --ref main       record.jsonld   # latest
scd-validate -p placements --ref v2026.1.0  record.jsonld   # pinned (once tagged)
```

## In CI

```yaml
- run: npx @socialcaredata/validator -p placements 'data/**/*.jsonld'
```

A non-zero exit fails the step; add `--json` for structured output.

## As a library

```ts
import { validate, renderPretty } from '@socialcaredata/validator'

const report = await validate(myRecord, 'person:subject-of-care')
console.log(renderPretty(report, { color: false }))
```

The package is isomorphic — nothing in it touches the filesystem — so the same
build runs in Node, in a bundler and in the browser. See [the API
reference](docs/api.md).

## Documentation

- [Getting started](docs/getting-started.md)
- [Command line reference](docs/cli.md)
- [Library API](docs/api.md)
- [Profiles and shapes](docs/profiles.md)
- [What each message means](docs/error-reference.md)
- [How it works](docs/how-it-works.md)
- [Limitations](docs/limitations.md)
- [Contributing](docs/contributing.md)

## Licence

MIT. The standards themselves are published under the
[Open Government Licence](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/).
