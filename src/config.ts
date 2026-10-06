/*
 * The Social Care standards, as the validator component is configured with them.
 *
 * Shapes are never bundled. They are generated from the LinkML schemas in
 * SocialCareData/standard and published to SocialCareData/ontology, and this
 * file holds URLs into that repository rather than copies - so the page can
 * never check against a shape that disagrees with the published standard. The
 * `blob/main` in each URL is only the default: the page's version box swaps
 * in any tag or branch.
 *
 * Type imports only. The page's main thread imports this file, and pulling in
 * the engine would add ~500 kB to that bundle.
 */

import type { ValidatorConfig } from './component/config.js'

const ONTOLOGY = 'https://github.com/SocialCareData/ontology/blob/main'
/*
 * The examples sit beside the shapes but are not versioned with them: the ref
 * box changes only shapes and contexts, and tags older than the examples'
 * move to the ontology repository have none.
 */
const EXAMPLES = `${ONTOLOGY}/examples`

/*
 * Every standard names its module context, although the examples declare the
 * ontology's released combined context. That combined context defines
 * `outcome` twice - safeguarding's and assessments-and-plans' - and the later
 * one wins, which fails valid-safeguarding-full. Browsers also cannot fetch
 * GitHub release assets (no CORS). Drop these once the ontology fixes both.
 */
export const config: ValidatorConfig = {
  standards: [
    {
      name: 'Person - subject of care',
      description: 'A person receiving care, with the fuller identity and demographic detail that role requires.',
      shapes: `${ONTOLOGY}/person/person-subject-of-care-shape.ttl`,
      context: `${ONTOLOGY}/person/context.jsonld`,
      examples: [
        `${EXAMPLES}/person/subject-of-care/valid-subject-of-care.jsonld`,
        `${EXAMPLES}/person/subject-of-care/valid-subject-of-care-full.jsonld`,
      ],
    },
    {
      name: 'Person - connected person',
      description: 'Someone connected to a subject of care - a relative, carer or contact - held to a lighter standard.',
      shapes: `${ONTOLOGY}/person/person-connected-shape.ttl`,
      context: `${ONTOLOGY}/person/context.jsonld`,
      examples: [
        `${EXAMPLES}/person/connected/valid-connected.jsonld`,
        `${EXAMPLES}/person/connected/valid-connected-full.jsonld`,
      ],
    },
    {
      name: "Children's Social Care Placements",
      description: 'A placement record across its whole lifecycle, from requirements through to quality assurance.',
      shapes: `${ONTOLOGY}/placements/placements-standard-shape.ttl`,
      context: `${ONTOLOGY}/placements/context.jsonld`,
      examples: [
        `${EXAMPLES}/placements/valid-placement.jsonld`,
        `${EXAMPLES}/placements/valid-placement-full.jsonld`,
      ],
    },
    {
      name: 'Safeguarding',
      description: 'Organisations, services, professionals and service episodes involved in safeguarding.',
      shapes: `${ONTOLOGY}/safeguarding/safeguarding-standard-shape.ttl`,
      context: `${ONTOLOGY}/safeguarding/context.jsonld`,
      examples: [
        `${EXAMPLES}/safeguarding/valid-safeguarding.jsonld`,
        `${EXAMPLES}/safeguarding/valid-safeguarding-full.jsonld`,
      ],
    },
    {
      name: 'Care Needs Assessments and Care Plans',
      description: 'Care needs assessments and the care plans that follow from them.',
      shapes: `${ONTOLOGY}/assessments-and-plans/assessments-and-plans-standard-shape.ttl`,
      context: `${ONTOLOGY}/assessments-and-plans/context.jsonld`,
      examples: [
        `${EXAMPLES}/assessments-and-plans/valid-assessments-and-plans.jsonld`,
        `${EXAMPLES}/assessments-and-plans/valid-assessments-and-plans-full.jsonld`,
      ],
    },
  ],

  /*
   * Plain-English names for the regexes the shapes use. Describing a regex in
   * words is not a solved problem, so this is a lookup over the handful the
   * published shapes actually contain. Anything else falls back to the
   * shape's own `sh:description`.
   */
  patterns: [
    {
      pattern: /^\^\[A-Z\]\{1,2\}\[0-9\]\[0-9A-Z\]\? ?\?\[0-9\]\[A-Z\]\{2\}\$$/,
      description: 'a UK postcode in upper case, with an optional space',
      example: 'AB1 2CD',
    },
    { pattern: '^[AEU]{3}$', description: 'three letters, each one A, E or U', example: 'AEU' },
  ],

  placeholder: '{\n  "@type": "Person",\n  "name": [{ "@type": "Name", "givenName": ["Ada"], "familyName": "Lovelace" }]\n}',
  storageKey: 'scd-validator:last',
}
