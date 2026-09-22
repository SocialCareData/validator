/*
 * The pipeline: JSON in, report out.
 *
 *   parse -> skolemize -> resolve @context -> toRDF -> SHACL -> humanise
 *
 * Everything here is isomorphic. The CLI supplies file contents and the web UI
 * supplies the textarea's value; neither touches this module's behaviour.
 */

import { skolemize, type NodeLocation } from './skolemize.js'
import { resolveContext, toDataset, type JsonLdContext } from './jsonld.js'
import { createShaclValidator } from './shacl.js'
import { assembleDocumentReport, buildIssues } from '../report/build.js'
import { SCHEMA_VERSION, emptyCounts, type DocumentReport, type Issue, type RunReport, type Severity }
  from '../report/types.js'
import type { LoadedProfile } from '../catalogue/resolve.js'
import type { CrossCheckDocument } from './cross-checks.js'
import type { Dataset } from 'rdf-ext'

export const VALIDATOR_NAME = '@socialcaredata/validator'

export interface DocumentInput {
  name?: string
  /** Raw text - preferred, because it unlocks line and column numbers. */
  text?: string
  /** Already-parsed JSON, when the caller has it. */
  data?: unknown
  /** Conformance mode: what this file is supposed to do. */
  expect?: 'valid' | 'invalid'
}

export interface ValidatorOptions {
  /** Trace focus nodes back to JSON paths. On unless a shape forbids it. */
  skolemize?: boolean
  /** Fetches an absolute `@context` URL named by a document. */
  fetchContext?: (url: string) => Promise<JsonLdContext>
  /** Drop issues below this severity. */
  minSeverity?: Severity
  version?: string
}

const SEVERITY_RANK: Record<Severity, number> = { violation: 0, warning: 1, info: 2 }

interface RunOutcome {
  report: DocumentReport
  dataset?: Dataset
  index?: Map<string, NodeLocation[]>
}

function infoIssue (code: Issue['code'], title: string, hint?: string): Issue {
  return {
    id: `${code}`,
    severity: 'info',
    code,
    title,
    ...(hint !== undefined ? { hint } : {}),
    location: { jsonPath: '$', pointer: '' },
  }
}

export class Validator {
  private readonly engine: { validate(data: Dataset): { conforms: boolean, results: unknown[] } }
  private readonly useSkolem: boolean

  constructor (
    private readonly profile: LoadedProfile,
    private readonly opts: ValidatorOptions = {},
  ) {
    this.engine = createShaclValidator(profile.shapes) as never
    // A shape demanding blank nodes would be broken by skolemization, so the
    // loader's finding overrides the caller's preference rather than the
    // other way round.
    this.useSkolem = (opts.skolemize ?? true) && profile.skolemSafe
  }

  async validate (input: DocumentInput | string | object): Promise<DocumentReport> {
    return (await this.run(input)).report
  }

