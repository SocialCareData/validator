/*
 * Which shapes exist, and where they live.
 *
 * Shapes are never bundled. They are generated from the LinkML schemas in
 * SocialCareData/standard and published to SocialCareData/ontology, and this
 * package holds URLs into that repository rather than copies - so a release can
 * never ship a shape that disagrees with the published standard.
 */

export const ONTOLOGY_REPO = 'SocialCareData/ontology'

/** TODO: switch to `v2026.1.0` once the ontology repo cuts its first release. */
export const DEFAULT_REF = 'main'

export interface ShapeRef {
  /** Path within the ontology repo. */
  file: string
  /** A 404 on an optional shape is a warning, not a failure. */
  optional?: boolean
  /** What is lost when an optional shape is missing. */
  provides?: string
}

export interface Profile {
  id: string
  label: string
  /** Merged into one dataset, in this order. */
  shapes: ShapeRef[]
  /** JSON-LD context, in the same repo. */
  context: string
  /** Names from CROSS_CHECKS. */
  crossChecks: string[]
  /** Folder of bundled examples, relative to the package root. */
  examples: string
}

export const profiles: readonly Profile[] = Object.freeze([
  {
    id: 'person:subject-of-care',
    label: 'Person - subject of care',
    shapes: [{ file: 'person/person-subject-of-care-shape.ttl' }],
    context: 'person/context.jsonld',
    crossChecks: [],
    examples: 'examples/person/subject-of-care',
  },
  {
    id: 'person:connected',
    label: 'Person - connected person',
    shapes: [{ file: 'person/person-connected-shape.ttl' }],
    context: 'person/context.jsonld',
    crossChecks: [],
    examples: 'examples/person/connected',
  },
  {
    id: 'placements',
    label: "Children's Social Care Placements",
    shapes: [
      { file: 'placements/placements-standard-shape.ttl' },
      {
        file: 'placements/placements-base-rules-shape.ttl',
        optional: true,
        provides: 'the conditional "Other requires free text" rules',
      },
    ],
    context: 'placements/context.jsonld',
    crossChecks: ['duplicateChildId'],
    examples: 'examples/placements',
  },
  {
    id: 'safeguarding',
    label: 'Safeguarding',
    shapes: [{ file: 'safeguarding/safeguarding-standard-shape.ttl' }],
    context: 'safeguarding/context.jsonld',
    crossChecks: [],
    examples: 'examples/safeguarding',
  },
  {
    id: 'assessments-and-plans',
    label: 'Care Needs Assessments and Care Plans',
    shapes: [{ file: 'assessments-and-plans/assessments-and-plans-standard-shape.ttl' }],
    context: 'assessments-and-plans/context.jsonld',
    crossChecks: [],
    examples: 'examples/assessments-and-plans',
  },
])

export function getProfile (id: string): Profile | undefined {
  return profiles.find((p) => p.id === id)
}

export function rawUrl (ref: string, file: string): string {
  return `https://raw.githubusercontent.com/${ONTOLOGY_REPO}/${ref}/${file}`
}
