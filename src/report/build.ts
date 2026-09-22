/*
 * Turning a raw SHACL report into something worth reading.
 *
 * The three translations that matter, in order of how much they help:
 *   focus node   -> a JSON path, via the skolemization index
 *   property IRI -> the term the user wrote, via the inverted context
 *   constraint   -> a sentence, via shape facts and messages.ts
 */

import { createHash } from './hash.js'
import { isSkolemIri } from '../core/skolemize.js'
import { describeConstraint, suggest } from './messages.js'
import { shapeFacts } from './shape-facts.js'
import type { ContextIndex } from '../core/context.js'
import type { NodeLocation } from '../core/skolemize.js'
import type { SourceMap } from '../core/source-map.js'
import type { Dataset } from 'rdf-ext'
import type { ValidationResult } from 'rdf-validate-shacl'
import type { DocumentReport, Issue, IssueGroup, Location, Severity } from './types.js'
import { emptyCounts } from './types.js'

export interface BuildContext {
  document: string
  shapes: Dataset
  index: Map<string, NodeLocation[]>
  context?: ContextIndex
  /** Every path any shape declares - for did-you-mean on unknown fields. */
  declaredPaths: string[]
  /** The parsed document, for reading the offending value back out. */
  data: unknown
  /** Locates the *property* in the source text, not just its parent node. */
  sourceMap?: SourceMap
}

function severityOf (result: ValidationResult): Severity {
  const value = result.severity?.value ?? ''
  if (value.endsWith('Warning')) return 'warning'
  if (value.endsWith('Info')) return 'info'
  return 'violation'
}

/** The raw JSON value of the offending property, for quoting back at the user. */
function resolvePointerForValue (
  build: BuildContext, base: Location, term: string | undefined,
): string | undefined {
  if (term === undefined) return undefined
  const pointer = `${base.pointer}/${term.replace(/~/g, '~0').replace(/\//g, '~1')}`
  const value = resolvePointer(build.data, pointer)
  // `"x": ["XYZ"]` reads as XYZ to the person who wrote it; only collapse when
  // there is exactly one entry, so we never hide that there were several.
  const scalar = Array.isArray(value) && value.length === 1 ? value[0] : value
  if (typeof scalar === 'string' || typeof scalar === 'number' || typeof scalar === 'boolean') {
    return String(scalar)
  }
  return undefined
}

function resolvePointer (data: unknown, pointer: string): unknown {
  if (pointer === '') return data
  let current: unknown = data
  for (const raw of pointer.split('/').slice(1)) {
    const key = raw.replace(/~1/g, '/').replace(/~0/g, '~')
    if (Array.isArray(current)) current = current[Number(key)]
    else if (current !== null && typeof current === 'object') current = (current as Record<string, unknown>)[key]
    else return undefined
    if (current === undefined) return undefined
  }
  return current
}

function displayValue (raw: string | undefined, ctx: ContextIndex | undefined,
                       propertyIri: string | undefined, typeIri: string | undefined): string | undefined {
  if (raw === undefined) return undefined
  if (ctx && /^https?:\/\//.test(raw)) {
    const token = propertyIri !== undefined ? ctx.tokenFor(raw, propertyIri, typeIri) : undefined
    if (token !== undefined) return token
    const term = ctx.termFor(raw, typeIri)
    if (term !== undefined) return term
    return ctx.compact(raw)
  }
  return raw
}

