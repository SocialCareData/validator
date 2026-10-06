/*
 * Validation runs here, not on the main thread.
 *
 * Parsing thousands of lines of Turtle and running SHACL takes long enough to
 * freeze an editor, and the whole point of the page is that you can keep typing.
 */

// Side-effect import, and it has to come first - see the file for why.
import './worker-globals.js'

import type { PatternHint, RunReport } from '@theodi/data-standard-validator'
import type { ResolvedStandard } from './config.js'
import { loadValidator } from './engine.js'

export interface ValidateRequest {
  kind: 'validate'
  id: number
  standard: ResolvedStandard
  patterns?: PatternHint[]
  /** For the status line only; the URLs in `standard` already carry it. */
  ref?: string
  text: string
  name: string
}

export type WorkerResponse =
  | { kind: 'status', id: number, message: string }
  | { kind: 'result', id: number, report: RunReport }
  | { kind: 'error', id: number, message: string }

// loadValidator memoises per set of sources for the life of the worker, so the
// shapes are fetched and parsed once however often somebody presses Validate.
const seen = new Set<string>()

self.addEventListener('message', (event: MessageEvent<ValidateRequest>) => {
  const request = event.data
  if (request.kind !== 'validate') return
  void (async () => {
    const post = (message: WorkerResponse): void => { self.postMessage(message) }
    try {
      const key = JSON.stringify(request.standard)
      if (!seen.has(key)) {
        const at = request.ref !== undefined ? ` for ${request.ref}` : ''
        post({ kind: 'status', id: request.id, message: `Fetching shapes${at}...` })
        seen.add(key)
      }
      const validator = await loadValidator({
        ...request.standard,
        ...(request.patterns !== undefined ? { patterns: request.patterns } : {}),
      })
      post({ kind: 'status', id: request.id, message: 'Validating...' })
      const report = await validator.validateAll([{ name: request.name, text: request.text }])
      post({ kind: 'result', id: request.id, report })
    } catch (error) {
      post({ kind: 'error', id: request.id, message: (error as Error).message })
    }
  })()
})
