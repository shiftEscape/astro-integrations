import type { AstroIntegration, AstroConfig } from 'astro'
import { fileURLToPath } from 'node:url'
import { join, isAbsolute } from 'node:path'
import {
  scanLocalesDir,
  computeCoverage,
  deriveLocaleFromUrl,
  buildLocaleUrl,
} from './utils.js'
import type {
  I18nToolkitOptions,
  CoveragePayload,
  ToolkitConfigPayload,
  LocaleSwitchPayload,
} from './types.js'

export default function i18nToolkit(
  options: I18nToolkitOptions = {}
): AstroIntegration {
  const {
    localesDir = './src/locales',
    format = 'json',
  } = options

  let projectRoot = process.cwd()
  let resolvedLocales: string[] = []
  let resolvedDefaultLocale = options.defaultLocale ?? 'en'
  let prefixDefault = false

  return {
    name: 'astro-i18n-toolkit',

    hooks: {
      'astro:config:setup'({ addDevToolbarApp, addMiddleware, command, config, logger }) {
        if (command !== 'dev') return

        projectRoot = fileURLToPath(config.root)

        // Read Astro's i18n config if available
        const astroI18n = (config as AstroConfig & { i18n?: { locales?: string[]; defaultLocale?: string; routing?: { prefixDefaultLocale?: boolean } } }).i18n
        if (astroI18n?.locales) {
          resolvedLocales = astroI18n.locales as string[]
        }
        if (astroI18n?.defaultLocale) {
          resolvedDefaultLocale = options.defaultLocale ?? astroI18n.defaultLocale
        }
        if (astroI18n?.routing?.prefixDefaultLocale) {
          prefixDefault = astroI18n.routing.prefixDefaultLocale
        }

        logger.info('i18n Toolkit active — visible in dev toolbar.')

        // Register toolbar app
        addDevToolbarApp({
          id: 'astro-i18n-toolkit',
          name: 'i18n Toolkit',
          icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>`,
          entrypoint: fileURLToPath(new URL('./toolbar-app.js', import.meta.url)),
        })

        // Inject locale-switcher middleware (Tier 2)
        addMiddleware({
          entrypoint: new URL('./middleware.js', import.meta.url),
          order: 'pre',
        })
      },

      'astro:server:setup'({ toolbar }) {
        // Client ready — send config
        toolbar.on<Record<string, never>>('astro-i18n-toolkit:ready', () => {
          // If no locales from Astro config, fall back to locale file names
          if (resolvedLocales.length === 0) {
            const absDir = isAbsolute(localesDir) ? localesDir : join(projectRoot, localesDir)
            const localeMap = scanLocalesDir(absDir, format)
            resolvedLocales = [...localeMap.keys()]
          }

          const configPayload: ToolkitConfigPayload = {
            locales: resolvedLocales,
            defaultLocale: resolvedDefaultLocale,
            currentLocale: resolvedDefaultLocale, // server doesn't know the current URL
          }
          toolbar.send('astro-i18n-toolkit:config', configPayload)
        })

        // Client requests coverage scan
        toolbar.on<{ currentUrl?: string }>('astro-i18n-toolkit:request-coverage', (data) => {
          const absDir = isAbsolute(localesDir) ? localesDir : join(projectRoot, localesDir)
          const localeMap = scanLocalesDir(absDir, format)

          // Ensure default locale is present
          if (!localeMap.has(resolvedDefaultLocale) && localeMap.size > 0) {
            const firstLocale = [...localeMap.keys()][0]
            resolvedDefaultLocale = firstLocale
          }

          const { keys, summary } = computeCoverage(localeMap, resolvedDefaultLocale)

          const payload: CoveragePayload = {
            locales: [...localeMap.keys()],
            defaultLocale: resolvedDefaultLocale,
            keys,
            summary,
            totalKeys: keys.length,
            scannedAt: Date.now(),
          }

          toolbar.send('astro-i18n-toolkit:coverage', payload)
        })

        // Client requests locale switch — compute redirect URL and send back
        toolbar.on<LocaleSwitchPayload>('astro-i18n-toolkit:switch-locale', ({ locale, currentUrl }) => {
          const targetUrl = buildLocaleUrl(
            currentUrl,
            locale,
            resolvedLocales,
            resolvedDefaultLocale,
            prefixDefault
          )

          // Send redirect instruction: "locale::target-path"
          toolbar.send('astro-i18n-toolkit:redirect', {
            redirectUrl: `${locale}::${targetUrl}`,
          })
        })
      },
    },
  }
}

export type { I18nToolkitOptions }
