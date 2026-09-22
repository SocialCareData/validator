/*
 * SHACL constraint components, rendered as sentences.
 *
 * Every entry answers three questions a user actually has: what is wrong,
 * where, and what would be right instead. The `expected` payload is structured
 * rather than baked into the string so the web UI can show permitted values as
 * pills and the JSON output stays machine-readable.
 */

import type { Expectation, IssueCode } from './types.js'
import type { ShapeFacts } from './shape-facts.js'
import { describePattern, exampleFromDescription } from './patterns.js'

export interface MessageInput {
  /** Component name with the `sh:` prefix stripped, e.g. `MinCountConstraintComponent`. */
  component: string
  /** Field name as the user would write it, already resolved from the context. */
  term: string | undefined
  facts: ShapeFacts
  /** The offending value, humanised (enum IRIs already turned into tokens). */
  value: string | undefined
  /** Permitted values as tokens, for `sh:in`. */
  allowed?: string[]
  allowedIris?: string[]
  /** Friendly name for a `sh:datatype` / `sh:class`. */
  friendlyType?: string
  /** Suggestion for an unrecognised field name. */
  didYouMean?: string
}

export interface MessageOutput {
  code: IssueCode
  title: string
  hint?: string
  expected?: Expectation
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

function quoted (value: string | undefined): string {
  return value === undefined ? '' : ` - you gave \`${value}\``
}

function field (term: string | undefined): string {
  return term !== undefined ? `\`${term}\`` : 'this field'
}

export function describeConstraint (input: MessageInput): MessageOutput {
  const { component, term, facts, value } = input
  const name = field(term)

  // A shape that carries its own message said it better than we can. The
  // generated shapes declare none; the hand-maintained rules shapes do.
  const declared = facts.message

  switch (component) {
    case 'MinCountConstraintComponent': {
      const min = facts.minCount ?? 1
      if (min <= 1) {
        return {
          code: 'required-field-missing',
          title: `Missing required field ${name}`,
          hint: facts.description !== undefined
            ? `Add ${name}: ${facts.description}`
            : `Add ${name} to this record.`,
          expected: { kind: 'count', min },
        }
      }
      return {
        code: 'too-few-values',
        title: `${name} needs at least ${min} values`,
        expected: { kind: 'count', min },
      }
    }

    case 'MaxCountConstraintComponent': {
      const max = facts.maxCount ?? 1
      return {
        code: 'too-many-values',
        title: max === 1
          ? `${name} may only appear once`
          : `${name} may appear at most ${max} times`,
        hint: max === 1 ? `Keep a single ${term ?? 'value'} and remove the rest.` : undefined,
        expected: { kind: 'count', max },
      }
    }

    case 'InConstraintComponent': {
      const allowed = input.allowed ?? []
      const shown = allowed.length > 6
        ? `${allowed.slice(0, 6).join(', ')} and ${allowed.length - 6} more`
        : allowed.join(', ')
      return {
        code: 'value-not-allowed',
        title: `${name} must be one of the permitted values${quoted(value)}`,
        hint: allowed.length > 0 ? `Allowed values: ${shown}.` : undefined,
        expected: {
          kind: 'one-of',
          values: allowed,
          ...(input.allowedIris !== undefined ? { iris: input.allowedIris } : {}),
        },
      }
    }

    case 'PatternConstraintComponent': {
      const described = facts.pattern !== undefined ? describePattern(facts.pattern) : undefined
      const example = described?.example ?? exampleFromDescription(facts.description)
      const what = described?.description ?? facts.description ?? 'the expected format'
      return {
        code: 'bad-format',
        title: `${name} is not in the expected format${quoted(value)}`,
        hint: example !== undefined
          ? `It should be ${what}, for example \`${example}\`.`
          : `It should be ${what}.`,
        expected: {
          kind: 'format',
          ...(described?.description !== undefined ? { description: described.description } : {}),
          ...(example !== undefined ? { example } : {}),
          ...(facts.pattern !== undefined ? { pattern: facts.pattern } : {}),
        },
      }
    }

    case 'DatatypeConstraintComponent': {
      const friendly = friendlyDatatype(facts.datatype)
      return {
        code: 'wrong-type',
        title: `${name} must be ${friendly}${quoted(value)}`,
        expected: {
          kind: 'datatype',
          friendly,
          datatype: facts.datatype ?? '',
        },
      }
    }

    case 'NodeKindConstraintComponent': {
      const kind = facts.nodeKind?.split('#').pop()
      const wantsLiteral = kind === 'Literal'
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
      const klass = input.friendlyType ?? facts.klass?.split(/[#/]/).pop()
      return {
        code: 'wrong-object-type',
        title: klass !== undefined
          ? `${name} must be a ${klass}`
          : `${name} is not the expected kind of object`,
        hint: facts.description,
        expected: klass !== undefined
          ? { kind: 'class', term: klass, iri: facts.klass ?? '' }
          : undefined,
      }
    }

    case 'MinInclusiveConstraintComponent':
      return {
        code: 'out-of-range',
        title: `${name} must be at least ${facts.minInclusive}${quoted(value)}`,
        expected: { kind: 'range', min: Number(facts.minInclusive) },
      }

    case 'MaxInclusiveConstraintComponent':
      return {
        code: 'out-of-range',
        title: `${name} must be at most ${facts.maxInclusive}${quoted(value)}`,
        expected: { kind: 'range', max: Number(facts.maxInclusive) },
      }

    case 'MinExclusiveConstraintComponent':
      return {
        code: 'out-of-range',
        title: `${name} must be more than ${facts.minExclusive}${quoted(value)}`,
        expected: { kind: 'range', min: Number(facts.minExclusive) },
      }

    case 'MaxExclusiveConstraintComponent':
      return {
        code: 'out-of-range',
        title: `${name} must be less than ${facts.maxExclusive}${quoted(value)}`,
        expected: { kind: 'range', max: Number(facts.maxExclusive) },
      }

    case 'ClosedConstraintComponent':
      return {
        code: 'unknown-field',
        title: `${name} is not a field in this standard`,
        hint: input.didYouMean !== undefined
          ? `Did you mean \`${input.didYouMean}\`?`
          : 'Check the spelling, or remove it if it is not part of the standard.',
      }

    case 'NotConstraintComponent':
      // The hand-maintained rules shapes are the only place this appears, and
      // they carry a written message explaining the conditional rule.
      return {
        code: 'rule-violation',
        title: declared ?? `${name} breaks a conditional rule of this standard`,
      }

    default:
      return {
        code: 'other',
        title: declared ?? `${name} does not satisfy ${component.replace(/ConstraintComponent$/, '')}`,
        hint: facts.description,
      }
  }
}

/** Levenshtein-based suggestion for a misspelled field name. */
export function suggest (candidate: string, options: string[]): string | undefined {
  let best: string | undefined
  let bestScore = Infinity
  const limit = Math.max(2, Math.floor(candidate.length / 3))
  for (const option of options) {
    const score = distance(candidate.toLowerCase(), option.toLowerCase())
    if (score < bestScore) { bestScore = score; best = option }
  }
  return bestScore <= limit ? best : undefined
}

function distance (a: string, b: string): number {
  const rows = a.length + 1
  const cols = b.length + 1
  let prev = new Array<number>(cols)
  let curr = new Array<number>(cols)
  for (let j = 0; j < cols; j++) prev[j] = j
  for (let i = 1; i < rows; i++) {
    curr[0] = i
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost)
    }
    const swap = prev; prev = curr; curr = swap
  }
  return prev[cols - 1]!
}