  /**
   * The full result, including the dataset. Cross-record checks need every
   * document's triples at once, so `validateAll` keeps them; `validate`
   * discards them rather than leaking RDF into the public report type.
   */
  private async run (input: DocumentInput | string | object): Promise<RunOutcome> {
    const doc = normalise(input)
    const name = doc.name ?? 'document'

    let data: unknown
    try {
      data = doc.data !== undefined ? doc.data : JSON.parse(doc.text ?? '')
    } catch (error) {
      // Go through the same assembler as everything else, so the issue lands in
      // a group. Renderers walk groups, and an issue outside every group is an
      // issue nobody ever sees.
      return {
        report: assembleDocumentReport(name, false, [{
          id: 'parse-error',
          severity: 'violation',
          code: 'input/parse-error',
          title: `This file is not valid JSON: ${(error as Error).message}`,
          hint: 'Fix the syntax first - nothing else could be checked.',
          location: { jsonPath: '$', pointer: '', document: name },
        }]),
      }
    }

    const skolemized = this.useSkolem
      ? skolemize(data, {
          ...(doc.text !== undefined ? { text: doc.text } : {}),
          ...(this.profile.contextIndex ? { context: this.profile.contextIndex } : {}),
        })
      : { document: data, index: new Map<string, NodeLocation[]>(), sourceMap: undefined }
    const { document, index, sourceMap } = skolemized

    const resolution = await resolveContext(document, {
      ...(this.profile.context !== undefined ? { profileContext: this.profile.context } : {}),
      ...(this.profile.contextSource !== undefined ? { profileContextUrl: this.profile.contextSource } : {}),
      ...(this.opts.fetchContext ? { fetchContext: this.opts.fetchContext } : {}),
    })

    const dataset = await toDataset(document, resolution.context)
    const report = this.engine.validate(dataset)

    const issues = buildIssues(report.results as never, {
      document: name,
      shapes: this.profile.shapes,
      index,
      ...(this.profile.contextIndex ? { context: this.profile.contextIndex } : {}),
      declaredPaths: this.profile.declaredPaths,
      data,
      ...(sourceMap !== undefined ? { sourceMap } : {}),
    })

    if (resolution.assumed) {
      issues.push(infoIssue(
        'input/assumed-context',
        'No @context in this document, so the selected profile\'s context was used',
        'Field names were matched against the standard\'s own vocabulary.',
      ))
    } else if (resolution.substituted) {
      issues.push(infoIssue(
        'input/substituted-context',
        'The document\'s @context is a relative path, so the profile\'s published context was used instead',
      ))
    }

    const filtered = this.opts.minSeverity !== undefined
      ? issues.filter((i) => SEVERITY_RANK[i.severity] <= SEVERITY_RANK[this.opts.minSeverity!])
      : issues

    const result = assembleDocumentReport(name, report.conforms, filtered)
    if (doc.expect !== undefined) {
      result.expected = doc.expect
      result.expectationMet = doc.expect === 'valid' ? report.conforms : !report.conforms
    }
    return { report: result, dataset, index }
  }

  async validateAll (inputs: (DocumentInput | string | object)[]): Promise<RunReport> {
    const started = Date.now()
    const documents: DocumentReport[] = []
    const crossDocs: CrossCheckDocument[] = []

    for (const input of inputs) {
      const { report, dataset, index } = await this.run(input)
      if (dataset) {
        crossDocs.push({ name: report.document, dataset, index: index ?? new Map() })
      }
      documents.push(report)
    }

    const crossChecks = this.profile.crossChecks.map((check) => check.run(crossDocs))

    const counts = emptyCounts()
    for (const doc of documents) {
      for (const key of Object.keys(counts) as Severity[]) counts[key] += doc.counts[key]
    }

    const expectationsFailed = documents.some((d) => d.expectationMet === false)
    const conforms = documents.every((d) => d.conforms) &&
      crossChecks.every((c) => c.ok) &&
      !expectationsFailed

    return {
      schemaVersion: SCHEMA_VERSION,
      validator: { name: VALIDATOR_NAME, version: this.opts.version ?? '0.0.0' },
      profile: {
        id: this.profile.id,
        label: this.profile.label,
        ref: this.profile.ref,
        shapes: this.profile.shapeSources,
        ...(this.profile.contextSource !== undefined ? { context: this.profile.contextSource } : {}),
        warnings: this.profile.warnings,
      },
      documents,
      crossChecks,
      conforms,
      counts,
      durationMs: Date.now() - started,
    }
  }
}

function normalise (input: DocumentInput | string | object): DocumentInput {
  if (typeof input === 'string') return { text: input }
  if ('text' in input || 'data' in input || 'name' in input || 'expect' in input) {
    return input as DocumentInput
  }
  return { data: input }
}

export function createValidator (profile: LoadedProfile, opts?: ValidatorOptions): Validator {
  return new Validator(profile, opts)
}
