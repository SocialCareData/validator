/*
 * Public API.
 *
 * Isomorphic throughout: nothing here touches the filesystem, so the same build
 * serves Node, bundlers and the browser.
 */

export { profiles, getProfile, rawUrl, DEFAULT_REF, ONTOLOGY_REPO } from './shapes/catalogue.js'
export type { Profile, ShapeRef } from './shapes/catalogue.js'

export { loadProfile } from './shapes/profile.js'
export type { LoadedProfile, LoadOptions } from './shapes/profile.js'

export { fetchText, FetchError, NotFoundError } from './shapes/fetch.js'
export type { Fetch } from './shapes/fetch.js'

export { Validator, createValidator } from './validator.js'
export type { DocumentInput } from './validator.js'

export { groupIssues } from './report/build.js'
export type { IssueGroup } from './report/build.js'
export type {
  Issue, IssueCode, Location, Severity, DocumentReport, CrossCheckReport, RunReport,
} from './report/types.js'

export { renderPretty } from './report/pretty.js'
export type { PrettyOptions } from './report/pretty.js'

export { skolemize, isSkolemIri, SKOLEM_PREFIX } from './document/skolemize.js'
export type { NodeLocation } from './document/skolemize.js'

export { ContextIndex } from './document/context.js'

import { loadProfile, type LoadOptions } from './shapes/profile.js'
import { createValidator, type DocumentInput } from './validator.js'
import type { RunReport } from './report/types.js'

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
