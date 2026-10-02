/*
 * A Social Care profile, turned into a ready validator.
 *
 * Loading a profile parses ~20k lines of Turtle. Tests validating dozens of
 * documents, and the web page's worker, should not pay for that twice, so
 * validators are memoised per profile and ref.
 */

import { createValidator, type Environment, type Validator } from '@theodi/data-standard-validator'
import { getProfile, rawUrl, DEFAULT_REF } from './catalogue.js'
import { CROSS_CHECKS } from './cross-checks.js'
import { PATTERNS } from './patterns.js'

export interface ProfileOptions extends Environment {
  /** Tag, branch or commit in the ontology repo. */
  ref?: string
  /** For tests: switch off traceable node identities. Not memoised. */
  skolemize?: boolean
}

const loaded = new Map<string, Promise<Validator>>()

export function profileValidator (id: string, opts: ProfileOptions = {}): Promise<Validator> {
  const ref = opts.ref ?? DEFAULT_REF
  const key = `${id}@${ref}`
  if (opts.skolemize !== undefined) return load(id, ref, opts)
  let pending = loaded.get(key)
  if (!pending) {
    pending = load(id, ref, opts)
    // A failed load (a typo'd ref, a dropped connection) should not stick.
    pending.catch(() => loaded.delete(key))
    loaded.set(key, pending)
  }
  return pending
}

async function load (id: string, ref: string, opts: ProfileOptions): Promise<Validator> {
  const profile = getProfile(id)
  if (!profile) throw new Error(`unknown profile '${id}'`)
  return createValidator({
    shapes: profile.shapes.map((shape) => ({
      url: rawUrl(ref, shape.file),
      ...(shape.optional === true ? { optional: true } : {}),
      ...(shape.provides !== undefined ? { label: shape.provides } : {}),
    })),
    context: rawUrl(ref, profile.context),
    crossChecks: profile.crossChecks.map((name) => {
      const check = CROSS_CHECKS[name]
      if (!check) throw new Error(`profile '${id}' names an unknown cross-check '${name}'`)
      return check
    }),
    patterns: PATTERNS,
    ...(opts.skolemize !== undefined ? { skolemize: opts.skolemize } : {}),
    ...(opts.fetch !== undefined ? { fetch: opts.fetch } : {}),
  })
}
