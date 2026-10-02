/*
 * Regenerate examples/<module>/expectations.json.
 *
 * These files pin the issue code and JSON path every invalid example should
 * produce, which is what turns the conformance suite from "did it fail?" into
 * "did it say the right thing?". Regenerating them records current behaviour -
 * including any bug you have just introduced - so read the diff before
 * committing it.
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { profiles } from '../src/catalogue.js'
import { profileValidator } from '../src/profile.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

for (const profile of profiles) {
  const validator = await profileValidator(profile.id)
  const dir = join(root, profile.examples)
  const expectations: Record<string, { code: string, jsonPath: string }[]> = {}

  for (const file of readdirSync(dir).filter((f) => f.endsWith('.jsonld')).sort()) {
    if (file.startsWith('valid-')) continue
    const report = await validator.validate({
      name: file,
      text: readFileSync(join(dir, file), 'utf8'),
    })
    expectations[file] = report.issues
      .filter((i) => i.severity === 'violation')
      .map((i) => ({ code: i.code, jsonPath: i.location.jsonPath }))
      .sort((a, b) => (a.jsonPath + a.code).localeCompare(b.jsonPath + b.code))
  }

  writeFileSync(join(dir, 'expectations.json'), `${JSON.stringify(expectations, null, 2)}\n`)
  console.log(`${profile.id}: ${Object.keys(expectations).length} invalid example(s)`)
}
