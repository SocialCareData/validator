# Command line reference

```
scd-validate [files...]      validate (the default command)
scd-validate profiles        list the profiles this version knows about
scd-validate explain <code>  what an issue code means and how to fix it
scd-validate fetch           download shapes into the cache for offline use
```

With no files, or with `-`, input is read from stdin.

## Validation options

| Option | Default | What it does |
| --- | --- | --- |
| `-p, --profile <id>` | — | Profile to validate against |
| `-s, --shapes <path\|url>` | — | Use this shape instead of a profile's. Repeatable; merged in order |
| `-c, --context <path\|url>` | profile's | JSON-LD context used to resolve field names |
| `-r, --ref <ref>` | `main` | Tag, branch or commit in the ontology repo |
| `-f, --format <fmt>` | `auto` | `pretty`, `json`, `github`, `sarif`, `summary` |
| `-o, --output <file>` | stdout | Write the report to a file |
| `--severity <level>` | `info` | Lowest severity to report |
| `--fail-on <level>` | `violation` | Exit `1` at this severity or above |
| `--expect <mode>` | `none` | `auto` reads `valid-*`/`invalid-*` filenames as expectations |
| `--no-cross-checks` | on | Skip checks that span the whole set of records |
| `--no-skolem` | on | Stop tracing results back to JSON paths (debugging aid) |
| `--offline` | off | Never hit the network; fail if shapes are not cached |
| `--no-cache` | on | Ignore the on-disk cache |
| `--cache-dir <dir>` | platform cache | Where to keep cached shapes |
| `--max-issues <n>` | `50` | Issues printed per document |
| `--no-color` | auto | Disable colour (also honours `NO_COLOR`) |
| `-q, --quiet` | off | Print nothing; use the exit code |
| `-v, --verbose` | off | Include focus nodes, shape IRIs and constraint names |

`--format auto` picks `github` under GitHub Actions, `pretty` on a terminal, and
`json` when piped.

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Everything conformed, and every `--expect` was met |
| `1` | Problems found |
| `2` | Bad usage, or a file could not be read |
| `3` | Shapes could not be loaded |

## In GitHub Actions

Inline annotations on the pull request — no configuration, because `--format auto`
detects Actions:

```yaml
- run: npx @socialcaredata/validator -p placements 'data/**/*.jsonld'
```

Code scanning instead:

```yaml
- run: npx @socialcaredata/validator -p placements -f sarif -o results.sarif 'data/**/*.jsonld'
  continue-on-error: true
- uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: results.sarif
```

Pin the standard so a change upstream cannot turn your pipeline red overnight:

```yaml
- run: npx @socialcaredata/validator -p placements --ref v2026.1.0 'data/**/*.jsonld'
```

## Air-gapped use

```bash
scd-validate fetch --ref v2026.1.0 --cache-dir ./shapes   # where there is a network
scd-validate -p placements --ref v2026.1.0 --cache-dir ./shapes --offline data/*.jsonld
```

## Validating against your own shapes

`--shapes` bypasses the catalogue entirely, and accepts local paths and URLs. Give
it several times to merge shapes:

```bash
scd-validate -s base-shape.ttl -s extra-rules.ttl -c context.jsonld record.jsonld
```

Without a context the validator still works, but field names are reported as IRIs
rather than the names you wrote — the context is what makes the output readable.

## Conformance mode

`--expect auto` treats `valid-*` filenames as "must conform" and `invalid-*` as
"must not", and fails if a file behaves differently. It is how this project tests
its own examples:

```bash
scd-validate -p placements --expect auto examples/placements/*.jsonld
```
