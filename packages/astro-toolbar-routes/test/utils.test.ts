import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  isDynamicPattern,
  classifyKind,
  classifyRenderMode,
  isInternalRoute,
  matchesExclude,
  normaliseComponent,
  buildRouteInfo,
  sortRoutes,
} from '../src/utils.js'

describe('isDynamicPattern', () => {
  it('detects bracket params', () => {
    assert.ok(isDynamicPattern('/blog/[slug]'))
    assert.ok(isDynamicPattern('/[locale]/[...rest]'))
    assert.ok(isDynamicPattern('/docs/[...slug]'))
  })
  it('returns false for static patterns', () => {
    assert.ok(!isDynamicPattern('/about'))
    assert.ok(!isDynamicPattern('/'))
    assert.ok(!isDynamicPattern('/api/health'))
  })
})

describe('classifyKind', () => {
  it('maps known types correctly', () => {
    assert.equal(classifyKind('page'),     'page')
    assert.equal(classifyKind('endpoint'), 'endpoint')
    assert.equal(classifyKind('redirect'), 'redirect')
    assert.equal(classifyKind('fallback'), 'fallback')
  })
  it('returns other for unknown types', () => {
    assert.equal(classifyKind('unknown'), 'other')
    assert.equal(classifyKind(''),        'other')
  })
})

describe('classifyRenderMode', () => {
  it('treats prerender=true as static', () => {
    assert.equal(classifyRenderMode(true), 'static')
  })
  it('treats prerender=false as ssr', () => {
    assert.equal(classifyRenderMode(false), 'ssr')
  })
  it('treats prerender=undefined as static (default)', () => {
    assert.equal(classifyRenderMode(undefined), 'static')
  })
})

describe('isInternalRoute', () => {
  it('flags Astro internal prefixes', () => {
    assert.ok(isInternalRoute('/_astro/index.abc123.js'))
    assert.ok(isInternalRoute('/_server_islands/MyComponent'))
    assert.ok(isInternalRoute('/_image'))
    assert.ok(isInternalRoute('/_actions/submit'))
  })
  it('does not flag user routes', () => {
    assert.ok(!isInternalRoute('/about'))
    assert.ok(!isInternalRoute('/api/users'))
    assert.ok(!isInternalRoute('/blog/[slug]'))
  })
})

describe('matchesExclude', () => {
  it('matches exact patterns', () => {
    assert.ok(matchesExclude('/admin', ['/admin']))
    assert.ok(matchesExclude('/secret', ['/other', '/secret']))
  })
  it('matches glob prefix patterns', () => {
    assert.ok(matchesExclude('/api/users', ['/api/*']))
    assert.ok(matchesExclude('/api/posts/1', ['/api/*']))
  })
  it('does not match unrelated patterns', () => {
    assert.ok(!matchesExclude('/about', ['/admin', '/api/*']))
    assert.ok(!matchesExclude('/blog/post', ['/api/*']))
  })
})

describe('normaliseComponent', () => {
  it('strips the project root', () => {
    const result = normaliseComponent('/home/user/project/src/pages/index.astro', '/home/user/project/')
    assert.equal(result, 'src/pages/index.astro')
  })
  it('normalises Windows backslashes', () => {
    const result = normaliseComponent('C:\\project\\src\\pages\\about.astro', 'C:\\project\\')
    assert.ok(result.includes('/'))
  })
  it('strips leading slash', () => {
    const result = normaliseComponent('/project/src/pages/blog.astro', '/project/')
    assert.ok(!result.startsWith('/'))
  })
})

describe('buildRouteInfo', () => {
  const root = '/project/'

  it('builds a valid RouteInfo for a static page', () => {
    const info = buildRouteInfo(
      { pattern: '/about', type: 'page', prerender: true, component: '/project/src/pages/about.astro' },
      root,
      {}
    )
    assert.ok(info)
    assert.equal(info.pattern, '/about')
    assert.equal(info.renderMode, 'static')
    assert.equal(info.kind, 'page')
    assert.equal(info.isDynamic, false)
  })

  it('builds a valid RouteInfo for an SSR dynamic route', () => {
    const info = buildRouteInfo(
      { pattern: '/blog/[slug]', type: 'page', prerender: false, component: '/project/src/pages/blog/[slug].astro' },
      root,
      {}
    )
    assert.ok(info)
    assert.equal(info.renderMode, 'ssr')
    assert.equal(info.isDynamic, true)
  })

  it('returns null for internal routes by default', () => {
    const info = buildRouteInfo(
      { pattern: '/_astro/chunk.js', type: 'endpoint', prerender: true, component: '' },
      root,
      {}
    )
    assert.equal(info, null)
  })

  it('includes internal routes when showInternalRoutes is true', () => {
    const info = buildRouteInfo(
      { pattern: '/_astro/chunk.js', type: 'endpoint', prerender: true, component: '' },
      root,
      { showInternalRoutes: true }
    )
    assert.ok(info)
  })

  it('returns null for excluded patterns', () => {
    const info = buildRouteInfo(
      { pattern: '/admin', type: 'page', prerender: true, component: '/project/src/pages/admin.astro' },
      root,
      { exclude: ['/admin'] }
    )
    assert.equal(info, null)
  })

  it('returns null for glob-excluded patterns', () => {
    const info = buildRouteInfo(
      { pattern: '/api/users', type: 'endpoint', prerender: false, component: '/project/src/pages/api/users.ts' },
      root,
      { exclude: ['/api/*'] }
    )
    assert.equal(info, null)
  })
})

describe('sortRoutes', () => {
  it('sorts pages before endpoints', () => {
    const routes = [
      { pattern: '/api/data', kind: 'endpoint' as const, renderMode: 'static' as const, isDynamic: false, component: '' },
      { pattern: '/about',    kind: 'page'     as const, renderMode: 'static' as const, isDynamic: false, component: '' },
    ]
    const sorted = sortRoutes(routes)
    assert.equal(sorted[0].kind, 'page')
    assert.equal(sorted[1].kind, 'endpoint')
  })

  it('sorts static before SSR within same kind', () => {
    const routes = [
      { pattern: '/ssr',    kind: 'page' as const, renderMode: 'ssr'    as const, isDynamic: false, component: '' },
      { pattern: '/static', kind: 'page' as const, renderMode: 'static' as const, isDynamic: false, component: '' },
    ]
    const sorted = sortRoutes(routes)
    assert.equal(sorted[0].renderMode, 'static')
    assert.equal(sorted[1].renderMode, 'ssr')
  })

  it('sorts alphabetically within same kind and render mode', () => {
    const routes = [
      { pattern: '/contact', kind: 'page' as const, renderMode: 'static' as const, isDynamic: false, component: '' },
      { pattern: '/about',   kind: 'page' as const, renderMode: 'static' as const, isDynamic: false, component: '' },
      { pattern: '/blog',    kind: 'page' as const, renderMode: 'static' as const, isDynamic: false, component: '' },
    ]
    const sorted = sortRoutes(routes)
    assert.equal(sorted[0].pattern, '/about')
    assert.equal(sorted[1].pattern, '/blog')
    assert.equal(sorted[2].pattern, '/contact')
  })

  it('does not mutate the original array', () => {
    const routes = [
      { pattern: '/b', kind: 'page' as const, renderMode: 'static' as const, isDynamic: false, component: '' },
      { pattern: '/a', kind: 'page' as const, renderMode: 'static' as const, isDynamic: false, component: '' },
    ]
    const original = [...routes]
    sortRoutes(routes)
    assert.equal(routes[0].pattern, original[0].pattern)
  })
})
