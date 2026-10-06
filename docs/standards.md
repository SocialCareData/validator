# Standards and shapes

Each **standard** on the page pairs a SHACL shape with the JSON-LD context that
names its fields, and offers two example records.

| Standard | Shape | Context |
| --- | --- | --- |
| Person - subject of care | `person/person-subject-of-care-shape.ttl` | `person/context.jsonld` |
| Person - connected person | `person/person-connected-shape.ttl` | `person/context.jsonld` |
| Children's Social Care Placements | `placements/placements-standard-shape.ttl` | `placements/context.jsonld` |
| Safeguarding | `safeguarding/safeguarding-standard-shape.ttl` | `safeguarding/context.jsonld` |
| Care Needs Assessments and Care Plans | `assessments-and-plans/assessments-and-plans-standard-shape.ttl` | `assessments-and-plans/context.jsonld` |

They are defined in [`src/config.ts`](../src/config.ts).

## Why Person has two standards

`person-standard.yaml` is a deliberately permissive core that the two shapes
tighten in different directions. A subject of care must have an identifier, a date
of birth, an address, a gender code and an ethnicity code; a connected person —
a relative or a contact — needs little more than a name. Validating a connected
person against the subject-of-care shape will produce a page of spurious
"required field missing" problems.

## Where shapes come from

`src/config.ts` names each file by its GitHub page URL:

```
https://github.com/SocialCareData/ontology/blob/<ref>/<module>/<file>
```

The page fetches the same file from `raw.githubusercontent.com`, the only
GitHub host that allows a page on another site to read it. The files there are
generated from the LinkML schemas in
[SocialCareData/standard](https://github.com/SocialCareData/standard) — never
hand-edited — and this tool holds URLs rather than copies, so a release of the
validator can never ship a shape that disagrees with the published standard.

## Pinning

The URLs in the config say `main`, and `main` moves. For anything repeatable —
CI, a published pipeline, an audit — pin to a tag.

On the page, set the ref under **Advanced**. It replaces the ref in every shape
and context URL, and the result line names the ref that was used.

The page fetches the shapes once per standard and ref, and keeps them for as
long as the tab is open.

## Contexts

A standard with a configured context reads every record with it, whatever the
record's own `@context` says. A standard without one uses the record's own
`@context`.

Every Social Care standard configures its module context for now. The examples
declare the ontology's released combined context, which cannot stand in for it
yet:

- It defines `outcome` twice, once for safeguarding and once for assessments
  and plans. The second definition wins, so a safeguarding episode's outcome
  stops matching its shape.
- It is a GitHub release file, and browsers cannot fetch those from another site.

## Adding a standard

Add an entry to `src/config.ts`, put its examples under `examples/<name>/` in
SocialCareData/ontology following the `valid-*` / `invalid-*` convention, and list the two `valid-*`
files in the entry. The conformance suite picks the folder up from those
example URLs. See [contributing](contributing.md).
