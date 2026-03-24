# @shiftescape/astro-toolbar-routes

[![version](https://img.shields.io/npm/v/@shiftescape/astro-toolbar-routes.svg?style=flat-square)](http://npm.im/@shiftescape/astro-toolbar-routes) [![downloads](https://img.shields.io/npm/dm/@shiftescape/astro-toolbar-routes.svg?style=flat-square)](https://npm-stat.com/charts.html?package=@shiftescape/astro-toolbar-routes&from=2026-03-01) [![MIT License](https://img.shields.io/npm/l/@shiftescape/astro-toolbar-routes.svg?style=flat-square)](http://opensource.org/licenses/MIT)

A dev toolbar integration for Astro that shows a live, clickable route map of your entire project — grouped by type, searchable, and active only in development.

```
Route Map (6 routes)      🟢 3 static   🔴 2 SSR   🔵 1 endpoint
───────────────────────────────────────────────────────────────

📄 Pages
  🟢  /                                                       →
  🟢  /about                                                  →
  🟢  /blog                                                   →
  🔴  /blog/[slug]                              (SSR) (dynamic)
  🔴  /404                                                (SSR)

⚡ Endpoints
  🔵  /api/contact                                   (endpoint)
```

## Features

- 🗺 **Live route map** — every route in your project visible at a glance
- 🔵 **Highlight active route** — current page is highlighted in the panel
- 🖱 **Click to navigate** — click any static route to jump to it instantly
- 🏷 **Tags** — dynamic, SSR, endpoint, and redirect routes clearly labelled
- 🔍 **Searchable** — filter by URL pattern or file path in real time
- 🔒 **Dev-only** — completely stripped in `astro build`, zero production footprint
- 🔄 **Live updates** — reflects new pages added while dev server is running
- 🚫 **Zero dependencies** — no external packages

## Install

```bash
npm install -D @shiftescape/astro-toolbar-routes
# or
pnpm add -D @shiftescape/astro-toolbar-routes
```

## Usage

```js
// astro.config.mjs
import { defineConfig } from "astro/config";
import toolbarRoutes from "@shiftescape/astro-toolbar-routes";

export default defineConfig({
  integrations: [toolbarRoutes()],
});
```

Open your site in `astro dev` and click the map icon (🗺) in the bottom toolbar.

### With options

```js
toolbarRoutes({
  // Exclude specific routes or glob prefixes
  exclude: ["/admin", "/api/*"],

  // Show Astro internal routes (_astro/*, _server_islands/*, etc.)
  showInternalRoutes: false,
});
```

## Options

| Option               | Type       | Default | Description                                                             |
| -------------------- | ---------- | ------- | ----------------------------------------------------------------------- |
| `exclude`            | `string[]` | `[]`    | Route patterns to hide. Supports exact match and `*` suffix wildcard.   |
| `showInternalRoutes` | `boolean`  | `false` | Show Astro's internal routes like `/_astro/*` and `/_server_islands/*`. |

## Route types

| Tag        | Meaning                                                                                  |
| ---------- | ---------------------------------------------------------------------------------------- |
| _(no tag)_ | Static page — click to navigate                                                          |
| `dynamic`  | Route has `[param]` or `[...slug]` segments — cannot navigate without a real param value |
| `SSR`      | Rendered on-demand (`prerender: false`)                                                  |
| `endpoint` | API route (`.ts` / `.js` file in `src/pages/`)                                           |
| `redirect` | Configured redirect rule                                                                 |

## License

MIT © [Alvin James Bellero](https://github.com/shiftEscape)
