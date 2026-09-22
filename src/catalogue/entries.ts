/*
 * Which shapes exist, and where they live.
 *
 * Shapes are never vendored into this package. They are generated from the
 * LinkML schemas in SocialCareData/standard and published to
 * SocialCareData/ontology, and that repo is the single source of truth. We hold
 * URLs, not copies, so a release of this tool can never ship a shape that
 * disagrees with the published standard.
 *
 * DEFAULT_REF is the git ref those URLs resolve against. It is `main` because
 * the ontology repo has no tags yet; once a MAIS release is cut, change it to
 * that tag so a given version of this package always validates identically.
 */

export const ONTOLOGY_REPO = 'SocialCareData/ontology'

/** TODO: switch to `v2026.1.0` once the ontology repo cuts its first release. */
export const DEFAULT_REF = 'main'

export interface ShapeRef {
  /** Path within the ontology repo, e.g. `person/person-connected-shape.ttl`. */
  file: string
  /**
   * When true, a 404 downgrades to a warning instead of failing the run.
   * Used for shapes that exist upstream but are not published yet.
   */
  optional?: boolean
  /** Shown to the user when an optional shape is missing. */
  provides?: string
}

export interface CatalogueEntry {
  id: string
  label: string
  /** Directory in the ontology repo. */
  module: string
  /** Merged into one dataset, in this order. */
  shapes: ShapeRef[]
  /** Path to the JSON-LD context, within the same module. */
  context: string
  /** Names from CROSS_CHECKS. */
  crossChecks: string[]
  /** Folder of bundled examples, relative to the package root. */
  examples: string
  /** One sentence for the profile picker. */
  describes: string
}

export const catalogue: readonly CatalogueEntry[] = Object.freeze([
  {
    id: 'person:subject-of-care',
    label: 'Person - subject of care',
    module: 'person',
    shapes: [{ file: 'person/person-subject-of-care-shape.ttl' }],
    context: 'person/context.jsonld',
    crossChecks: [],
    examples: 'examples/person/subject-of-care',
    describes: 'A person receiving care, with the fuller identity and demographic detail that role requires.',
  },
  {
    id: 'person:connected',
    label: 'Person - connected person',
    module: 'person',
    shapes: [{ file: 'person/person-connected-shape.ttl' }],
    context: 'person/context.jsonld',
    crossChecks: [],
    examples: 'examples/person/connected',
    describes: 'Someone connected to a subject of care - a relative, carer or contact - held to a lighter standard.',
  },
  {
    id: 'placements',
    label: "Children's Social Care Placements",
    module: 'placements',
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
    describes: 'A placement record across its whole lifecycle, from requirements through to quality assurance.',
  },
  {
    id: 'safeguarding',
    label: 'Safeguarding',
    module: 'safeguarding',
    shapes: [{ file: 'safeguarding/safeguarding-standard-shape.ttl' }],
    context: 'safeguarding/context.jsonld',
    crossChecks: [],
    examples: 'examples/safeguarding',
    describes: 'Organisations, services, professionals and service episodes involved in safeguarding.',
  },
  {
    id: 'assessments-and-plans',
    label: 'Care Needs Assessments and Care Plans',
    module: 'assessments-and-plans',
    shapes: [{ file: 'assessments-and-plans/assessments-and-plans-standard-shape.ttl' }],
    context: 'assessments-and-plans/context.jsonld',
    crossChecks: [],
    examples: 'examples/assessments-and-plans',
    describes: 'Care needs assessments and the care plans that follow from them.',
  },
])

export function getEntry (id: string): CatalogueEntry | undefined {
  return catalogue.find((e) => e.id === id)
}

export function rawUrl (ref: string, file: string): string {
  return `https://raw.githubusercontent.com/${ONTOLOGY_REPO}/${ref}/${file}`
}

export interface ProfileUrls {
  shapes: { url: string, optional: boolean, provides?: string }[]
  context: string
}

export function profileUrls (id: string, ref: string = DEFAULT_REF): ProfileUrls {
  const entry = getEntry(id)
  if (!entry) {
    throw new Error(
      `unknown profile '${id}'. Available: ${catalogue.map((e) => e.id).join(', ')}`,
    )
  }
  return {
    shapes: entry.shapes.map((s) => ({
      url: rawUrl(ref, s.file),
      optional: s.optional === true,
      ...(s.provides !== undefined ? { provides: s.provides } : {}),
    })),
    context: rawUrl(ref, entry.context),
  }
}
