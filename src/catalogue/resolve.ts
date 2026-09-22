/*
 * Turning a profile name (or a pile of --shapes arguments) into something the
 * validator can run: a merged shape dataset, an inverted context, and an
 * honest account of anything that went missing on the way.
 */

import { getEntry, profileUrls, DEFAULT_REF, type CatalogueEntry } from './entries.js'
import { Fetcher, NotFoundError, type FetcherOptions } from './fetcher.js'
import { mergeTurtle } from '../core/rdf.js'
import { ContextIndex } from '../core/context.js'
import { requiresBlankNodes, declaredPaths } from '../core/shacl.js'
import { unwrapContext, type JsonLdContext } from '../core/jsonld.js'
import { CROSS_CHECKS, type CrossCheck } from '../core/cross-checks.js'
import type { Dataset } from 'rdf-ext'
import type { Issue } from '../report/types.js'

export interface LoadedProfile {
  id: string | null
  label: string | null
  ref: string
  shapes: Dataset
  /** URLs or paths the shapes actually came from. */
  shapeSources: string[]
  context?: JsonLdContext
  contextSource?: string
  contextIndex?: ContextIndex
  crossChecks: CrossCheck[]
  /** Every property path any shape mentions - powers did-you-mean. */
  declaredPaths: string[]
  /** True when no shape needs blank nodes, so paths can be traced. */
  skolemSafe: boolean
  /** Setup problems worth telling the user about, e.g. an unpublished shape. */
  warnings: Issue[]
}

/** Reads a local file. Supplied by the CLI; absent in the browser. */
export type LocalReader = (path: string) => Promise<string>

export interface LoadOptions extends FetcherOptions {
  ref?: string
  /** Explicit shape sources - a URL or a local path. Bypasses the catalogue. */
  shapes?: string[]
  /** Explicit context source. */
  context?: string
  readLocal?: LocalReader
}

function isUrl (value: string): boolean {
  return /^https?:\/\//i.test(value)
}

function warning (code: Issue['code'], title: string, hint?: string): Issue {
  return {
    id: `${code}:${title}`,
    severity: 'warning',
    code,
    title,
    ...(hint !== undefined ? { hint } : {}),
    location: { jsonPath: '$', pointer: '' },
  }
}

async function read (
  source: string,
  fetcher: Fetcher,
  readLocal: LocalReader | undefined,
  implicit: boolean,
): Promise<string> {
  if (isUrl(source)) return fetcher.text(source, { implicit })
  if (!readLocal) {
    throw new Error(
      `cannot read local path '${source}' here - only URLs are supported in the browser`,
    )
  }
  return readLocal(source)
}

export async function loadProfile (
  id: string | null,
  opts: LoadOptions = {},
): Promise<LoadedProfile> {
  const ref = opts.ref ?? DEFAULT_REF
  const fetcher = new Fetcher(opts)
  const warnings: Issue[] = []

  let entry: CatalogueEntry | undefined
  if (id !== null) {
    entry = getEntry(id)
    if (!entry) {
      throw new Error(`unknown profile '${id}'`)
    }
  }

  // --- shapes -------------------------------------------------------------
  const sources: { text: string, url?: string }[] = []
  const shapeSources: string[] = []

  if (opts.shapes && opts.shapes.length > 0) {
    for (const source of opts.shapes) {
      sources.push({ text: await read(source, fetcher, opts.readLocal, false), url: source })
      shapeSources.push(source)
    }
  } else if (entry) {
    const urls = profileUrls(entry.id, ref)
    for (const shape of urls.shapes) {
      try {
        sources.push({ text: await fetcher.text(shape.url), url: shape.url })
        shapeSources.push(shape.url)
      } catch (error) {
        if (shape.optional && error instanceof NotFoundError) {
          warnings.push(warning(
            'catalogue/shape-unavailable',
            `${shape.provides ?? 'an optional shape'} could not be loaded - validating without it`,
            `${shape.url} is not published at ref '${ref}'. Results are still valid, ` +
            'but these particular checks did not run.',
          ))
          continue
        }
        throw error
      }
    }
  } else {
    throw new Error('no profile selected and no --shapes given')
  }

  if (sources.length === 0) {
    throw new Error('no shapes could be loaded')
  }
  const shapes = mergeTurtle(sources)

  // --- context ------------------------------------------------------------
  let context: JsonLdContext | undefined
  let contextSource: string | undefined
  const contextRef = opts.context ?? (entry ? profileUrls(entry.id, ref).context : undefined)
  if (contextRef !== undefined) {
    try {
      const raw = await read(contextRef, fetcher, opts.readLocal, opts.context === undefined)
      context = unwrapContext(JSON.parse(raw))
      contextSource = contextRef
    } catch (error) {
      warnings.push(warning(
        'catalogue/shape-unavailable',
        'the JSON-LD context could not be loaded - field names will be shown as IRIs',
        `${contextRef}: ${(error as Error).message}`,
      ))
    }
  }

  const skolemSafe = !requiresBlankNodes(shapes)
  if (!skolemSafe) {
    warnings.push(warning(
      'catalogue/shape-unavailable',
      'a shape requires blank nodes, so results cannot be traced back to JSON paths',
      'Issues will name the nearest @id instead of a path.',
    ))
  }

  return {
    id: entry?.id ?? null,
    label: entry?.label ?? null,
    ref,
    shapes,
    shapeSources,
    ...(context !== undefined ? { context } : {}),
    ...(contextSource !== undefined ? { contextSource } : {}),
    ...(context !== undefined ? { contextIndex: new ContextIndex(context) } : {}),
    crossChecks: (entry?.crossChecks ?? [])
      .map((name) => CROSS_CHECKS[name])
      .filter((c): c is CrossCheck => c !== undefined),
    declaredPaths: declaredPaths(shapes),
    skolemSafe,
    warnings,
  }
}
