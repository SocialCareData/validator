/*
 * The gate that used to live in SocialCareData/standard.
 *
 * Its ontology-sync workflow ran these same examples against freshly generated
 * shapes and refused to publish if any misbehaved. The examples now live here,
 * so the gate does too - with one addition: as well as asserting that
 * `valid-*` conforms and `invalid-*` does not, each invalid example pins the
 * issue codes and JSON paths it should produce. That turns a pass/fail gate
 * into a regression test for the part people actually read.
 */

import { describe, expect, test, beforeAll } from 'vitest'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { profiles } from '../src/catalogue.js'
import { loadProfile, type LoadedProfile } from '../src/profile.js'
import { createValidator } from '../src/validate.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

interface Expectation { code: string, jsonPath: string }

for (const entry of profiles) {
  describe(entry.id, () => {
    let profile: LoadedProfile

    beforeAll(async () => {
      profile = await loadProfile(entry.id)
    })

    const dir = join(root, entry.examples)
    const files = readdirSync(dir).filter((f) => f.endsWith('.jsonld')).sort()

    test('has examples', () => {
      expect(files.length).toBeGreaterThan(0)
    })

    const expectationsPath = join(dir, 'expectations.json')
    const expectations: Record<string, Expectation[]> = existsSync(expectationsPath)
      ? JSON.parse(readFileSync(expectationsPath, 'utf8')) as Record<string, Expectation[]>
      : {}

    test.each(files)('%s', async (file) => {
      const shouldConform = file.startsWith('valid-')
      const validator = createValidator(profile)
      const report = await validator.validate({
        name: file,
        text: readFileSync(join(dir, file), 'utf8'),
      })

      // The original gate, preserved exactly.
      expect(report.conforms).toBe(shouldConform)

      if (shouldConform) return

      // And the part the old gate could not check: that we say something useful.
      const actual = report.issues
        .filter((i) => i.severity === 'violation')
        .map((i) => ({ code: i.code, jsonPath: i.location.jsonPath }))
        .sort((a, b) => (a.jsonPath + a.code).localeCompare(b.jsonPath + b.code))

      expect(actual.length).toBeGreaterThan(0)
      for (const issue of actual) {
        expect(issue.code, `${file} produced an undescribed constraint`).not.toBe('other')
      }

      const pinned = expectations[file]
      if (pinned !== undefined) {
        expect(actual).toEqual([...pinned].sort((a, b) =>
          (a.jsonPath + a.code).localeCompare(b.jsonPath + b.code)))
      }
    })
  })
}
