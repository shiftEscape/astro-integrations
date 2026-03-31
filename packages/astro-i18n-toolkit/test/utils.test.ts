import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  flattenKeys,
  parseLocaleFile,
  parseYamlSimple,
  scanLocalesDir,
  computeCoverage,
  deriveLocaleFromUrl,
  buildLocaleUrl,
} from '../src/utils.js'

describe('flattenKeys', () => {
  it('flattens nested objects to dot notation', () => {
    const input = { nav: { home: 'Home', about: 'About' }, hero: { title: 'Welcome' } }
    const result = flattenKeys(input)
    assert.equal(result['nav.home'], 'Home')
    assert.equal(result['nav.about'], 'About')
    assert.equal(result['hero.title'], 'Welcome')
  })

  it('handles flat objects unchanged', () => {
    const result = flattenKeys({ hello: 'world', bye: 'ciao' })
    assert.equal(result['hello'], 'world')
    assert.equal(result['bye'], 'ciao')
  })

  it('converts non-string values to strings', () => {
    const result = flattenKeys({ count: 42, active: true } as any)
    assert.equal(result['count'], '42')
    assert.equal(result['active'], 'true')
  })

  it('handles three levels of nesting', () => {
    const result = flattenKeys({ a: { b: { c: 'deep' } } })
    assert.equal(result['a.b.c'], 'deep')
  })
})

describe('parseYamlSimple', () => {
  it('parses simple key: value pairs', () => {
    const yaml = `title: Hello World\ndescription: A test`
    const result = parseYamlSimple(yaml)
    assert.equal(result['title'], 'Hello World')
    assert.equal(result['description'], 'A test')
  })

  it('ignores comment lines', () => {
    const yaml = `# This is a comment\ntitle: Hello`
    const result = parseYamlSimple(yaml)
    assert.ok(!('#' in result))
    assert.equal(result['title'], 'Hello')
  })

  it('strips surrounding quotes', () => {
    const yaml = `title: "Quoted Value"\nother: 'Single Quoted'`
    const result = parseYamlSimple(yaml)
    assert.equal(result['title'], 'Quoted Value')
    assert.equal(result['other'], 'Single Quoted')
  })

  it('parses nested keys', () => {
    const yaml = `nav:\n  home: Home\n  about: About`
    const result = parseYamlSimple(yaml)
    const nav = result['nav'] as Record<string, string>
    assert.equal(nav['home'], 'Home')
    assert.equal(nav['about'], 'About')
  })
})

describe('parseLocaleFile', () => {
  let tmpDir: string

  before(() => {
    tmpDir = join(tmpdir(), `i18n-test-${Date.now()}`)
    mkdirSync(tmpDir, { recursive: true })
    writeFileSync(join(tmpDir, 'en.json'), JSON.stringify({ nav: { home: 'Home' }, title: 'Welcome' }))
    writeFileSync(join(tmpDir, 'fr.yaml'), `nav:\n  home: Accueil\ntitle: Bienvenue`)
  })

  after(() => rmSync(tmpDir, { recursive: true, force: true }))

  it('parses JSON files correctly', () => {
    const result = parseLocaleFile(join(tmpDir, 'en.json'), 'json')
    assert.equal(result['nav.home'], 'Home')
    assert.equal(result['title'], 'Welcome')
  })

  it('parses YAML files correctly', () => {
    const result = parseLocaleFile(join(tmpDir, 'fr.yaml'), 'yaml')
    assert.equal(result['nav.home'], 'Accueil')
    assert.equal(result['title'], 'Bienvenue')
  })

  it('returns empty object for nonexistent file', () => {
    const result = parseLocaleFile(join(tmpDir, 'missing.json'), 'json')
    assert.deepEqual(result, {})
  })
})

