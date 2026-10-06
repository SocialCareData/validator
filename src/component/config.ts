/*
 * What the validator is configured with, and how its URLs become fetchable.
 *
 * Kept free of the DOM and of engine values: the page's main thread imports it
 * to build the pickers, and Node tests import it to load the same standards.
 * Pulling in the RDF stack here would add ~500 kB to the main-thread bundle.
 */

import type { PatternHint } from '@theodi/data-standard-validator'

export interface ValidatorConfig {
  standards: StandardConfig[]
  /**
   * Git ref put into every GitHub-hosted shape and context URL. Defaults to
   * the ref written in the first GitHub shape URL.
   */
  ref?: string
  /** Plain-English names for the `sh:pattern` regexes the shapes use. */
  patterns?: PatternHint[]
  /** Shown in the empty editor. */
  placeholder?: string
  /** localStorage key for the last record; `false` turns persistence off. */
  storageKey?: string | false
}

export interface StandardConfig {
  /** The picker label, and what the verdict line says was checked. */
  name: string
  /** Help text under the picker. */
  description?: string
  /** SHACL shapes in Turtle, merged into one dataset in this order. */
  shapes: string | string[]
  /**
   * A JSON-LD context that replaces each record's own `@context`. Without
   * one, the record's own `@context` is loaded instead.
   */
  context?: string
  /** Offered under "Example". A bare URL is named after its file. */
  examples?: (string | { name: string, url: string })[]
}

export interface GitHubFile { owner: string, repo: string, ref: string, path: string }

/** What `loadValidator` needs for one standard at one ref. */
export interface ResolvedStandard { shapes: string[], context?: string }

/*
 * The ref is taken to be a single path segment. A ref containing `/` cannot
 * be told apart from the path in a URL, but can still be typed into the ref box.
 */
const BLOB = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/(?:blob|raw)\/([^/]+)\/(.+)$/
const RAW = /^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/

export function parseGitHubUrl (url: string): GitHubFile | undefined {
  const match = BLOB.exec(url) ?? RAW.exec(url)
  if (!match) return undefined
  const [, owner, repo, ref, path] = match as unknown as [string, string, string, string, string]
  return { owner, repo, ref, path }
}

/**
 * A URL a browser can fetch. GitHub page links become raw links, since only
 * raw.githubusercontent.com answers cross-origin requests; `ref` replaces the
 * ref written in the URL. Anything else is fetched as written.
 */
export function fetchUrl (url: string, ref?: string): string {
  const file = parseGitHubUrl(url)
  if (!file) return url
  return `https://raw.githubusercontent.com/${file.owner}/${file.repo}/${ref ?? file.ref}/${file.path}`
}

export function shapeList (standard: StandardConfig): string[] {
  return typeof standard.shapes === 'string' ? [standard.shapes] : standard.shapes
}

export function resolveStandard (standard: StandardConfig, ref?: string): ResolvedStandard {
  return {
    shapes: shapeList(standard).map((url) => fetchUrl(url, ref)),
    ...(standard.context !== undefined ? { context: fetchUrl(standard.context, ref) } : {}),
  }
}

function firstGitHubShape (config: ValidatorConfig): GitHubFile | undefined {
  for (const standard of config.standards) {
    for (const url of shapeList(standard)) {
      const file = parseGitHubUrl(url)
      if (file) return file
    }
  }
  return undefined
}

/** The ref the version box starts at; undefined when nothing is versionable. */
export function defaultRef (config: ValidatorConfig): string | undefined {
  return config.ref ?? firstGitHubShape(config)?.ref
}

/** Where the shapes live, for the version box's help text. */
export function shapesRepo (config: ValidatorConfig): { name: string, url: string } | undefined {
  const file = firstGitHubShape(config)
  if (!file) return undefined
  const name = `${file.owner}/${file.repo}`
  return { name, url: `https://github.com/${name}` }
}

export function exampleList (standard: StandardConfig): { name: string, url: string }[] {
  return (standard.examples ?? []).map((example) => typeof example === 'string'
    ? { name: decodeURIComponent(example.replace(/[?#].*$/, '').replace(/^.*\//, '').replace(/\.[^.]+$/, '')), url: example }
    : example)
}
