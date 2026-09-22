import { describe, expect, test } from 'vitest'
import { describeConstraint, suggest, friendlyDatatype } from '../../src/report/messages.js'

const XSD = 'http://www.w3.org/2001/XMLSchema#'

describe('describeConstraint', () => {
  test('a missing required field says what to add, using the shape description', () => {
    const out = describeConstraint({
      component: 'MinCountConstraintComponent',
      term: 'postcode',
      facts: { minCount: 1, description: 'UK postcode in standard format (e.g. AB1 2CD).' },
      value: undefined,
    })
    expect(out.code).toBe('required-field-missing')
    expect(out.title).toContain('postcode')
    expect(out.hint).toContain('UK postcode')
  })

  test('a bad pattern explains the format and gives an example', () => {
    const out = describeConstraint({
      component: 'PatternConstraintComponent',
      term: 'postcode',
      facts: { pattern: '^[A-Z]{1,2}[0-9][0-9A-Z]? ?[0-9][A-Z]{2}$' },
      value: 'NOT A POSTCODE',
    })
    expect(out.code).toBe('bad-format')
    expect(out.hint).toContain('AB1 2CD')
    expect(out.title).toContain('NOT A POSTCODE')
    // The regex belongs in the technical layer, never the sentence.
    expect(out.title).not.toContain('^[A-Z]')
    expect(out.hint).not.toContain('^[A-Z]')
  })

  test('an out-of-vocabulary value lists the tokens, not the IRIs', () => {
    const out = describeConstraint({
      component: 'InConstraintComponent',
      term: 'genderCode',
      facts: { in: ['https://ontology.socialcaredata.io/gender-code#Male'] },
      value: '7',
      allowed: ['1', '2', '9', 'X'],
    })
    expect(out.code).toBe('value-not-allowed')
    expect(out.hint).toBe('Allowed values: 1, 2, 9, X.')
    expect(JSON.stringify(out)).not.toContain('ontology.socialcaredata.io')
  })

  test('too many values names the limit', () => {
    const out = describeConstraint({
      component: 'MaxCountConstraintComponent', term: 'name', facts: { maxCount: 1 }, value: undefined,
    })
    expect(out.code).toBe('too-many-values')
    expect(out.title).toContain('only appear once')
  })

  test('a wrong datatype is described in words', () => {
    const out = describeConstraint({
      component: 'DatatypeConstraintComponent',
      term: 'siblingCount',
      facts: { datatype: `${XSD}integer` },
      value: 'two',
    })
    expect(out.code).toBe('wrong-type')
    expect(out.title).toContain('a whole number')
  })

  test('an unknown field offers a suggestion', () => {
    const out = describeConstraint({
      component: 'ClosedConstraintComponent',
      term: 'postCode',
      facts: {},
      value: undefined,
      didYouMean: 'postcode',
    })
    expect(out.code).toBe('unknown-field')
    expect(out.hint).toContain('postcode')
  })

  test('a rules shape keeps its own wording', () => {
    const out = describeConstraint({
      component: 'NotConstraintComponent',
      term: undefined,
      facts: { message: 'When culturalNeeds is cln:Other, culturalNeedsOther must be provided.' },
      value: undefined,
    })
    expect(out.code).toBe('rule-violation')
    expect(out.title).toContain('culturalNeedsOther')
  })

  test('bounds are reported with the limit and the value', () => {
    const out = describeConstraint({
      component: 'MinInclusiveConstraintComponent',
      term: 'otherWeeklyCost', facts: { minInclusive: '0' }, value: '-50',
    })
    expect(out.code).toBe('out-of-range')
    expect(out.title).toContain('at least 0')
    expect(out.title).toContain('-50')
  })

  test('an unrecognised component degrades without crashing', () => {
    const out = describeConstraint({
      component: 'SomeFutureConstraintComponent', term: 'x', facts: {}, value: undefined,
    })
    expect(out.code).toBe('other')
    expect(out.title).toContain('SomeFuture')
  })
})

describe('suggest', () => {
  test('finds a near miss', () => {
    expect(suggest('postCode', ['postcode', 'city', 'line1'])).toBe('postcode')
  })
  test('declines when nothing is close', () => {
    expect(suggest('zzzzzzzz', ['postcode', 'city'])).toBeUndefined()
  })
})

describe('friendlyDatatype', () => {
  test('knows the common XSD types', () => {
    expect(friendlyDatatype(`${XSD}boolean`)).toBe('true or false')
    expect(friendlyDatatype(`${XSD}date`)).toContain('date')
  })
})
