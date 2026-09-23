/*
 * Public API.
 *
 * Isomorphic throughout: nothing here touches the filesystem, so the same build
 * serves Node, bundlers and the browser.
 */

export { profiles, getProfile, rawUrl, DEFAULT_REF, ONTOLOGY_REPO } from './catalogue.js'
export type { Profile, ShapeRef } from './catalogue.js'

export { loadProfile } from './profile.js'
export type { LoadedProfile, LoadOptions } from './profile.js'

export { fetchText, FetchError, NotFoundError } from './fetch.js'
export type { Fetch } from './fetch.js'

export { Validator, createValidator } from './validate.js'
export type { DocumentInput } from './validate.js'

export { groupIssues } from './report.js'
export type {
  Issue, IssueCode, IssueGroup, Location, Severity, DocumentReport, CrossCheckReport, RunReport,
} from './report.js'

export { renderPretty } from './pretty.js'
export type { PrettyOptions } from './pretty.js'

export { skolemize, isSkolemIri, SKOLEM_PREFIX } from './skolemize.js'
export type { NodeLocation } from './skolemize.js'

export { ContextIndex } from './context.js'

import { loadProfile, type LoadOptions } from './profile.js'
import { createValidator, type DocumentInput } from './validate.js'
import type { RunReport } from './report.js'

/**
 * Validate one or more documents against a profile.
 *
 * ```ts
 * const report = await validate(myRecord, 'person:subject-of-care')
 * ```
 */
export async function validate (
  input: DocumentInput | string | object | (DocumentInput | string | object)[],
  profileId: string,
  opts: LoadOptions = {},
): Promise<RunReport> {
  const validator = createValidator(await loadProfile(profileId, opts))
  return validator.validateAll(Array.isArray(input) ? input : [input])
}
