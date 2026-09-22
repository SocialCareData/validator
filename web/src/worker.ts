/*
 * Validation runs here, not on the main thread.
 *
 * Parsing ~20k lines of Turtle and running SHACL takes long enough to freeze
 * an editor, and the whole point of the page is that you can keep typing.
 */

// Side-effect import, and it has to come first - see the file for why.
import './worker-globals.js'

import { loadProfile } from '@validator/catalogue/resolve.js'
import { createValidator } from '@validator/core/validator.js'
import { MemoryCache } from '@validator/catalogue/fetcher.js'
import type { LoadedProfile } from '@validator/catalogue/resolve.js'
import type { RunReport } from '@validator/report/types.js'

export interface ValidateRequest {
  kind: 'validate'
  id: number
  profileId: string
  ref: string
  text: string
  name: string
}

export type WorkerResponse =
  | { kind: 'status', id: number, message: string }
  | { kind: 'result', id: number, report: RunReport }
  | { kind: 'error', id: number, message: string }

// Shapes are fetched once per profile+ref and kept for the life of the page.
const cache = new MemoryCache()
const profiles = new Map<string, Promise<LoadedProfile>>()

function getProfile (id: string, ref: string): Promise<LoadedProfile> {
  const key = `${id}@${ref}`
  let pending = profiles.get(key)
  if (!pending) {
    pending = loadProfile(id, { ref, cache })
    profiles.set(key, pending)
  }
  return pending
}

self.addEventListener('message', (event: MessageEvent<ValidateRequest>) => {
  const request = event.data
  if (request.kind !== 'validate') return
  void (async () => {
    const post = (message: WorkerResponse): void => { self.postMessage(message) }
    try {
      const key = `${request.profileId}@${request.ref}`
      if (!profiles.has(key)) {
        post({ kind: 'status', id: request.id, message: `Fetching shapes for ${request.ref}...` })
      }
      const profile = await getProfile(request.profileId, request.ref)
      post({ kind: 'status', id: request.id, message: 'Validating...' })
      const validator = createValidator(profile, { version: __APP_VERSION__ })
      const report = await validator.validateAll([{ name: request.name, text: request.text }])
      post({ kind: 'result', id: request.id, report })
    } catch (error) {
      post({ kind: 'error', id: request.id, message: (error as Error).message })
    }
  })()
})

declare const __APP_VERSION__: string
