/*
 * Guards on the mechanism that makes readable paths possible.
 *
 * Skolemization rewrites the graph before it is validated. That is only
 * acceptable if it provably changes no verdict, and if the synthetic
 * identifiers never escape into anything a user reads.
 */

import { describe, expect, test, beforeAll } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { catalogue } from '../src/catalogue/entries.js'
import { loadProfile, type LoadedProfile } from '../src/catalogue/resolve.js'
import { createValidator } from '../src/core/validator.js'
import { render } from '../src/report/render/index.js'
import { requiresBlankNodes } from '../src/core/shacl.js'
import { readLocal } from '../src/node.js'
import { SKOLEM_PREFIX } from '../src/core/skolemize.js'
import { testCache } from './helpers/cached-fetch.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const profiles: Record<string, LoadedProfile> = {}

beforeAll(async () => {
  for (const entry of catalogue) {
    profiles[entry.id] = await loadProfile(entry.id, { cache: testCache, readLocal })
  }
})

describe('skolemization is verdict-neutral', () => {
  for (const entry of catalogue) {
    const dir = join(root, entry.examples)
    const files = readdirSync(dir).filter((f) => f.endsWith('.jsonld')).sort()

    test.each(files)(`${entry.id} / %s`, async (file) => {
      const profile = profiles[entry.id]!
      const text = readFileSync(join(dir, file), 'utf8')

      const withSkolem = await createValidator(profile, { skolemize: true })
        .validate({ name: file, text })
      const without = await createValidator(profile, { skolemize: false })
        .validate({ name: file, text })

      expect(without.conforms).toBe(withSkolem.conforms)
    })
  }
})

describe('synthetic identifiers stay internal', () => {
  test.each(catalogue.map((e) => e.id))('%s', async (id) => {
    const entry = catalogue.find((e) => e.id === id)!
    const dir = join(root, entry.examples)
    const files = readdirSync(dir).filter((f) => f.endsWith('.jsonld')).sort()
    const validator = createValidator(profiles[id]!)
    const report = await validator.validateAll(files.map((f) => ({
      name: f, text: readFileSync(join(dir, f), 'utf8'),
    })))

    for (const format of ['pretty', 'json', 'github', 'sarif', 'summary'] as const) {
      expect(render(report, format, { color: false })).not.toContain(SKOLEM_PREFIX)
    }
  })
})

describe('the published shapes permit skolemization', () => {
  test.each(catalogue.map((e) => e.id))('%s has no sh:nodeKind sh:BlankNode', (id) => {
    expect(requiresBlankNodes(profiles[id]!.shapes)).toBe(false)
    expect(profiles[id]!.skolemSafe).toBe(true)
  })
})

describe('reports never leak raw IRIs into the human layer', () => {
  test.each(catalogue.map((e) => e.id))('%s', async (id) => {
    const entry = catalogue.find((e) => e.id === id)!
    const dir = join(root, entry.examples)
    const files = readdirSync(dir).filter((f) => f.startsWith('invalid-')).sort()
    const validator = createValidator(profiles[id]!)
    for (const file of files) {
      const report = await validator.validate({
        name: file, text: readFileSync(join(dir, file), 'utf8'),
      })
      for (const issue of report.issues) {
        expect(issue.title, `${file}: ${issue.title}`).not.toMatch(/https?:\/\//)
        if (issue.hint !== undefined) {
          expect(issue.hint, `${file}: ${issue.hint}`).not.toMatch(/https?:\/\//)
        }
      }
    }
  })
})
