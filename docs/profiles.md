# Profiles and shapes

A **profile** pairs one or more SHACL shapes with the JSON-LD context that names
their fields, plus any checks that span a whole set of records.

| Profile | Shapes it loads | Cross-record checks |
| --- | --- | --- |
| `person:subject-of-care` | `person/person-subject-of-care-shape.ttl` | — |
| `person:connected` | `person/person-connected-shape.ttl` | — |
| `placements` | `placements/placements-standard-shape.ttl`, `placements/placements-base-rules-shape.ttl` | duplicate `childId` |
| `safeguarding` | `safeguarding/safeguarding-standard-shape.ttl` | — |
| `assessments-and-plans` | `assessments-and-plans/assessments-and-plans-standard-shape.ttl` | — |

Each also loads `<module>/context.jsonld` from the same place.

`scd-validate profiles --check` confirms every one of those URLs resolves at the
ref you are using.

## Why Person has two profiles

`person-standard.yaml` is a deliberately permissive core that the two profiles
tighten in different directions. A subject of care must have an identifier, a date
of birth, an address, a gender code and an ethnicity code; a connected person —
a relative or a contact — needs little more than a name. Validating a connected
person against the subject-of-care shape will produce a page of spurious
"required field missing" problems.

## Where shapes come from

```
https://raw.githubusercontent.com/SocialCareData/ontology/<ref>/<module>/<file>
```

`<ref>` is `--ref`, defaulting to `main`. The files there are generated from the
LinkML schemas in
[SocialCareData/standard](https://github.com/SocialCareData/standard) — never
hand-edited — and this tool holds URLs rather than copies, so a release of the
validator can never ship a shape that disagrees with the published standard.

## Pinning

`main` moves. For anything repeatable — CI, a published pipeline, an audit — pin
to a tag:

```bash
scd-validate -p placements --ref v2026.1.0 data/*.jsonld
```

Cached files for a tag or a full commit SHA are kept indefinitely, because they
cannot change. A branch is revalidated after ten minutes.

## The placements rules shape

`gen-shacl` cannot translate LinkML `rules:`, so the conditional constraints —
"if you select an *Other* code, you must supply the paired free text" — are
maintained by hand and merged on top of the generated shape.

That file is marked optional in the catalogue. If it is not published at the ref
you asked for, validation continues without it and says so in a warning, rather
than failing. The rest of the checks are unaffected.

## Adding a profile

Add an entry to `src/catalogue/entries.ts`, put its examples under
`examples/<name>/` following the `valid-*` / `invalid-*` convention, and the
conformance suite will pick them up automatically. See
[contributing](contributing.md).
