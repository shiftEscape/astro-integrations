import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import i18nToolkit from '../src/index.js'

const mockLogger = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} }

function setupIntegration(opts = {}, command: 'dev' | 'build' | 'preview' = 'dev') {
  const integration = i18nToolkit(opts)
  let registeredApp: any = null
  let middlewareAdded: any = null

  integration.hooks['astro:config:setup']?.({
    command,
    addDevToolbarApp: (app: any) => { registeredApp = app },
    addMiddleware: (mw: any) => { middlewareAdded = mw },
    logger: mockLogger,
    config: {
      root: new URL('file:///project/'),
      i18n: { locales: ['en', 'fr', 'de'], defaultLocale: 'en', routing: { prefixDefaultLocale: false } },
    },
  } as any)

  return { integration, registeredApp, middlewareAdded }
}

describe('i18nToolkit integration', () => {
  it('returns integration with correct name', () => {
    assert.equal(i18nToolkit().name, 'astro-i18n-toolkit')
  })

  it('has required hooks', () => {
    const integration = i18nToolkit()
    assert.ok(typeof integration.hooks['astro:config:setup'] === 'function')
    assert.ok(typeof integration.hooks['astro:server:setup'] === 'function')
  })

  it('accepts all options without throwing', () => {
    assert.doesNotThrow(() => i18nToolkit({
      localesDir: './src/i18n',
      defaultLocale: 'en',
      format: 'yaml',
    }))
  })

  it('does not register app outside dev mode', () => {
    for (const command of ['build', 'preview'] as const) {
      const { registeredApp, middlewareAdded } = setupIntegration({}, command)
      assert.equal(registeredApp, null, `Should not register toolbar in ${command}`)
      assert.equal(middlewareAdded, null, `Should not add middleware in ${command}`)
    }
  })

  it('registers toolbar app in dev mode with correct properties', () => {
    const { registeredApp } = setupIntegration()
    assert.ok(registeredApp !== null)
    assert.equal(registeredApp.id,   'astro-i18n-toolkit')
    assert.equal(registeredApp.name, 'i18n Toolkit')
    assert.ok(registeredApp.entrypoint.endsWith('toolbar-app.js'))
    assert.ok(registeredApp.icon.startsWith('<svg'))
  })

  it('registers middleware with order pre in dev mode', () => {
    const { middlewareAdded } = setupIntegration()
    assert.ok(middlewareAdded !== null)
    assert.equal(middlewareAdded.order, 'pre')
    assert.ok(middlewareAdded.entrypoint instanceof URL)
    assert.ok(middlewareAdded.entrypoint.href.endsWith('middleware.js'))
  })

  it('server:setup registers all required handlers', () => {
    const { integration } = setupIntegration()
    const handlers: string[] = []
    const mockToolbar = {
      on:   (event: string, _: any) => { handlers.push(event) },
      send: () => {},
    }
    integration.hooks['astro:server:setup']?.({ toolbar: mockToolbar } as any)
    assert.ok(handlers.includes('astro-i18n-toolkit:ready'))
    assert.ok(handlers.includes('astro-i18n-toolkit:request-coverage'))
    assert.ok(handlers.includes('astro-i18n-toolkit:switch-locale'))
  })

  it('sends config when client is ready', () => {
    const { integration } = setupIntegration()
    const handlers = new Map<string, (...args: any[]) => void>()
    const captured: Array<{ event: string; payload: any }> = []
    const mockToolbar = {
      on:   (event: string, cb: (...args: any[]) => void) => { handlers.set(event, cb) },
      send: (event: string, payload: any) => { captured.push({ event, payload }) },
    }
    integration.hooks['astro:server:setup']?.({ toolbar: mockToolbar } as any)
    handlers.get('astro-i18n-toolkit:ready')?.({})

    assert.equal(captured[0]?.event, 'astro-i18n-toolkit:config')
    assert.ok(Array.isArray(captured[0]?.payload.locales))
    assert.equal(typeof captured[0]?.payload.defaultLocale, 'string')
  })

  it('sends coverage payload when requested', () => {
    const tmpDir = join(tmpdir(), `i18n-int-${Date.now()}`)
    mkdirSync(tmpDir, { recursive: true })
    writeFileSync(join(tmpDir, 'en.json'), JSON.stringify({ hello: 'Hello', world: 'World' }))
    writeFileSync(join(tmpDir, 'fr.json'), JSON.stringify({ hello: 'Bonjour' }))

    const integration = i18nToolkit({ localesDir: tmpDir, defaultLocale: 'en' })
    integration.hooks['astro:config:setup']?.({
      command: 'dev',
      addDevToolbarApp: () => {},
      addMiddleware: () => {},
      logger: mockLogger,
      config: { root: new URL('file:///project/'), i18n: undefined },
    } as any)

    const handlers = new Map<string, (...args: any[]) => void>()
    const captured: Array<{ event: string; payload: any }> = []
    const mockToolbar = {
      on:   (event: string, cb: (...args: any[]) => void) => { handlers.set(event, cb) },
      send: (event: string, payload: any) => { captured.push({ event, payload }) },
    }
    integration.hooks['astro:server:setup']?.({ toolbar: mockToolbar } as any)
    handlers.get('astro-i18n-toolkit:request-coverage')?.({})

    const coverageEvent = captured.find(c => c.event === 'astro-i18n-toolkit:coverage')
    assert.ok(coverageEvent, 'should send coverage event')
    assert.ok(Array.isArray(coverageEvent.payload.keys))
    assert.ok(coverageEvent.payload.totalKeys > 0)

    const worldKey = coverageEvent.payload.keys.find((k: any) => k.key === 'world')
    assert.ok(worldKey, 'should find world key')
    assert.equal(worldKey.status, 'missing')
    assert.ok(worldKey.missingIn.includes('fr'))

    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('computes redirect URL for locale switch', () => {
    const { integration } = setupIntegration()
    const handlers = new Map<string, (...args: any[]) => void>()
    const captured: Array<{ event: string; payload: any }> = []
    const mockToolbar = {
      on:   (event: string, cb: (...args: any[]) => void) => { handlers.set(event, cb) },
      send: (event: string, payload: any) => { captured.push({ event, payload }) },
    }
    integration.hooks['astro:server:setup']?.({ toolbar: mockToolbar } as any)
    handlers.get('astro-i18n-toolkit:switch-locale')?.({ locale: 'fr', currentUrl: '/about' })

    const redirect = captured.find(c => c.event === 'astro-i18n-toolkit:redirect')
    assert.ok(redirect, 'should send redirect event')
    assert.ok(redirect.payload.redirectUrl.includes('fr'), 'redirect URL should include locale')
    assert.ok(redirect.payload.redirectUrl.includes('/fr/about'), 'redirect URL should be locale-prefixed')
  })
})
