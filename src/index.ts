/*
 * Public API.
 *
 * Isomorphic: this entry point never touches the filesystem, so the same build
 * serves Node, bundlers and the browser. Node-only helpers (reading files,
 * stdin, the disk cache) live in `@socialcaredata/validator/node`.
 */

export { catalogue, getEntry, profileUrls, rawUrl, DEFAULT_REF, ONTOLOGY_REPO } from './catalogue/entries.js'
export type { CatalogueEntry, ShapeRef, ProfileUrls } from './catalogue/entries.js'

export { loadProfile } from './catalogue/resolve.js'
export type { LoadedProfile, LoadOptions, LocalReader } from './catalogue/resolve.js'

export { Fetcher, MemoryCache, FetchError, NotFoundError, ALLOWED_HOSTS } from './catalogue/fetcher.js'
export type { FetchCache, CacheEntry, FetcherOptions } from './catalogue/fetcher.js'

export { Validator, createValidator, VALIDATOR_NAME } from './core/validator.js'
export type { DocumentInput, ValidatorOptions } from './core/validator.js'

export { skolemize, isSkolemIri, SKOLEM_PREFIX } from './core/skolemize.js'
export type { NodeLocation, SkolemizeResult } from './core/skolemize.js'

export { ContextIndex } from './core/context.js'
export { CROSS_CHECKS, duplicateChildId } from './core/cross-checks.js'
export type { CrossCheck, CrossCheckResult } from './core/cross-checks.js'

export { render, renderPretty } from './report/render/index.js'
export type { Format, RenderOptions } from './report/render/index.js'

export { SCHEMA_VERSION } from './report/types.js'
export type {
  Issue, IssueCode, IssueGroup, Location, Expectation, Severity,
  DocumentReport, CrossCheckReport, RunReport,
} from './report/types.js'

import { loadProfile, type LoadOptions, type LoadedProfile } from './catalogue/resolve.js'
import { createValidator, type DocumentInput, type ValidatorOptions } from './core/validator.js'
import type { RunReport } from './report/types.js'

/**
 * Validate one or more documents against a profile, in a single call.
 *
 * ```ts
 * const report = await validate(myJson, 'person:subject-of-care')
 * ```
 */
export async function validate (
  input: DocumentInput | string | object | (DocumentInput | string | object)[],
  profile: string | LoadedProfile,
  opts: LoadOptions & ValidatorOptions = {},
): Promise<RunReport> {
  const loaded = typeof profile === 'string' ? await loadProfile(profile, opts) : profile
  const validator = createValidator(loaded, opts)
  return validator.validateAll(Array.isArray(input) ? input : [input])
}
