/*
 * Validation runs here, not on the main thread.
 *
 * Parsing ~20k lines of Turtle and running SHACL takes long enough to freeze
 * an editor, and the whole point of the page is that you can keep typing.
 */

// Side-effect import, and it has to come first - see the file for why.
import './worker-globals.js'

import { loadProfile } from '@validator/profile.js'
import { createValidator } from '@validator/validate.js'
import type { RunReport } from '@validator/report.js'

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

// loadProfile memoises per profile+ref for the life of the worker, so the
// shapes are fetched and parsed once however often somebody presses Validate.
const seen = new Set<string>()

self.addEventListener('message', (event: MessageEvent<ValidateRequest>) => {
  const request = event.data
  if (request.kind !== 'validate') return
  void (async () => {
    const post = (message: WorkerResponse): void => { self.postMessage(message) }
    try {
      const key = `${request.profileId}@${request.ref}`
      if (!seen.has(key)) {
        post({ kind: 'status', id: request.id, message: `Fetching shapes for ${request.ref}...` })
        seen.add(key)
      }
      const profile = await loadProfile(request.profileId, { ref: request.ref })
      post({ kind: 'status', id: request.id, message: 'Validating...' })
      const validator = createValidator(profile)
      const report = await validator.validateAll([{ name: request.name, text: request.text }])
      post({ kind: 'result', id: request.id, report })
    } catch (error) {
      post({ kind: 'error', id: request.id, message: (error as Error).message })
    }
  })()
})
