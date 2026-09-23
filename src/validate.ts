/*
 * The pipeline: JSON in, report out.
 *
 *   parse -> skolemize -> resolve @context -> toRDF -> SHACL -> humanise
 *
 * Isomorphic. The CLI supplies file contents and the web page supplies a
 * textarea's value; neither changes what happens here.
 */

import { skolemize, type NodeLocation, type SourceMap } from './skolemize.js'
import { resolveContext, toDataset } from './jsonld.js'
import { createShaclValidator } from './shacl.js'
import { buildIssues, documentReport, emptyCounts, noteIssue } from './report.js'
import type { DocumentReport, Issue, RunReport, Severity } from './report.js'
import type { LoadedProfile } from './profile.js'
import type { CrossCheckDocument } from './cross-checks.js'
import type { Dataset } from 'rdf-ext'

export interface DocumentInput {
  name?: string
  /** Raw text - preferred, because it is what gives issues a line and column. */
  text?: string
  /** Already-parsed JSON, when the caller has it. */
  data?: unknown
}

interface Outcome {
  report: DocumentReport
  dataset?: Dataset
}

export class Validator {
  private readonly engine: { validate(data: Dataset): { conforms: boolean, results: never[] } }
  private readonly useSkolem: boolean

  constructor (private readonly profile: LoadedProfile) {
    this.engine = createShaclValidator(profile.shapes) as never
    // A shape demanding blank nodes would be broken by skolemization, so the
    // loader's finding decides this, not the caller.
    this.useSkolem = profile.skolemSafe
  }

  async validate (input: DocumentInput | string | object): Promise<DocumentReport> {
    return (await this.run(input)).report
  }

  async validateAll (inputs: (DocumentInput | string | object)[]): Promise<RunReport> {
    const documents: DocumentReport[] = []
    const crossDocs: CrossCheckDocument[] = []

    for (const input of inputs) {
      const { report, dataset } = await this.run(input)
      if (dataset) crossDocs.push({ name: report.document, dataset })
      documents.push(report)
    }

    const crossChecks = this.profile.crossChecks.map((check) => check.run(crossDocs))

    const counts = emptyCounts()
    for (const doc of documents) {
      for (const key of Object.keys(counts) as Severity[]) counts[key] += doc.counts[key]
    }

    return {
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
      conforms: documents.every((d) => d.conforms) && crossChecks.every((c) => c.ok),
      counts,
    }
  }

  private async run (input: DocumentInput | string | object): Promise<Outcome> {
    const doc = normalise(input)
    const name = doc.name ?? 'document'

    let data: unknown
    try {
      data = doc.data !== undefined ? doc.data : JSON.parse(doc.text ?? '')
    } catch (error) {
      // Through the same assembler as everything else: an issue that renderers
      // do not walk is an issue nobody ever sees.
      return {
        report: documentReport(name, false, [{
          severity: 'violation',
          code: 'parse-error',
          title: `This file is not valid JSON: ${(error as Error).message}`,
          hint: 'Fix the syntax first - nothing else could be checked.',
          location: { jsonPath: '$', pointer: '', document: name },
        }]),
      }
    }

    let document: unknown = data
    let index = new Map<string, NodeLocation[]>()
    let sourceMap: SourceMap | undefined
    if (this.useSkolem) {
      const result = skolemize(data, {
        ...(doc.text !== undefined ? { text: doc.text } : {}),
        ...(this.profile.contextIndex ? { context: this.profile.contextIndex } : {}),
      })
      document = result.document
      index = result.index
      sourceMap = result.sourceMap
    }

    const resolved = resolveContext(document, this.profile.context)
    const dataset = await toDataset(document, resolved.context)
    const shaclReport = this.engine.validate(dataset)

    const issues = buildIssues(shaclReport.results, {
      document: name,
      shapes: this.profile.shapes,
      index,
      ...(this.profile.contextIndex ? { context: this.profile.contextIndex } : {}),
      data,
      ...(sourceMap !== undefined ? { sourceMap } : {}),
    })

    if (resolved.note === 'assumed') {
      issues.push(withDocument(noteIssue(
        'assumed-context',
        "No @context in this document, so the selected profile's context was used",
      ), name))
    } else if (resolved.note === 'substituted') {
      issues.push(withDocument(noteIssue(
        'substituted-context',
        "This document's @context names a file we do not have, so the profile's published context was used",
      ), name))
    }

    return { report: documentReport(name, shaclReport.conforms, issues), dataset }
  }
}

function withDocument (issue: Issue, document: string): Issue {
  return { ...issue, location: { ...issue.location, document } }
}

function normalise (input: DocumentInput | string | object): DocumentInput {
  if (typeof input === 'string') return { text: input }
  if ('text' in input || 'data' in input || 'name' in input) return input as DocumentInput
  return { data: input }
}

export function createValidator (profile: LoadedProfile): Validator {
  return new Validator(profile)
}
