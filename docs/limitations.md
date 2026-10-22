# Limitations

## Input

- **JSON and JSON-LD only.** Turtle and N-Quads cannot be pasted in.
- **One document at a time.** The page validates what is in the editor.
  Several records can go in one document, in a top-level `@graph`.

## Where issues point

- **A node used in several places** is reported at the first position it appears.
- **`@index`, `@language` and `@id` container maps, `@nest` and `@reverse`** are
  skipped rather than mis-pathed. Issues inside them report the nearest `@id`
  instead of a path. None of the published Social Care contexts use any of
  these today, only `@set`.
- **`@list` members** are pathed by array index. RDF list re-ordering is not
  tracked.
- **A missing field has nothing to underline**, so those issues point at the
  enclosing object instead.

## Validation

- **SHACL Core only.** SPARQL-based constraints are not evaluated.
- **`sh:nodeKind sh:BlankNode` disables path tracing.** No current shape uses it.
  If one ever does, the validator notices, warns, and falls back to reporting
  the nearest `@id`.

## Shapes

- **`main` moves.** The default ref tracks the latest published shapes, so the
  same record can get different answers on different days. Pin a tag under
  **Advanced** for anything repeatable.
- **A mutable ref is not tamper-evident.** There is no integrity check on fetched
  shapes beyond HTTPS.
- **A document's own `@context` is always replaced.** The page reads every record
  with the standard's published context, the one matching the shapes, and an
  informational issue says so. The examples declare the ontology's released
  combined context, which the page cannot use yet: it defines `outcome` twice,
  and browsers cannot fetch GitHub release files.
- **Shapes are fetched at run time.** They are two or three small files, so this
  is normally unnoticeable, but it does mean the page needs a network.

## Reporting

- **Regex descriptions are a lookup, not a translator.** Patterns the page does
  not recognise are described using the shape's own `sh:description` instead.
- **`other` means there is no plain-English wording** for that constraint yet.
  Please report it.
