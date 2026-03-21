import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  AssetInfo,
  BudgetReport,
  BudgetViolation,
  PageAssets,
} from './types.js'

/**
 * Serialise the full audit result to a JSON file inside outDir.
 */
export async function writeReport({
  outDir,
  reportPath,
  assets,
  pages,
  violations,
}: {
  outDir: string
  reportPath: string
  assets: AssetInfo[]
  pages: PageAssets[]
  violations: BudgetViolation[]
}): Promise<string> {
  const jsAssets = assets.filter((a) => a.type === 'js')
  const cssAssets = assets.filter((a) => a.type === 'css')

  const report: BudgetReport = {
    generatedAt: new Date().toISOString(),
    totalAssets: assets.length,
    totalJsBytes: jsAssets.reduce((s, a) => s + a.sizeBytes, 0),
    totalCssBytes: cssAssets.reduce((s, a) => s + a.sizeBytes, 0),
    assets: assets.map((a) => ({
      relativePath: a.relativePath,
      absolutePath: a.absolutePath,
      type: a.type,
      sizeBytes: a.sizeBytes,
    })),
    pages: pages.map((p) => ({
      route: p.route,
      htmlPath: p.htmlPath,
      js: p.js,
      css: p.css,
    })),
    violations,
    passed: violations.filter((v) => v.severity === 'error').length === 0,
  }

  const dest = join(outDir, reportPath)
  await writeFile(dest, JSON.stringify(report, null, 2), 'utf-8')
  return dest
}
