import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { writeFile, mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { checkFileBudgets, checkPageBudgets } from '../src/check.js'
import type { AssetInfo, PageAssets } from '../src/types.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string

// Create real temp files so measureSize() can read them
async function mkAsset(
  name: string,
  sizeBytes: number,
  type: 'js' | 'css' = 'js',
): Promise<AssetInfo> {
  const relativePath = `assets/${name}`
  const absolutePath = join(tmpDir, relativePath)
  await mkdir(join(tmpDir, 'assets'), { recursive: true })
  // Write a buffer of the target size (all zeros — compresses well, fine for tests)
  await writeFile(absolutePath, Buffer.alloc(sizeBytes, 0x61)) // 'a' bytes
  return { relativePath, absolutePath, type, sizeBytes }
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

before(async () => {
  tmpDir = join(tmpdir(), `astro-bundle-budget-test-${Date.now()}`)
  await mkdir(tmpDir, { recursive: true })
})

// ---------------------------------------------------------------------------
// checkFileBudgets
// ---------------------------------------------------------------------------

describe('checkFileBudgets', () => {
  it('returns no violations when no rules are configured', async () => {
    const asset = await mkAsset('huge.js', 999_999)
    const violations = await checkFileBudgets([asset], [])
    assert.equal(violations.length, 0)
  })

  it('returns no violations when all assets are under budget', async () => {
    const asset = await mkAsset('small.js', 10_000)
    const violations = await checkFileBudgets([asset], [
      { path: '**/*.js', budget: '50 kB' },
    ])
    assert.equal(violations.length, 0)
  })

  it('returns a violation when an asset exceeds budget', async () => {
    const asset = await mkAsset('big.js', 60_000)
    const violations = await checkFileBudgets([asset], [
      { path: '**/*.js', budget: '50 kB' },
    ])
    assert.equal(violations.length, 1)
    assert.equal(violations[0].subject, 'assets/big.js')
    assert.equal(violations[0].severity, 'error')
    assert.ok(violations[0].actualBytes > 50_000)
    assert.ok(violations[0].overByPercent > 0)
  })

  it('first matching rule wins', async () => {
    // vendor-specific rule (200 kB) should take precedence over generic (50 kB)
    const asset = await mkAsset('vendor-abc.js', 100_000)
    const violations = await checkFileBudgets([asset], [
      { path: 'assets/vendor-*.js', budget: '200 kB' },
      { path: '**/*.js',            budget: '50 kB' },
    ])
    // Under the vendor rule (100 kB < 200 kB) — should pass
    assert.equal(violations.length, 0)
  })

  it('assets not matching any rule are skipped', async () => {
    const asset = await mkAsset('app.css', 999_999, 'css')
    const violations = await checkFileBudgets([asset], [
      { path: '**/*.js', budget: '1 B' }, // JS-only rule
    ])
    assert.equal(violations.length, 0)
  })

  it('reports overByPercent correctly', async () => {
    const asset = await mkAsset('over.js', 150_000) // 150 kB vs 100 kB budget → 50% over
    const violations = await checkFileBudgets([asset], [
      { path: '**/*.js', budget: '100 kB' },
    ])
    assert.equal(violations.length, 1)
    assert.ok(
      violations[0].overByPercent >= 49 && violations[0].overByPercent <= 51,
      `Expected ~50% over, got ${violations[0].overByPercent}%`,
    )
  })

  it('handles multiple assets with multiple violations', async () => {
    const a = await mkAsset('page1.js', 200_000)
    const b = await mkAsset('page2.js', 300_000)
    const c = await mkAsset('tiny.js', 1_000)
    const violations = await checkFileBudgets([a, b, c], [
      { path: '**/*.js', budget: '100 kB' },
    ])
    assert.equal(violations.length, 2)
  })
})

// ---------------------------------------------------------------------------
// checkPageBudgets
// ---------------------------------------------------------------------------

describe('checkPageBudgets', () => {
  async function mkPage(
    route: string,
    jsSizes: number[],
    cssSizes: number[],
  ): Promise<PageAssets> {
    const js = await Promise.all(
      jsSizes.map((s, i) => mkAsset(`page-js-${route.replace(/\//g, '_')}-${i}.js`, s))
    )
    const css = await Promise.all(
      cssSizes.map((s, i) => mkAsset(`page-css-${route.replace(/\//g, '_')}-${i}.css`, s, 'css'))
    )
    return { route, htmlPath: `${tmpDir}${route}index.html`, js, css }
  }

  it('returns no violations when no rules', async () => {
    const page = await mkPage('/about/', [50_000], [5_000])
    const v = await checkPageBudgets([page], [])
    assert.equal(v.length, 0)
  })

  it('checks JS total per page', async () => {
    const page = await mkPage('/heavy/', [80_000, 60_000], [])
    // Total JS: 140 kB vs 100 kB budget
    const v = await checkPageBudgets([page], [{ type: 'js', budget: '100 kB' }])
    assert.equal(v.length, 1)
    assert.equal(v[0].subject, '/heavy/')
    assert.ok(v[0].actualBytes > 100_000)
  })

  it('checks CSS total per page', async () => {
    const page = await mkPage('/styled/', [], [30_000, 20_000])
    // Total CSS: 50 kB vs 20 kB budget
    const v = await checkPageBudgets([page], [{ type: 'css', budget: '20 kB' }])
    assert.equal(v.length, 1)
    assert.ok(v[0].actualBytes > 20_000)
  })

  it('checks combined total per page', async () => {
    const page = await mkPage('/combo/', [80_000], [80_000])
    // Total: 160 kB vs 100 kB budget
    const v = await checkPageBudgets([page], [{ type: 'total', budget: '100 kB' }])
    assert.equal(v.length, 1)
  })

  it('passes when total is exactly at the limit', async () => {
    const page = await mkPage('/exact/', [100_000], [])
    const v = await checkPageBudgets([page], [{ type: 'js', budget: 100_000 }])
    assert.equal(v.length, 0)
  })

  it('checks every page against every rule', async () => {
    const p1 = await mkPage('/page1/', [200_000], [])
    const p2 = await mkPage('/page2/', [50_000], [])
    const v = await checkPageBudgets([p1, p2], [{ type: 'js', budget: '100 kB' }])
    // Only /page1/ violates
    assert.equal(v.length, 1)
    assert.equal(v[0].subject, '/page1/')
  })
})
