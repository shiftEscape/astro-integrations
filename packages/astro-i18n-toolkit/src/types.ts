// ---------------------------------------------------------------------------
// Public option types
// ---------------------------------------------------------------------------

export interface I18nToolkitOptions {
  /**
   * Path to locale files directory, relative to project root.
   * e.g. './src/locales' or './public/locales'
   * @default './src/locales'
   */
  localesDir?: string

  /**
   * The reference locale — all other locales are compared against this.
   * Falls back to config.i18n.defaultLocale if not set.
   * @default 'en'
   */
  defaultLocale?: string

  /**
   * File format of translation files.
   * @default 'json'
   */
  format?: 'json' | 'yaml'
}

// ---------------------------------------------------------------------------
// Internal types shared between server ↔ toolbar client
// ---------------------------------------------------------------------------

export type KeyStatus = 'complete' | 'fallback' | 'missing'

export interface KeyCoverage {
  key: string
  status: KeyStatus
  /** Which locales are missing this key */
  missingIn: string[]
  /** Reference locale value (truncated for display) */
  referenceValue: string
}

export interface LocaleCoverage {
  locale: string
  total: number
  complete: number
  fallback: number
  missing: number
  /** 0–100 */
  percent: number
}

export interface CoveragePayload {
  locales: string[]
  defaultLocale: string
  keys: KeyCoverage[]
  summary: LocaleCoverage[]
  totalKeys: number
  scannedAt: number
}

export interface LocaleSwitchPayload {
  locale: string
  currentUrl: string
}

export interface ToolkitConfigPayload {
  locales: string[]
  defaultLocale: string
  currentLocale: string
}

// Cookie name used by the Tier 2 locale switcher middleware
export const LOCALE_COOKIE = '__astro_i18n_locale'
