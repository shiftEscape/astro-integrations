import { readFile } from 'node:fs/promises'
import { gzipSync, brotliCompressSync, constants as zlibConstants } from 'node:zlib'

// ---------------------------------------------------------------------------
// Size string parsing
// ---------------------------------------------------------------------------

const SIZE_UNITS: Record<string, number> = {
  b: 1,
  kb: 1_000,
  kib: 1_024,
  mb: 1_000_000,
  mib: 1_048_576,
  gb: 1_000_000_000,
}

/**
 * Parse a human-readable size string or raw byte number into bytes.
 *
 * Accepts: 100, '100', '100 kB', '1.5 MB', '50KiB', '200kb'
 */
export function parseSize(value: number | string): number {
  if (typeof value === 'number') return value

  const match = value.trim().match(/^([\d.]+)\s*([a-zA-Z]*)$/)
  if (!match) throw new Error(`Cannot parse size: "${value}"`)

  const amount = parseFloat(match[1])
  const unit = match[2].toLowerCase()

  if (!unit || unit === 'b') return Math.round(amount)
  const multiplier = SIZE_UNITS[unit]
  if (!multiplier) throw new Error(`Unknown size unit: "${unit}" in "${value}"`)

  return Math.round(amount * multiplier)
}

// ---------------------------------------------------------------------------
// Human-readable formatting
// ---------------------------------------------------------------------------

/**
 * Format bytes into a compact human-readable string.
 * e.g. 1234 → '1.2 kB', 1_500_000 → '1.5 MB'
 */
export function formatSize(bytes: number): string {
  if (bytes < 1_000) return `${bytes} B`
  if (bytes < 1_000_000) return `${(bytes / 1_000).toFixed(1)} kB`
  if (bytes < 1_000_000_000) return `${(bytes / 1_000_000).toFixed(2)} MB`
  return `${(bytes / 1_000_000_000).toFixed(2)} GB`
}

/**
 * Format a percentage delta. e.g. 0.15 → '+15%'
 */
export function formatDelta(overByPercent: number): string {
  const sign = overByPercent >= 0 ? '+' : ''
  return `${sign}${Math.round(overByPercent)}%`
}

// ---------------------------------------------------------------------------
// Compression
// ---------------------------------------------------------------------------

export type Compression = 'none' | 'gzip' | 'brotli'

/**
 * Measure a file's size, optionally after compression.
 */
export async function measureSize(
  absolutePath: string,
  compression: Compression = 'none',
): Promise<number> {
  const buf = await readFile(absolutePath)

  if (compression === 'gzip') {
    return gzipSync(buf, { level: 9 }).byteLength
  }

  if (compression === 'brotli') {
    return brotliCompressSync(buf, {
      params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 11 },
    }).byteLength
  }

  return buf.byteLength
}

// ---------------------------------------------------------------------------
// Minimatch-style glob matching (no extra deps)
// ---------------------------------------------------------------------------

/**
 * Glob matcher supporting *, **, and ? wildcards.
 * Uses a placeholder approach to avoid regex-escape collisions.
 * Zero dependencies — Node built-ins only.
 */
export function matchGlob(pattern: string, filePath: string): boolean {
  const p = filePath.replace(/\\/g, '/')
  const g = pattern.replace(/\\/g, '/')

  // 1. Replace glob wildcards with NUL-byte placeholders (safe — never in paths)
  // 2. Escape remaining regex special characters
  // 3. Expand placeholders back to their regex equivalents
  // This avoids the escape step mangling wildcard replacement strings.
  const DS = '\x00DS\x00'  // **/ → zero-or-more dir/ segments
  const D  = '\x00D\x00'   // **  → anything
  const S  = '\x00S\x00'   // *   → within one path segment
  const Q  = '\x00Q\x00'   // ?   → exactly one non-slash char

  const regex = g
    .replace(/\*\*\//g, DS)
    .replace(/\*\*/g,   D)
    .replace(/\*/g,     S)
    .replace(/\?/g,     Q)
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')   // escape regex specials
    .replace(/\x00DS\x00/g, '(?:[^/]+/)*')       // **/ = zero or more dir/ segments
    .replace(/\x00D\x00/g,  '.*')                 // **  = anything including slashes
    .replace(/\x00S\x00/g,  '[^/]*')              // *   = within segment only
    .replace(/\x00Q\x00/g,  '[^/]')               // ?   = one non-slash char

  return new RegExp(`^${regex}$`).test(p)
}

// ---------------------------------------------------------------------------
// Asset type detection
// ---------------------------------------------------------------------------

export function getAssetType(filePath: string): 'js' | 'css' | 'other' {
  const lower = filePath.toLowerCase()
  if (lower.endsWith('.js') || lower.endsWith('.mjs') || lower.endsWith('.cjs')) return 'js'
  if (lower.endsWith('.css')) return 'css'
  return 'other'
}

// ---------------------------------------------------------------------------
// Console colour helpers (no chalk — use ANSI escapes directly)
// ---------------------------------------------------------------------------

const NO_COLOR = process.env.NO_COLOR !== undefined || !process.stdout.isTTY

const c = (code: number, str: string) =>
  NO_COLOR ? str : `\x1b[${code}m${str}\x1b[0m`

export const bold = (s: string) => c(1, s)
export const dim = (s: string) => c(2, s)
export const red = (s: string) => c(31, s)
export const green = (s: string) => c(32, s)
export const yellow = (s: string) => c(33, s)
export const cyan = (s: string) => c(36, s)
export const white = (s: string) => c(37, s)
