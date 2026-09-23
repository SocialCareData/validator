/*
 * The duplicate-childId check matches on the flat namespace
 * https://ontology.socialcaredata.io/childId. Point it at the wrong namespace
 * and it matches nothing and passes silently - which is how the original
 * version of this check behaved for a while. These fixtures really do collide,
 * so a vacuous check fails the test rather than passing it.
 */

import { describe, expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadProfile } from '../src/shapes/profile.js'
import { createValidator } from '../src/validator.js'

const fixtures = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'cross-checks')

describe('duplicateChildId', () => {
  test('flags the same childId across two records', async () => {
    const profile = await loadProfile('placements')
    const validator = createValidator(profile)
    const report = await validator.validateAll(
      ['duplicate-a.jsonld', 'duplicate-b.jsonld'].map((name) => ({
        name, text: readFileSync(join(fixtures, name), 'utf8'),
      })),
    )

    const check = report.crossChecks.find((c) => c.id === 'duplicate-child-id')
    expect(check, 'the placements profile should run the duplicate-childId check').toBeDefined()
    expect(check!.ok).toBe(false)
    expect(check!.findings).toHaveLength(1)
    expect(check!.findings[0]!.message).toContain('ABCD2012')
    expect(check!.findings[0]!.documents).toEqual(['duplicate-a.jsonld', 'duplicate-b.jsonld'])
    expect(report.conforms).toBe(false)
  })

  test('passes when each record has its own childId', async () => {
    const profile = await loadProfile('placements')
    const validator = createValidator(profile)
    const a = JSON.parse(readFileSync(join(fixtures, 'duplicate-a.jsonld'), 'utf8')) as Record<string, unknown>
    const b = JSON.parse(readFileSync(join(fixtures, 'duplicate-b.jsonld'), 'utf8')) as Record<string, unknown>
    b['childId'] = 'WXYZ2013'

    const report = await validator.validateAll([
      { name: 'a.jsonld', data: a },
      { name: 'b.jsonld', data: b },
    ])
    expect(report.crossChecks[0]!.ok).toBe(true)
  })
})
