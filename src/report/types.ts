/*
 * The shape of a report. This is a published contract: `--format json` emits
 * it verbatim, so treat changes here as breaking and bump `schemaVersion`.
 *
 * Two layers, deliberately:
 *   - the human layer (code, title, hint, expected, jsonPath) is what the CLI
 *     and web UI show, and it never contains a bare IRI;
 *   - `technical` carries the raw SHACL result for anyone who does know SHACL,
 *     and is what makes a bug report against this tool actionable.
 */

export type Severity = 'violation' | 'warning' | 'info'

export type IssueCode =
  | 'required-field-missing'
  | 'too-few-values'
  | 'too-many-values'
  | 'value-not-allowed'
  | 'bad-format'
  | 'wrong-type'
  | 'wrong-object-type'
  | 'out-of-range'
  | 'unknown-field'
  | 'rule-violation'
  | 'duplicate-child-id'
  | 'input/assumed-context'
  | 'input/substituted-context'
  | 'input/parse-error'
  | 'catalogue/shape-unavailable'
  | 'other'

export interface Location {
  /** `address[0].postcode`, or `$` for the document root. */
  jsonPath: string
  /** RFC 6901 pointer for the same place. */
  pointer: string
  /** Nearest `@id` the user wrote, on this node or an ancestor. */
  nodeId?: string
  /** `@type` as written, e.g. `Address`. */
  nodeType?: string
  line?: number
  column?: number
  endLine?: number
  endColumn?: number
  offset?: number
  length?: number
  /** File name, when several documents are validated together. */
  document?: string
}

export type Expectation =
  | { kind: 'one-of', values: string[], iris?: string[] }
  | { kind: 'format', description?: string, example?: string, pattern?: string }
  | { kind: 'datatype', friendly: string, datatype: string }
  | { kind: 'class', term: string, iri: string }
  | { kind: 'count', min?: number, max?: number, actual?: number }
  | { kind: 'range', min?: number, max?: number }

export interface Issue {
  id: string
  severity: Severity
  code: IssueCode
  /** One line, plain English, no IRIs. */
  title: string
  /** `sh:description` from the shape, where there is one. */
  detail?: string
  /** What to do about it. */
  hint?: string
  location: Location
  relatedLocations?: Location[]
  field?: { term: string, iri: string }
  value?: { display: string, json?: unknown, kind: 'literal' | 'iri' | 'node' | 'missing' }
  expected?: Expectation
  technical?: {
    focusNode: string
    resultPath?: string
    sourceShape?: string
    sourceConstraintComponent: string
    shaclMessage?: string[]
    value?: string
  }
}

export interface IssueGroup {
  key: string
  /** `Address (address[0])` - what the user sees as a heading. */
  label: string
  location: Location
  issues: string[]
}

export interface DocumentReport {
  document: string
  conforms: boolean
  counts: Record<Severity, number>
  issues: Issue[]
  groups: IssueGroup[]
  /** Conformance mode: what the file name promised. */
  expected?: 'valid' | 'invalid'
  expectationMet?: boolean
}

export interface CrossCheckReport {
  id: string
  title: string
  ok: boolean
  findings: { message: string, documents: string[] }[]
}

export interface RunReport {
  schemaVersion: number
  validator: { name: string, version: string }
  profile: {
    id: string | null
    label: string | null
    ref: string
    shapes: string[]
    context?: string
    /** Anything odd about the setup itself, e.g. a shape that is not published. */
    warnings: Issue[]
  }
  documents: DocumentReport[]
  crossChecks: CrossCheckReport[]
  conforms: boolean
  counts: Record<Severity, number>
  durationMs: number
}

export const SCHEMA_VERSION = 1

export function emptyCounts (): Record<Severity, number> {
  return { violation: 0, warning: 0, info: 0 }
}
