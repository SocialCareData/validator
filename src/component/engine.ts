/*
 * A configured standard, turned into a ready validator.
 *
 * Loading a standard parses thousands of lines of Turtle. The worker, and
 * tests validating dozens of documents, should not pay for that twice, so
 * validators are memoised per set of sources.
 */

import { createValidator, type Environment, type PatternHint, type Validator } from '@theodi/data-standard-validator'
import type { ResolvedStandard } from './config.js'

export interface LoadOptions extends ResolvedStandard, Environment {
  patterns?: readonly PatternHint[]
  /** For tests: switch off traceable node identities. Not memoised. */
  skolemize?: boolean
}

const loaded = new Map<string, Promise<Validator>>()

export function loadValidator (opts: LoadOptions): Promise<Validator> {
  if (opts.skolemize !== undefined) return load(opts)
  const key = JSON.stringify([
    opts.shapes,
    opts.context ?? null,
    (opts.patterns ?? []).map((p) => [String(p.pattern), p.description, p.example ?? null]),
  ])
  let pending = loaded.get(key)
  if (!pending) {
    pending = load(opts)
    // A failed load (a typo'd ref, a dropped connection) should not stick.
    pending.catch(() => loaded.delete(key))
    loaded.set(key, pending)
  }
  return pending
}

function load (opts: LoadOptions): Promise<Validator> {
  return createValidator({
    shapes: opts.shapes,
    ...(opts.context !== undefined ? { context: opts.context } : {}),
    ...(opts.patterns !== undefined ? { patterns: opts.patterns } : {}),
    ...(opts.skolemize !== undefined ? { skolemize: opts.skolemize } : {}),
    ...(opts.fetch !== undefined ? { fetch: opts.fetch } : {}),
  })
}
