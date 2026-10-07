/*
 * The config is the only place a standard is described, so it is checked like
 * code: its URLs must resolve the way the page resolves them (how GitHub URLs
 * are rewritten is tested in the component), and the examples
 * it offers must be exactly the folder's valid records - an example added to a
 * folder but not to the config would never reach the page.
 */

import { describe, expect, test } from 'vitest'
import { config } from '../src/config.js'
import {
  defaultRef, exampleList, resolveStandard, shapesRepo,
} from '@theodi/data-standard-validator-component/config'
import { exampleFiles, standards } from './helpers.js'

describe('the Social Care config', () => {
  test('versions shapes and contexts from the ontology repo', () => {
    expect(defaultRef(config)).toBe('main')
    expect(shapesRepo(config)?.name).toBe('SocialCareData/ontology')
    for (const standard of standards) {
      const resolved = resolveStandard(standard, 'v2026-09-30')
      for (const url of [...resolved.shapes, resolved.context]) {
        expect(url).toMatch(/^https:\/\/raw\.githubusercontent\.com\/SocialCareData\/ontology\/v2026-09-30\//)
      }
    }
  })

  test.each(standards.map((s) => s.name))('%s offers exactly its folder\'s valid examples', (name) => {
    const standard = standards.find((s) => s.name === name)!
    const offered = exampleList(standard).map((e) => `${e.name}.jsonld`).sort()
    expect(offered).toEqual(exampleFiles(standard).filter((f) => f.startsWith('valid-')))
  })
})
