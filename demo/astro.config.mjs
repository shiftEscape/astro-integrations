import { defineConfig } from "astro/config";
import bundleBudget from "@shiftescape/astro-bundle-budget";
import envInspector from "@shiftescape/astro-env-inspector";
import toolbarRoutes from "@shiftescape/astro-toolbar-routes";
import i18nToolkit from "@shiftescape/astro-i18n-toolkit";

export default defineConfig({
  vite: {
    build: {
      assetsInlineLimit: 0, // force all assets to be emitted as files
    },
  },
  integrations: [
    bundleBudget({
      budgets: [{ path: "**/*.js", budget: "2B" }],
      verbose: true,
    }),
    envInspector(),
    toolbarRoutes(),
    i18nToolkit({ localesDir: "./src/locales", defaultLocale: "en" }),
  ],
});
