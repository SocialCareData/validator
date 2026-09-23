/*
 * Page wiring. Validation happens in a worker; this file only collects input,
 * renders the report, and keeps the gutter in step with the textarea.
 */

import { profiles, getProfile, DEFAULT_REF } from '@validator/shapes/catalogue.js'
import { groupIssues } from '@validator/report/build.js'
import type { Issue, RunReport, Severity } from '@validator/report/types.js'
import { DESCRIPTIONS } from './descriptions.js'
import type { ValidateRequest, WorkerResponse } from './worker.js'

const $ = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id)
  if (!element) throw new Error(`missing #${id}`)
  return element as T
}

const profileSelect = $<HTMLSelectElement>('profile')
const profileHelp = $<HTMLParagraphElement>('profile-help')
const exampleSelect = $<HTMLSelectElement>('example')
const refInput = $<HTMLInputElement>('ref')
const input = $<HTMLTextAreaElement>('input')
const gutter = $<HTMLPreElement>('gutter')
const results = $<HTMLElement>('results')
const validateButton = $<HTMLButtonElement>('validate')
const form = $<HTMLFormElement>('controls')

// Examples are this package's own files, so bundling them is fine. Shapes are
// the thing we never vendor.
const exampleFiles = import.meta.glob('../../examples/**/*.jsonld', {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>

const STORAGE_KEY = 'scd-validator:last'

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

for (const profile of profiles) {
  profileSelect.add(new Option(profile.label, profile.id))
}
refInput.value = DEFAULT_REF

function exampleKey (path: string): string {
  return path.replace(/^.*\/examples\//, '')
}

function refreshExamples (): void {
  const profile = getProfile(profileSelect.value)
  profileHelp.textContent = DESCRIPTIONS[profileSelect.value] ?? ''

  exampleSelect.length = 1
  if (!profile) return
  const prefix = `${profile.examples.replace(/^examples\//, '')}/`
  for (const path of Object.keys(exampleFiles).sort()) {
    const key = exampleKey(path)
    if (!key.startsWith(prefix)) continue
    const name = key.slice(prefix.length).replace(/\.jsonld$/, '')
    const label = name.startsWith('valid-') ? `${name}  (should pass)` : `${name}  (should fail)`
    exampleSelect.add(new Option(label, path))
  }
}

// ---------------------------------------------------------------------------
// Editor gutter
// ---------------------------------------------------------------------------

let flaggedLines = new Set<number>()

function renderGutter (): void {
  const lines = input.value.split('\n').length
  const out: string[] = []
  for (let n = 1; n <= Math.max(lines, 1); n++) {
    out.push(flaggedLines.has(n) ? `<span class="flagged">${n}</span>` : String(n))
  }
  gutter.innerHTML = out.join('\n')
  gutter.scrollTop = input.scrollTop
}

input.addEventListener('input', () => {
  flaggedLines = new Set()
  renderGutter()
})
input.addEventListener('scroll', () => { gutter.scrollTop = input.scrollTop })

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
  gutter.scrollTop = input.scrollTop
}

// ---------------------------------------------------------------------------
// Rendering a report
// ---------------------------------------------------------------------------

const SEVERITY_WORD: Record<Severity, string> = {
  violation: 'Problem', warning: 'Warning', info: 'Note',
}

function el (tag: string, className?: string, text?: string): HTMLElement {
  const node = document.createElement(tag)
  if (className !== undefined) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

/** Render `**bold**` and `` `code` `` from the message layer. */
function richText (target: HTMLElement, text: string): void {
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*)/g
  let last = 0
  for (const match of text.matchAll(pattern)) {
    const index = match.index
    if (index > last) target.append(text.slice(last, index))
    const token = match[0]
    if (token.startsWith('`')) {
      target.append(el('code', undefined, token.slice(1, -1)))
    } else {
      target.append(el('strong', undefined, token.slice(2, -2)))
    }
    last = index + token.length
  }
  if (last < text.length) target.append(text.slice(last))
}

function issueCard (issue: Issue): HTMLElement {
  const card = el('article', `issue ${issue.severity}`)
  card.tabIndex = 0
  card.setAttribute('role', 'button')

  const title = el('p', 'issue-title')
  richText(title, issue.title)
  card.append(title)

  const where = issue.location.line !== undefined
    ? `${issue.location.jsonPath}  ·  line ${issue.location.line}`
    : issue.location.jsonPath
  card.append(el('p', 'issue-meta', `${SEVERITY_WORD[issue.severity]} at ${where}`))

  if (issue.hint !== undefined) {
    const hint = el('p', 'issue-hint')
    richText(hint, issue.hint)
    card.append(hint)
  }

  if (issue.allowedValues !== undefined && issue.allowedValues.length > 0) {
    const pills = el('div', 'pills')
    for (const value of issue.allowedValues) pills.append(el('span', 'pill', value))
    card.append(pills)
  }

  if (issue.technical) {
    const details = document.createElement('details')
    details.append(el('summary', undefined, 'Technical detail'))
    const dl = document.createElement('dl')
    const rows: [string, string | undefined][] = [
      ['code', issue.code],
      ['constraint', issue.technical.constraint],
      ['property', issue.technical.resultPath],
      ['focus', issue.technical.focusNode],
      ['shape', issue.technical.sourceShape],
    ]
    for (const [key, value] of rows) {
      if (value === undefined) continue
      dl.append(el('dt', undefined, key), el('dd', undefined, value))
    }
    details.append(dl)
    // Clicking inside the disclosure should not also jump the editor.
    details.addEventListener('click', (event) => { event.stopPropagation() })
    card.append(details)
  }

  const jump = (): void => {
    if (issue.location.line !== undefined) jumpToLine(issue.location.line, issue.location.column ?? 1)
  }
  card.addEventListener('click', jump)
  card.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); jump() }
  })
  return card
}

