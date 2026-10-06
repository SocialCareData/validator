/*
 * The validator UI: a toolbar to pick a standard and an example, an editor,
 * and a results pane. Validation happens in a worker; this file only collects
 * input, renders the report, and keeps the gutter and colouring in step with
 * the textarea.
 *
 * Everything it knows about a particular standard comes from the config.
 */

import './styles.css'
import {
  defaultRef, exampleList, fetchUrl, resolveStandard, shapesRepo, type ValidatorConfig,
} from './config.js'
import { highlightJson } from './highlight.js'
import { banner, el, renderReport, type RunLabel } from './report.js'
import type { ValidateRequest, WorkerResponse } from './worker.js'

export interface MountedValidator {
  /** Stop the worker and empty the element. */
  destroy(): void
}

const DEFAULT_STORAGE_KEY = 'data-standard-validator:last'

let instances = 0

/*
 * Static markup only: anything from the config goes in through textContent or
 * an Option, never through innerHTML. Ids are prefixed per instance so labels
 * still work with two validators on one page.
 */
function markup (p: string): string {
  return `
    <form class="toolbar" autocomplete="off">
      <div class="field">
        <label for="${p}-standard">Standard</label>
        <select id="${p}-standard" name="standard"></select>
      </div>
      <div class="field">
        <label for="${p}-example">Example</label>
        <select id="${p}-example" name="example">
          <option value="">Load an example…</option>
        </select>
      </div>
      <div class="actions">
        <button type="submit" class="primary validate">Validate</button>
        <button type="button" class="ghost clear">Clear</button>
      </div>
      <details class="advanced">
        <summary>Advanced</summary>
        <div class="advanced-body">
          <label for="${p}-ref">Shapes version (git ref)</label>
          <input id="${p}-ref" name="ref" class="ref-input" spellcheck="false" />
          <p class="help ref-help"></p>
        </div>
      </details>
      <p class="help toolbar-help standard-help"></p>
    </form>

    <main class="workspace">
      <section class="pane editor-pane" aria-labelledby="${p}-editor-heading">
        <h2 id="${p}-editor-heading" class="pane-head">Your data</h2>
        <div class="editor">
          <pre class="gutter" aria-hidden="true"></pre>
          <div class="code">
            <pre class="highlight" aria-hidden="true"></pre>
            <textarea name="data" class="input" wrap="off" spellcheck="false"
              aria-label="JSON or JSON-LD to validate"></textarea>
          </div>
        </div>
        <p class="privacy">
          Your data stays in this browser. Only the shape and context files are downloaded.
        </p>
      </section>

      <section class="pane results-pane" aria-labelledby="${p}-results-heading">
        <h2 id="${p}-results-heading" class="pane-head">Results</h2>
        <div class="results-scroll">
          <div class="results" aria-live="polite"></div>
        </div>
      </section>
    </main>`
}

