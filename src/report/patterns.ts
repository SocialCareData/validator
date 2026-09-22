/*
 * Regexes, described the way a person would describe them.
 *
 * There are only nine distinct patterns across the published shapes, so this is
 * a lookup rather than a general regex-to-prose engine - which is a problem
 * nobody has solved well. Anything unrecognised falls back to naming the field
 * and, where the shape carried a `sh:description`, quoting that instead of the
 * regex.
 */

export interface PatternDescription {
  description: string
  example?: string
}

const KNOWN: { test: RegExp, description: string, example?: string }[] = [
  {
    test: /^\^\[A-Z\]\{1,2\}\[0-9\]\[0-9A-Z\]\? ?\?\[0-9\]\[A-Z\]\{2\}\$$/,
    description: 'a UK postcode in upper case, with an optional space',
    example: 'AB1 2CD',
  },
  {
    test: /^\^\[AEU\]\{3\}\$$/,
    description: 'three letters, each one A, E or U',
    example: 'AEU',
  },
  {
    test: /^\^\\d\{10\}\$$/,
    description: 'exactly 10 digits',
    example: '9012345678',
  },
  {
    test: /^\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$$/,
    description: 'a date written as YYYY-MM-DD',
    example: '2026-04-01',
  },
]

/** Turn a handful of obvious regex idioms into words. */
function describeGeneric (pattern: string): string | undefined {
  let m = /^\^\\d\{(\d+)\}\$$/.exec(pattern)
  if (m) return `exactly ${m[1]} digits`
  m = /^\^\[0-9\]\{(\d+)\}\$$/.exec(pattern)
  if (m) return `exactly ${m[1]} digits`
  m = /^\^\.\{(\d+),\}\$$/.exec(pattern)
  if (m) return `at least ${m[1]} characters`
  return undefined
}

export function describePattern (pattern: string): PatternDescription | undefined {
  for (const known of KNOWN) {
    if (known.test.test(pattern)) {
      return {
        description: known.description,
        ...(known.example !== undefined ? { example: known.example } : {}),
      }
    }
  }
  const generic = describeGeneric(pattern)
  return generic !== undefined ? { description: generic } : undefined
}

/**
 * Pull an example out of a `sh:description` - the modellers write them as
 * "UK postcode in standard format (e.g. AB1 2CD)." which is exactly the
 * example we would otherwise have to invent.
 */
export function exampleFromDescription (description: string | undefined): string | undefined {
  if (description === undefined) return undefined
  const match = /\(e\.g\.?,?\s*([^)]+)\)/i.exec(description)
  return match?.[1]?.trim()
}
