#!/usr/bin/env node
/*
 * The command line.
 *
 * Exit codes are the contract for CI:
 *   0  everything conformed (and every --expect was met)
 *   1  validation found problems
 *   2  bad usage, or a file could not be read
 *   3  shapes could not be loaded - network, ref or parse failure
 */

import { Command, Option } from 'commander'
import { createRequire } from 'node:module'
import { writeFile } from 'node:fs/promises'
import { loadProfile } from '../catalogue/resolve.js'
import { catalogue, profileUrls, DEFAULT_REF } from '../catalogue/entries.js'
import { createValidator } from '../core/validator.js'
import { render, type Format } from '../report/render/index.js'
import { Fetcher, FetchError } from '../catalogue/fetcher.js'
import { DiskCache, readLocal, readStdin, expectationFromName } from '../node.js'
import { explain, EXPLANATIONS } from './explain.js'
import type { DocumentInput } from '../core/validator.js'
import type { Severity } from '../report/types.js'

const require = createRequire(import.meta.url)
const pkg = require('../../package.json') as { version: string }

const EXIT_OK = 0
const EXIT_FINDINGS = 1
const EXIT_USAGE = 2
const EXIT_SHAPES = 3

interface ValidateFlags {
  profile?: string
  shapes?: string[]
  context?: string
  ref: string
  format?: string
  output?: string
  severity: Severity
  failOn: Severity
  expect: string
  crossChecks: boolean
  skolem: boolean
  offline: boolean
  cache: boolean
  cacheDir?: string
  maxIssues: string
  color: boolean
  quiet: boolean
  verbose: boolean
}

function chooseFormat (requested: string | undefined, isTty: boolean): Format {
  if (requested !== undefined && requested !== 'auto') return requested as Format
  if (process.env['GITHUB_ACTIONS'] === 'true') return 'github'
  return isTty ? 'pretty' : 'json'
}

async function runValidate (files: string[], flags: ValidateFlags): Promise<number> {
  const cache = flags.cacheDir !== undefined ? new DiskCache(flags.cacheDir) : new DiskCache()

  let profile
  try {
    profile = await loadProfile(flags.profile ?? null, {
      ref: flags.ref,
      ...(flags.shapes !== undefined ? { shapes: flags.shapes } : {}),
      ...(flags.context !== undefined ? { context: flags.context } : {}),
      readLocal,
      cache,
      offline: flags.offline,
      noCache: !flags.cache,
    })
  } catch (error) {
    process.stderr.write(`${(error as Error).message}\n`)
    if (error instanceof FetchError) {
      process.stderr.write(
        `\nCould not load shapes for ref '${flags.ref}'. ` +
        'Try --ref main, or check your network.\n',
      )
    }
    return error instanceof FetchError ? EXIT_SHAPES : EXIT_USAGE
  }

  // Read the documents.
  const sources = new Map<string, string>()
  const inputs: DocumentInput[] = []
  const wantExpectations = flags.expect !== 'none'
  try {
    if (files.length === 0 || (files.length === 1 && files[0] === '-')) {
      const text = await readStdin()
      sources.set('(stdin)', text)
      inputs.push({ name: '(stdin)', text })
    } else {
      const { readFile } = await import('node:fs/promises')
      for (const file of files) {
        const text = await readFile(file, 'utf8')
        sources.set(file, text)
        const expect = flags.expect === 'auto'
          ? expectationFromName(file)
          : flags.expect === 'valid' || flags.expect === 'invalid'
            ? flags.expect
            : undefined
        inputs.push({
          name: file,
          text,
          ...(wantExpectations && expect !== undefined ? { expect } : {}),
        })
      }
    }
  } catch (error) {
    process.stderr.write(`${(error as Error).message}\n`)
    return EXIT_USAGE
  }

  const fetcher = new Fetcher({ cache, offline: flags.offline, noCache: !flags.cache })
  const validator = createValidator(profile, {
    skolemize: flags.skolem,
    minSeverity: flags.severity,
    version: pkg.version,
    fetchContext: async (url) => {
      const raw = await fetcher.json(url)
      return (raw !== null && typeof raw === 'object' && '@context' in raw)
        ? (raw as Record<string, unknown>)['@context'] as never
        : raw as never
    },
  })

  const report = flags.crossChecks
    ? await validator.validateAll(inputs)
    : await validator.validateAll(inputs).then((r) => ({ ...r, crossChecks: [] }))

  const format = chooseFormat(flags.format, process.stdout.isTTY === true)
  const output = render(report, format, {
    color: flags.color && process.env['NO_COLOR'] === undefined,
    verbose: flags.verbose,
    maxIssues: Number(flags.maxIssues),
    sources,
  })

  if (flags.output !== undefined) await writeFile(flags.output, output, 'utf8')
  else if (!flags.quiet || format !== 'pretty') process.stdout.write(`${output}\n`)

  const threshold: Severity = flags.failOn
  const failed = report.documents.some((doc) =>
    doc.expectationMet === false ||
    doc.counts.violation > 0 ||
    (threshold === 'warning' && doc.counts.warning > 0),
  ) || report.crossChecks.some((c) => !c.ok)

  return failed ? EXIT_FINDINGS : EXIT_OK
}

const program = new Command()

program
  .name('scd-validate')
  .description(
    'Validate social care data against the published Social Care MAIS SHACL shapes.\n' +
    'Shapes are fetched from SocialCareData/ontology; nothing is bundled, so you are\n' +
    'always checking against the published standard.',
  )
  .version(pkg.version)

