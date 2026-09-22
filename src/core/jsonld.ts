/*
 * Deciding which @context a document should be read with, then getting it
 * into RDF.
 *
 * The examples that ship with this package declare relative contexts
 * (`"@context": "../context.jsonld"`) because they used to sit next to a
 * generated tree that contained one. They no longer do, and we deliberately do
 * not vendor contexts - they belong to the ontology repo. Rather than rewrite
 * 49 files (and then rewrite every file a user hands us), the loader decides:
 *
 *   1. inline object or array        -> use it
 *   2. relative path                 -> use the selected profile's context
 *   3. absolute URL                  -> fetch it (allowlisted)
 *   4. absent                        -> use the profile's context, and say so
 *   5. explicit --context override   -> beats all of the above
 *
 * Rule 4 is what lets somebody paste plain JSON into the web UI and get a
 * useful answer instead of "0 triples, everything conforms".
 */

import jsonld from 'jsonld'
import { parseNQuads } from './rdf.js'
import type { Dataset } from 'rdf-ext'

export type JsonLdContext = Record<string, unknown> | unknown[]

export interface ContextResolution {
  context: JsonLdContext | undefined
  /** True when the document did not name a context and we supplied one. */
  assumed: boolean
  /** True when the document named a relative path we could not honour. */
  substituted: boolean
  /** Where the context came from, for the report header. */
  source?: string
}

export interface ResolveContextOptions {
  /** Context belonging to the selected profile. */
  profileContext?: JsonLdContext
  profileContextUrl?: string
  /** `--context`, which wins outright. */
  override?: JsonLdContext
  overrideUrl?: string
  /** Fetches an absolute context URL. Injected so the browser and Node agree. */
  fetchContext?: (url: string) => Promise<JsonLdContext>
}

function isRelativeRef (value: string): boolean {
  return !/^[a-z][a-z0-9+.-]*:/i.test(value)
}

/** Unwrap `{"@context": {...}}` wrappers, which is how the files are written. */
export function unwrapContext (parsed: unknown): JsonLdContext {
  if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) &&
      '@context' in (parsed as Record<string, unknown>)) {
    return (parsed as Record<string, unknown>)['@context'] as JsonLdContext
  }
  return parsed as JsonLdContext
}

export async function resolveContext (
  doc: unknown,
  opts: ResolveContextOptions = {},
): Promise<ContextResolution> {
  if (opts.override !== undefined) {
    return {
      context: opts.override,
      assumed: false,
      substituted: false,
      ...(opts.overrideUrl !== undefined ? { source: opts.overrideUrl } : {}),
    }
  }

  const declared = (doc !== null && typeof doc === 'object' && !Array.isArray(doc))
    ? (doc as Record<string, unknown>)['@context']
    : undefined

  const profileSource = opts.profileContextUrl !== undefined
    ? { source: opts.profileContextUrl }
    : {}

  if (declared === undefined) {
    return { context: opts.profileContext, assumed: true, substituted: false, ...profileSource }
  }
  if (typeof declared === 'object' && declared !== null) {
    return { context: declared as JsonLdContext, assumed: false, substituted: false, source: 'inline' }
  }
  if (typeof declared === 'string') {
    if (isRelativeRef(declared)) {
      // The path is meaningless to us - it referred to a tree we do not have.
      return { context: opts.profileContext, assumed: false, substituted: true, ...profileSource }
    }
    if (opts.fetchContext) {
      const fetched = await opts.fetchContext(declared)
      return { context: fetched, assumed: false, substituted: false, source: declared }
    }
    return { context: opts.profileContext, assumed: false, substituted: true, ...profileSource }
  }
  return { context: opts.profileContext, assumed: true, substituted: false, ...profileSource }
}

/**
 * Convert a JSON-LD document to an RDF dataset.
 *
 * The document loader refuses every remote lookup: by this point the context
 * is already in hand, and a silent network fetch mid-conversion would make
 * results depend on whoever happens to be reachable.
 */
export async function toDataset (doc: unknown, context: JsonLdContext | undefined): Promise<Dataset> {
  const input = (doc !== null && typeof doc === 'object' && !Array.isArray(doc))
    ? { ...(doc as Record<string, unknown>), ...(context !== undefined ? { '@context': context } : {}) }
    : doc

  const nquads = await jsonld.toRDF(input, {
    format: 'application/n-quads',
    documentLoader: async (url: string) => {
      throw new Error(
        `refusing to fetch ${url} while converting the document - ` +
        'resolve contexts up front, not mid-conversion',
      )
    },
  }) as unknown as string

  return parseNQuads(nquads)
}