export function mountValidator (root: HTMLElement, config: ValidatorConfig): MountedValidator {
  instances += 1
  root.classList.add('dsv')
  root.innerHTML = markup(`dsv${instances}`)

  const $ = <T extends Element>(selector: string): T => {
    const element = root.querySelector<T>(selector)
    if (!element) throw new Error(`missing ${selector}`)
    return element
  }

  const form = $<HTMLFormElement>('form')
  const standardSelect = $<HTMLSelectElement>('[name="standard"]')
  const standardHelp = $<HTMLParagraphElement>('.standard-help')
  const exampleSelect = $<HTMLSelectElement>('[name="example"]')
  const refInput = $<HTMLInputElement>('[name="ref"]')
  const input = $<HTMLTextAreaElement>('[name="data"]')
  const gutter = $<HTMLPreElement>('.gutter')
  const highlight = $<HTMLElement>('.highlight')
  const results = $<HTMLElement>('.results')
  const validateButton = $<HTMLButtonElement>('.validate')

  const storageKey = config.storageKey === false ? undefined : config.storageKey ?? DEFAULT_STORAGE_KEY
  if (config.placeholder !== undefined) input.placeholder = config.placeholder

  // -------------------------------------------------------------------------
  // Setup
  // -------------------------------------------------------------------------

  config.standards.forEach((standard, index) => {
    standardSelect.add(new Option(standard.name, String(index)))
  })

  // Nothing to version when no shape comes from GitHub, so no version box.
  const initialRef = defaultRef(config)
  const repo = shapesRepo(config)
  if (initialRef === undefined) {
    $<HTMLElement>('.advanced').hidden = true
  } else {
    refInput.value = initialRef
    const help = $<HTMLParagraphElement>('.ref-help')
    help.append('Which revision of ')
    if (repo) {
      const link = el('a', undefined, repo.name) as HTMLAnchorElement
      link.href = repo.url
      link.rel = 'noreferrer'
      help.append(link)
    } else {
      help.append('the shapes repository')
    }
    help.append(' the shapes are read from. A tag pins results; a branch tracks the latest.')
  }

  const currentStandard = (): ValidatorConfig['standards'][number] | undefined =>
    config.standards[Number(standardSelect.value)]

  function refreshExamples (): void {
    const standard = currentStandard()
    standardHelp.textContent = standard?.description ?? ''
    exampleSelect.length = 1
    if (!standard) return
    for (const example of exampleList(standard)) {
      exampleSelect.add(new Option(example.name, example.url))
    }
  }

  // -------------------------------------------------------------------------
  // Editor: gutter and colouring
  // -------------------------------------------------------------------------

  let flaggedLines = new Set<number>()

  /** The gutter and the colour layer only look right while they scroll with the textarea. */
  function syncScroll (): void {
    gutter.scrollTop = input.scrollTop
    highlight.scrollTop = input.scrollTop
    highlight.scrollLeft = input.scrollLeft
  }

  /** Redraw everything derived from the textarea. Call after any change to its value. */
  function renderEditor (): void {
    highlight.innerHTML = highlightJson(input.value)
    const lines = input.value.split('\n').length
    const out: string[] = []
    for (let n = 1; n <= Math.max(lines, 1); n++) {
      out.push(flaggedLines.has(n) ? `<span class="flagged">${n}</span>` : String(n))
    }
    gutter.innerHTML = out.join('\n')
    syncScroll()
  }

  function setText (text: string): void {
    input.value = text
    flaggedLines = new Set()
    renderEditor()
  }

  input.addEventListener('input', () => {
    flaggedLines = new Set()
    renderEditor()
  })
  input.addEventListener('scroll', syncScroll)

  /** Put the caret on a line and scroll it into view. */
  function jumpToLine (line: number, column = 1): void {
    const lines = input.value.split('\n')
    let offset = 0
    for (let i = 0; i < line - 1 && i < lines.length; i++) offset += lines[i]!.length + 1
    const start = offset + column - 1
    input.focus()
    input.setSelectionRange(start, start + Math.max(1, (lines[line - 1]?.length ?? 1) - column + 1))
    const lineHeight = input.scrollHeight / Math.max(lines.length, 1)
    input.scrollTop = Math.max(0, (line - 4) * lineHeight)
    syncScroll()
  }

  // -------------------------------------------------------------------------
  // Worker
  // -------------------------------------------------------------------------

  const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
  let requestId = 0
  // A worker that throws while loading is gone for good, and messages posted to
  // it vanish without a reply - which on the page looks like "Validating..."
  // forever. Remember the failure so every run can say so instead.
  let workerFailure: string | undefined
  // The standard and ref of the latest request, for the verdict line.
  let inFlight: RunLabel = { standard: '' }

  function idle (): void {
    validateButton.disabled = false
    validateButton.textContent = 'Validate'
  }

  function showWorkerFailure (): void {
    idle()
    results.replaceChildren(banner('error',
      `The validator could not start in this browser: ${workerFailure ?? 'unknown error'}`))
  }

  // Deliberately not preventDefault(): the error should still reach the console.
  worker.addEventListener('error', (event: ErrorEvent) => {
    workerFailure = event.message !== '' ? event.message : 'the worker script failed to load'
    showWorkerFailure()
  })

  worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
    const message = event.data
    if (message.id !== requestId) return // a newer run has superseded this one
    if (message.kind === 'status') {
      results.replaceChildren(banner('info', message.message))
      return
    }
    idle()
    if (message.kind === 'error') {
      results.replaceChildren(banner('error', `Could not validate: ${message.message}`))
      return
    }
    flaggedLines = renderReport(results, message.report, inFlight, jumpToLine)
    renderEditor()
  })

  function run (): void {
    if (workerFailure !== undefined) { showWorkerFailure(); return }
    const standard = currentStandard()
    if (!standard) return
    if (input.value.trim() === '') {
      results.replaceChildren(banner('info', 'Paste a record above, or load one of the examples.'))
      return
    }
    if (storageKey !== undefined) {
      try {
        localStorage.setItem(storageKey, input.value)
      } catch {
        // Private browsing, or storage disabled. Not worth mentioning.
      }
    }
    // Clear first: leaving the previous run's issues on screen while a new one
    // is in flight invites people to act on stale advice.
    results.replaceChildren(banner('info', 'Validating…'))
    validateButton.disabled = true
    validateButton.textContent = 'Validating…'
    requestId += 1
    const ref = initialRef === undefined ? undefined : refInput.value.trim() || initialRef
    inFlight = { standard: standard.name, ...(ref !== undefined ? { ref } : {}) }
    const request: ValidateRequest = {
      kind: 'validate',
      id: requestId,
      standard: resolveStandard(standard, ref),
      ...(config.patterns !== undefined ? { patterns: config.patterns } : {}),
      ...(ref !== undefined ? { ref } : {}),
      text: input.value,
      name: 'your record',
    }
    worker.postMessage(request)
  }

  // -------------------------------------------------------------------------
  // Events
  // -------------------------------------------------------------------------

  form.addEventListener('submit', (event) => { event.preventDefault(); run() })
  standardSelect.addEventListener('change', refreshExamples)

  // Only the latest pick may fill the editor, however the fetches finish.
  let exampleToken = 0
  exampleSelect.addEventListener('change', () => {
    const url = exampleSelect.value
    if (url === '') return
    const token = ++exampleToken
    results.replaceChildren(banner('info', 'Loading example…'))
    void (async () => {
      try {
        const response = await fetch(fetchUrl(url))
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const text = await response.text()
        if (token !== exampleToken) return
        setText(text)
        results.replaceChildren()
        run()
      } catch (error) {
        if (token !== exampleToken) return
        results.replaceChildren(banner('error', `Could not load the example: ${(error as Error).message}`))
      }
    })()
  })

  $<HTMLButtonElement>('.clear').addEventListener('click', () => {
    exampleToken += 1
    exampleSelect.value = ''
    setText('')
    results.replaceChildren()
  })

  input.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); run() }
  })

  // Drag a .json or .jsonld file straight onto the editor.
  input.addEventListener('dragover', (event) => { event.preventDefault() })
  input.addEventListener('drop', (event) => {
    const file = event.dataTransfer?.files?.[0]
    if (!file) return
    event.preventDefault()
    void file.text().then(setText)
  })

  if (storageKey !== undefined) {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved !== null && saved !== '') input.value = saved
    } catch {
      // As above.
    }
  }

  refreshExamples()
  renderEditor()

  return {
    destroy () {
      worker.terminate()
      root.replaceChildren()
      root.classList.remove('dsv')
    },
  }
}
