/*
 * Fetching a text file over HTTPS.
 *
 * `fetch` is injectable so Node, the browser and tests all run the same code.
 * There is no caching layer: a run downloads one profile's two or three small
 * files, and callers that need to validate repeatedly hold on to the loaded
 * profile instead.
 */

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

export type Fetch = typeof globalThis.fetch

export async function fetchText (url: string, doFetch: Fetch = globalThis.fetch): Promise<string> {
  if (typeof doFetch !== 'function') {
    throw new FetchError('no fetch implementation available', url)
  }
  let response: Response
  try {
    response = await doFetch(url)
  } catch (error) {
    throw new FetchError(`could not reach ${url}: ${(error as Error).message}`, url)
  }
  if (response.status === 404) throw new NotFoundError(url)
  if (!response.ok) throw new FetchError(`HTTP ${response.status} fetching ${url}`, url, response.status)
  return response.text()
}
