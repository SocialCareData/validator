/*
 * Turning a profile name into something the validator can run: a merged shape
 * dataset, an inverted context, and an honest account of anything missing.
 */

import { getProfile, rawUrl, DEFAULT_REF } from './catalogue.js'
import { fetchText, NotFoundError, type Fetch } from './fetch.js'
import { mergeTurtle } from './rdf.js'
import { ContextIndex } from './context.js'
import { requiresBlankNodes } from './shacl.js'
import { unwrapContext, type JsonLdContext } from './jsonld.js'
import { CROSS_CHECKS, type CrossCheck } from './cross-checks.js'
import { noteIssue, type Issue } from './report.js'
import type { Dataset } from 'rdf-ext'

export interface LoadedProfile {
  id: string
  label: string
  ref: string
  shapes: Dataset
  shapeSources: string[]
  context?: JsonLdContext
  contextSource?: string
  contextIndex?: ContextIndex
  crossChecks: CrossCheck[]
  /** True when no shape needs blank nodes, so paths can be traced. */
  skolemSafe: boolean
  /** Setup problems worth telling the user about. */
  warnings: Issue[]
}

export interface LoadOptions {
  ref?: string
  fetch?: Fetch
}

// Loading a profile parses ~20k lines of Turtle. Callers validating many
// documents, and the web page, should not pay for that twice.
const loaded = new Map<string, Promise<LoadedProfile>>()

export function loadProfile (id: string, opts: LoadOptions = {}): Promise<LoadedProfile> {
  const ref = opts.ref ?? DEFAULT_REF
  const key = `${id}@${ref}`
  let pending = loaded.get(key)
  if (!pending) {
    pending = load(id, ref, opts.fetch)
    loaded.set(key, pending)
  }
  return pending
}

async function load (id: string, ref: string, doFetch?: Fetch): Promise<LoadedProfile> {
  const profile = getProfile(id)
  if (!profile) throw new Error(`unknown profile '${id}'`)

  const warnings: Issue[] = []
  const sources: { text: string, url?: string }[] = []
  const shapeSources: string[] = []

  for (const shape of profile.shapes) {
    const url = rawUrl(ref, shape.file)
    try {
      sources.push({ text: await fetchText(url, doFetch), url })
      shapeSources.push(url)
    } catch (error) {
      if (shape.optional === true && error instanceof NotFoundError) {
        warnings.push(noteIssue(
          'shape-unavailable',
          `${shape.provides ?? 'an optional shape'} could not be loaded - validating without it`,
          `${url} is not published at ref '${ref}'. Everything reported is still ` +
          'accurate, but these particular checks did not run.',
        ))
        continue
      }
      throw error
    }
  }
  if (sources.length === 0) throw new Error(`no shapes could be loaded for '${id}'`)

  const contextUrl = rawUrl(ref, profile.context)
  let context: JsonLdContext | undefined
  let contextSource: string | undefined
  try {
    context = unwrapContext(JSON.parse(await fetchText(contextUrl, doFetch)))
    contextSource = contextUrl
  } catch (error) {
    warnings.push(noteIssue(
      'shape-unavailable',
      'the JSON-LD context could not be loaded - field names will be shown as IRIs',
      `${contextUrl}: ${(error as Error).message}`,
    ))
  }

  const shapes = mergeTurtle(sources)
  const skolemSafe = !requiresBlankNodes(shapes)
  if (!skolemSafe) {
    warnings.push(noteIssue(
      'shape-unavailable',
      'a shape requires blank nodes, so results cannot be traced back to JSON paths',
      'Issues will name the nearest @id instead of a path.',
    ))
  }

  return {
    id: profile.id,
    label: profile.label,
    ref,
    shapes,
    shapeSources,
    ...(context !== undefined ? { context, contextIndex: new ContextIndex(context) } : {}),
    ...(contextSource !== undefined ? { contextSource } : {}),
    crossChecks: profile.crossChecks
      .map((name) => CROSS_CHECKS[name])
      .filter((c): c is CrossCheck => c !== undefined),
    skolemSafe,
    warnings,
  }
}
