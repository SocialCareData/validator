# Getting started

## In the browser

Open **<https://socialcaredata.github.io/validator/>**, paste a record, choose the
standard it should follow, press **Validate**.

Everything runs in your browser. Your data is never uploaded — the only network
requests the page makes are for the shape and context files, which it downloads
from the public ontology repository.

If you are not sure what a valid record looks like, use **Load an example…**. The
examples marked *should fail* are the fastest way to see what a problem report
looks like before you are staring at one of your own.

## On the command line

The page is built on the generic
[`dsv` validator](https://github.com/theodi/data-standard-validator), which runs anywhere Node 22+ does. Give it a profile's
published shape (`-s`) and context (`-c`):

```bash
ONT=https://raw.githubusercontent.com/SocialCareData/ontology/main
npx @theodi/data-standard-validator \
  -s $ONT/person/person-subject-of-care-shape.ttl \
  -c $ONT/person/context.jsonld \
  mydata.jsonld
```

| Profile | `-s` (repeat for several) | `-c` |
| --- | --- | --- |
| `person:subject-of-care` | `person/person-subject-of-care-shape.ttl` | `person/context.jsonld` |
| `person:connected` | `person/person-connected-shape.ttl` | `person/context.jsonld` |
| `placements` | `placements/placements-standard-shape.ttl`, plus `placements/placements-base-rules-shape.ttl` once it is published | `placements/context.jsonld` |
| `safeguarding` | `safeguarding/safeguarding-standard-shape.ttl` | `safeguarding/context.jsonld` |
| `assessments-and-plans` | `assessments-and-plans/assessments-and-plans-standard-shape.ttl` | `assessments-and-plans/context.jsonld` |

Each path is relative to `$ONT`. Replace `main` in `$ONT` with a tag to pin a
version. The page treats the placements rules shape as optional and warns when
it is missing. The command line treats every `-s` as required, so leave that
one out until it is published.

Pass several files at once. Every file in one command is validated together:

```bash
npx @theodi/data-standard-validator -s $ONT/placements/placements-standard-shape.ttl \
  -c $ONT/placements/context.jsonld data/*.jsonld
```

Two things are specific to the web page and are not available on the command
line. The duplicate-`childId` check across placements records lives in this
repo's [`src/cross-checks.ts`](../src/cross-checks.ts). The plain-English
description of the postcode regex lives in [`src/patterns.ts`](../src/patterns.ts).
The command line still reports a bad postcode, using the shape's own
description.

## Reading the output

```
mydata.jsonld -> fails
  in Address (address[0])
    x postcode is not in the expected format - you gave NOT A POSTCODE
      at address[0].postcode  line 10
         10 |   "address": [ { "@type": "Address", "postcode": "NOT A POSTCODE" } ],
            |                                                  ^^^^^^^^^^^^^^^^
      It should be UK postcode in standard format, for example `AB1 2CD`.
```

- **`in Address (address[0])`**: problems are grouped by the object they are
  in, so you can fix one part of the record at a time.
- **`at address[0].postcode`**: the path to the exact field in your JSON.
- **The caret**: points at the offending value in your file.
- **The last line**: what the standard expects, with an example.

`-f json` prints the whole report as JSON, and `-f markdown` produces a report
for GitHub job summaries. Exit codes are `0` when everything conforms, `1` when
problems were found, `2` for bad usage, and `3` when a shape, context or file
could not be loaded.

## Do I need JSON-LD?

No. The page always reads your record with the selected profile's published
context, and tells you it did. On the command line,
`-c` does the same. Plain JSON whose field names match the standard will
validate correctly.

Adding `"@context": "https://raw.githubusercontent.com/SocialCareData/ontology/main/person/context.jsonld"`
makes the file self-describing, which is worth doing if it will be passed around.
