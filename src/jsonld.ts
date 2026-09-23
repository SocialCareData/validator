/*
 * Deciding which @context a document is read with, then getting it into RDF.
 *
 * The examples in this package declare relative contexts
 * (`"@context": "../context.jsonld"`) inherited from where they used to live,
 * and users' files may name a context we have no copy of. Rather than rewrite
 * files or fetch arbitrary URLs, there is one rule: an inline context is used
 * as written, and anything else falls back to the selected profile's published
 * context - which is the one that matches the shapes being validated against.
 *
 * That also means pasting plain JSON with no @context at all just works, which
 * is the common case in the browser.
 */

import jsonld from 'jsonld'
import { parseNQuads } from './rdf.js'
import type { Dataset } from 'rdf-ext'

export type JsonLdContext = Record<string, unknown> | unknown[]

/** Why the context in use is not the one the document named. */
export type ContextNote = 'assumed' | 'substituted'

export interface ResolvedContext {
  context: JsonLdContext | undefined
  note?: ContextNote
}

/** Unwrap `{"@context": {...}}`, which is how the published files are written. */
export function unwrapContext (parsed: unknown): JsonLdContext {
  if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) &&
      '@context' in (parsed as Record<string, unknown>)) {
    return (parsed as Record<string, unknown>)['@context'] as JsonLdContext
  }
  return parsed as JsonLdContext
}

export function resolveContext (
  doc: unknown,
  profileContext: JsonLdContext | undefined,
): ResolvedContext {
  const declared = (doc !== null && typeof doc === 'object' && !Array.isArray(doc))
    ? (doc as Record<string, unknown>)['@context']
    : undefined

  if (declared !== undefined && typeof declared === 'object' && declared !== null) {
    return { context: declared as JsonLdContext }
  }
  if (declared === undefined) {
    return { context: profileContext, note: 'assumed' }
  }
  // A string: a path or URL pointing at a file we do not have.
  return { context: profileContext, note: 'substituted' }
}

/**
 * Convert a JSON-LD document to RDF.
 *
 * The document loader refuses every remote lookup: the context is already in
 * hand by this point, and a silent fetch mid-conversion would make results
 * depend on whoever happens to be reachable.
 */
export async function toDataset (
  doc: unknown,
  context: JsonLdContext | undefined,
): Promise<Dataset> {
  const input = (doc !== null && typeof doc === 'object' && !Array.isArray(doc))
    ? { ...(doc as Record<string, unknown>), ...(context !== undefined ? { '@context': context } : {}) }
    : doc

  const nquads = await jsonld.toRDF(input, {
    format: 'application/n-quads',
    documentLoader: async (url: string) => {
      throw new Error(`refusing to fetch ${url} while converting the document`)
    },
  }) as unknown as string

  return parseNQuads(nquads)
}
