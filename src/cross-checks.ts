/*
 * Constraints that hold across a whole set of records, which SHACL Core cannot
 * express at all - it validates one focus node at a time.
 */

import { rdf } from './rdf.js'
import type { Dataset } from 'rdf-ext'

export interface CrossCheckDocument {
  name: string
  dataset: Dataset
}

export interface CrossCheckFinding {
  message: string
  documents: string[]
}

export interface CrossCheckResult {
  id: string
  title: string
  ok: boolean
  findings: CrossCheckFinding[]
}

export interface CrossCheck {
  id: string
  title: string
  run(documents: CrossCheckDocument[]): CrossCheckResult
}

/*
 * Flat namespace: every module shares https://ontology.socialcaredata.io/, so
 * this is sc:childId, not a placements-scoped IRI. Getting this wrong matches
 * zero quads and the check passes vacuously - which is exactly what used to
 * happen, so the test for it uses purpose-built fixtures that really do collide.
 */
const CHILD_ID = 'https://ontology.socialcaredata.io/childId'

export const duplicateChildId: CrossCheck = {
  id: 'duplicate-child-id',
  title: 'duplicate childId across the record set',
  run (documents) {
    const predicate = rdf.namedNode(CHILD_ID)
    const seen = new Map<string, string[]>()
    for (const { name, dataset } of documents) {
      for (const quad of dataset.match(null, predicate, null)) {
        const id = quad.object.value
        const bucket = seen.get(id)
        if (bucket) {
          if (!bucket.includes(name)) bucket.push(name)
        } else {
          seen.set(id, [name])
        }
      }
    }
    const findings: CrossCheckFinding[] = []
    for (const [id, names] of seen) {
      if (names.length > 1) {
        findings.push({
          message: `childId ${id} appears in ${names.length} records: ${names.join(', ')}`,
          documents: names,
        })
      }
    }
    return { id: this.id, title: this.title, ok: findings.length === 0, findings }
  },
}

export const CROSS_CHECKS: Record<string, CrossCheck> = {
  duplicateChildId,
}
