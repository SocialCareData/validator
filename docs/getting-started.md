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

```bash
npx @socialcaredata/validator -p person:subject-of-care mydata.jsonld
```

or install it once:

```bash
npm install --global @socialcaredata/validator
scd-validate -p person:subject-of-care mydata.jsonld
```

`scd-validate --help` lists the profiles.

Several files at once — useful because some checks look across a whole set of
records rather than one at a time:

```bash
scd-validate -p placements data/*.jsonld
```

From a pipe:

```bash
jq '.records[0]' export.json | scd-validate -p safeguarding
```

## Reading the output

```
mydata.jsonld -> fails
  in Address (address[0])
    x postcode is not in the expected format - you gave NOT A POSTCODE
      at address[0].postcode  line 10
         10 |   "address": [ { "@type": "Address", "postcode": "NOT A POSTCODE" } ],
            |                                                  ^^^^^^^^^^^^^^^^
      It should be a UK postcode in upper case, with an optional space, for example `AB1 2CD`.
```

- **`in Address (address[0])`** — problems are grouped by the object they are in,
  so you fix one part of the record at a time.
- **`at address[0].postcode`** — the path to the exact field, in your JSON.
- **the caret** — the offending value in your file.
- **the last line** — what the standard expects, and an example.

`--json` prints the whole report as JSON, including a `technical` block per issue
carrying the focus node, shape and constraint component.

## What the exit code means

| Code | Meaning |
| --- | --- |
| `0` | Everything conforms |
| `1` | Problems were found |
| `2` | Bad usage, or a file could not be read |
| `3` | Shapes could not be loaded — network, or a bad `--ref` |

So `scd-validate -p placements data/*.jsonld && echo ok` does the right thing in a
script.

## Do I need JSON-LD?

No. If your file has no `@context`, the validator uses the selected profile's
published context, and tells you it did. Plain JSON whose field names match the
standard will validate correctly.

Adding `"@context": "https://raw.githubusercontent.com/SocialCareData/ontology/main/person/context.jsonld"`
makes the file self-describing, which is worth doing if it will be passed around.
