import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, extname, basename } from 'node:path'
import type { KeyCoverage, LocaleCoverage, KeyStatus } from './types.js'

// ---------------------------------------------------------------------------
// Flatten a nested object into dot-notation keys
// { nav: { home: 'Home' } } → { 'nav.home': 'Home' }
// ---------------------------------------------------------------------------
export function flattenKeys(
  obj: Record<string, unknown>,
  prefix = ''
): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(result, flattenKeys(v as Record<string, unknown>, key))
    } else {
      result[key] = String(v ?? '')
    }
  }
  return result
}

// ---------------------------------------------------------------------------
// Parse a single locale file (JSON or YAML)
// ---------------------------------------------------------------------------
export function parseLocaleFile(
  filePath: string,
  format: 'json' | 'yaml'
): Record<string, string> {
  try {
    const raw = readFileSync(filePath, 'utf-8')
    if (format === 'json') {
      return flattenKeys(JSON.parse(raw))
    }
    // YAML — minimal parser for simple key: value structures
    // For real projects, this handles 80% of cases without a dep
    return flattenKeys(parseYamlSimple(raw))
  } catch {
    return {}
  }
}

// ---------------------------------------------------------------------------
// Very simple YAML parser — handles flat and one-level-nested key: value
// Sufficient for i18n files, avoids pulling in js-yaml as a dependency
// ---------------------------------------------------------------------------
export function parseYamlSimple(raw: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  let currentKey = ''

  for (const line of raw.split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue

    // Detect indented (nested) line
    const isNested = line.startsWith('  ') || line.startsWith('\t')

    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue

    const key = line.slice(isNested ? line.search(/\S/) : 0, colonIdx).trim()
    const value = line.slice(colonIdx + 1).trim()

    if (!isNested) {
      currentKey = key
      if (value) {
        // Strip surrounding quotes
        result[key] = value.replace(/^["']|["']$/g, '')
      } else {
        result[key] = {}
      }
    } else if (currentKey) {
      if (typeof result[currentKey] !== 'object') result[currentKey] = {}
      ;(result[currentKey] as Record<string, string>)[key] =
        value.replace(/^["']|["']$/g, '')
    }
  }
  return result
}

// ---------------------------------------------------------------------------
// Scan a locales directory and return a map of locale → flat keys
// ---------------------------------------------------------------------------
export function scanLocalesDir(
  dir: string,
  format: 'json' | 'yaml'
): Map<string, Record<string, string>> {
  const result = new Map<string, Record<string, string>>()
  if (!existsSync(dir)) return result

  const ext = format === 'json' ? '.json' : '.yaml'
  const altExt = format === 'yaml' ? '.yml' : null

  try {
    const files = readdirSync(dir)
    for (const file of files) {
      const fileExt = extname(file)
      if (fileExt !== ext && fileExt !== altExt) continue
      const locale = basename(file, fileExt)
      const keys = parseLocaleFile(join(dir, file), format)
      result.set(locale, keys)
    }
  } catch {
    // directory unreadable — return empty
  }

  return result
}

// ---------------------------------------------------------------------------
// Compute coverage diff — reference locale vs all others
// ---------------------------------------------------------------------------
export function computeCoverage(
  localeMap: Map<string, Record<string, string>>,
  defaultLocale: string
): { keys: KeyCoverage[]; summary: LocaleCoverage[] } {
  const reference = localeMap.get(defaultLocale) ?? {}
  const referenceKeys = Object.keys(reference)
  const allLocales = [...localeMap.keys()].filter(l => l !== defaultLocale)

  const keys: KeyCoverage[] = referenceKeys.map(key => {
    const missingIn: string[] = []
    let status: KeyStatus = 'complete'

    for (const locale of allLocales) {
      const localeKeys = localeMap.get(locale) ?? {}
      if (!(key in localeKeys) || localeKeys[key] === '') {
        missingIn.push(locale)
        status = 'missing'
      }
    }

    // If not all missing but some are, mark as fallback for those
    if (status === 'missing' && missingIn.length < allLocales.length) {
      status = 'fallback'
    }

    return {
      key,
      status,
      missingIn,
      referenceValue: (reference[key] ?? '').slice(0, 60),
    }
  })

  // Keys that exist in non-reference locales but NOT in reference
  // These are orphaned keys — we add them as 'missing' from reference perspective
  for (const [locale, localeKeys] of localeMap) {
    if (locale === defaultLocale) continue
    for (const key of Object.keys(localeKeys)) {
      if (!reference[key]) {
        const existing = keys.find(k => k.key === key)
        if (!existing) {
          keys.push({
            key,
            status: 'missing',
            missingIn: [defaultLocale],
            referenceValue: '',
          })
        }
      }
    }
  }

  // Sort: missing first, then fallback, then complete
  keys.sort((a, b) => {
    const order = { missing: 0, fallback: 1, complete: 2 }
    return order[a.status] - order[b.status] || a.key.localeCompare(b.key)
  })

  const summary: LocaleCoverage[] = allLocales.map(locale => {
    const total = referenceKeys.length
    const missing = keys.filter(k => k.missingIn.includes(locale)).length
    const complete = total - missing
    const fallback = 0 // simplified — fallback = missing for per-locale view
    return {
      locale,
      total,
      complete,
      fallback,
      missing,
      percent: total > 0 ? Math.round((complete / total) * 100) : 100,
    }
  })

  return { keys, summary }
}

// ---------------------------------------------------------------------------
// Derive locale from a URL pathname using Astro's i18n config pattern
// e.g. /fr/about → 'fr', /about → defaultLocale
// ---------------------------------------------------------------------------
export function deriveLocaleFromUrl(
  pathname: string,
  locales: string[],
  defaultLocale: string
): string {
  const segments = pathname.split('/').filter(Boolean)
  const first = segments[0]?.toLowerCase()
  if (first && locales.map(l => l.toLowerCase()).includes(first)) {
    return locales.find(l => l.toLowerCase() === first) ?? defaultLocale
  }
  return defaultLocale
}

// ---------------------------------------------------------------------------
// Build locale-switched URL: replace or prepend the locale prefix
// ---------------------------------------------------------------------------
export function buildLocaleUrl(
  pathname: string,
  targetLocale: string,
  locales: string[],
  defaultLocale: string,
  prefixDefault: boolean
): string {
  const segments = pathname.split('/').filter(Boolean)
  const firstIsLocale =
    segments.length > 0 &&
    locales.map(l => l.toLowerCase()).includes(segments[0].toLowerCase())

  // Remove existing locale prefix
  const rest = firstIsLocale ? segments.slice(1) : segments

  // Add new locale prefix
  const addPrefix = targetLocale !== defaultLocale || prefixDefault
  const newSegments = addPrefix ? [targetLocale, ...rest] : rest

  return '/' + newSegments.join('/')
}
