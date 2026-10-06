/*
 * A run report, as DOM. Knows nothing about the editor beyond a callback to
 * jump to a line, so the rendering can be read and changed on its own.
 */

import { groupIssues, type Issue, type RunReport, type Severity } from '@theodi/data-standard-validator'

/** What was validated against: the report itself only knows shape URLs. */
export interface RunLabel { standard: string, ref?: string }

type JumpTo = (line: number, column: number) => void

const SEVERITY_WORD: Record<Severity, string> = {
  violation: 'Problem', warning: 'Warning', info: 'Note',
}

export function el (tag: string, className?: string, text?: string): HTMLElement {
  const node = document.createElement(tag)
  if (className !== undefined) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

export function banner (kind: 'warning' | 'info' | 'error', text: string): HTMLElement {
  return el('div', `banner ${kind}`, text)
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

function issueCard (issue: Issue, jumpTo: JumpTo): HTMLElement {
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

  // `value` is the only place an issue raised outside SHACL - a context that
  // could not be loaded, say - can name the URL and the reason.
  if (issue.technical || issue.value !== undefined) {
    const details = document.createElement('details')
    details.append(el('summary', undefined, 'Technical detail'))
    const dl = document.createElement('dl')
    const rows: [string, string | undefined][] = [
      ['code', issue.code],
      ['value', issue.value],
      ['constraint', issue.technical?.constraint],
      ['property', issue.technical?.resultPath],
      ['focus', issue.technical?.focusNode],
      ['shape', issue.technical?.sourceShape],
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
    if (issue.location.line !== undefined) jumpTo(issue.location.line, issue.location.column ?? 1)
  }
  card.addEventListener('click', jump)
  card.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); jump() }
  })
  return card
}

/** Fill `results` with the report. Returns the lines the editor should flag. */
export function renderReport (
  results: HTMLElement, report: RunReport, label: RunLabel, jumpTo: JumpTo,
): Set<number> {
  results.replaceChildren()
  const flagged = new Set<number>()

  const doc = report.documents[0]
  if (!doc) return flagged

  for (const warning of report.setup.warnings) {
    results.append(banner('warning', `${warning.title}${warning.hint !== undefined ? ` ${warning.hint}` : ''}`))
  }

  const problems = doc.counts.violation
  const warnings = doc.counts.warning
  const verdict = el('div', `verdict ${doc.conforms ? 'pass' : 'fail'}`)
  verdict.append(el('strong', undefined, doc.conforms
    ? 'This record follows the standard'
    : `${problems} problem${problems === 1 ? '' : 's'} found`))
  const parts = [label.standard, label.ref !== undefined ? `ref ${label.ref}` : '']
  if (warnings > 0) parts.push(`${warnings} warning${warnings === 1 ? '' : 's'}`)
  verdict.append(el('span', 'muted', parts.filter(Boolean).join('  ·  ')))
  results.append(verdict)

  for (const issue of doc.issues) {
    if (issue.location.line !== undefined && issue.severity !== 'info') {
      flagged.add(issue.location.line)
    }
  }

  for (const group of groupIssues(doc.issues.filter((i) => i.severity !== 'info'))) {
    const section = el('section', 'group')
    section.append(el('h3', undefined, group.label))
    for (const issue of group.issues) section.append(issueCard(issue, jumpTo))
    results.append(section)
  }

  for (const note of doc.issues.filter((i) => i.severity === 'info')) {
    results.append(banner('info', note.title))
  }

  for (const check of report.crossChecks) {
    if (check.ok) continue
    for (const finding of check.findings) results.append(banner('error', finding.message))
  }

  return flagged
}
