# Command line reference

```
scd-validate [files...] -p <profile> [--ref <ref>] [--json]
```

With no files, or with `-`, input is read from stdin.

| Option | Default | What it does |
| --- | --- | --- |
| `-p, --profile <id>` | — | Standard to validate against. Required |
| `-r, --ref <ref>` | `main` | Tag, branch or commit in the ontology repo |
| `--json` | off | Machine-readable output instead of the report |
| `-V, --version` | | Print the version |
| `-h, --help` | | Print help, including the list of profiles |

## Profiles

| Profile | Covers |
| --- | --- |
| `person:subject-of-care` | A person receiving care |
| `person:connected` | A relative, carer or contact |
| `placements` | Children's social care placements |
| `safeguarding` | Organisations, services, professionals, service episodes |
| `assessments-and-plans` | Care needs assessments and care plans |

`--profile` is required and cannot be guessed: a record with `"@type": "Person"`
may be either `person:subject-of-care` or `person:connected`, and those two
profiles hold it to deliberately different standards.

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Everything conformed |
| `1` | Problems found |
| `2` | Bad usage, or a file could not be read |
| `3` | Shapes could not be loaded — network, or a bad `--ref` |

So `scd-validate -p placements data/*.jsonld && echo ok` does the right thing.

## Examples

```bash
scd-validate -p person:subject-of-care record.jsonld
scd-validate -p placements data/*.jsonld
scd-validate -p safeguarding --ref v2026.1.0 record.jsonld
jq '.records[0]' export.json | scd-validate -p placements
```

Pass several files in one command when you can: the duplicate-`childId` check
looks across the whole set, so validating files one at a time will never find it.

## In CI

```yaml
- run: npx @socialcaredata/validator -p placements 'data/**/*.jsonld'
```

A non-zero exit fails the step. For structured output, add `--json` and parse it.

Pin the standard so a change upstream cannot turn your pipeline red overnight:

```yaml
- run: npx @socialcaredata/validator -p placements --ref v2026.1.0 'data/**/*.jsonld'
```

Colour is used when stdout is a terminal, and suppressed otherwise or when
`NO_COLOR` is set.
