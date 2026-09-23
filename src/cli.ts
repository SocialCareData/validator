#!/usr/bin/env node
/*
 * One command: validate files against a profile.
 *
 * Exit codes are the contract for scripts:
 *   0  everything conformed
 *   1  problems were found
 *   2  bad usage, or a file could not be read
 *   3  shapes could not be loaded - network, or a bad --ref
 */

import { Command, Option } from 'commander'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { profiles, DEFAULT_REF } from './catalogue.js'
import { loadProfile } from './profile.js'
import { createValidator } from './validate.js'
import { renderPretty } from './pretty.js'
import { FetchError } from './fetch.js'
import type { DocumentInput } from './validate.js'

const require = createRequire(import.meta.url)
const pkg = require('../package.json') as { version: string }

const EXIT_OK = 0
const EXIT_FINDINGS = 1
const EXIT_USAGE = 2
const EXIT_SHAPES = 3

interface Flags {
  profile?: string
  ref: string
  json: boolean
}

async function readStdin (): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}

async function run (files: string[], flags: Flags): Promise<number> {
  if (flags.profile === undefined) {
    process.stderr.write(
      'a profile is required: -p <id>\n\n' +
      `${profiles.map((p) => `  ${p.id.padEnd(24)} ${p.label}`).join('\n')}\n`,
    )
    return EXIT_USAGE
  }

  let profile
  try {
    profile = await loadProfile(flags.profile, { ref: flags.ref })
  } catch (error) {
    process.stderr.write(`${(error as Error).message}\n`)
    if (error instanceof FetchError) {
      process.stderr.write(`\nCould not load shapes for ref '${flags.ref}'. Try --ref main.\n`)
      return EXIT_SHAPES
    }
    return EXIT_USAGE
  }

  const sources = new Map<string, string>()
  const inputs: DocumentInput[] = []
  try {
    if (files.length === 0 || (files.length === 1 && files[0] === '-')) {
      const text = await readStdin()
      sources.set('(stdin)', text)
      inputs.push({ name: '(stdin)', text })
    } else {
      for (const file of files) {
        const text = await readFile(file, 'utf8')
        sources.set(file, text)
        inputs.push({ name: file, text })
      }
    }
  } catch (error) {
    process.stderr.write(`${(error as Error).message}\n`)
    return EXIT_USAGE
  }

  const report = await createValidator(profile).validateAll(inputs)

  process.stdout.write(flags.json
    ? `${JSON.stringify(report, null, 2)}\n`
    : `${renderPretty(report, {
        color: process.stdout.isTTY === true && process.env['NO_COLOR'] === undefined,
        sources,
      })}\n`)

  return report.conforms ? EXIT_OK : EXIT_FINDINGS
}

const program = new Command()

program
  .name('scd-validate')
  .description(
    'Validate social care data against the published Social Care MAIS SHACL shapes.\n\n' +
    'Shapes are fetched from SocialCareData/ontology at run time; nothing is\n' +
    'bundled, so you are always checking against the published standard.',
  )
  .version(pkg.version)
  .argument('[files...]', 'JSON or JSON-LD files ("-" or nothing reads stdin)')
  .addOption(new Option('-p, --profile <id>', 'standard to validate against')
    .choices(profiles.map((p) => p.id)))
  .option('-r, --ref <ref>', 'tag, branch or commit in the ontology repo', DEFAULT_REF)
  .option('--json', 'machine-readable output', false)
  .addHelpText('after', `\nProfiles:\n${
    profiles.map((p) => `  ${p.id.padEnd(24)} ${p.label}`).join('\n')
  }\n\nExamples:\n` +
    '  scd-validate -p person:subject-of-care record.jsonld\n' +
    '  scd-validate -p placements data/*.jsonld\n' +
    '  scd-validate -p safeguarding --ref v2026.1.0 record.jsonld\n' +
    '  cat record.jsonld | scd-validate -p placements --json\n')
  .action(async (files: string[], flags: Flags) => {
    process.exitCode = await run(files, flags)
  })

program.parseAsync(process.argv).catch((error: unknown) => {
  process.stderr.write(`${(error as Error).message}\n`)
  process.exitCode = EXIT_USAGE
})
