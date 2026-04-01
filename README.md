# astro-integrations

[![CI](https://github.com/shiftEscape/astro-integrations/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/shiftEscape/astro-integrations/actions/workflows/ci.yml)

📦 A collection of Astro integrations by [@shiftEscape](https://github.com/shiftEscape).

## Packages

| Package                                                                | Description                                                                                                               | npm                                                                                                                                       |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| [`@shiftescape/astro-bundle-budget`](./packages/astro-bundle-budget)   | Build-time JS/CSS bundle size budgets — fails the build when pages exceed your thresholds                                 | [![npm](https://img.shields.io/npm/v/@shiftescape/astro-bundle-budget)](https://www.npmjs.com/package/@shiftescape/astro-bundle-budget)   |
| [`@shiftescape/astro-env-inspector`](./packages/astro-env-inspector)   | Dev toolbar panel that shows your environment variables grouped, masked, and searchable                                   | [![npm](https://img.shields.io/npm/v/@shiftescape/astro-env-inspector)](https://www.npmjs.com/package/@shiftescape/astro-env-inspector)   |
| [`@shiftescape/astro-toolbar-routes`](./packages/astro-toolbar-routes) | Dev toolbar route map — clickable list of every route in your project, grouped and searchable                             | [![npm](https://img.shields.io/npm/v/@shiftescape/astro-toolbar-routes)](https://www.npmjs.com/package/@shiftescape/astro-toolbar-routes) |
| [`@shiftescape/astro-i18n-toolkit`](./packages/astro-i18n-toolkit)     | Dev toolbar i18n debugger — translation coverage map across all locales and a one-click locale switcher, library-agnostic | [![npm](https://img.shields.io/npm/v/@shiftescape/astro-i18n-toolkit)](https://www.npmjs.com/package/@shiftescape/astro-i18n-toolkit)     |

## Structure

```
astro-integrations/
├── packages/
│   ├── astro-bundle-budget/    # @shiftescape/astro-bundle-budget
│   ├── astro-env-inspector/    # @shiftescape/astro-env-inspector
│   ├── astro-toolbar-routes/   # @shiftescape/astro-toolbar-routes
│   └── astro-i18n-toolkit/     # @shiftescape/astro-i18n-toolkit
└── demo/                       # shared Astro site for local testing
```

## Getting started

```bash
npm install
```

## Development workflow

**Build a package:**

```bash
npm run build:bundle-budget
npm run build:env-inspector
npm run build:toolbar-routes
npm run build:i18n-toolkit
# or all at once:
npm run build:all
```

**Start the demo:**

```bash
npm run dev:demo
```

**Test bundle budgets:**

```bash
npm run build:demo
```

## Running tests

```bash
npm test --workspace=packages/astro-bundle-budget
npm test --workspace=packages/astro-env-inspector
npm test --workspace=packages/astro-toolbar-routes
npm test --workspace=packages/astro-i18n-toolkit
```

CI runs all test suites first, then publishes only the matching package.

## License

MIT © [Alvin James Bellero](https://github.com/shiftEscape)

## 🙏 Acknowledgements

Built with the [Astro Integration API](https://docs.astro.build/en/reference/integrations-reference/) and listed in the [Astro Integrations Library](https://astro.build/integrations/?search=%40shiftescape). 🌟
