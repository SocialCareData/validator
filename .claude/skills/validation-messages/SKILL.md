---
name: validation-messages
description: Change or add the plain-English wording the validator shows for a SHACL constraint. Use when a message reads badly, when an issue comes out with code "other", or when a Social Care sh:pattern needs a better description.
---

# Validation messages

Messages are built by the engine, **[@theodi/data-standard-validator](https://github.com/theodi/data-standard-validator)**,
which is checked out locally at `../data-standard-validator`. Its own
`validation-messages` skill covers `describeConstraint`, shape facts and the
wording rules. Make changes there, then link the build here to check them
against the real standards.

## What stays in this repo

`patterns` in `src/config.ts` holds `PatternHint`s, plain-English names for the
regexes the Social Care shapes use:

```ts
{ pattern: '^[AEU]{3}$', description: 'three letters, each one A, E or U', example: 'AEU' }
```

A string `pattern` matches the shape's `sh:pattern` source exactly. A `RegExp`
is tested against that source. Without a hint, the engine falls back to the
shape's `sh:description` and lifts the example out of any `(e.g. ...)`.

## Checking a change against the real standards

```bash
npm update @theodi/data-standard-validator-component @theodi/data-standard-validator
npm run dev        # load each invalid example and read it as a user would
npm run test:web
```

To try an unreleased engine change, build the engine, then the component
against it, and install the component with
`npm install --install-links ../data-standard-validator-component`.

An issue with code `other` means the engine has no case for that constraint.
Fix it upstream.