program
  .argument('[files...]', 'JSON or JSON-LD files to validate ("-" or nothing reads stdin)')
  .option('-p, --profile <id>', 'profile to validate against (see `scd-validate profiles`)')
  .option('-s, --shapes <path|url>', 'validate against this shape instead of a profile\'s', collect, undefined)
  .option('-c, --context <path|url>', 'JSON-LD context to interpret field names with')
  .option('-r, --ref <ref>', 'git ref in the ontology repo', DEFAULT_REF)
  .addOption(new Option('-f, --format <format>', 'output format')
    .choices(['auto', 'pretty', 'json', 'github', 'sarif', 'summary'])
    .default('auto'))
  .option('-o, --output <file>', 'write the report to a file instead of stdout')
  .addOption(new Option('--severity <level>', 'lowest severity to report')
    .choices(['violation', 'warning', 'info']).default('info'))
  .addOption(new Option('--fail-on <level>', 'exit 1 at this severity or above')
    .choices(['violation', 'warning']).default('violation'))
  .addOption(new Option('--expect <mode>', 'treat valid-*/invalid-* filenames as expectations')
    .choices(['none', 'auto', 'valid', 'invalid']).default('none'))
  .option('--no-cross-checks', 'skip checks that span the whole set of records')
  .option('--no-skolem', 'do not trace results back to JSON paths (debugging aid)')
  .option('--offline', 'never hit the network; fail if shapes are not cached', false)
  .option('--no-cache', 'ignore the on-disk cache')
  .option('--cache-dir <dir>', 'where to keep cached shapes')
  .option('--max-issues <n>', 'issues to print per document', '50')
  .option('--no-color', 'disable colour')
  .option('-q, --quiet', 'suppress the report, use the exit code', false)
  .option('-v, --verbose', 'include focus nodes, shape IRIs and constraint names', false)
  .action(async (files: string[], flags: ValidateFlags) => {
    process.exitCode = await runValidate(files, flags)
  })

program
  .command('profiles')
  .description('list the profiles this version knows about')
  .option('-r, --ref <ref>', 'git ref in the ontology repo', DEFAULT_REF)
  .option('--check', 'confirm every shape and context URL resolves', false)
  .option('--json', 'machine-readable output', false)
  .action(async (opts: { ref: string, check: boolean, json: boolean }) => {
    const rows = catalogue.map((entry) => ({
      id: entry.id,
      label: entry.label,
      describes: entry.describes,
      ...profileUrls(entry.id, opts.ref),
    }))

    if (opts.check) {
      const fetcher = new Fetcher({ cache: new DiskCache() })
      let bad = 0
      for (const row of rows) {
        for (const url of [...row.shapes.map((s) => s.url), row.context]) {
          try {
            await fetcher.text(url)
            process.stdout.write(`  ok      ${url}\n`)
          } catch (error) {
            const optional = row.shapes.find((s) => s.url === url)?.optional === true
            process.stdout.write(`  ${optional ? 'absent ' : 'MISSING'} ${url}\n`)
            if (!optional) bad++
            void error
          }
        }
      }
      process.exitCode = bad > 0 ? EXIT_SHAPES : EXIT_OK
      return
    }

    if (opts.json) {
      process.stdout.write(`${JSON.stringify(rows, null, 2)}\n`)
      return
    }

    process.stdout.write(`\nProfiles (ref ${opts.ref}):\n\n`)
    for (const row of rows) {
      process.stdout.write(`  ${row.id}\n`)
      process.stdout.write(`      ${row.label} - ${row.describes}\n\n`)
    }
    process.stdout.write('Validate with:  scd-validate -p <id> yourdata.jsonld\n\n')
  })

program
  .command('explain')
  .argument('<code>', 'an issue code from a report')
  .description('what an issue code means and how to fix it')
  .action((code: string) => {
    const text = explain(code)
    if (text === undefined) {
      process.stderr.write(
        `unknown code '${code}'. Known codes:\n  ${Object.keys(EXPLANATIONS).join('\n  ')}\n`,
      )
      process.exitCode = EXIT_USAGE
      return
    }
    process.stdout.write(`\n${code}\n\n${text}\n\n`)
  })

program
  .command('fetch')
  .description('download shapes into the cache, for offline use later')
  .option('-r, --ref <ref>', 'git ref in the ontology repo', DEFAULT_REF)
  .option('-p, --profile <id>', 'fetch only this profile')
  .action(async (opts: { ref: string, profile?: string }) => {
    const fetcher = new Fetcher({ cache: new DiskCache() })
    const entries = opts.profile !== undefined
      ? catalogue.filter((e) => e.id === opts.profile)
      : catalogue
    if (entries.length === 0) {
      process.stderr.write(`unknown profile '${opts.profile}'\n`)
      process.exitCode = EXIT_USAGE
      return
    }
    for (const entry of entries) {
      const urls = profileUrls(entry.id, opts.ref)
      for (const url of [...urls.shapes.map((s) => s.url), urls.context]) {
        try {
          await fetcher.text(url)
          process.stdout.write(`  cached  ${url}\n`)
        } catch {
          process.stdout.write(`  skipped ${url}\n`)
        }
      }
    }
  })

function collect (value: string, previous: string[] | undefined): string[] {
  return [...(previous ?? []), value]
}

program.parseAsync(process.argv).catch((error: unknown) => {
  process.stderr.write(`${(error as Error).message}\n`)
  process.exitCode = EXIT_USAGE
})
