# Library API

```bash
npm install @socialcaredata/validator
```

One entry point, and it is isomorphic: nothing in it touches the filesystem, so
the same build runs in Node, in a bundler and in the browser.

## The short way

```ts
import { validate, renderPretty } from '@socialcaredata/validator'

const report = await validate(record, 'person:subject-of-care')

if (!report.conforms) {
  console.log(renderPretty(report, { color: false }))
}
```

`record` may be a parsed object, a JSON string, or `{ name, text }`. Pass the raw
text when you have it — that is what gives every issue a line and column.

## Reusing a profile

Loading a profile fetches and parses its shapes, which is the expensive part.
`loadProfile` memoises per profile and ref for the life of the process, so
repeated calls are free; hold on to the validator when checking many records:

```ts
import { loadProfile, createValidator } from '@socialcaredata/validator'

const profile = await loadProfile('placements', { ref: 'v2026.1.0' })
const validator = createValidator(profile)

const report = await validator.validateAll(
  files.map((f) => ({ name: f.path, text: f.contents })),
)
```

`validateAll` also runs the cross-record checks, which need every document at
once; `validate` handles a single document and returns just its report.

## Reading a report

```ts
for (const doc of report.documents) {
  for (const issue of doc.issues) {
    console.log(issue.severity, issue.code, issue.location.jsonPath, issue.title)
  }
}
```

Every `Issue` has two layers:

- the **human layer** — `title`, `hint`, `allowedValues`, `location.jsonPath`.
  Guaranteed never to contain a raw IRI; safe to show to anyone.
- **`technical`** — `focusNode`, `resultPath`, `sourceShape`, `constraint`. For
  people who know SHACL, and for bug reports against this tool.

`groupIssues(issues)` groups them by the object they belong to, which is how both
the terminal output and the web page arrange them.

## In the browser

```ts
import { profiles, loadProfile, createValidator } from '@socialcaredata/validator'

const profile = await loadProfile(profiles[0].id)   // fetches over HTTPS
const report = await createValidator(profile).validate(textarea.value)
```

Shapes come from `raw.githubusercontent.com`, which sends
`Access-Control-Allow-Origin: *`, so no proxy is needed. Validating is CPU-bound;
run it in a Web Worker if it competes with typing. See `web/src/worker.ts` in
this repository for a worked example, including the one global shim a worker
needs.

## Injecting `fetch`

```ts
const profile = await loadProfile('safeguarding', { fetch: myFetch })
```

Useful for instrumentation, for tests, and for environments where `fetch` needs
a proxy agent.
