/*
 * Guards on the mechanism that makes readable paths possible.
 *
 * Skolemization rewrites the graph before it is validated. That is only
 * acceptable if it provably changes no verdict, and if the synthetic
 * identifiers never escape into anything a user reads.
 */

import { describe, expect, test, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { formatReport, SKOLEM_PREFIX, type Validator } from '@theodi/data-standard-validator'
import { exampleFiles, examplesDir, standards, validatorFor } from './helpers.js'

const loaded: Record<string, Validator> = {}
const unskolemized: Record<string, Validator> = {}

beforeAll(async () => {
  for (const standard of standards) {
    loaded[standard.name] = await validatorFor(standard)
    unskolemized[standard.name] = await validatorFor(standard, { skolemize: false })
  }
})

const names = standards.map((s) => s.name)
const byName = (name: string): (typeof standards)[number] => standards.find((s) => s.name === name)!

describe('skolemization is verdict-neutral', () => {
  for (const standard of standards) {
    const dir = examplesDir(standard)

    test.each(exampleFiles(standard))(`${standard.name} / %s`, async (file) => {
      const text = readFileSync(join(dir, file), 'utf8')

      const withSkolem = await loaded[standard.name]!.validate({ name: file, text })
      const without = await unskolemized[standard.name]!.validate({ name: file, text })

      expect(without.conforms).toBe(withSkolem.conforms)
    })
  }
})

describe('synthetic identifiers stay internal', () => {
  test.each(names)('%s', async (name) => {
    const dir = examplesDir(byName(name))
    const report = await loaded[name]!.validateAll(exampleFiles(byName(name)).map((f) => ({
      name: f, text: readFileSync(join(dir, f), 'utf8'),
    })))

    for (const format of ['text', 'json', 'markdown'] as const) {
      expect(formatReport(report, format, { color: false })).not.toContain(SKOLEM_PREFIX)
    }
  })
})

describe('the published shapes permit skolemization', () => {
  test.each(names)('%s has no sh:nodeKind sh:BlankNode', (name) => {
    expect(loaded[name]!.skolemSafe).toBe(true)
  })
})

describe('reports never leak raw IRIs into the human layer', () => {
  test.each(names)('%s', async (name) => {
    const dir = examplesDir(byName(name))
    for (const file of exampleFiles(byName(name)).filter((f) => f.startsWith('invalid-'))) {
      const report = await loaded[name]!.validate({
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
