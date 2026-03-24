import type { RouteInfo, RouteKind, RouteRenderMode, ToolbarRoutesOptions } from './types.js'

// ---------------------------------------------------------------------------
// Internal Astro route prefixes to skip
// ---------------------------------------------------------------------------

const INTERNAL_PREFIXES = [
  '/_astro',
  '/_server_islands',
  '/_image',
  '/_actions',
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function isDynamicPattern(pattern: string): boolean {
  return pattern.includes('[') || pattern.includes('...')
}

export function classifyKind(type: string): RouteKind {
  switch (type) {
    case 'page':     return 'page'
    case 'endpoint': return 'endpoint'
    case 'redirect': return 'redirect'
    case 'fallback': return 'fallback'
    default:         return 'other'
  }
}

export function classifyRenderMode(prerender: boolean | undefined): RouteRenderMode {
  // undefined means Astro hasn't decided yet — treat as static (the default)
  return prerender === false ? 'ssr' : 'static'
}

export function isInternalRoute(pattern: string): boolean {
  return INTERNAL_PREFIXES.some((prefix) => pattern.startsWith(prefix))
}

export function matchesExclude(pattern: string, excludes: string[]): boolean {
  return excludes.some((rule) => {
    if (rule.endsWith('*')) {
      return pattern.startsWith(rule.slice(0, -1))
    }
    return pattern === rule
  })
}

export function normaliseComponent(component: string, root: string): string {
  // Strip the absolute project root prefix so the path is relative
  const normalised = component.replace(root, '').replace(/\\/g, '/')
  return normalised.startsWith('/') ? normalised.slice(1) : normalised
}

// ---------------------------------------------------------------------------
// Route collection — called once per route in astro:route:setup,
// accumulates into a list, then sorted and returned
// ---------------------------------------------------------------------------

export function buildRouteInfo(
  route: {
    pattern: string
    type: string
    prerender?: boolean
    component: string
  },
  projectRoot: string,
  options: ToolbarRoutesOptions
): RouteInfo | null {
  const { exclude = [], showInternalRoutes = false } = options

  if (!showInternalRoutes && isInternalRoute(route.pattern)) return null
  if (matchesExclude(route.pattern, exclude)) return null

  return {
    pattern: route.pattern,
    isDynamic: isDynamicPattern(route.pattern),
    renderMode: classifyRenderMode(route.prerender),
    kind: classifyKind(route.type),
    component: normaliseComponent(route.component, projectRoot),
  }
}

export function sortRoutes(routes: RouteInfo[]): RouteInfo[] {
  return [...routes].sort((a, b) => {
    // Static pages first, then SSR, then endpoints
    const kindOrder = { page: 0, endpoint: 1, redirect: 2, fallback: 3, other: 4 }
    const kd = kindOrder[a.kind] - kindOrder[b.kind]
    if (kd !== 0) return kd
    // Within same kind: static before SSR
    if (a.renderMode !== b.renderMode) {
      return a.renderMode === 'static' ? -1 : 1
    }
    // Alphabetically
    return a.pattern.localeCompare(b.pattern)
  })
}