export function buildIssues (results: ValidationResult[], build: BuildContext): Issue[] {
  const issues: Issue[] = []

  for (const result of results) {
    const focus = result.focusNode?.value
    const locations = focus !== undefined ? build.index.get(focus) : undefined
    const primary = locations?.[0]

    const propertyIri = result.path?.value
    const typeIri = primary?.nodeType !== undefined && build.context
      ? build.context.expand(primary.nodeType)
      : undefined

    const term = propertyIri !== undefined && build.context
      ? build.context.termFor(propertyIri, typeIri)
      : undefined

    const facts = shapeFacts(build.shapes, result.sourceShape)
    const component = result.sourceConstraintComponent?.value.split('#').pop() ?? 'Unknown'

    // Permitted values, rendered as the tokens a user would type.
    let allowed: string[] | undefined
    if (facts.in && build.context && propertyIri !== undefined) {
      const tokens = build.context.tokensFor(propertyIri, typeIri)
      allowed = facts.in.map((iri) => tokens?.get(iri)
        ?? build.context?.termFor(iri, typeIri)
        ?? build.context?.compact(iri)
        ?? iri)
    } else if (facts.in) {
      allowed = facts.in
    }

    const value = displayValue(result.value?.value, build.context, propertyIri, typeIri)

    // The issue sits at the *property*, one level below the focus node.
    const base: Location = primary
      ? { ...primary, document: build.document }
      : { jsonPath: '$', pointer: '', document: build.document }

    const rawJsonValue = resolvePointerForValue(build, base, term)
    const message = describeConstraint({
      component,
      term,
      facts,
      value: rawJsonValue ?? value,
      ...(allowed !== undefined ? { allowed, allowedIris: facts.in } : {}),
      ...(component === 'ClosedConstraintComponent' && propertyIri !== undefined && build.context
        ? {
            didYouMean: suggest(
              build.context.termFor(propertyIri, typeIri) ?? propertyIri.split(/[#/]/).pop() ?? '',
              build.declaredPaths
                .map((p) => build.context?.termFor(p, typeIri))
                .filter((t): t is string => t !== undefined),
            ),
          }
        : {}),
    })

    let location: Location = base
    if (term !== undefined && primary) {
      const pointer = `${base.pointer}/${term.replace(/~/g, '~0').replace(/\//g, '~1')}`
      // The span of the *property* is what the user needs underlined. When the
      // property is absent (a minCount failure) there is nothing to point at,
      // so we keep the enclosing node's span instead of pointing at line 1.
      const span = build.sourceMap?.locate(pointer)
      location = {
        ...base,
        jsonPath: base.jsonPath === '$' ? term : `${base.jsonPath}.${term}`,
        pointer,
        ...(span ?? {}),
      }
    }

    const jsonValue = resolvePointer(build.data, location.pointer)

    // `gc:7` is our expansion of the value; `7` is what the user typed. Show
    // theirs when we can see it, and keep ours in the technical block.
    const shownValue = typeof jsonValue === 'string' || typeof jsonValue === 'number' ||
      typeof jsonValue === 'boolean'
      ? String(jsonValue)
      : value

    const issue: Issue = {
      id: createHash(`${build.document}|${location.pointer}|${component}|${result.value?.value ?? ''}`),
      severity: severityOf(result),
      code: message.code,
      title: message.title,
      ...(message.hint !== undefined ? { hint: message.hint } : {}),
      ...(facts.description !== undefined ? { detail: facts.description } : {}),
      location,
      ...(term !== undefined && propertyIri !== undefined
        ? { field: { term, iri: propertyIri } }
        : {}),
      ...(value !== undefined
        ? {
            value: {
              display: shownValue ?? value,
              ...(jsonValue !== undefined ? { json: jsonValue } : {}),
              kind: result.value?.termType === 'NamedNode' ? 'iri' as const
                : result.value?.termType === 'BlankNode' ? 'node' as const
                : 'literal' as const,
            },
          }
        : message.code === 'required-field-missing'
          ? { value: { display: '(absent)', kind: 'missing' as const } }
          : {}),
      ...(message.expected !== undefined ? { expected: message.expected } : {}),
      technical: {
        // A synthetic identifier means nothing outside this process, so the
        // technical block reports the node the way a reader can actually find
        // it: the nearest @id the document supplied, or its position.
        focusNode: focus === undefined
          ? '(none)'
          : isSkolemIri(focus)
            ? `(anonymous node at ${base.jsonPath}${
                primary?.nearestId !== undefined ? `, within ${primary.nearestId}` : ''})`
            : focus,
        ...(propertyIri !== undefined ? { resultPath: propertyIri } : {}),
        ...(result.sourceShape ? { sourceShape: result.sourceShape.value } : {}),
        sourceConstraintComponent: result.sourceConstraintComponent?.value ?? '(unknown)',
        ...(result.message.length > 0
          ? { shaclMessage: result.message.map((m) => m.value) }
          : {}),
        ...(result.value?.value !== undefined ? { value: result.value.value } : {}),
      },
    }

    if (locations && locations.length > 1) {
      issue.relatedLocations = locations.slice(1).map((l) => ({ ...l, document: build.document }))
    }

    issues.push(issue)
  }

  return dedupe(issues)
}

/**
 * One mistake often trips several constraints at once - an out-of-vocabulary
 * enum value fails `sh:in` *and* `sh:class`. Showing both trains people to
 * ignore the output, so the specific complaint wins and the generic one goes.
 */
function dedupe (issues: Issue[]): Issue[] {
  const bySlot = new Map<string, Issue[]>()
  for (const issue of issues) {
    const slot = `${issue.location.pointer}|${issue.technical?.value ?? ''}`
    const bucket = bySlot.get(slot)
    if (bucket) bucket.push(issue)
    else bySlot.set(slot, [issue])
  }

  const suppressed = new Set<string>()
  for (const bucket of bySlot.values()) {
    if (bucket.length < 2) continue
    const hasSpecific = bucket.some((i) => i.code === 'value-not-allowed' || i.code === 'bad-format')
    if (!hasSpecific) continue
    for (const issue of bucket) {
      if (issue.code === 'wrong-type' || issue.code === 'wrong-object-type') suppressed.add(issue.id)
    }
  }

  const seen = new Set<string>()
  return issues.filter((issue) => {
    if (suppressed.has(issue.id)) return false
    if (seen.has(issue.id)) return false
    seen.add(issue.id)
    return true
  })
}

const SEVERITY_ORDER: Record<Severity, number> = { violation: 0, warning: 1, info: 2 }

export function groupIssues (issues: Issue[]): IssueGroup[] {
  const groups = new Map<string, IssueGroup>()
  for (const issue of issues) {
    const loc = issue.location
    // Group by the node, not the property: "everything wrong with address[0]".
    let nodePath = loc.jsonPath
    if (issue.field !== undefined) {
      const suffix = `.${issue.field.term}`
      if (loc.jsonPath.endsWith(suffix)) nodePath = loc.jsonPath.slice(0, -suffix.length)
      else if (loc.jsonPath === issue.field.term) nodePath = '$' // a root-level field
    }
    const key = `${loc.document ?? ''}#${nodePath || '$'}`
    const atRoot = nodePath === '' || nodePath === '$'
    // `PlacementAvailability (placementAvailability)` says the same thing twice.
    const redundant = loc.nodeType !== undefined &&
      nodePath.toLowerCase() === loc.nodeType.toLowerCase()
    const label = loc.nodeType !== undefined
      ? (atRoot || redundant ? loc.nodeType : `${loc.nodeType} (${nodePath})`)
      : atRoot ? 'this record' : nodePath
    const existing = groups.get(key)
    if (existing) existing.issues.push(issue.id)
    else groups.set(key, { key, label, location: { ...loc, jsonPath: nodePath || '$' }, issues: [issue.id] })
  }
  return [...groups.values()]
}

export function assembleDocumentReport (
  documentName: string,
  conforms: boolean,
  issues: Issue[],
): DocumentReport {
  const sorted = [...issues].sort((a, b) => {
    const bySeverity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
    if (bySeverity !== 0) return bySeverity
    return (a.location.line ?? 0) - (b.location.line ?? 0)
  })
  const counts = emptyCounts()
  for (const issue of sorted) counts[issue.severity]++
  return {
    document: documentName,
    conforms,
    counts,
    issues: sorted,
    groups: groupIssues(sorted),
  }
}
