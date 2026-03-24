import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import toolbarRoutes from '../src/index.js'

const mockLogger = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} }

function setupIntegration(opts = {}, command: 'dev' | 'build' | 'preview' = 'dev') {
  const integration = toolbarRoutes(opts)
  integration.hooks['astro:config:setup']?.({
    command,
    addDevToolbarApp: () => {},
    logger: mockLogger,
    config: { root: new URL('file:///project/'), vite: {} },
  } as any)
  return integration
}

function resolveRoutes(integration: any, routes: any[]) {
  integration.hooks['astro:routes:resolved']?.({ routes, logger: mockLogger })
}

function setupServer(integration: any, currentPath = '/') {
  const captured: Array<{ event: string; payload: any }> = []
  const handlers = new Map<string, (...args: any[]) => void>()
  const mockToolbar = {
    on: (event: string, cb: (...args: any[]) => void) => { handlers.set(event, cb) },
    send: (event: string, payload: any) => { captured.push({ event, payload }) },
  }
  integration.hooks['astro:server:setup']?.({ toolbar: mockToolbar } as any)
  handlers.get('astro-toolbar-routes:request')?.({ currentPath })
  return captured
}

describe('toolbarRoutes integration', () => {
  it('returns an integration with correct name', () => {
    assert.equal(toolbarRoutes().name, 'astro-toolbar-routes')
  })

  it('has required hooks', () => {
    const integration = toolbarRoutes()
    assert.ok(typeof integration.hooks['astro:config:setup'] === 'function')
    assert.ok(typeof integration.hooks['astro:routes:resolved'] === 'function')
    assert.ok(typeof integration.hooks['astro:server:setup'] === 'function')
  })

  it('accepts options without throwing', () => {
    assert.doesNotThrow(() => toolbarRoutes({ exclude: ['/admin'], showInternalRoutes: false }))
  })

  it('does not register toolbar app outside dev mode', () => {
    for (const command of ['build', 'preview'] as const) {
      let called = false
      const integration = toolbarRoutes()
      integration.hooks['astro:config:setup']?.({
        command,
        addDevToolbarApp: () => { called = true },
        logger: mockLogger,
        config: { root: new URL('file:///tmp/'), vite: {} },
      } as any)
      assert.equal(called, false, `Should not register in ${command} mode`)
    }
  })

  it('registers toolbar app in dev mode with correct properties', () => {
    let registeredApp: any = null
    const integration = toolbarRoutes()
    integration.hooks['astro:config:setup']?.({
      command: 'dev',
      addDevToolbarApp: (app: any) => { registeredApp = app },
      logger: mockLogger,
      config: { root: new URL('file:///tmp/'), vite: {} },
    } as any)
    assert.ok(registeredApp)
    assert.equal(registeredApp.id, 'astro-toolbar-routes')
    assert.equal(registeredApp.name, 'Route Map')
    assert.ok(registeredApp.entrypoint.endsWith('toolbar-app.js'))
    assert.ok(registeredApp.icon.startsWith('<svg'))
  })

  it('collects routes via astro:routes:resolved', () => {
    const integration = setupIntegration()
    resolveRoutes(integration, [
      { pattern: '/about',        type: 'page',     isPrerendered: true,  entrypoint: '/project/src/pages/about.astro' },
      { pattern: '/blog/[slug]',  type: 'page',     isPrerendered: false, entrypoint: '/project/src/pages/blog/[slug].astro' },
      { pattern: '/api/data',     type: 'endpoint', isPrerendered: false, entrypoint: '/project/src/pages/api/data.ts' },
    ])

    const captured = setupServer(integration, '/about')
    assert.equal(captured[0].event, 'astro-toolbar-routes:data')

    const { routes, total, staticCount, ssrCount, endpointCount } = captured[0].payload
    assert.equal(total, 3)
    assert.equal(staticCount, 1)
    assert.equal(ssrCount, 2)
    assert.equal(endpointCount, 1)

    const about = routes.find((r: any) => r.pattern === '/about')
    assert.ok(about)
    assert.equal(about.renderMode, 'static')
    assert.equal(about.isDynamic, false)

    const blog = routes.find((r: any) => r.pattern === '/blog/[slug]')
    assert.ok(blog)
    assert.equal(blog.renderMode, 'ssr')
    assert.equal(blog.isDynamic, true)
  })

  it('refreshes route list on repeated astro:routes:resolved calls', () => {
    const integration = setupIntegration()

    resolveRoutes(integration, [
      { pattern: '/about', type: 'page', isPrerendered: true, entrypoint: '/project/src/pages/about.astro' },
    ])

    // Simulate a new page being added (hot reload fires routes:resolved again)
    resolveRoutes(integration, [
      { pattern: '/about',   type: 'page', isPrerendered: true, entrypoint: '/project/src/pages/about.astro' },
      { pattern: '/contact', type: 'page', isPrerendered: true, entrypoint: '/project/src/pages/contact.astro' },
    ])

    const captured = setupServer(integration)
    assert.equal(captured[0].payload.total, 2)
  })

  it('excludes routes matching options.exclude', () => {
    const integration = setupIntegration({ exclude: ['/admin', '/api/*'] })
    resolveRoutes(integration, [
      { pattern: '/about',     type: 'page',     isPrerendered: true,  entrypoint: '/project/src/pages/about.astro' },
      { pattern: '/admin',     type: 'page',     isPrerendered: true,  entrypoint: '/project/src/pages/admin.astro' },
      { pattern: '/api/users', type: 'endpoint', isPrerendered: false, entrypoint: '/project/src/pages/api/users.ts' },
    ])
    const captured = setupServer(integration)
    assert.equal(captured[0].payload.routes.length, 1)
    assert.equal(captured[0].payload.routes[0].pattern, '/about')
  })

  it('passes currentPath through to the payload', () => {
    const integration = setupIntegration()
    resolveRoutes(integration, [])
    const captured = setupServer(integration, '/blog')
    assert.equal(captured[0].payload.currentPath, '/blog')
  })

  it('server:setup registers the request handler', () => {
    const integration = setupIntegration()
    const handlers: string[] = []
    const mockToolbar = {
      on: (event: string, _: any) => { handlers.push(event) },
      send: () => {},
    }
    integration.hooks['astro:server:setup']?.({ toolbar: mockToolbar } as any)
    assert.ok(handlers.includes('astro-toolbar-routes:request'))
  })
})
