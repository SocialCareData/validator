/*
 * Run every bundled example through the CLI, one file per invocation.
 *
 * The conformance suite already checks verdicts through the library; this
 * checks them through the binary a user actually runs, exit codes included.
 * `valid-*` must exit 0 and `invalid-*` must exit 1 - anything else (2 usage,
 * 3 shapes unavailable) is a failure, so a network outage cannot pass for a
 * correctly rejected record. Files go one at a time because cross-checks such
 * as duplicateChildId would otherwise compare the examples with each other.
 *
 *   node scripts/validate-examples.mjs [path/to/scd-validate]
 */

import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { profiles } from '../dist/index.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const cli = process.argv[2] ?? join(root, 'dist', 'cli.js')
const isScript = cli.endsWith('.js')

if (!existsSync(cli)) {
  console.error(`no CLI at ${cli} - run \`npm run build\` first`)
  process.exit(2)
}

let failures = 0
let total = 0

for (const profile of profiles) {
  const dir = join(root, profile.examples)
  const files = readdirSync(dir).filter((f) => f.endsWith('.jsonld')).sort()

  for (const file of files) {
    const expected = file.startsWith('valid-') ? 0 : file.startsWith('invalid-') ? 1 : undefined
    if (expected === undefined) continue
    total++

    const path = join(dir, file)
    const args = ['-p', profile.id, path]
    const result = isScript
      ? spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' })
      : spawnSync(cli, args, { encoding: 'utf8' })

    const name = relative(root, path)
    if (result.status === expected) {
      console.log(`ok    ${name}`)
    } else {
      failures++
      console.log(`FAIL  ${name}: expected exit ${expected}, got ${result.status ?? result.signal}`)
      process.stdout.write(result.stdout ?? '')
      process.stderr.write(result.stderr || `${result.error?.message ?? ''}\n`)
    }
  }
}

console.log(`\n${total - failures}/${total} examples gave the expected verdict`)
if (total === 0 || failures > 0) process.exitCode = 1
