# Library API

```bash
npm install @socialcaredata/validator
```

Two entry points:

- `@socialcaredata/validator` — isomorphic. No `node:fs` anywhere on the
  validation path, so it runs in Node, in a bundler and in the browser.
- `@socialcaredata/validator/node` — filesystem, stdin and the disk cache.

## The short way

```ts
import { validate, render } from '@socialcaredata/validator'

const report = await validate(record, 'person:subject-of-care')

if (!report.conforms) {
  console.log(render(report, 'pretty'))
}
```

`record` may be a parsed object, a JSON string, or `{ name, text }`. Pass the raw
text when you have it — that is what gives every issue a line and column.

## Reusing a profile

Loading a profile fetches and parses its shapes, which is the expensive part. Do
it once when validating many records:

```ts
import { loadProfile, createValidator } from '@socialcaredata/validator'

const profile = await loadProfile('placements', { ref: 'v2026.1.0' })
const validator = createValidator(profile)

const report = await validator.validateAll(
  files.map((f) => ({ name: f.path, text: f.contents })),
)
```

`validateAll` also runs the cross-record checks, which need every document at
once; `validate` handles a single document and skips them.

## Reading a report

```ts
for (const doc of report.documents) {
  for (const issue of doc.issues) {
    console.log(issue.severity, issue.code, issue.location.jsonPath, issue.title)
  }
}
```

Every `Issue` has two layers:

- the **human layer** — `title`, `hint`, `detail`, `expected`, `location.jsonPath`.
  Guaranteed never to contain a raw IRI; safe to show to anyone.
- **`technical`** — `focusNode`, `resultPath`, `sourceShape`,
  `sourceConstraintComponent`. For people who know SHACL, and for bug reports.

`RunReport` is the same object `--format json` prints, and carries a
`schemaVersion` you can pin against.

## In the browser

```ts
import { loadProfile, createValidator, catalogue } from '@socialcaredata/validator'

const profile = await loadProfile(catalogue[0].id)          // fetches over HTTPS
const report = await createValidator(profile).validate(textarea.value)
```

Shapes are fetched from `raw.githubusercontent.com`, which sends
`Access-Control-Allow-Origin: *`, so no proxy is needed. Validating a large
record is CPU-bound; run it in a Web Worker if it is competing with typing. See
`web/src/worker.ts` in this repository for a worked example, including the one
global shim a worker needs.

## Injecting `fetch` and a cache

```ts
const profile = await loadProfile('safeguarding', {
  fetch: myInstrumentedFetch,
  cache: myCache,          // { get(url), set(url, entry) }
  offline: true,
})
```

On Node, `@socialcaredata/validator/node` exports `DiskCache`, `readDocuments`,
`readStdin` and `expectationFromName`.

## Your own shapes

```ts
const profile = await loadProfile(null, {
  shapes: ['./my-shape.ttl'],
  context: './my-context.jsonld',
  readLocal: (p) => fs.promises.readFile(p, 'utf8'),
})
```

`readLocal` is required for local paths and is deliberately not built in — it is
the one thing that would make this module non-isomorphic.
