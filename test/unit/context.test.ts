import { describe, expect, test } from 'vitest'
import { ContextIndex } from '../../src/context.js'

const ctx = new ContextIndex({
  p: 'https://ontology.socialcaredata.io/',
  nuc: 'https://ontology.socialcaredata.io/name-use-code#',
  auc: 'https://ontology.socialcaredata.io/address-use-code#',
  postcode: 'p:postcode',
  Name: {
    '@id': 'p:Name',
    '@context': {
      use: {
        '@id': 'p:use',
        '@type': '@vocab',
        '@context': { usual: 'nuc:Usual', official: 'nuc:Official' },
      },
    },
  },
  Address: {
    '@id': 'p:Address',
    '@context': {
      use: {
        '@id': 'p:use',
        '@type': '@vocab',
        '@context': { home: 'auc:Home', work: 'auc:Work' },
      },
    },
  },
})

describe('ContextIndex', () => {
  test('expands compact IRIs through prefixes', () => {
    expect(ctx.expand('p:postcode')).toBe('https://ontology.socialcaredata.io/postcode')
    expect(ctx.expand('nuc:Official')).toBe('https://ontology.socialcaredata.io/name-use-code#Official')
  })

  test('maps a property IRI back to its term', () => {
    expect(ctx.termFor('https://ontology.socialcaredata.io/postcode')).toBe('postcode')
  })

  test('resolves type-scoped terms within their own scope', () => {
    const nameScope = ctx.expand('Name')
    expect(ctx.termFor('https://ontology.socialcaredata.io/use', nameScope)).toBe('use')
  })

  test('inverts a @vocab term map so enum IRIs read as tokens', () => {
    const nameScope = ctx.expand('Name')
    expect(ctx.tokenFor(
      'https://ontology.socialcaredata.io/name-use-code#Official',
      'https://ontology.socialcaredata.io/use',
      nameScope,
    )).toBe('official')
  })

  test('keeps two type scopes apart', () => {
    const addressScope = ctx.expand('Address')
    const tokens = ctx.tokensFor('https://ontology.socialcaredata.io/use', addressScope)
    expect([...(tokens?.values() ?? [])]).toEqual(['home', 'work'])
  })

  test('compacts an IRI using the longest matching prefix', () => {
    expect(ctx.compact('https://ontology.socialcaredata.io/name-use-code#Usual')).toBe('nuc:Usual')
  })
})
