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

They are defined in [`src/catalogue.ts`](../src/catalogue.ts). Every report's
`setup.shapes` lists the exact URLs that were loaded.

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

`<ref>` is set under **Advanced** on the page, and defaults to `main`. The files there are generated from the
LinkML schemas in
[SocialCareData/standard](https://github.com/SocialCareData/standard) — never
hand-edited — and this tool holds URLs rather than copies, so a release of the
validator can never ship a shape that disagrees with the published standard.

## Pinning

`main` moves. For anything repeatable — CI, a published pipeline, an audit — pin
to a tag.

On the page, set the ref under **Advanced**. On the command line, put the tag
in the URL:

```bash
npx @theodi/data-standard-validator \
  -s https://raw.githubusercontent.com/SocialCareData/ontology/v2026.1.0/placements/placements-standard-shape.ttl \
  -c https://raw.githubusercontent.com/SocialCareData/ontology/v2026.1.0/placements/context.jsonld \
  data/*.jsonld
```

The page fetches the shapes once per profile and ref, and keeps them for as
long as the tab is open.

## The placements rules shape

`gen-shacl` cannot translate LinkML `rules:`, so the conditional constraints —
"if you select an *Other* code, you must supply the paired free text" — are
maintained by hand and merged on top of the generated shape.

That file is marked optional in the catalogue. If it is not published at the ref
you asked for, validation continues without it and says so in a warning, rather
than failing. The rest of the checks are unaffected.

## Adding a profile

Add an entry to `src/catalogue.ts`, put its examples under `examples/<name>/`
following the `valid-*` / `invalid-*` convention, and the conformance suite will
pick them up automatically. See [contributing](contributing.md).
