import type {
  AssetInfo,
  BudgetRule,
  BudgetViolation,
  BundleBudgetOptions,
  PageAssets,
  PageBudget,
} from './types.js'
import { matchGlob, measureSize, parseSize } from './utils.js'

// ---------------------------------------------------------------------------
// Per-file budget checks
// ---------------------------------------------------------------------------

/**
 * Check each asset against every BudgetRule.
 * The first matching rule wins (glob order matters, like CSS specificity).
 */
export async function checkFileBudgets(
  assets: AssetInfo[],
  rules: BudgetRule[],
): Promise<BudgetViolation[]> {
  if (!rules.length) return []

  const violations: BudgetViolation[] = []

  for (const asset of assets) {
    // Find the first rule whose pattern matches this asset
    const rule = rules.find((r) => matchGlob(r.path, asset.relativePath))
    if (!rule) continue

    const budgetBytes = parseSize(rule.budget)
    const compression = rule.compression ?? 'none'
    const actualBytes = await measureSize(asset.absolutePath, compression)

    if (actualBytes > budgetBytes) {
      const overByPercent = ((actualBytes - budgetBytes) / budgetBytes) * 100
      violations.push({
        severity: 'error',
        rule,
        subject: asset.relativePath,
        message: buildFileMessage(asset.relativePath, actualBytes, budgetBytes, compression),
        actualBytes,
        budgetBytes,
        overByPercent,
      })
    }
  }

  return violations
}

// ---------------------------------------------------------------------------
// Per-page budget checks
// ---------------------------------------------------------------------------

/**
 * Check each page against every PageBudget.
 */
export async function checkPageBudgets(
  pages: PageAssets[],
  rules: PageBudget[],
): Promise<BudgetViolation[]> {
  if (!rules.length) return []

  const violations: BudgetViolation[] = []

  for (const page of pages) {
    for (const rule of rules) {
      const budgetBytes = parseSize(rule.budget)
      const compression = rule.compression ?? 'none'

      // Collect the relevant assets for this page + rule type
      let pageAssets: AssetInfo[] = []
      if (rule.type === 'js') pageAssets = page.js
      else if (rule.type === 'css') pageAssets = page.css
      else pageAssets = [...page.js, ...page.css]  // 'total'

      // Sum the sizes
      let actualBytes = 0
      for (const asset of pageAssets) {
        actualBytes += await measureSize(asset.absolutePath, compression)
      }

      if (actualBytes > budgetBytes) {
        const overByPercent = ((actualBytes - budgetBytes) / budgetBytes) * 100
        violations.push({
          severity: 'error',
          rule,
          subject: page.route,
          message: buildPageMessage(
            page.route,
            rule.type,
            actualBytes,
            budgetBytes,
            compression,
          ),
          actualBytes,
          budgetBytes,
          overByPercent,
        })
      }
    }
  }

  return violations
}

// ---------------------------------------------------------------------------
// Message builders
// ---------------------------------------------------------------------------

import { formatSize } from './utils.js'

function compressionLabel(c: string) {
  if (c === 'gzip') return ' (gzip)'
  if (c === 'brotli') return ' (brotli)'
  return ''
}

function buildFileMessage(
  path: string,
  actual: number,
  budget: number,
  compression: string,
): string {
  return (
    `${path}: ${formatSize(actual)}${compressionLabel(compression)} ` +
    `exceeds budget of ${formatSize(budget)} ` +
    `(+${formatSize(actual - budget)} over)`
  )
}

function buildPageMessage(
  route: string,
  type: string,
  actual: number,
  budget: number,
  compression: string,
): string {
  return (
    `${route} — total ${type.toUpperCase()}${compressionLabel(compression)}: ` +
    `${formatSize(actual)} exceeds budget of ${formatSize(budget)} ` +
    `(+${formatSize(actual - budget)} over)`
  )
}
