/*
 * Fetching shape and context files, with a cache in front.
 *
 * Isomorphic on purpose: `fetch` and the cache are both injected, so the CLI
 * (disk cache) and the web UI (Cache API / memory) run identical code. The host
 * allowlist applies to *implicit* fetches only - the ones the catalogue decides
 * to make on the user's behalf. An explicit `--shapes https://...` is the user
 * telling us where to look, and is not second-guessed.
 */

export interface CacheEntry {
  body: string
  etag?: string
  fetchedAt: number
}

export interface FetchCache {
  get(key: string): Promise<CacheEntry | undefined>
  set(key: string, entry: CacheEntry): Promise<void>
}

export class MemoryCache implements FetchCache {
  private readonly store = new Map<string, CacheEntry>()
  async get (key: string): Promise<CacheEntry | undefined> { return this.store.get(key) }
  async set (key: string, entry: CacheEntry): Promise<void> { this.store.set(key, entry) }
}

export const ALLOWED_HOSTS = ['raw.githubusercontent.com', 'ontology.socialcaredata.io']

export class FetchError extends Error {
  constructor (message: string, readonly url: string, readonly status?: number) {
    super(message)
    this.name = 'FetchError'
  }
}

export class NotFoundError extends FetchError {
  constructor (url: string) {
    super(`not found: ${url}`, url, 404)
    this.name = 'NotFoundError'
  }
}

export interface FetcherOptions {
  fetch?: typeof globalThis.fetch
  cache?: FetchCache
  /** Never hit the network; fail if the cache misses. */
  offline?: boolean
  /** Skip the cache entirely. */
  noCache?: boolean
  /** Widen the allowlist for implicit fetches. */
  allowAnyHost?: boolean
  signal?: AbortSignal
  retries?: number
}

/**
 * A ref that cannot move (a tag or a full SHA) is cached indefinitely; a branch
 * is revalidated, because `main` is the default and does move.
 */
function isImmutableRef (url: string): boolean {
  const match = /raw\.githubusercontent\.com\/[^/]+\/[^/]+\/([^/]+)\//.exec(url)
  const ref = match?.[1]
  if (ref === undefined) return false
  if (/^[0-9a-f]{40}$/.test(ref)) return true
  return /^v?\d+\.\d+/.test(ref)
}

const MUTABLE_TTL_MS = 10 * 60 * 1000

export class Fetcher {
  private readonly doFetch: typeof globalThis.fetch
  private readonly cache: FetchCache
  private readonly inflight = new Map<string, Promise<string>>()

  constructor (private readonly opts: FetcherOptions = {}) {
    const injected = opts.fetch ?? globalThis.fetch
    if (typeof injected !== 'function') {
      throw new Error('no fetch implementation available - pass one via options.fetch')
    }
    this.doFetch = injected.bind(globalThis)
    this.cache = opts.cache ?? new MemoryCache()
  }

  private assertAllowed (url: string, implicit: boolean): void {
    if (!implicit || this.opts.allowAnyHost === true) return
    let host: string
    try {
      host = new URL(url).hostname
    } catch {
      throw new FetchError(`not a valid URL: ${url}`, url)
    }
    if (!ALLOWED_HOSTS.includes(host)) {
      throw new FetchError(
        `refusing to fetch from ${host}. Allowed: ${ALLOWED_HOSTS.join(', ')}. ` +
        'Pass the file explicitly with --shapes or --context if this is intended.',
        url,
      )
    }
  }

  /** Fetch `url` as text, consulting and populating the cache. */
  async text (url: string, { implicit = true }: { implicit?: boolean } = {}): Promise<string> {
    this.assertAllowed(url, implicit)

    const pending = this.inflight.get(url)
    if (pending) return pending

    const work = this.fetchText(url)
    this.inflight.set(url, work)
    try {
      return await work
    } finally {
      this.inflight.delete(url)
    }
  }

  private async fetchText (url: string): Promise<string> {
    const useCache = this.opts.noCache !== true
    const cached = useCache ? await this.cache.get(url) : undefined

    if (cached) {
      const fresh = isImmutableRef(url) || (Date.now() - cached.fetchedAt) < MUTABLE_TTL_MS
      if (fresh || this.opts.offline === true) return cached.body
    }
    if (this.opts.offline === true) {
      throw new FetchError(`offline and not cached: ${url}`, url)
    }

    const headers: Record<string, string> = {}
    if (cached?.etag !== undefined) headers['if-none-match'] = cached.etag

    const response = await this.withRetries(url, headers)

    if (response.status === 304 && cached) {
      await this.cache.set(url, { ...cached, fetchedAt: Date.now() })
      return cached.body
    }
    if (response.status === 404) throw new NotFoundError(url)
    if (!response.ok) {
      throw new FetchError(`HTTP ${response.status} fetching ${url}`, url, response.status)
    }

    const body = await response.text()
    if (useCache) {
      const etag = response.headers.get('etag')
      await this.cache.set(url, {
        body,
        fetchedAt: Date.now(),
        ...(etag !== null ? { etag } : {}),
      })
    }
    return body
  }

  private async withRetries (url: string, headers: Record<string, string>): Promise<Response> {
    const attempts = (this.opts.retries ?? 2) + 1
    let lastError: unknown
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        const init: RequestInit = { headers }
        if (this.opts.signal) init.signal = this.opts.signal
        const response = await this.doFetch(url, init)
        // Client errors are final; server errors are worth another go.
        if (response.status < 500 || attempt === attempts - 1) return response
        lastError = new FetchError(`HTTP ${response.status}`, url, response.status)
      } catch (error) {
        lastError = error
        if (attempt === attempts - 1) break
      }
      await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1) + Math.random() * 100))
    }
    throw lastError instanceof Error
      ? lastError
      : new FetchError(`failed to fetch ${url}`, url)
  }

  async json (url: string, opts?: { implicit?: boolean }): Promise<unknown> {
    const body = await this.text(url, opts)
    try {
      return JSON.parse(body)
    } catch (error) {
      throw new FetchError(
        `${url} is not valid JSON: ${(error as Error).message}`, url,
      )
    }
  }
}
