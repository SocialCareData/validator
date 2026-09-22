/*
 * Terminal output.
 *
 * The shape of a block is deliberate: the sentence first, because that is what
 * people read; then the offending line with a caret, because that is what they
 * act on; then the hint. Everything else - IRIs, shape identifiers, constraint
 * components - is available under --verbose and nowhere else.
 */

import pc from 'picocolors'
import type { Issue, RunReport, Severity } from '../types.js'

export interface PrettyOptions {
  color?: boolean
  verbose?: boolean
  maxIssues?: number
  /** Source text per document, for code frames. */
  sources?: Map<string, string>
}

const GLYPH: Record<Severity, string> = { violation: 'x', warning: '!', info: 'i' }

function paint (enabled: boolean) {
  const id = (s: string): string => s
  if (!enabled) {
    return { red: id, yellow: id, green: id, cyan: id, dim: id, bold: id, magenta: id }
  }
  return {
    red: pc.red, yellow: pc.yellow, green: pc.green,
    cyan: pc.cyan, dim: pc.dim, bold: pc.bold, magenta: pc.magenta,
  }
}

/** Render `**x**` and `` `x` `` from the message layer as terminal styling. */
function inline (text: string, c: ReturnType<typeof paint>): string {
  return text
    .replace(/`([^`]+)`/g, (_, s: string) => c.cyan(s))
    .replace(/\*\*([^*]+)\*\*/g, (_, s: string) => c.bold(s))
}

function codeFrame (issue: Issue, source: string | undefined, c: ReturnType<typeof paint>): string[] {
  if (source === undefined || issue.location.line === undefined) return []
  // Nothing to underline when the complaint is that the field is absent - the
  // span we have is the enclosing object's, and pointing a caret at `{` reads
  // like a parse error.
  if (issue.value?.kind === 'missing') return []
  const lines = source.split('\n')
  const lineNo = issue.location.line
  const text = lines[lineNo - 1]
  if (text === undefined) return []
  const gutter = String(lineNo).padStart(5)
  const out = [`${c.dim(gutter)} ${c.dim('|')} ${text.replace(/\s+$/, '')}`]
  const column = issue.location.column ?? 1
  const width = issue.location.endLine === lineNo && issue.location.endColumn !== undefined
    ? Math.max(1, issue.location.endColumn - column)
    : 1
  out.push(`${' '.repeat(5)} ${c.dim('|')} ${' '.repeat(Math.max(0, column - 1))}${c.red('^'.repeat(Math.min(width, 60)))}`)
  return out
}

export function renderPretty (report: RunReport, opts: PrettyOptions = {}): string {
  const c = paint(opts.color !== false)
  const out: string[] = []
  const max = opts.maxIssues ?? 50

  const profileName = report.profile.label ?? report.profile.id ?? 'custom shapes'
  out.push('')
  out.push(`${c.bold(profileName)} ${c.dim(`· ref ${report.profile.ref} · ${report.documents.length} document(s)`)}`)

  for (const warning of report.profile.warnings) {
    out.push(`  ${c.yellow('!')} ${inline(warning.title, c)}`)
    if (warning.hint !== undefined) out.push(`    ${c.dim(warning.hint)}`)
  }

  for (const doc of report.documents) {
    const verdict = doc.conforms
      ? c.green('passes')
      : doc.counts.violation === 0 ? c.yellow('warnings only') : c.red('fails')
    const expectation = doc.expectationMet === false
      ? c.red(`  (expected to ${doc.expected === 'valid' ? 'pass' : 'fail'})`)
      : ''
    out.push('')
    out.push(`${c.bold(doc.document)} ${c.dim('->')} ${verdict}${expectation}`)

    if (doc.issues.length === 0) continue

    const byId = new Map(doc.issues.map((i) => [i.id, i]))
    let shown = 0

    for (const group of doc.groups) {
      if (group.issues.every((id) => byId.get(id)?.severity === 'info')) continue
      const issues = group.issues.map((id) => byId.get(id)).filter((i): i is Issue => i !== undefined)
      if (issues.length === 0) continue
      out.push(`  ${c.dim('in')} ${c.magenta(group.label)}`)

      for (const issue of issues) {
        if (shown >= max) continue
        shown++
        const glyph = issue.severity === 'violation' ? c.red(GLYPH.violation)
          : issue.severity === 'warning' ? c.yellow(GLYPH.warning) : c.cyan(GLYPH.info)
        out.push(`    ${glyph} ${inline(issue.title, c)}`)
        out.push(`      ${c.dim('at')} ${c.cyan(issue.location.jsonPath)}${
          issue.location.line !== undefined ? c.dim(`  line ${issue.location.line}`) : ''}`)
        out.push(...codeFrame(issue, opts.sources?.get(doc.document), c).map((l) => `      ${l}`))
        if (issue.hint !== undefined) out.push(`      ${c.dim(issue.hint)}`)
        if (opts.verbose === true && issue.technical) {
          out.push(`      ${c.dim(`constraint: ${issue.technical.sourceConstraintComponent}`)}`)
          out.push(`      ${c.dim(`focus:      ${issue.technical.focusNode}`)}`)
          if (issue.technical.resultPath !== undefined) {
            out.push(`      ${c.dim(`path:       ${issue.technical.resultPath}`)}`)
          }
        }
      }
    }
    const notes = doc.issues.filter((i) => i.severity === 'info')
    for (const note of notes) out.push(`  ${c.cyan('i')} ${c.dim(note.title)}`)

    const problems = doc.issues.length - notes.length
    if (problems > shown) {
      out.push(`    ${c.dim(`... and ${problems - shown} more (raise --max-issues to see them)`)}`)
    }
  }

  for (const check of report.crossChecks) {
    if (check.ok) continue
    out.push('')
    out.push(`${c.bold('Across all records')} ${c.dim('->')} ${c.red(check.title)}`)
    for (const finding of check.findings) out.push(`    ${c.red('x')} ${finding.message}`)
  }

  out.push('')
  const { violation, warning, info } = report.counts
  if (report.conforms && violation === 0 && warning === 0) {
    out.push(c.green(`All good - ${report.documents.length} document(s) conform.`))
  } else {
    const parts: string[] = []
    if (violation > 0) parts.push(c.red(`${violation} problem${violation === 1 ? '' : 's'}`))
    if (warning > 0) parts.push(c.yellow(`${warning} warning${warning === 1 ? '' : 's'}`))
    if (info > 0) parts.push(c.dim(`${info} note${info === 1 ? '' : 's'}`))
    out.push(parts.length > 0 ? parts.join(', ') : c.red('failed'))
    const codes = new Map<string, number>()
    for (const doc of report.documents) {
      for (const issue of doc.issues) {
        if (issue.severity === 'info') continue
        codes.set(issue.code, (codes.get(issue.code) ?? 0) + 1)
      }
    }
    if (codes.size > 0) {
      const summary = [...codes.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([code, n]) => `${n} ${code.replace(/-/g, ' ')}`)
        .join(', ')
      out.push(c.dim(`  ${summary}`))
      out.push(c.dim('  Run `scd-validate explain <code>` for what any of these mean.'))
    }
  }
  out.push('')
  return out.join('\n')
}
