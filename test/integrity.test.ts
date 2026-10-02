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
import { formatReport, SKOLEM_PREFIX, type Validator } from '@theodi/data-standard-validator'
import { profiles } from '../src/catalogue.js'
import { profileValidator } from '../src/profile.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const loaded: Record<string, Validator> = {}
const unskolemized: Record<string, Validator> = {}

beforeAll(async () => {
  for (const entry of profiles) {
    loaded[entry.id] = await profileValidator(entry.id)
    unskolemized[entry.id] = await profileValidator(entry.id, { skolemize: false })
  }
})

describe('skolemization is verdict-neutral', () => {
  for (const entry of profiles) {
    const dir = join(root, entry.examples)
    const files = readdirSync(dir).filter((f) => f.endsWith('.jsonld')).sort()

    test.each(files)(`${entry.id} / %s`, async (file) => {
      const text = readFileSync(join(dir, file), 'utf8')

      const withSkolem = await loaded[entry.id]!.validate({ name: file, text })
      const without = await unskolemized[entry.id]!.validate({ name: file, text })

      expect(without.conforms).toBe(withSkolem.conforms)
    })
  }
})

describe('synthetic identifiers stay internal', () => {
  test.each(profiles.map((e) => e.id))('%s', async (id) => {
    const entry = profiles.find((e) => e.id === id)!
    const dir = join(root, entry.examples)
    const files = readdirSync(dir).filter((f) => f.endsWith('.jsonld')).sort()
    const report = await loaded[id]!.validateAll(files.map((f) => ({
      name: f, text: readFileSync(join(dir, f), 'utf8'),
    })))

    for (const format of ['text', 'json', 'markdown'] as const) {
      expect(formatReport(report, format, { color: false })).not.toContain(SKOLEM_PREFIX)
    }
  })
})

describe('the published shapes permit skolemization', () => {
  test.each(profiles.map((e) => e.id))('%s has no sh:nodeKind sh:BlankNode', (id) => {
    expect(loaded[id]!.skolemSafe).toBe(true)
  })
})

describe('reports never leak raw IRIs into the human layer', () => {
  test.each(profiles.map((e) => e.id))('%s', async (id) => {
    const entry = profiles.find((e) => e.id === id)!
    const dir = join(root, entry.examples)
    const files = readdirSync(dir).filter((f) => f.startsWith('invalid-')).sort()
    for (const file of files) {
      const report = await loaded[id]!.validate({
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
