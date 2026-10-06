/*
 * The configured standards, loaded the way the page's worker loads them, and
 * pointed at this working tree's examples rather than the ones on GitHub.
 */

import { readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
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
 * The local folder holding a standard's examples: the folder of its first
 * configured example, which must be a file in this repository. The invalid
 * examples live alongside, unlisted, as the conformance suite's negative cases.
 */
export function examplesDir (standard: StandardConfig): string {
  const first = exampleList(standard)[0]
  const file = first !== undefined ? parseGitHubUrl(first.url) : undefined
  if (!file || `${file.owner}/${file.repo}` !== 'SocialCareData/validator') {
    throw new Error(`${standard.name}: examples must be files in SocialCareData/validator`)
  }
  return join(root, dirname(file.path))
}

export function exampleFiles (standard: StandardConfig): string[] {
  return readdirSync(examplesDir(standard)).filter((f) => f.endsWith('.jsonld')).sort()
}
