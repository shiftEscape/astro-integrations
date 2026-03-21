import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative, extname } from 'node:path'
import type { AssetInfo, PageAssets } from './types.js'
import { getAssetType, measureSize } from './utils.js'

// ---------------------------------------------------------------------------
// Walk the output directory and collect all JS/CSS assets
// ---------------------------------------------------------------------------

/**
 * Recursively collect all files under a directory, returning paths
 * relative to that directory.
 */
async function walk(dir: string, base = dir): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await walk(full, base)))
    } else {
      files.push(relative(base, full))
    }
  }

  return files
}

/**
 * Collect all JS and CSS assets from the build output directory.
 * Returns an AssetInfo for each, with sizes measured.
 */
export async function collectAssets(outDir: string): Promise<AssetInfo[]> {
  const allFiles = await walk(outDir)
  const assets: AssetInfo[] = []

  for (const relativePath of allFiles) {
    const type = getAssetType(relativePath)
    if (type === 'other') continue

    const absolutePath = join(outDir, relativePath)
    const sizeBytes = (await stat(absolutePath)).size

    assets.push({
      relativePath: relativePath.replace(/\\/g, '/'),
      absolutePath,
      type,
      sizeBytes,
    })
  }

  return assets
}

// ---------------------------------------------------------------------------
// Parse HTML files to map which assets each page references
// ---------------------------------------------------------------------------

/** Regex-based extraction of src/href attributes — no DOM dependency. */
function extractAssetRefs(html: string): { js: string[]; css: string[] } {
  const js: string[] = []
  const css: string[] = []

  // <script src="..."> — covers type=module too
  const scriptRe = /<script[^>]+src=["']([^"']+)["'][^>]*>/gi
  let m: RegExpExecArray | null
  while ((m = scriptRe.exec(html)) !== null) {
    const src = m[1]
    if (src && !src.startsWith('http') && !src.startsWith('//')) {
      js.push(src)
    }
  }

  // <link rel="stylesheet" href="...">
  const linkRe = /<link[^>]+href=["']([^"']+)["'][^>]*>/gi
  while ((m = linkRe.exec(html)) !== null) {
    const href = m[1]
    const isStylesheet =
      /rel=["']stylesheet["']/i.test(m[0]) ||
      href.endsWith('.css')
    if (isStylesheet && !href.startsWith('http') && !href.startsWith('//')) {
      css.push(href)
    }
  }

  return { js, css }
}

/**
 * Given a list of asset hrefs from HTML and the full asset map,
 * resolve them to AssetInfo objects.
 */
function resolveRefs(hrefs: string[], assets: AssetInfo[]): AssetInfo[] {
  return hrefs
    .map((href) => {
      // Strip leading slash and query strings
      const clean = href.replace(/^\//, '').split('?')[0].split('#')[0]
      return assets.find(
        (a) => a.relativePath === clean || a.relativePath.endsWith(clean),
      )
    })
    .filter((a): a is AssetInfo => a !== undefined)
}

/**
 * Walk every .html file in outDir and build a per-page asset map.
 */
export async function collectPages(
  outDir: string,
  assets: AssetInfo[],
): Promise<PageAssets[]> {
  const allFiles = await walk(outDir)
  const htmlFiles = allFiles.filter((f) => f.endsWith('.html'))

  const pages: PageAssets[] = []

  for (const relHtml of htmlFiles) {
    const htmlPath = join(outDir, relHtml)
    const html = await readFile(htmlPath, 'utf-8')
    const refs = extractAssetRefs(html)

    // Derive a clean route from the HTML file path
    let route = '/' + relHtml.replace(/\\/g, '/')
    if (route.endsWith('/index.html')) {
      route = route.slice(0, -'index.html'.length)
    } else if (route.endsWith('.html')) {
      route = route.slice(0, -'.html'.length)
    }

    pages.push({
      route,
      htmlPath,
      js: resolveRefs(refs.js, assets),
      css: resolveRefs(refs.css, assets),
    })
  }

  // Sort by route for deterministic output
  pages.sort((a, b) => a.route.localeCompare(b.route))

  return pages
}
