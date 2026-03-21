import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";
import { collectAssets, collectPages } from "./collect.js";
import { checkFileBudgets, checkPageBudgets } from "./check.js";
import {
  printAssetTable,
  printPageSummary,
  printStatus,
  printViolations,
} from "./print.js";
import { writeReport } from "./report.js";
import { getToolbarEntry } from "./toolbar.js";
import type {
  AssetInfo,
  BudgetViolation,
  BundleBudgetOptions,
} from "./types.js";

export type {
  BundleBudgetOptions,
  BudgetRule,
  PageBudget,
  AssetType,
} from "./types.js";

// In-memory cache of the last build stats — served to the Dev Toolbar
let cachedStats: {
  assets: AssetInfo[];
  totalJsBytes: number;
  totalCssBytes: number;
  violations: BudgetViolation[];
} | null = null;

/**
 * astro-bundle-budget
 *
 * Build-time JS/CSS bundle size budgets for Astro.
 * Hooks into astro:build:done to inspect generated assets and fail the build
 * when pages exceed configured thresholds.
 *
 * Also registers a Dev Toolbar app for live bundle inspection during astro dev.
 *
 * @example
 * ```js
 * // astro.config.mjs
 * import { defineConfig } from 'astro/config'
 * import bundleBudget from 'astro-bundle-budget'
 *
 * export default defineConfig({
 *   integrations: [
 *     bundleBudget({
 *       budgets: [
 *         { path: '**\/*.js', budget: '100 kB' },
 *         { path: '**\/*.css', budget: '20 kB' },
 *       ],
 *       pageBudgets: [
 *         { type: 'js',    budget: '150 kB' },
 *         { type: 'total', budget: '200 kB', compression: 'gzip' },
 *       ],
 *     })
 *   ]
 * })
 * ```
 */
export default function bundleBudget(
  options: BundleBudgetOptions = {},
): AstroIntegration {
  const config: Required<BundleBudgetOptions> = {
    budgets: options.budgets ?? [],
    pageBudgets: options.pageBudgets ?? [],
    include: options.include ?? ["js", "css"],
    failOnExceed: options.failOnExceed ?? true,
    report: options.report ?? false,
    reportPath: options.reportPath ?? "bundle-budget-report.json",
    verbose: options.verbose ?? false,
  };

  let outDir: URL;

  return {
    name: "astro-bundle-budget",
    hooks: {
      // -----------------------------------------------------------------
      // Register the Dev Toolbar panel + a Vite plugin that serves the
      // cached stats JSON to the panel during `astro dev`.
      // -----------------------------------------------------------------
      "astro:config:setup": ({ addDevToolbarApp, updateConfig }) => {
        // Register the toolbar panel (gauge icon, shadow-DOM panel)
        addDevToolbarApp(getToolbarEntry(config));

        // Inject a tiny Vite middleware that serves cached build stats
        // at /__bundle-budget/stats so the toolbar can read them.
        updateConfig({
          vite: {
            plugins: [
              {
                name: "astro-bundle-budget:dev-server",
                configureServer(server) {
                  server.middlewares.use(
                    "/__bundle-budget/stats",
                    (_req, res) => {
                      res.setHeader("Content-Type", "application/json");
                      res.setHeader("Access-Control-Allow-Origin", "*");
                      if (cachedStats) {
                        res.end(JSON.stringify(cachedStats));
                      } else {
                        res.statusCode = 404;
                        res.end(
                          JSON.stringify({
                            error:
                              "No stats cached yet — run astro build first.",
                          }),
                        );
                      }
                    },
                  );
                },
              },
            ],
          },
        });
      },

      // -----------------------------------------------------------------
      // Capture outDir after full config resolution.
      // -----------------------------------------------------------------
      "astro:config:done": ({ config: astroConfig }) => {
        outDir = astroConfig.outDir;
      },

      // -----------------------------------------------------------------
      // Main audit — runs after all HTML + assets are on disk.
      // -----------------------------------------------------------------
      "astro:build:done": async ({ logger }) => {
        const outPath = fileURLToPath(outDir);
        logger.info("Analysing bundle...");

        // 1. Collect all JS/CSS assets
        const assets = await collectAssets(outPath);
        if (!assets.length) {
          logger.warn(
            "No JS or CSS assets found in build output. Nothing to audit.",
          );
          return;
        }

        // 2. Build per-page asset map (needed for pageBudgets + verbose)
        const needsPages = config.pageBudgets.length > 0 || config.verbose;
        const pages = needsPages ? await collectPages(outPath, assets) : [];

        // 3. Print asset table
        printAssetTable(assets, config.verbose);

        // 4. Per-page summary (when pageBudgets are configured)
        if (config.pageBudgets.length > 0) {
          printPageSummary(pages);
        }

        // 5. Check per-file budgets
        const fileViolations = await checkFileBudgets(assets, config.budgets);

        // 6. Check per-page budgets
        const pageViolations = await checkPageBudgets(
          pages,
          config.pageBudgets,
        );

        const allViolations = [...fileViolations, ...pageViolations];

        // 7. Cache for Dev Toolbar — accessible on next `astro dev`
        cachedStats = {
          assets,
          totalJsBytes: assets
            .filter((a) => a.type === "js")
            .reduce((s, a) => s + a.sizeBytes, 0),
          totalCssBytes: assets
            .filter((a) => a.type === "css")
            .reduce((s, a) => s + a.sizeBytes, 0),
          violations: allViolations,
        };

        // 8. Print violations
        const hasErrors = printViolations(allViolations);

        // 9. Write JSON report if requested
        if (config.report) {
          const dest = await writeReport({
            outDir: outPath,
            reportPath: config.reportPath,
            assets,
            pages,
            violations: allViolations,
          });
          printStatus(!hasErrors, dest);
        } else {
          printStatus(!hasErrors);
        }

        // 10. Fail the build on error-level violations
        if (hasErrors && config.failOnExceed) {
          const count = allViolations.filter(
            (v) => v.severity === "error",
          ).length;
          logger.error(
            `Build failed: ${count} budget violation${count > 1 ? "s" : ""}. ` +
              `Set failOnExceed: false to demote to warnings.`,
          );
          process.exit(1);
        }
      },
    },
  };
}