describe('scanLocalesDir', () => {
  let tmpDir: string

  before(() => {
    tmpDir = join(tmpdir(), `i18n-scan-${Date.now()}`)
    mkdirSync(tmpDir, { recursive: true })
    writeFileSync(join(tmpDir, 'en.json'), JSON.stringify({ hello: 'Hello' }))
    writeFileSync(join(tmpDir, 'fr.json'), JSON.stringify({ hello: 'Bonjour' }))
    writeFileSync(join(tmpDir, 'notes.txt'), 'not a locale file')
  })

  after(() => rmSync(tmpDir, { recursive: true, force: true }))

  it('scans JSON locale files', () => {
    const result = scanLocalesDir(tmpDir, 'json')
    assert.ok(result.has('en'))
    assert.ok(result.has('fr'))
    assert.ok(!result.has('notes'))
  })

  it('returns empty map for nonexistent directory', () => {
    const result = scanLocalesDir('/nonexistent/path', 'json')
    assert.equal(result.size, 0)
  })

  it('populates flattened keys', () => {
    const result = scanLocalesDir(tmpDir, 'json')
    assert.equal(result.get('en')?.['hello'], 'Hello')
    assert.equal(result.get('fr')?.['hello'], 'Bonjour')
  })
})

describe('computeCoverage', () => {
  it('marks complete keys correctly', () => {
    const localeMap = new Map<string, Record<string, string>>([
      ['en', { 'nav.home': 'Home', title: 'Welcome' }],
      ['fr', { 'nav.home': 'Accueil', title: 'Bienvenue' }],
    ])
    const { keys } = computeCoverage(localeMap, 'en')
    keys.forEach(k => assert.equal(k.status, 'complete'))
  })

  it('marks missing keys correctly', () => {
    const localeMap = new Map<string, Record<string, string>>([
      ['en', { 'nav.home': 'Home', 'nav.about': 'About' }],
      ['fr', { 'nav.home': 'Accueil' }],
    ])
    const { keys } = computeCoverage(localeMap, 'en')
    const aboutKey = keys.find(k => k.key === 'nav.about')
    assert.ok(aboutKey)
    assert.equal(aboutKey.status, 'missing')
    assert.ok(aboutKey.missingIn.includes('fr'))
  })

  it('produces correct summary per locale', () => {
    const localeMap = new Map<string, Record<string, string>>([
      ['en', { a: '1', b: '2', c: '3', d: '4' }],
      ['fr', { a: '1', b: '2' }],
    ])
    const { summary } = computeCoverage(localeMap, 'en')
    const fr = summary.find(s => s.locale === 'fr')
    assert.ok(fr)
    assert.equal(fr.total, 4)
    assert.equal(fr.missing, 2)
    assert.equal(fr.percent, 50)
  })

  it('handles empty locale map gracefully', () => {
    const { keys, summary } = computeCoverage(new Map(), 'en')
    assert.equal(keys.length, 0)
    assert.equal(summary.length, 0)
  })

  it('sorts missing before complete', () => {
    const localeMap = new Map<string, Record<string, string>>([
      ['en', { a: '1', b: '2', c: '3' }],
      ['fr', { a: '1' }],
    ])
    const { keys } = computeCoverage(localeMap, 'en')
    assert.equal(keys[0].status, 'missing')
  })
})

describe('deriveLocaleFromUrl', () => {
  const locales = ['en', 'fr', 'de']

  it('extracts locale prefix from URL', () => {
    assert.equal(deriveLocaleFromUrl('/fr/about', locales, 'en'), 'fr')
    assert.equal(deriveLocaleFromUrl('/de/contact', locales, 'en'), 'de')
  })

  it('returns defaultLocale for unprefixed URLs', () => {
    assert.equal(deriveLocaleFromUrl('/about', locales, 'en'), 'en')
    assert.equal(deriveLocaleFromUrl('/', locales, 'en'), 'en')
  })

  it('is case-insensitive', () => {
    assert.equal(deriveLocaleFromUrl('/FR/about', locales, 'en'), 'fr')
  })
})

describe('buildLocaleUrl', () => {
  const locales = ['en', 'fr', 'de']

  it('adds locale prefix for non-default locale', () => {
    assert.equal(buildLocaleUrl('/about', 'fr', locales, 'en', false), '/fr/about')
  })

  it('removes old prefix and adds new one', () => {
    assert.equal(buildLocaleUrl('/fr/about', 'de', locales, 'en', false), '/de/about')
  })

  it('removes prefix for default locale when prefixDefault is false', () => {
    assert.equal(buildLocaleUrl('/fr/about', 'en', locales, 'en', false), '/about')
  })

  it('keeps prefix for default locale when prefixDefault is true', () => {
    assert.equal(buildLocaleUrl('/about', 'en', locales, 'en', true), '/en/about')
  })

  it('handles root path', () => {
    assert.equal(buildLocaleUrl('/', 'fr', locales, 'en', false), '/fr')
  })
})
