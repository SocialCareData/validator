/*
 * Output formats. `pretty` for people, `json` for tooling, `github` for inline
 * PR annotations, `sarif` for code scanning, `summary` for piping.
 */

import { renderPretty, type PrettyOptions } from './pretty.js'
import type { Issue, RunReport } from '../types.js'

export type Format = 'pretty' | 'json' | 'github' | 'sarif' | 'summary'

export interface RenderOptions extends PrettyOptions {}

const HELP_BASE = 'https://github.com/SocialCareData/validator/blob/main/docs/error-reference.md'

function renderJson (report: RunReport): string {
  return JSON.stringify(report, null, 2)
}

function escapeWorkflow (value: string): string {
  return value.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')
}

/** GitHub Actions workflow commands - these become inline PR annotations. */
function renderGithub (report: RunReport): string {
  const lines: string[] = []
  for (const doc of report.documents) {
    for (const issue of doc.issues) {
      if (issue.severity === 'info') continue
      const level = issue.severity === 'violation' ? 'error' : 'warning'
      const parts = [`file=${doc.document}`]
      if (issue.location.line !== undefined) parts.push(`line=${issue.location.line}`)
      if (issue.location.column !== undefined) parts.push(`col=${issue.location.column}`)
      parts.push(`title=${escapeWorkflow(issue.location.jsonPath)}`)
      const body = issue.hint !== undefined ? `${issue.title} ${issue.hint}` : issue.title
      lines.push(`::${level} ${parts.join(',')}::${escapeWorkflow(stripMarkup(body))}`)
    }
  }
  for (const check of report.crossChecks) {
    for (const finding of check.findings) {
      lines.push(`::error title=${escapeWorkflow(check.title)}::${escapeWorkflow(finding.message)}`)
    }
  }
  return lines.join('\n')
}

function stripMarkup (text: string): string {
  return text.replace(/[`*]/g, '')
}

function renderSarif (report: RunReport): string {
  const codes = new Set<string>()
  for (const doc of report.documents) for (const issue of doc.issues) codes.add(issue.code)

  const results = report.documents.flatMap((doc) =>
    doc.issues.filter((i) => i.severity !== 'info').map((issue) => ({
      ruleId: issue.code,
      level: issue.severity === 'violation' ? 'error' : 'warning',
      message: { text: stripMarkup(issue.hint !== undefined ? `${issue.title} ${issue.hint}` : issue.title) },
      locations: [{
        physicalLocation: {
          artifactLocation: { uri: doc.document },
          ...(issue.location.line !== undefined
            ? {
                region: {
                  startLine: issue.location.line,
                  ...(issue.location.column !== undefined ? { startColumn: issue.location.column } : {}),
                  ...(issue.location.endLine !== undefined ? { endLine: issue.location.endLine } : {}),
                },
              }
            : {}),
        },
        logicalLocations: [{ fullyQualifiedName: issue.location.jsonPath }],
      }],
      partialFingerprints: { issueId: issue.id },
    })),
  )

  return JSON.stringify({
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [{
      tool: {
        driver: {
          name: report.validator.name,
          version: report.validator.version,
          informationUri: 'https://github.com/SocialCareData/validator',
          rules: [...codes].map((code) => ({
            id: code,
            name: code,
            shortDescription: { text: code.replace(/-/g, ' ') },
            helpUri: `${HELP_BASE}#${code.replace(/\//g, '')}`,
          })),
        },
      },
      results,
    }],
  }, null, 2)
}

function renderSummary (report: RunReport): string {
  const lines = report.documents.map((doc) => {
    const verdict = doc.conforms ? 'PASS' : 'FAIL'
    return `${verdict}  ${doc.document}  ${doc.counts.violation} problem(s), ${doc.counts.warning} warning(s)`
  })
  lines.push(report.conforms ? 'OK' : 'FAILED')
  return lines.join('\n')
}

export function render (report: RunReport, format: Format, opts: RenderOptions = {}): string {
  switch (format) {
    case 'json': return renderJson(report)
    case 'github': return renderGithub(report)
    case 'sarif': return renderSarif(report)
    case 'summary': return renderSummary(report)
    case 'pretty':
    default: return renderPretty(report, opts)
  }
}

export { renderPretty }
export type { Issue }
