import type { BundleBudgetOptions } from './types.js'

/**
 * Returns the DevToolbarAppEntry config to pass to addDevToolbarApp().
 * This is NOT an AstroIntegration — it's just the entry config object.
 */
export function getToolbarEntry(_options: BundleBudgetOptions) {
  return {
    id: 'astro-bundle-budget',
    name: 'Bundle Budget',
    icon: 'gauge' as const,
    // Resolved at runtime via import.meta.url — Astro handles the URL→path mapping
    entrypoint: new URL('./toolbar-app.js', import.meta.url).href,
  }
}
