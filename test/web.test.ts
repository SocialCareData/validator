/*
 * The page, driven in a real browser.
 *
 * The library is covered elsewhere; what this proves is the part unit tests
 * cannot - that the RDF stack survives bundling, that the worker starts, that
 * shapes fetch across origins from GitHub Pages, and that a person who pastes a
 * broken record sees the field name and the line.
 *
 * It drives the production build, not the dev server. The two differ in ways
 * that matter: the dev server never tree-shakes, so it once hid a build that
 * dropped the worker's `window` shim and hung on "Validating..." in production.
 */

import { describe, expect, test, beforeAll, afterAll } from 'vitest'
import { chromium, type Browser, type Page } from 'playwright'
import { build, preview, type PreviewServer } from 'vite'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

let server: PreviewServer
let outDir: string
let browser: Browser
let page: Page
let baseUrl: string
const consoleErrors: string[] = []

beforeAll(async () => {
  const configFile = join(root, 'web', 'vite.config.ts')
  // A scratch directory, so a test run never overwrites web/dist.
  outDir = mkdtempSync(join(tmpdir(), 'scd-validator-web-'))
  await build({ configFile, logLevel: 'warn', build: { outDir } })
  server = await preview({ configFile, build: { outDir }, preview: { port: 0 } })
  const address = server.httpServer.address()
  const port = typeof address === 'object' && address !== null ? address.port : 0
  baseUrl = `http://localhost:${port}${server.config.base}`

  // HEADED=1 opens a real window, and SLOWMO=250 slows it enough to watch.
  // Debugging a failure by reading a stack trace is much harder than looking.
  browser = await chromium.launch({
    headless: process.env['HEADED'] !== '1',
    slowMo: Number(process.env['SLOWMO'] ?? 0),
  })
  page = await browser.newPage()
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => { consoleErrors.push(error.message) })
  await page.goto(baseUrl, { waitUntil: 'networkidle' })
}, 180_000)

afterAll(async () => {
  await browser?.close()
  await server?.close()
  if (outDir !== undefined) rmSync(outDir, { recursive: true, force: true })
})

describe('the validator page', () => {
  test('lists every profile from the catalogue', async () => {
    const options = await page.$$eval('#profile option', (nodes) =>
      nodes.map((n) => (n as HTMLOptionElement).value))
    expect(options).toContain('person:subject-of-care')
    expect(options).toContain('placements')
    expect(options).toHaveLength(5)
  })

  test('reports a bad postcode with the field name and the line', async () => {
    const text = readFileSync(
      join(root, 'examples/person/subject-of-care/invalid-bad-postcode.jsonld'), 'utf8')

    await page.selectOption('#profile', 'person:subject-of-care')
    await page.fill('#input', text)
    await page.click('#validate')

    await page.waitForSelector('.issue.violation', { timeout: 120_000 })

    const title = await page.textContent('.issue.violation .issue-title')
    expect(title).toContain('postcode')
    expect(title).not.toContain('http')

    const meta = await page.textContent('.issue.violation .issue-meta')
    expect(meta).toContain('address[0].postcode')
    expect(meta).toContain('line 10')

    const verdict = await page.textContent('.verdict')
    expect(verdict).toContain('problem')
  })

  test('accepts a record that follows the standard', async () => {
    const text = readFileSync(
      join(root, 'examples/person/subject-of-care/valid-subject-of-care.jsonld'), 'utf8')
    await page.fill('#input', text)
    await page.click('#validate')
    await page.waitForSelector('.verdict.pass', { timeout: 120_000 })
    expect(await page.textContent('.verdict.pass')).toContain('follows the standard')
  })

  test('shows permitted values as pills for a controlled vocabulary', async () => {
    const text = readFileSync(
      join(root, 'examples/person/subject-of-care/invalid-bad-gender.jsonld'), 'utf8')
    await page.fill('#input', text)
    await page.click('#validate')
    await page.waitForSelector('.issue.violation .pill', { timeout: 120_000 })
    const pills = await page.$$eval('.pill', (nodes) => nodes.map((n) => n.textContent))
    expect(pills.length).toBeGreaterThan(1)
    for (const pill of pills) expect(pill).not.toContain('http')
  })

  test('explains malformed JSON instead of failing silently', async () => {
    await page.fill('#input', '{ "name": ')
    await page.click('#validate')
    await page.waitForSelector('.issue, .banner.error', { timeout: 120_000 })
    const body = await page.textContent('#results')
    expect(body?.toLowerCase()).toContain('json')
  })

  test('the browser logged no errors throughout', () => {
    expect(consoleErrors).toEqual([])
  })
})
