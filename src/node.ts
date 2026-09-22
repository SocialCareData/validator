/*
 * Node-only helpers: the filesystem, stdin, and a cache on disk.
 *
 * Kept out of the main entry point so that importing the library in a browser
 * bundle never drags `node:fs` in. The CLI is the main consumer; library users
 * on Node can import this too.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { homedir, tmpdir } from 'node:os'
import { join, dirname, basename } from 'node:path'
import type { CacheEntry, FetchCache } from './catalogue/fetcher.js'
import type { DocumentInput } from './core/validator.js'

export async function readDocuments (paths: string[]): Promise<DocumentInput[]> {
  return Promise.all(paths.map(async (path) => ({
    name: path,
    text: await readFile(path, 'utf8'),
  })))
}

export async function readStdin (): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}

/** `valid-*.jsonld` must conform, `invalid-*.jsonld` must not. */
export function expectationFromName (path: string): 'valid' | 'invalid' | undefined {
  const name = basename(path)
  if (name.startsWith('valid-')) return 'valid'
  if (name.startsWith('invalid-')) return 'invalid'
  return undefined
}

export function defaultCacheDir (): string {
  const xdg = process.env['XDG_CACHE_HOME']
  if (xdg !== undefined && xdg !== '') return join(xdg, 'socialcaredata-validator')
  const home = homedir()
  if (home !== '') return join(home, '.cache', 'socialcaredata-validator')
  return join(tmpdir(), 'socialcaredata-validator')
}

/**
 * A cache on disk, so repeat runs (and CI) do not re-fetch the same shapes.
 * Entries are keyed by a hash of the URL; the body and its ETag live together
 * so a mutable ref like `main` can be revalidated rather than re-downloaded.
 */
export class DiskCache implements FetchCache {
  constructor (private readonly dir: string = defaultCacheDir()) {}

  private pathFor (key: string): string {
    const hash = createHash('sha256').update(key).digest('hex').slice(0, 32)
    return join(this.dir, `${hash}.json`)
  }

  async get (key: string): Promise<CacheEntry | undefined> {
    try {
      const raw = await readFile(this.pathFor(key), 'utf8')
      return JSON.parse(raw) as CacheEntry
    } catch {
      return undefined
    }
  }

  async set (key: string, entry: CacheEntry): Promise<void> {
    const path = this.pathFor(key)
    try {
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, JSON.stringify(entry), 'utf8')
    } catch {
      // A cache that cannot be written is an inconvenience, not a failure.
    }
  }
}

export const readLocal = (path: string): Promise<string> => readFile(path, 'utf8')
