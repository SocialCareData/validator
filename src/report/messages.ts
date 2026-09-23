/*
 * SHACL constraint components, rendered as sentences.
 *
 * The generated shapes declare no `sh:message` at all, so the strings a SHACL
 * engine produces ("Less than 1 values") are its own generic defaults and are
 * not worth parsing. They do declare several hundred `sh:description`s and, of
 * course, the constraint parameters themselves - so the wording is built from
 * the source shape instead. The hand-maintained rules shapes are the exception:
 * they carry a message written by the modellers, and it is used verbatim.
 */

import type { ShapeFacts } from './shape-facts.js'
import type { IssueCode } from './types.js'

export interface MessageInput {
  /** Component name with the `sh:` prefix stripped. */
  constraint: string
  /** Field name as the user writes it, already resolved from the context. */
  term: string | undefined
  facts: ShapeFacts
  /** The offending value, as the user wrote it. */
  value: string | undefined
  /** Permitted values as tokens, for `sh:in`. */
  allowedValues?: string[]
}

export interface Message {
  code: IssueCode
  title: string
  hint?: string
}

const FRIENDLY_DATATYPES: Record<string, string> = {
  'http://www.w3.org/2001/XMLSchema#string': 'a piece of text',
  'http://www.w3.org/2001/XMLSchema#integer': 'a whole number',
  'http://www.w3.org/2001/XMLSchema#int': 'a whole number',
  'http://www.w3.org/2001/XMLSchema#decimal': 'a number',
  'http://www.w3.org/2001/XMLSchema#float': 'a number',
  'http://www.w3.org/2001/XMLSchema#double': 'a number',
  'http://www.w3.org/2001/XMLSchema#boolean': 'true or false',
  'http://www.w3.org/2001/XMLSchema#date': 'a date (YYYY-MM-DD)',
  'http://www.w3.org/2001/XMLSchema#dateTime': 'a date and time',
  'http://www.w3.org/2001/XMLSchema#anyURI': 'a URL',
}

export function friendlyDatatype (iri: string | undefined): string {
  if (iri === undefined) return 'a different type'
  return FRIENDLY_DATATYPES[iri] ?? `a ${iri.split(/[#/]/).pop() ?? 'value'}`
}

/*
 * Describing a regex in words is not a solved problem, so this is a lookup over
 * the handful of patterns the published shapes actually use. Anything else
 * falls back to the shape's own `sh:description`.
 */
const PATTERNS: { test: RegExp, description: string, example?: string }[] = [
  {
    test: /^\^\[A-Z\]\{1,2\}\[0-9\]\[0-9A-Z\]\? ?\?\[0-9\]\[A-Z\]\{2\}\$$/,
    description: 'a UK postcode in upper case, with an optional space',
    example: 'AB1 2CD',
  },
  { test: /^\^\[AEU\]\{3\}\$$/, description: 'three letters, each one A, E or U', example: 'AEU' },
]

function describePattern (pattern: string): { description: string, example?: string } | undefined {
  for (const known of PATTERNS) {
    if (known.test.test(pattern)) {
      return { description: known.description, ...(known.example !== undefined ? { example: known.example } : {}) }
    }
  }
  const digits = /^\^(?:\\d|\[0-9\])\{(\d+)\}\$$/.exec(pattern)
  return digits ? { description: `exactly ${digits[1]} digits` } : undefined
}

/**
 * The modellers write descriptions as "UK postcode in standard format
 * (e.g. AB1 2CD)", which is exactly the example we would otherwise invent.
 */
function exampleFrom (description: string | undefined): string | undefined {
  if (description === undefined) return undefined
  return /\(e\.g\.?,?\s*([^)]+)\)/i.exec(description)?.[1]?.trim()
}

const quoted = (value: string | undefined): string =>
  value === undefined ? '' : ` - you gave \`${value}\``

const field = (term: string | undefined): string =>
  term !== undefined ? `\`${term}\`` : 'this field'

