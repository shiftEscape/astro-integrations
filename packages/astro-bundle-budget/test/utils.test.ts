import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseSize, formatSize, formatDelta, matchGlob, getAssetType } from '../src/utils.js'

// ---------------------------------------------------------------------------
// parseSize
// ---------------------------------------------------------------------------

describe('parseSize', () => {
  it('returns plain numbers as-is', () => {
    assert.equal(parseSize(1000), 1000)
    assert.equal(parseSize(0), 0)
  })

  it('parses byte strings', () => {
    assert.equal(parseSize('500'), 500)
    assert.equal(parseSize('500 B'), 500)
    assert.equal(parseSize('500b'), 500)
  })

  it('parses kB (SI — 1000 bytes)', () => {
    assert.equal(parseSize('1 kB'), 1_000)
    assert.equal(parseSize('100 kB'), 100_000)
    assert.equal(parseSize('1.5 kB'), 1_500)
    assert.equal(parseSize('100KB'), 100_000)
    assert.equal(parseSize('100kb'), 100_000)
  })

  it('parses KiB (binary — 1024 bytes)', () => {
    assert.equal(parseSize('1 KiB'), 1_024)
    assert.equal(parseSize('100kib'), 102_400)
  })

  it('parses MB', () => {
    assert.equal(parseSize('1 MB'), 1_000_000)
    assert.equal(parseSize('1.5 MB'), 1_500_000)
  })

  it('parses MiB', () => {
    assert.equal(parseSize('1 MiB'), 1_048_576)
  })

  it('throws on unknown unit', () => {
    assert.throws(() => parseSize('100 TB'), /Unknown size unit/)
  })

  it('throws on unparseable string', () => {
    assert.throws(() => parseSize('not a size'), /Cannot parse/)
  })
})

// ---------------------------------------------------------------------------
// formatSize
// ---------------------------------------------------------------------------

describe('formatSize', () => {
  it('formats bytes under 1kB', () => {
    assert.equal(formatSize(0), '0 B')
    assert.equal(formatSize(999), '999 B')
  })

  it('formats kB range', () => {
    assert.equal(formatSize(1_000), '1.0 kB')
    assert.equal(formatSize(42_300), '42.3 kB')
    assert.equal(formatSize(999_900), '999.9 kB')
  })

  it('formats MB range', () => {
    assert.equal(formatSize(1_000_000), '1.00 MB')
    assert.equal(formatSize(1_500_000), '1.50 MB')
  })
})

// ---------------------------------------------------------------------------
// formatDelta
// ---------------------------------------------------------------------------

describe('formatDelta', () => {
  it('prefixes positive values with +', () => {
    assert.equal(formatDelta(15), '+15%')
    assert.equal(formatDelta(0), '+0%')
  })

  it('keeps negative sign', () => {
    assert.equal(formatDelta(-10), '-10%')
  })

  it('rounds to nearest integer', () => {
    assert.equal(formatDelta(14.7), '+15%')
    assert.equal(formatDelta(14.3), '+14%')
  })
})

// ---------------------------------------------------------------------------
// matchGlob
// ---------------------------------------------------------------------------

describe('matchGlob', () => {
  it('matches exact paths', () => {
    assert.ok(matchGlob('assets/index.js', 'assets/index.js'))
    assert.ok(!matchGlob('assets/index.js', 'assets/other.js'))
  })

  it('matches * within a segment', () => {
    assert.ok(matchGlob('assets/*.js', 'assets/index.js'))
    assert.ok(matchGlob('assets/*.js', 'assets/vendor-abc123.js'))
    assert.ok(!matchGlob('assets/*.js', 'assets/deep/index.js'))
  })

  it('matches ** across segments', () => {
    assert.ok(matchGlob('**/*.js', 'assets/index.js'))
    assert.ok(matchGlob('**/*.js', 'assets/deep/nested/chunk.js'))
    assert.ok(!matchGlob('**/*.js', 'assets/style.css'))
  })

  it('matches **/ prefix (zero or more dirs)', () => {
    assert.ok(matchGlob('**/vendor-*.js', 'assets/vendor-abc.js'))
    assert.ok(matchGlob('**/vendor-*.js', 'vendor-abc.js'))
  })

  it('handles Windows-style backslashes in filePath', () => {
    assert.ok(matchGlob('assets/*.js', 'assets\\index.js'))
  })

  it('matches specific prefixes like vendor chunks', () => {
    assert.ok(matchGlob('assets/vendor-*.js', 'assets/vendor-CHmL3xRz.js'))
    assert.ok(!matchGlob('assets/vendor-*.js', 'assets/index-BxK92mPq.js'))
  })
})

// ---------------------------------------------------------------------------
// getAssetType
// ---------------------------------------------------------------------------

describe('getAssetType', () => {
  it('identifies JS files', () => {
    assert.equal(getAssetType('assets/index.js'), 'js')
    assert.equal(getAssetType('assets/chunk.mjs'), 'js')
    assert.equal(getAssetType('assets/server.cjs'), 'js')
  })

  it('identifies CSS files', () => {
    assert.equal(getAssetType('assets/style.css'), 'css')
    assert.equal(getAssetType('styles/main.css'), 'css')
  })

  it('returns other for images, fonts, etc.', () => {
    assert.equal(getAssetType('assets/logo.png'), 'other')
    assert.equal(getAssetType('fonts/inter.woff2'), 'other')
    assert.equal(getAssetType('assets/data.json'), 'other')
  })

  it('is case-insensitive', () => {
    assert.equal(getAssetType('assets/STYLE.CSS'), 'css')
    assert.equal(getAssetType('assets/BUNDLE.JS'), 'js')
  })
})
