/*
 * The gate that used to live in SocialCareData/standard.
 *
 * Its ontology-sync workflow ran these same examples against freshly generated
 * shapes and refused to publish if any misbehaved. The examples now live in
 * SocialCareData/ontology and the gate lives here, with one addition: as well
 * as asserting that `valid-*` conforms and `invalid-*` does not, each invalid example pins the
 * issue codes and JSON paths it should produce. That turns a pass/fail gate
 * into a regression test for the part people actually read.
 */

import { describe, expect, test, beforeAll } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import type { Validator } from '@theodi/data-standard-validator'
import { exampleFiles, examplesDir, expectationsFile, standards, validatorFor } from './helpers.js'

interface Expectation { code: string, jsonPath: string }

for (const standard of standards) {
  describe(standard.name, () => {
    let validator: Validator

    beforeAll(async () => {
      validator = await validatorFor(standard)
    })

    const dir = examplesDir(standard)
    const files = exampleFiles(standard)

    test('has examples', () => {
      expect(files.length).toBeGreaterThan(0)
    })

    const expectationsPath = expectationsFile(standard)
    const expectations: Record<string, Expectation[]> = existsSync(expectationsPath)
      ? JSON.parse(readFileSync(expectationsPath, 'utf8')) as Record<string, Expectation[]>
      : {}

    test.each(files)('%s', async (file) => {
      const shouldConform = file.startsWith('valid-')
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
