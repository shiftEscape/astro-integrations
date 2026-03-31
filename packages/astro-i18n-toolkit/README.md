# @shiftescape/astro-i18n-toolkit

A dev toolbar integration for Astro that adds a live i18n debugger — translation coverage map across all locales and a one-click locale switcher. Library-agnostic: works with Astro's built-in i18n, astro-i18next, Paraglide, or any manual JSON/YAML setup.

[![version](https://img.shields.io/npm/v/@shiftescape/astro-i18n-toolkit.svg?style=flat-square)](http://npm.im/@shiftescape/astro-i18n-toolkit) [![downloads](https://img.shields.io/npm/dm/@shiftescape/astro-i18n-toolkit.svg?style=flat-square)](https://npm-stat.com/charts.html?package=@shiftescape/astro-i18n-toolkit&from=2016-11-24) [![MIT License](https://img.shields.io/npm/l/@shiftescape/astro-i18n-toolkit.svg?style=flat-square)](http://opensource.org/licenses/MIT)

## Features

- 🗺 **Coverage map** — scans all locale files and shows every key as green (complete), amber (fallback), or red (missing), per locale
- 📊 **Per-locale summary** — coverage % badge per locale at a glance
- 🔍 **Searchable** — filter keys by name or reference value in real time
- 🌐 **Locale switcher** — one-click locale switching via injected middleware, no URL editing required
- ⚙️ **Library-agnostic** — reads JSON or YAML locale files directly; works alongside any i18n library
- 🔒 **Dev-only** — completely stripped in `astro build`, zero production footprint

## Install

```bash
npm install -D @shiftescape/astro-i18n-toolkit
```

## Usage

```js
// astro.config.mjs
import { defineConfig } from "astro/config";
import i18nToolkit from "@shiftescape/astro-i18n-toolkit";

export default defineConfig({
  i18n: {
    defaultLocale: "en",
    locales: ["en", "fr", "de"],
  },
  integrations: [i18nToolkit()],
});
```

Your locale files should live at `src/locales/` by default:

```
src/locales/
  en.json   ← reference locale
  fr.json
  de.json
```

Open your site with `astro dev` and click the globe icon in the dev toolbar.

### With options

```js
i18nToolkit({
  localesDir: "./src/i18n", // path to locale files
  defaultLocale: "en", // reference locale for coverage diff
  format: "json", // 'json' | 'yaml'
});
```

## Options

| Option          | Type               | Default           | Description                                         |
| --------------- | ------------------ | ----------------- | --------------------------------------------------- |
| `localesDir`    | `string`           | `'./src/locales'` | Path to locale files, relative to project root      |
| `defaultLocale` | `string`           | `'en'`            | Reference locale — all others compared against this |
| `format`        | `'json' \| 'yaml'` | `'json'`          | File format of translation files                    |

## License

MIT © [Alvin James Bellero](https://github.com/shiftEscape)
