import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { writeFile, mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { collectAssets, collectPages } from '../src/collect.js'

// ---------------------------------------------------------------------------
// Build a fake Astro output directory
// ---------------------------------------------------------------------------

let outDir: string

const ASSETS = {
  'assets/index-BxK92mPq.js': 'console.log("main bundle");',
  'assets/vendor-CHmL3xRz.js': 'console.log("vendor bundle");',
  'assets/hoisted-DqW1Pz9a.js': 'console.log("hoisted");',
  'assets/index-EpW3Kz7b.css': 'body { margin: 0; }',
  'assets/about-GhJ5Lm2n.css': 'h1 { color: red; }',
}

const PAGES = {
  'index.html': `<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="/assets/index-EpW3Kz7b.css" />
</head>
<body>
  <script type="module" src="/assets/index-BxK92mPq.js"></script>
  <script type="module" src="/assets/vendor-CHmL3xRz.js"></script>
  <script src="/assets/hoisted-DqW1Pz9a.js"></script>
</body>
</html>`,

  'about/index.html': `<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="/assets/about-GhJ5Lm2n.css" />
</head>
<body>
  <script type="module" src="/assets/index-BxK92mPq.js"></script>
</body>
</html>`,

  'blog/post-one/index.html': `<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="/assets/index-EpW3Kz7b.css" />
</head>
<body>
  <script type="module" src="/assets/index-BxK92mPq.js"></script>
  <script type="module" src="/assets/vendor-CHmL3xRz.js"></script>
</body>
</html>`,
}

before(async () => {
  outDir = join(tmpdir(), `astro-bundle-budget-integration-${Date.now()}`)
  await mkdir(join(outDir, 'assets'), { recursive: true })
  await mkdir(join(outDir, 'about'), { recursive: true })
  await mkdir(join(outDir, 'blog/post-one'), { recursive: true })

  for (const [rel, content] of Object.entries(ASSETS)) {
    await writeFile(join(outDir, rel), content, 'utf-8')
  }
  for (const [rel, content] of Object.entries(PAGES)) {
    await writeFile(join(outDir, rel), content, 'utf-8')
  }
})

after(async () => {
  await rm(outDir, { recursive: true, force: true })
})

// ---------------------------------------------------------------------------
// collectAssets
// ---------------------------------------------------------------------------

describe('collectAssets', () => {
  it('collects all JS and CSS assets', async () => {
    const assets = await collectAssets(outDir)
    assert.equal(assets.length, Object.keys(ASSETS).length)
  })

  it('correctly identifies JS assets', async () => {
    const assets = await collectAssets(outDir)
    const jsAssets = assets.filter((a) => a.type === 'js')
    assert.equal(jsAssets.length, 3) // index, vendor, hoisted
  })

  it('correctly identifies CSS assets', async () => {
    const assets = await collectAssets(outDir)
    const cssAssets = assets.filter((a) => a.type === 'css')
    assert.equal(cssAssets.length, 2)
  })

  it('records non-zero sizes', async () => {
    const assets = await collectAssets(outDir)
    for (const a of assets) {
      assert.ok(a.sizeBytes > 0, `${a.relativePath} has zero size`)
    }
  })

  it('uses forward slashes in relativePath regardless of OS', async () => {
    const assets = await collectAssets(outDir)
    for (const a of assets) {
      assert.ok(!a.relativePath.includes('\\'), `backslash in ${a.relativePath}`)
    }
  })

  it('does not include HTML files', async () => {
    const assets = await collectAssets(outDir)
    for (const a of assets) {
      assert.ok(!a.relativePath.endsWith('.html'))
    }
  })
})

// ---------------------------------------------------------------------------
// collectPages
// ---------------------------------------------------------------------------

describe('collectPages', () => {
  it('collects one entry per HTML file', async () => {
    const assets = await collectAssets(outDir)
    const pages = await collectPages(outDir, assets)
    assert.equal(pages.length, Object.keys(PAGES).length)
  })

  it('produces clean route paths', async () => {
    const assets = await collectAssets(outDir)
    const pages = await collectPages(outDir, assets)
    const routes = pages.map((p) => p.route)
    assert.ok(routes.includes('/'), 'missing root route')
    assert.ok(routes.includes('/about/'), 'missing /about/ route')
    assert.ok(routes.includes('/blog/post-one/'), 'missing blog route')
  })

  it('correctly maps JS assets referenced by the home page', async () => {
    const assets = await collectAssets(outDir)
    const pages = await collectPages(outDir, assets)
    const home = pages.find((p) => p.route === '/')!
    assert.ok(home, 'home page not found')
    assert.equal(home.js.length, 3) // index, vendor, hoisted
  })

  it('correctly maps CSS assets referenced by the home page', async () => {
    const assets = await collectAssets(outDir)
    const pages = await collectPages(outDir, assets)
    const home = pages.find((p) => p.route === '/')!
    assert.equal(home.css.length, 1)
  })

  it('the about page only references 1 JS asset', async () => {
    const assets = await collectAssets(outDir)
    const pages = await collectPages(outDir, assets)
    const about = pages.find((p) => p.route === '/about/')!
    assert.equal(about.js.length, 1)
    assert.equal(about.js[0].relativePath, 'assets/index-BxK92mPq.js')
  })

  it('pages are sorted by route', async () => {
    const assets = await collectAssets(outDir)
    const pages = await collectPages(outDir, assets)
    const routes = pages.map((p) => p.route)
    const sorted = [...routes].sort()
    assert.deepEqual(routes, sorted)
  })
})
