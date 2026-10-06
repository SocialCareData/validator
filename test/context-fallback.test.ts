/*
 * A standard configured without a context falls back to each record's own
 * @context. The Social Care config does not rely on this yet (see
 * src/config.ts), so it is exercised here directly.
 */

import { describe, expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { examplesDir, standards, validatorFor } from './helpers.js'

const subjectOfCare = standards.find((s) => s.name === 'Person - subject of care')!
const withoutContext = { ...subjectOfCare, context: undefined }

describe('a standard with no configured context', () => {
  test('validates a record against the record\'s own @context', async () => {
    const validator = await validatorFor(withoutContext)
    const file = 'valid-subject-of-care.jsonld'
    const report = await validator.validate({
      name: file, text: readFileSync(join(examplesDir(subjectOfCare), file), 'utf8'),
    })
    expect(report.conforms).toBe(true)
    expect(report.issues.map((i) => i.code)).not.toContain('substituted-context')
  })

  test('says so when a record has no @context to fall back on', async () => {
    const validator = await validatorFor(withoutContext)
    const report = await validator.validate({ name: 'bare.json', json: { '@type': 'Person' } })
    expect(report.conforms).toBe(false)
    expect(report.issues.map((i) => i.code)).toContain('no-context')
  })
})
