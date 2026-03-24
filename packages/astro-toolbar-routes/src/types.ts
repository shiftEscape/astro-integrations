// ---------------------------------------------------------------------------
// Public option types
// ---------------------------------------------------------------------------

export interface ToolbarRoutesOptions {
  /**
   * Route patterns to exclude from the panel.
   * Supports exact match and glob-style prefix (e.g. '/api/*').
   * @default []
   */
  exclude?: string[]

  /**
   * Show Astro internal routes (_astro/*, _server_islands/*, etc.)
   * @default false
   */
  showInternalRoutes?: boolean
}

// ---------------------------------------------------------------------------
// Internal types shared between server ↔ client
// ---------------------------------------------------------------------------

export type RouteRenderMode = 'static' | 'ssr'
export type RouteKind = 'page' | 'endpoint' | 'redirect' | 'fallback' | 'other'

export interface RouteInfo {
  /** URL pattern e.g. /blog/[slug] */
  pattern: string
  /** Whether the route has dynamic segments */
  isDynamic: boolean
  /** Whether it is prerendered (static) or SSR */
  renderMode: RouteRenderMode
  /** Page, endpoint, redirect, etc. */
  kind: RouteKind
  /** Source file path relative to project root */
  component: string
}

export interface RoutesPayload {
  routes: RouteInfo[]
  total: number
  staticCount: number
  ssrCount: number
  endpointCount: number
  /** The URL pathname the toolbar is currently open on */
  currentPath: string
}
