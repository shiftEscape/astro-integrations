import type { AstroIntegration, IntegrationResolvedRoute } from 'astro'
import { fileURLToPath } from 'node:url'
import { buildRouteInfo, sortRoutes } from './utils.js'
import type { ToolbarRoutesOptions, RouteInfo, RoutesPayload } from './types.js'

export default function toolbarRoutes(
  options: ToolbarRoutesOptions = {}
): AstroIntegration {
  let collectedRoutes: RouteInfo[] = []
  let projectRoot = process.cwd()

  return {
    name: 'astro-toolbar-routes',

    hooks: {
      'astro:config:setup'({ addDevToolbarApp, command, logger, config }) {
        if (command !== 'dev') return

        projectRoot = fileURLToPath(config.root)

        logger.info('Route Map active — visible in dev toolbar.')

        addDevToolbarApp({
          id: 'astro-toolbar-routes',
          name: 'Route Map',
          icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>`,
          entrypoint: fileURLToPath(
            new URL('./toolbar-app.js', import.meta.url)
          ),
        })
      },

      // astro:routes:resolved fires after all routes are registered and gives
      // us the full route metadata: pattern, type, isPrerendered, entrypoint
      'astro:routes:resolved'({ routes }) {
        collectedRoutes = []
        for (const route of routes) {
          const info = buildRouteInfo(
            {
              pattern:    route.pattern,
              type:       route.type,
              prerender:  route.isPrerendered,
              component:  route.entrypoint,
            },
            projectRoot,
            options
          )
          if (info) collectedRoutes.push(info)
        }
      },

      'astro:server:setup'({ toolbar }) {
        toolbar.on<{ currentPath: string }>(
          'astro-toolbar-routes:request',
          ({ currentPath }) => {
            const sorted = sortRoutes(collectedRoutes)

            const payload: RoutesPayload = {
              routes: sorted,
              total: sorted.length,
              staticCount:   sorted.filter((r) => r.renderMode === 'static' && r.kind === 'page').length,
              ssrCount:      sorted.filter((r) => r.renderMode === 'ssr').length,
              endpointCount: sorted.filter((r) => r.kind === 'endpoint').length,
              currentPath,
            }

            toolbar.send('astro-toolbar-routes:data', payload)
          }
        )
      },
    },
  }
}

export type { ToolbarRoutesOptions }
