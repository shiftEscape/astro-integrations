// ---------------------------------------------------------------------------
// Public config types — what the user passes to bundleBudget()
// ---------------------------------------------------------------------------

/**
 * A single budget rule. Matches asset filenames with a glob pattern
 * and enforces a maximum size.
 *
 * @example
 * { path: '**\/*.js', budget: '100 kB' }
 * { path: 'assets/vendor-*.js', budget: 200_000 }           // bytes
 * { path: '**\/*.css', budget: '20 kB', compression: 'gzip' }
 */
export interface BudgetRule {
  /**
   * Glob pattern matched against the asset's path relative to outDir.
   * Uses standard minimatch syntax.
   */
  path: string

  /**
   * Maximum allowed size. Either a number (bytes) or a human-readable
   * string like '100 kB', '1.5 MB', '50 KB'.
   */
  budget: number | string

  /**
   * Whether to measure compressed size.
   * - 'none'  (default) — uncompressed bytes on disk
   * - 'gzip'  — gzip level 9
   * - 'brotli' — brotli level 11
   */
  compression?: 'none' | 'gzip' | 'brotli'
}

/**
 * Asset type filters for per-page budgets.
 */
export type AssetType = 'js' | 'css' | 'total'

/**
 * A per-page budget: the maximum total JS, CSS, or combined payload
 * a single page may reference.
 *
 * @example
 * { type: 'js', budget: '150 kB' }
 * { type: 'total', budget: '250 kB', compression: 'gzip' }
 */
export interface PageBudget {
  /** What to measure per page. */
  type: AssetType

  /** Maximum allowed size across all assets of that type for a single page. */
  budget: number | string

  /** Compression mode for measurement. Defaults to 'none'. */
  compression?: 'none' | 'gzip' | 'brotli'
}

/**
 * Full integration options.
 */
export interface BundleBudgetOptions {
  /**
   * Per-file budget rules. Each rule is checked against every asset in
   * the build output. First matching rule wins.
   *
   * @default [] (no per-file rules)
   */
  budgets?: BudgetRule[]

  /**
   * Per-page budgets. Measures the total JS or CSS payload that each
   * generated HTML page references (via <script src> and <link rel=stylesheet>).
   *
   * @default [] (no per-page rules)
   */
  pageBudgets?: PageBudget[]

  /**
   * Asset types to track and display in the console summary.
   * @default ['js', 'css']
   */
  include?: AssetType[]

  /**
   * Whether to fail (exit 1) when any budget is exceeded.
   * Set to false to warn but always pass.
   * @default true
   */
  failOnExceed?: boolean

  /**
   * Write a machine-readable JSON report alongside the build output.
   * @default false
   */
  report?: boolean

  /**
   * Path for the JSON report, relative to outDir.
   * @default 'bundle-budget-report.json'
   */
  reportPath?: string

  /**
   * Print every asset and its size, even when under budget.
   * @default false
   */
  verbose?: boolean
}

// ---------------------------------------------------------------------------
// Internal types — used inside the integration logic
// ---------------------------------------------------------------------------

export interface AssetInfo {
  /** Path relative to outDir, e.g. 'assets/index-aBc123.js' */
  relativePath: string
  /** Absolute path on disk */
  absolutePath: string
  /** Asset type */
  type: 'js' | 'css' | 'other'
  /** Uncompressed size in bytes */
  sizeBytes: number
  /** Gzip size in bytes (computed lazily) */
  gzipBytes?: number
  /** Brotli size in bytes (computed lazily) */
  brotliBytes?: number
}

export interface PageAssets {
  /** Route path, e.g. '/blog/my-post/' */
  route: string
  /** Absolute path to the HTML file */
  htmlPath: string
  /** All JS assets referenced by this page */
  js: AssetInfo[]
  /** All CSS assets referenced by this page */
  css: AssetInfo[]
}

export type ViolationSeverity = 'error' | 'warn'

export interface BudgetViolation {
  severity: ViolationSeverity
  /** Which rule was violated */
  rule: BudgetRule | PageBudget
  /** Human-readable description */
  message: string
  /** The asset or page that violated the budget */
  subject: string
  /** Actual size in bytes (after compression if applicable) */
  actualBytes: number
  /** Budget in bytes */
  budgetBytes: number
  /** How much over budget, as a percentage */
  overByPercent: number
}

export interface BudgetReport {
  generatedAt: string
  totalAssets: number
  totalJsBytes: number
  totalCssBytes: number
  assets: AssetInfo[]
  pages: PageAssets[]
  violations: BudgetViolation[]
  passed: boolean
}
