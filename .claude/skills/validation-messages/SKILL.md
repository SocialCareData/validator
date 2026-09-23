---
name: validation-messages
description: Change or add the plain-English wording the validator shows for a SHACL constraint. Use when a message reads badly, when an issue comes out with code "other", or when adding support for a constraint component the tool does not describe yet.
---

# Validation messages

The whole point of this tool is that it says "postcode is not in the expected
format, it should be a UK postcode... for example AB1 2CD" rather than quoting
`sh:PatternConstraintComponent` at somebody. `src/report/messages.ts` is where
that happens.

## Where the words come from

**Not from the SHACL engine.** The generated shapes declare zero `sh:message`,
so strings like "Less than 1 values" are `rdf-validate-shacl`'s own defaults.
Never parse them.

They come from the shape that raised the result: `src/report/shape-facts.ts`
reads back `sh:description`, `sh:minCount`, `sh:pattern`, `sh:in` and the rest,
and `describeConstraint` turns those into a sentence. The published shapes carry
several hundred descriptions, often with an example in them —
`"UK postcode in standard format (e.g. AB1 2CD)"` — which is where the example
in the hint is lifted from.

The hand-maintained `*-rules-shape.ttl` files are the one exception: they carry
an `sh:message` written by the modellers, and `NotConstraintComponent` uses it
verbatim.

## Adding a case

1. **`src/report/messages.ts`** — add a `case` to `describeConstraint`. Return an
   `IssueCode` from `src/report/types.ts` (add one only if none fits), a `title`,
   and a `hint` saying what would be right.
2. **`test/unit/messages.test.ts`** — a test with a hand-built `facts` object. No
   network, no shapes.
3. **`docs/error-reference.md`** — a section for the code. It is a documented
   interface, not an implementation detail.
4. **`npm run expectations && git diff examples/`** — if real examples now
   produce the new code, the pinned expectations change. Read the diff.

## Rules

**No IRIs in `title` or `hint`.** A test enforces it. Show the context term
(`postcode`), the enum token (`official`), or the compact form — never
`https://ontology.socialcaredata.io/postcode`. Raw IRIs belong in
`issue.technical`, which the CLI keeps out of sight and the web page hides
behind a disclosure.

**Say what would be right**, not only what is wrong. "must be one of: home,
work, temp" beats "value not allowed".

**Quote the value as the user wrote it.** `report/build.ts` reads it back out of
their JSON, so it reads `you gave 7`, not `you gave gc:7`.

**Markup is `` `code` `` and `**bold**`.** Both the terminal renderer and the
web page parse those two and nothing else.

## Checking your wording

```bash
npm run build
node dist/cli.js -p person:subject-of-care examples/person/subject-of-care/invalid-bad-postcode.jsonld
```

Read it as somebody holding a spreadsheet export and no knowledge of SHACL. If
the sentence does not tell them which field and what to do, it is not finished.

An issue coming out as code `other` means no case matched — that is a gap to
fill, and the conformance suite fails if any example produces it.
