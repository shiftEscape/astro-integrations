import type { MiddlewareHandler } from 'astro'
import { LOCALE_COOKIE } from './types.js'

// This middleware runs with order: 'pre' — before Astro's own i18n middleware.
// When the toolbar sets the __astro_i18n_locale cookie, we redirect to the
// locale-prefixed URL so the page re-renders in the selected locale.
// In production (command !== 'dev') this middleware is never registered.

export const onRequest: MiddlewareHandler = async (context, next) => {
  const { request, cookies, redirect } = context
  const url = new URL(request.url)

  // Only act if a locale override cookie is present
  const requestedLocale = cookies.get(LOCALE_COOKIE)?.value
  if (!requestedLocale) return next()

  // Skip internal Astro routes
  if (url.pathname.startsWith('/_astro') || url.pathname.startsWith('/_server')) {
    return next()
  }

  // The toolbar client sends the target URL directly — just redirect there
  // The redirect target is set as the cookie value in toolbar-app.ts
  // Format: "locale::target-path"  e.g. "fr::/fr/about"
  if (requestedLocale.includes('::')) {
    const [, targetPath] = requestedLocale.split('::')

    // Clear the cookie so we don't loop
    const response = redirect(targetPath || '/', 302)
    response.headers.append(
      'Set-Cookie',
      `${LOCALE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`
    )
    return response
  }

  return next()
}