export function describeConstraint (input: MessageInput): Message {
  const { constraint, term, facts, value } = input
  const name = field(term)

  switch (constraint) {
    case 'MinCountConstraintComponent': {
      const min = facts.minCount ?? 1
      if (min > 1) return { code: 'too-few-values', title: `${name} needs at least ${min} values` }
      return {
        code: 'required-field-missing',
        title: `Missing required field ${name}`,
        hint: facts.description !== undefined
          ? `Add ${name}: ${facts.description}`
          : `Add ${name} to this record.`,
      }
    }

    case 'MaxCountConstraintComponent': {
      const max = facts.maxCount ?? 1
      return {
        code: 'too-many-values',
        title: max === 1
          ? `${name} may only appear once`
          : `${name} may appear at most ${max} times`,
        ...(max === 1 ? { hint: `Keep a single ${term ?? 'value'} and remove the rest.` } : {}),
      }
    }

    case 'InConstraintComponent': {
      const allowed = input.allowedValues ?? []
      const shown = allowed.length > 6
        ? `${allowed.slice(0, 6).join(', ')} and ${allowed.length - 6} more`
        : allowed.join(', ')
      return {
        code: 'value-not-allowed',
        title: `${name} must be one of the permitted values${quoted(value)}`,
        ...(allowed.length > 0 ? { hint: `Allowed values: ${shown}.` } : {}),
      }
    }

    case 'PatternConstraintComponent': {
      const described = facts.pattern !== undefined ? describePattern(facts.pattern) : undefined
      const example = described?.example ?? exampleFrom(facts.description)
      const what = described?.description ?? facts.description ?? 'the expected format'
      return {
        code: 'bad-format',
        title: `${name} is not in the expected format${quoted(value)}`,
        hint: example !== undefined
          ? `It should be ${what}, for example \`${example}\`.`
          : `It should be ${what}.`,
      }
    }

    case 'DatatypeConstraintComponent':
      return {
        code: 'wrong-type',
        title: `${name} must be ${friendlyDatatype(facts.datatype)}${quoted(value)}`,
      }

    case 'NodeKindConstraintComponent': {
      const wantsLiteral = facts.nodeKind?.endsWith('Literal') === true
      return {
        code: 'wrong-type',
        title: wantsLiteral
          ? `${name} must be a plain value, not an object${quoted(value)}`
          : `${name} must be an object or a reference, not a plain value${quoted(value)}`,
        hint: wantsLiteral
          ? `Write ${name} as a string or number rather than a nested object.`
          : `Write ${name} as a nested object, or as an identifier pointing at one.`,
      }
    }

    case 'ClassConstraintComponent':
    case 'NodeConstraintComponent': {
      const klass = facts.klass?.split(/[#/]/).pop()
      return {
        code: 'wrong-object-type',
        title: klass !== undefined
          ? `${name} must be a ${klass}`
          : `${name} is not the expected kind of object`,
        ...(facts.description !== undefined ? { hint: facts.description } : {}),
      }
    }

    case 'MinInclusiveConstraintComponent':
      return { code: 'out-of-range', title: `${name} must be at least ${facts.minInclusive}${quoted(value)}` }
    case 'MaxInclusiveConstraintComponent':
      return { code: 'out-of-range', title: `${name} must be at most ${facts.maxInclusive}${quoted(value)}` }
    case 'MinExclusiveConstraintComponent':
      return { code: 'out-of-range', title: `${name} must be more than ${facts.minExclusive}${quoted(value)}` }
    case 'MaxExclusiveConstraintComponent':
      return { code: 'out-of-range', title: `${name} must be less than ${facts.maxExclusive}${quoted(value)}` }

    case 'NotConstraintComponent':
      // Only the hand-maintained rules shapes use this, and they explain
      // themselves better than a generic sentence could.
      return {
        code: 'rule-violation',
        title: facts.message ?? `${name} breaks a conditional rule of this standard`,
      }

    default:
      return {
        code: 'other',
        title: facts.message ?? `${name} does not satisfy ${constraint.replace(/ConstraintComponent$/, '')}`,
        ...(facts.description !== undefined ? { hint: facts.description } : {}),
      }
  }
}
