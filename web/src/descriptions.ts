/*
 * One-line descriptions for the profile picker.
 *
 * These live here rather than in the catalogue because they exist only to fill
 * the helper text under a <select>. The published package has no use for them,
 * and src/ is what gets published.
 */

export const DESCRIPTIONS: Record<string, string> = {
  'person:subject-of-care':
    'A person receiving care, with the fuller identity and demographic detail that role requires.',
  'person:connected':
    'Someone connected to a subject of care - a relative, carer or contact - held to a lighter standard.',
  placements:
    'A placement record across its whole lifecycle, from requirements through to quality assurance.',
  safeguarding:
    'Organisations, services, professionals and service episodes involved in safeguarding.',
  'assessments-and-plans':
    'Care needs assessments and the care plans that follow from them.',
}
