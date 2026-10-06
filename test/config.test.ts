/*
 * The config is the only place a standard is described, so it is checked like
 * code: its URLs must resolve the way the page resolves them, and the examples
 * it offers must be exactly the folder's valid records - an example added to a
 * folder but not to the config would never reach the page.
 */

import { describe, expect, test } from 'vitest'
import { config } from '../src/config.js'
import {
  defaultRef, exampleList, fetchUrl, parseGitHubUrl, resolveStandard, shapesRepo,
} from '../src/component/config.js'
import { exampleFiles, standards } from './helpers.js'

describe('GitHub URLs', () => {
  const blob = 'https://github.com/o/r/blob/main/dir/shape.ttl'
  const raw = 'https://raw.githubusercontent.com/o/r/main/dir/shape.ttl'

  test('page and raw links parse to the same file', () => {
    const expected = { owner: 'o', repo: 'r', ref: 'main', path: 'dir/shape.ttl' }
    expect(parseGitHubUrl(blob)).toEqual(expected)
    expect(parseGitHubUrl(raw)).toEqual(expected)
  })

  test('become raw links, at the requested ref', () => {
    expect(fetchUrl(blob)).toBe(raw)
    expect(fetchUrl(blob, 'v1.0.0')).toBe('https://raw.githubusercontent.com/o/r/v1.0.0/dir/shape.ttl')
    expect(fetchUrl(raw, 'v1.0.0')).toBe('https://raw.githubusercontent.com/o/r/v1.0.0/dir/shape.ttl')
  })

  test('anything else is fetched as written, whatever the ref', () => {
    expect(fetchUrl('https://example.org/shape.ttl', 'v1.0.0')).toBe('https://example.org/shape.ttl')
  })
})

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
