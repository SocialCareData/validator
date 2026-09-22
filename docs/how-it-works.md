# How it works

```
your JSON  ->  skolemize  ->  resolve @context  ->  RDF  ->  SHACL  ->  humanise
```

The first and last steps are the interesting ones. The middle is standard
JSON-LD processing.

## The problem this tool exists to solve

SHACL validates RDF. RDF has no notion of "line 10" or of `address[0].postcode` —
it has triples, and nodes, and most nodes in a converted JSON-LD document are
*blank nodes* with machine-generated labels. A conformant engine will faithfully
report:

```
Violation  path=https://ontology.socialcaredata.io/postcode  focus=_:b3
           "Value does not match pattern ^[A-Z]{1,2}[0-9][0-9A-Z]? ?[0-9][A-Z]{2}$"
```

Everything about that is correct. Nobody can act on it.

## Skolemization: putting the report back where it came from

`jsonld.toRDF` discards provenance and mints its own blank-node labels, so there
is no way to work backwards from `_:b3` to a position in the input.

So we do not let anything be anonymous. Before conversion, the document is walked
and every node object that lacks an `@id` is given one — `urn:scd:node:7` — while
recording where it came from: the JSON pointer, the dotted path, the enclosing
`@type`, the nearest ancestor `@id`, and the byte offsets.

Afterwards, every focus node in the SHACL report is either an `@id` the user
wrote or a URN that decodes straight back to `address[0]`. Blank nodes never
appear in a report at all.

**This is safe because it adds no triples.** `@id` is a node's identity, not a
property, so cardinality constraints, `sh:closed` and `sh:ignoredProperties` are
all unaffected. The one thing it would break is a shape requiring
`sh:nodeKind sh:BlankNode`; no shape in the Social Care model does, `loadProfile`
checks every time and disables the whole mechanism if one ever appears, and a
test validates all the bundled examples both ways and asserts the verdicts are
identical.

The synthetic identifiers are internal. A test renders every example in all five
output formats and asserts the string `urn:scd:node:` appears in none of them.

## Reading the context backwards

Field names come from inverting the profile's `context.jsonld`. Two features of
these contexts make that worth doing carefully:

- **type-scoped contexts.** `Name` and `Address` each declare their own `use`, so
  the same IRI can have different names depending on the object it sits in. The
  index keeps the scopes separate and prefers the one matching the enclosing
  `@type`.
- **`"@type": "@vocab"` term maps.** Enumerations are written out as token → IRI
  pairs. Inverted, they turn an `sh:in` list of five opaque IRIs into
  "must be one of: usual, official, temp, nickname, anonymous" — the tokens the
  user would actually type.

For a missing field there is no key in the document to read, which is exactly when
the inverted context earns its place.

## Saying what is wrong

The generated shapes declare **no** `sh:message`, so the strings a SHACL engine
produces ("Less than 1 values") are its own generic defaults. They do declare
several hundred `sh:description`s, plus the constraint parameters themselves.

So rather than parse engine messages, the reporter goes back to the source shape
and reads `sh:description`, `sh:minCount`, `sh:pattern`, `sh:in` and the rest
directly, and builds a sentence from those. That is where the postcode example
comes from — the shape says *"UK postcode in standard format (e.g. AB1 2CD)"*, and
the example in the hint is lifted straight out of it.

The hand-maintained rules shapes are the exception: they *do* carry an
`sh:message`, written by the modellers, and it is used verbatim.

## Checks SHACL cannot do

SHACL Core validates one focus node at a time, so "no two records may share a
`childId`" is not expressible. Those run separately, over every document passed in
a single command, after SHACL has finished. It follows that validating files one
at a time will never find them.

## Why the same code runs in both places

The core takes strings and an injected `fetch`. Nothing under `src/core`,
`src/catalogue` or `src/report` imports `node:fs`; the filesystem lives in
`src/cli` and `src/node.ts` only. The web page imports the library source
directly, so the deployed page and the published package cannot drift apart.
