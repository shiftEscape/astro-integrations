import type { AssetInfo, BudgetViolation, PageAssets } from './types.js'
import {
  bold,
  cyan,
  dim,
  formatSize,
  green,
  red,
  yellow,
} from './utils.js'

// ---------------------------------------------------------------------------
// Summary table: per-asset breakdown
// ---------------------------------------------------------------------------

const COL_PATH = 52
const COL_SIZE = 10
const COL_TYPE = 6

function truncate(str: string, max: number): string {
  if (str.length <= max) return str.padEnd(max)
  return '…' + str.slice(str.length - (max - 1))
}

/**
 * Print a compact per-asset table.
 */
export function printAssetTable(assets: AssetInfo[], verbose: boolean): void {
  const jsAssets = assets.filter((a) => a.type === 'js')
  const cssAssets = assets.filter((a) => a.type === 'css')

  const totalJs = jsAssets.reduce((s, a) => s + a.sizeBytes, 0)
  const totalCss = cssAssets.reduce((s, a) => s + a.sizeBytes, 0)

  // Header
  console.log(
    '\n' +
    dim(truncate('Asset', COL_PATH)) +
    dim('Type'.padStart(COL_TYPE + 1)) +
    dim(COL_SIZE > 0 ? 'Size'.padStart(COL_SIZE + 2) : ''),
  )
  console.log(dim('─'.repeat(COL_PATH + COL_TYPE + COL_SIZE + 4)))

  // Rows
  const sorted = [...assets].sort((a, b) => b.sizeBytes - a.sizeBytes)

  for (const asset of sorted) {
    const tooMany = !verbose && sorted.length > 20
    if (tooMany && sorted.indexOf(asset) >= 15) {
      if (sorted.indexOf(asset) === 15) {
        console.log(dim(`  … and ${sorted.length - 15} more (use verbose: true to see all)`))
      }
      break
    }

    const typeLabel =
      asset.type === 'js' ? cyan(' js') : yellow('css')
    const sizeFmt = formatSize(asset.sizeBytes).padStart(COL_SIZE)

    console.log(
      `  ${truncate(asset.relativePath, COL_PATH - 2)}` +
      `  ${typeLabel}` +
      `  ${sizeFmt}`,
    )
  }

  // Footer totals
  console.log(dim('─'.repeat(COL_PATH + COL_TYPE + COL_SIZE + 4)))
  if (jsAssets.length) {
    console.log(
      `  ${'Total JS'.padEnd(COL_PATH - 2)}` +
      `  ${cyan(' js')}` +
      `  ${formatSize(totalJs).padStart(COL_SIZE)}`,
    )
  }
  if (cssAssets.length) {
    console.log(
      `  ${'Total CSS'.padEnd(COL_PATH - 2)}` +
      `  ${yellow('css')}` +
      `  ${formatSize(totalCss).padStart(COL_SIZE)}`,
    )
  }
  console.log()
}

// ---------------------------------------------------------------------------
// Per-page summary (when pageBudgets are configured)
// ---------------------------------------------------------------------------

/**
 * Print a brief per-page asset summary.
 */
export function printPageSummary(pages: PageAssets[]): void {
  console.log(bold('\n  Per-page asset summary\n'))

  for (const page of pages) {
    const jsTotal = page.js.reduce((s, a) => s + a.sizeBytes, 0)
    const cssTotal = page.css.reduce((s, a) => s + a.sizeBytes, 0)

    const jsStr = cyan(formatSize(jsTotal).padStart(8))
    const cssStr = yellow(formatSize(cssTotal).padStart(8))

    console.log(
      `  ${truncate(page.route, 40).padEnd(42)}` +
      `  JS ${jsStr}  CSS ${cssStr}`,
    )
  }
  console.log()
}

// ---------------------------------------------------------------------------
// Violations output
// ---------------------------------------------------------------------------

/**
 * Print violations list. Returns whether any errors (not just warnings) exist.
 */
export function printViolations(violations: BudgetViolation[]): boolean {
  if (!violations.length) {
    console.log(`  ${green('✓')} All budgets passed.\n`)
    return false
  }

  const errors = violations.filter((v) => v.severity === 'error')
  const warns = violations.filter((v) => v.severity === 'warn')

  console.log(bold('\n  Budget violations\n'))

  for (const v of violations) {
    const icon = v.severity === 'error' ? red('✗') : yellow('△')
    const overPct = `+${Math.round(v.overByPercent)}%`
    console.log(
      `  ${icon} ${v.message}  ${dim(`(${overPct} over)`)}`,
    )
  }
  console.log()

  if (errors.length) {
    console.log(
      red(bold(`  ${errors.length} budget violation${errors.length > 1 ? 's' : ''} exceeded.`)) +
      (warns.length ? yellow(` ${warns.length} warning${warns.length > 1 ? 's' : ''}.`) : '') +
      '\n',
    )
  }

  return errors.length > 0
}

// ---------------------------------------------------------------------------
// Final one-line status
// ---------------------------------------------------------------------------

export function printStatus(passed: boolean, reportPath?: string): void {
  if (passed) {
    console.log(`  ${green('✓ astro-bundle-budget')} — all checks passed\n`)
  }
  if (reportPath) {
    console.log(`  ${dim(`Report → ${reportPath}`)}\n`)
  }
}
