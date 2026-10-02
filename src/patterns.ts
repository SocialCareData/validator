/*
 * Plain-English names for the regexes the Social Care shapes use.
 *
 * Describing a regex in words is not a solved problem, so this is a lookup
 * over the handful the published shapes actually contain. Anything else falls
 * back to the shape's own `sh:description`.
 */

import type { PatternHint } from '@theodi/data-standard-validator'

export const PATTERNS: readonly PatternHint[] = [
  {
    pattern: /^\^\[A-Z\]\{1,2\}\[0-9\]\[0-9A-Z\]\? ?\?\[0-9\]\[A-Z\]\{2\}\$$/,
    description: 'a UK postcode in upper case, with an optional space',
    example: 'AB1 2CD',
  },
  { pattern: '^[AEU]{3}$', description: 'three letters, each one A, E or U', example: 'AEU' },
]
