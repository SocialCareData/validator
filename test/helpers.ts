/*
 * The configured standards, and where their examples sit in a local checkout
 * of SocialCareData/ontology rather than on GitHub.
 */

import { existsSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from '../src/config.js'
import {
  exampleList, parseGitHubUrl, type StandardConfig,
} from '@theodi/data-standard-validator-component/config'

export const root = join(dirname(fileURLToPath(import.meta.url)), '..')

export const standards: readonly StandardConfig[] = config.standards

/**
 * The local checkout of SocialCareData/ontology that holds the examples: the
 * ONTOLOGY_DIR environment variable, or a clone next to this repository.
 */
export const ontologyDir = resolve(process.env['ONTOLOGY_DIR'] ?? join(root, '..', 'ontology'))

/**
 * A standard's examples, as the path below `examples/` in the ontology
 * repository: the folder of its first configured example.
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
