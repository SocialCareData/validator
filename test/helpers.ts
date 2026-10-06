/*
 * The configured standards, loaded the way the page's worker loads them, and
 * pointed at a local checkout of SocialCareData/ontology's examples rather
 * than the ones on GitHub.
 */

import { existsSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Validator } from '@theodi/data-standard-validator'
import { config } from '../src/config.js'
import {
  defaultRef, exampleList, parseGitHubUrl, resolveStandard, type StandardConfig,
} from '../src/component/config.js'
import { loadValidator, type LoadOptions } from '../src/component/engine.js'

export const root = join(dirname(fileURLToPath(import.meta.url)), '..')

export const standards: readonly StandardConfig[] = config.standards

export function validatorFor (
  standard: StandardConfig, opts: Partial<LoadOptions> = {},
): Promise<Validator> {
  return loadValidator({
    ...resolveStandard(standard, defaultRef(config)),
    ...(config.patterns !== undefined ? { patterns: config.patterns } : {}),
    ...opts,
  })
}

/**
 * The local checkout of SocialCareData/ontology that holds the examples: the
 * ONTOLOGY_DIR environment variable, or a clone next to this repository.
 */
export const ontologyDir = resolve(process.env['ONTOLOGY_DIR'] ?? join(root, '..', 'ontology'))

/**
 * A standard's examples, as the path below `examples/` in the ontology
 * repository: the folder of its first configured example. The invalid examples
 * live alongside, unlisted, as the conformance suite's negative cases.
 */
export function examplesPath (standard: StandardConfig): string {
  const first = exampleList(standard)[0]
  const file = first !== undefined ? parseGitHubUrl(first.url) : undefined
  if (!file || `${file.owner}/${file.repo}` !== 'SocialCareData/ontology' || !file.path.startsWith('examples/')) {
    throw new Error(`${standard.name}: examples must be files under examples/ in SocialCareData/ontology`)
  }
  return dirname(file.path).slice('examples/'.length)
}

export function examplesDir (standard: StandardConfig): string {
  const examples = join(ontologyDir, 'examples')
  if (!existsSync(examples)) {
    throw new Error(`No examples at ${examples}. Clone SocialCareData/ontology next to this repository, or set ONTOLOGY_DIR to a checkout of it.`)
  }
  return join(examples, examplesPath(standard))
}

export function exampleFiles (standard: StandardConfig): string[] {
  return readdirSync(examplesDir(standard)).filter((f) => f.endsWith('.jsonld')).sort()
}

/**
 * What a standard's invalid examples should report. Kept here rather than with
 * the examples, because it pins this validator's wording, not the standard.
 */
export function expectationsFile (standard: StandardConfig): string {
  return join(root, 'test', 'expectations', `${examplesPath(standard)}.json`)
}
