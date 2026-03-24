# 📦 astro-integrations

A collection of Astro integrations by [@shiftEscape](https://github.com/shiftEscape).

## Packages

| Package                                                                | Description                                                                                   | npm                                                                                                                                       |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| [`@shiftescape/astro-bundle-budget`](./packages/astro-bundle-budget)   | Build-time JS/CSS bundle size budgets — fails the build when pages exceed your thresholds     | [![npm](https://img.shields.io/npm/v/@shiftescape/astro-bundle-budget)](https://www.npmjs.com/package/@shiftescape/astro-bundle-budget)   |
| [`@shiftescape/astro-env-inspector`](./packages/astro-env-inspector)   | Dev toolbar panel that shows your environment variables grouped, masked, and searchable       | [![npm](https://img.shields.io/npm/v/@shiftescape/astro-env-inspector)](https://www.npmjs.com/package/@shiftescape/astro-env-inspector)   |
| [`@shiftescape/astro-toolbar-routes`](./packages/astro-toolbar-routes) | Dev toolbar route map — clickable list of every route in your project, grouped and searchable | [![npm](https://img.shields.io/npm/v/@shiftescape/astro-toolbar-routes)](https://www.npmjs.com/package/@shiftescape/astro-toolbar-routes) |

## Structure

```
astro-integrations/
├── packages/
│   ├── astro-bundle-budget/   # @shiftescape/astro-bundle-budget
│   ├── astro-env-inspector/   # @shiftescape/astro-env-inspector
│   └── astro-toolbar-routes/  # @shiftescape/astro-toolbar-routes
└── demo/                      # shared Astro site for local testing
```

## Getting started

Install all workspace dependencies from the root:

```bash
npm install
```

## Development workflow

**1. Build a package** (required before testing in the demo):

```bash
npm run build:bundle-budget
npm run build:env-inspector
npm run build:toolbar-routes
# or build all at once
npm run build:all
```

Or keep a package watching in a separate terminal:

```bash
cd packages/astro-bundle-budget  && npm run dev
cd packages/astro-env-inspector  && npm run dev
cd packages/astro-toolbar-routes && npm run dev
```

**2. Start the demo** to test all integrations live:

```bash
npm run dev:demo
```

**3. Test bundle budgets** (requires a full build):

```bash
npm run build:demo
```

## Running tests

```bash
npm test --workspace=packages/astro-bundle-budget
npm test --workspace=packages/astro-env-inspector
npm test --workspace=packages/astro-toolbar-routes
```

CI runs all tests first, then publishes only the matching package.

## License

MIT © [Alvin James Bellero](https://github.com/shiftEscape)

## 🙏 Acknowledgements

Built with the [Astro Integration API](https://docs.astro.build/en/reference/integrations-reference/) and listed in the [Astro Integrations Library](https://astro.build/integrations/?search=%40shiftescape). 🌟