function banner (kind: 'warning' | 'info' | 'error', text: string): HTMLElement {
  return el('div', `banner ${kind}`, text)
}

function renderReport (report: RunReport): void {
  results.replaceChildren()
  flaggedLines = new Set()

  const doc = report.documents[0]
  if (!doc) return

  for (const warning of report.profile.warnings) {
    results.append(banner('warning', `${warning.title}${warning.hint !== undefined ? ` ${warning.hint}` : ''}`))
  }

  const problems = doc.counts.violation
  const warnings = doc.counts.warning
  const verdict = el('div', `verdict ${doc.conforms ? 'pass' : 'fail'}`)
  verdict.append(el('strong', undefined, doc.conforms
    ? 'This record follows the standard'
    : `${problems} problem${problems === 1 ? '' : 's'} found`))
  const parts = [`${report.profile.label ?? ''}`, `ref ${report.profile.ref}`]
  if (warnings > 0) parts.push(`${warnings} warning${warnings === 1 ? '' : 's'}`)
  verdict.append(el('span', 'muted', parts.filter(Boolean).join('  ·  ')))
  results.append(verdict)

  for (const issue of doc.issues) {
    if (issue.location.line !== undefined && issue.severity !== 'info') {
      flaggedLines.add(issue.location.line)
    }
  }
  renderGutter()

  for (const group of groupIssues(doc.issues.filter((i) => i.severity !== 'info'))) {
    const section = el('section', 'group')
    section.append(el('h3', undefined, group.label))
    for (const issue of group.issues) section.append(issueCard(issue))
    results.append(section)
  }

  for (const note of doc.issues.filter((i) => i.severity === 'info')) {
    results.append(banner('info', note.title))
  }

  for (const check of report.crossChecks) {
    if (check.ok) continue
    for (const finding of check.findings) results.append(banner('error', finding.message))
  }
}

// ---------------------------------------------------------------------------
// Worker
// ---------------------------------------------------------------------------

const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
let requestId = 0

worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
  const message = event.data
  if (message.id !== requestId) return // a newer run has superseded this one
  if (message.kind === 'status') {
    results.replaceChildren(banner('info', message.message))
    return
  }
  validateButton.disabled = false
  validateButton.textContent = 'Validate'
  if (message.kind === 'error') {
    results.replaceChildren(banner('error', `Could not validate: ${message.message}`))
    return
  }
  renderReport(message.report)
})

function run (): void {
  const text = input.value.trim()
  if (text === '') {
    results.replaceChildren(banner('info', 'Paste a record above, or load one of the examples.'))
    return
  }
  try {
    localStorage.setItem(STORAGE_KEY, input.value)
  } catch {
    // Private browsing, or storage disabled. Not worth mentioning.
  }
  // Clear first: leaving the previous run's issues on screen while a new one
  // is in flight invites people to act on stale advice.
  results.replaceChildren(banner('info', 'Validating…'))
  validateButton.disabled = true
  validateButton.textContent = 'Validating…'
  requestId += 1
  const request: ValidateRequest = {
    kind: 'validate',
    id: requestId,
    profileId: profileSelect.value,
    ref: refInput.value.trim() || DEFAULT_REF,
    text: input.value,
    name: 'your record',
  }
  worker.postMessage(request)
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

form.addEventListener('submit', (event) => { event.preventDefault(); run() })
profileSelect.addEventListener('change', refreshExamples)

exampleSelect.addEventListener('change', () => {
  const path = exampleSelect.value
  if (path === '') return
  input.value = exampleFiles[path] ?? ''
  flaggedLines = new Set()
  renderGutter()
  results.replaceChildren()
  run()
})

$<HTMLButtonElement>('clear').addEventListener('click', () => {
  input.value = ''
  exampleSelect.value = ''
  flaggedLines = new Set()
  renderGutter()
  results.replaceChildren()
})

input.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); run() }
})

// Drag a .jsonld file straight onto the editor.
input.addEventListener('dragover', (event) => { event.preventDefault() })
input.addEventListener('drop', (event) => {
  const file = event.dataTransfer?.files?.[0]
  if (!file) return
  event.preventDefault()
  void file.text().then((text) => {
    input.value = text
    flaggedLines = new Set()
    renderGutter()
  })
})

try {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved !== null && saved !== '') input.value = saved
} catch {
  // As above.
}

refreshExamples()
renderGutter()
