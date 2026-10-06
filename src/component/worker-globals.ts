/*
 * Must be imported before anything else in the worker.
 *
 * rdf-ext's browser build pulls in a fetch wrapper that does
 * `const Headers = window.Headers` at module scope. That is fine on a main
 * thread and fatal in a Web Worker, where the global is `self` and `window`
 * does not exist - the worker dies on load with "window is not defined" before
 * a single line of our code runs.
 *
 * We never use that wrapper (shapes go through our own Fetcher), so the
 * cheapest correct fix is to give it the global it expects. A worker's
 * `globalThis` already carries Headers, Request, Response and fetch, so
 * nothing is being faked here.
 */

const scope = globalThis as Record<string, unknown>
if (scope['window'] === undefined) {
  scope['window'] = globalThis
}

export {}
