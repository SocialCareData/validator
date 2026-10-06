/*
 * Regenerate test/expectations/<module>.json.
 *
 * These files pin the issue code and JSON path every invalid example should
 * produce, which is what turns the conformance suite from "did it fail?" into
 * "did it say the right thing?". Regenerating them records current behaviour -
 * including any bug you have just introduced - so read the diff before
 * committing it.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { exampleFiles, examplesDir, expectationsFile, standards, validatorFor } from '../test/helpers.js'

for (const standard of standards) {
  const validator = await validatorFor(standard)
  const dir = examplesDir(standard)
  const expectations: Record<string, { code: string, jsonPath: string }[]> = {}

  for (const file of exampleFiles(standard)) {
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

  const file = expectationsFile(standard)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(expectations, null, 2)}\n`)
  console.log(`${standard.name}: ${Object.keys(expectations).length} invalid example(s)`)
}
