# Getting started

## In the browser

Open **<https://socialcaredata.github.io/validator/>**, paste a record, choose the
standard it should follow, press **Validate**.

If you are not sure what a valid record looks like, use **Load an example…**.
Each standard offers two: one with only the required properties, and one with
every property the standard defines.

## Linking to a record

Query parameters open the page on a standard and load a record, which is then
validated straight away:

```text
https://socialcaredata.github.io/validator/?shape=https://github.com/SocialCareData/ontology/blob/main/placements/placements-standard-shape.ttl&context=https://github.com/SocialCareData/ontology/blob/main/placements/context.jsonld&example=https://github.com/SocialCareData/standard/blob/main/src/_data/model/examples/placements/valid-placement.jsonld
```

- `shape` and `context` pick the standard that uses those files; either one is
  enough. A link at another ref (`blob/v1.0.0/...`) also sets the shapes
  version to that ref.
- `example` is the record to load. On its own it picks the standard that lists
  it. It can be any record URL, not only a listed example.
- Encode a URL that contains `&` or `#` (`encodeURIComponent`).

The full rules are in the component's
[usage guide](https://github.com/theodi/data-standard-validator-component/blob/main/docs/usage.md#linking-to-a-standard).
