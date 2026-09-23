# Limitations

## JSON paths

Mapping results back to `address[0].postcode` works for JSON and JSON-LD input.
Specifically:

- **Turtle or N-Quads input is not supported.** Only JSON in, for now.
- **A node used in several places** is reported at the first position it appears.
- **`@index`, `@language` and `@id` container maps, `@nest` and `@reverse`** are
  detected and skipped rather than mis-pathed. Issues inside them report the
  nearest `@id` instead of a path. None of the published Social Care contexts use
  any of these today — only `@set`.
- **`@list` members** are pathed by array index. RDF list re-ordering is not
  tracked.
- **Line and column numbers** exist only when the raw text was passed. Handing the
  library an already-parsed object gives you paths but not positions.
- **A missing field has nothing to underline**, so those issues carry the
  enclosing object's position and no code frame.

## Validation

- **`sh:nodeKind sh:BlankNode` disables path tracing.** No current shape uses it.
  If one ever does, `loadProfile` notices, turns skolemization off, warns, and
  falls back to reporting the nearest `@id`.
- **Cross-record checks only see the records in one command.** Validating a
  thousand files one at a time will never find a duplicate `childId`.
- **The placements conditional rules may not run.** They live in a hand-maintained
  shape that is not always published; when it is missing you get a warning, not a
  failure.
- **SHACL Core only.** SPARQL-based constraints are not evaluated.

## Shapes

- **`main` moves.** The default ref tracks the latest published shapes, so the same
  validator version can give different answers on different days. Pin with
  `--ref` for anything repeatable.
- **A mutable ref is not tamper-evident.** There is no integrity check on fetched
  shapes beyond HTTPS.
- **A `@context` named by path or URL is not fetched.** The profile's published
  context is used instead and an informational issue says so. Inline the context
  in the document if you need your own to be used as written.
- **Shapes are fetched on every run.** Two or three small files, so this is
  ordinarily unnoticeable, but it does mean the CLI needs a network.

## Reporting

- **Regex descriptions are a lookup, not a translator.** Patterns the tool does not
  recognise are described using the shape's own `sh:description` instead.
- **`other` means we have no plain-English wording** for that constraint yet.
  Please report it.
