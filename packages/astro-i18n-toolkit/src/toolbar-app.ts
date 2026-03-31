import { defineToolbarApp } from "astro/toolbar";
import type {
  CoveragePayload,
  KeyCoverage,
  LocaleCoverage,
  ToolkitConfigPayload,
  LocaleSwitchPayload,
} from "./types.js";
import { LOCALE_COOKIE } from "./types.js";

export default defineToolbarApp({
  init(canvas, app, server) {
    // -----------------------------------------------------------------------
    // State
    // -----------------------------------------------------------------------
    let config: ToolkitConfigPayload | null = null;
    let coverage: CoveragePayload | null = null;
    let activeTab: "coverage" | "switcher" = "coverage";
    let searchQuery = "";
    let activeFilter: "all" | "missing" | "fallback" | "complete" = "all";
    let panelBuilt = false;
    let listWrap: HTMLDivElement | null = null;
    let summaryBar: HTMLDivElement | null = null;
    let localeButtons: HTMLDivElement | null = null;

    // -----------------------------------------------------------------------
    // Bootstrap
    // -----------------------------------------------------------------------
    server.send("astro-i18n-toolkit:ready", {});

    server.on<ToolkitConfigPayload>("astro-i18n-toolkit:config", (data) => {
      config = data;
    });

    server.on<CoveragePayload>("astro-i18n-toolkit:coverage", (data) => {
      coverage = data;
      if (panelBuilt) {
        updateSummaryBar();
        refreshList();
        updateLocaleButtons();
      } else buildPanel();
    });

    app.onToggled(({ state }) => {
      if (state) {
        server.send("astro-i18n-toolkit:request-coverage", {});
        if (!panelBuilt && coverage) buildPanel();
      }
    });

    // -----------------------------------------------------------------------
    // Build panel once
    // -----------------------------------------------------------------------
    function buildPanel() {
      canvas.innerHTML = "";
      panelBuilt = false;

      const root = document.createElement("div");
      root.style.cssText = `
        position:fixed;bottom:72px;left:50%;transform:translateX(-50%);
        width:660px;max-width:calc(100vw - 32px);max-height:74vh;
        background:#0d1117;border:1px solid #21262d;border-radius:12px;
        font-family:ui-sans-serif,system-ui,sans-serif;font-size:13px;
        color:#e2e8f0;box-shadow:0 20px 60px rgba(0,0,0,.6);
        display:flex;flex-direction:column;overflow:hidden;z-index:9999;
      `;

      // ── Header ──
      const header = document.createElement("div");
      header.style.cssText = `
        padding:12px 16px 0;border-bottom:1px solid #21262d;flex-shrink:0;
      `;

      const titleRow = document.createElement("div");
      titleRow.style.cssText =
        "display:flex;align-items:center;gap:10px;padding-bottom:10px";

      const title = document.createElement("span");
      title.style.cssText =
        "font-size:14px;font-weight:600;color:#e2e8f0;display:flex;align-items:center;gap:8px";
      title.innerHTML = "i18n Toolkit";

      summaryBar = document.createElement("div");
      summaryBar.style.cssText =
        "display:flex;gap:12px;font-size:11px;margin-left:auto";

      titleRow.appendChild(title);
      titleRow.appendChild(summaryBar);
      header.appendChild(titleRow);

      // Tabs
      const tabs = document.createElement("div");
      tabs.style.cssText = "display:flex;gap:0";
      tabs.appendChild(
        makeTab("Coverage map", activeTab === "coverage", () =>
          switchTab("coverage", tabs, contentArea),
        ),
      );
      tabs.appendChild(
        makeTab("Locale switcher", activeTab === "switcher", () =>
          switchTab("switcher", tabs, contentArea),
        ),
      );
      header.appendChild(tabs);

      // Content area
      const contentArea = document.createElement("div");
      contentArea.style.cssText =
        "display:flex;flex-direction:column;flex:1;overflow:hidden";

      root.appendChild(header);
      root.appendChild(contentArea);
      canvas.appendChild(root);

      panelBuilt = true;
      renderTabContent(contentArea);
      updateSummaryBar();
    }

    // -----------------------------------------------------------------------
    // Tab switching
    // -----------------------------------------------------------------------
    function switchTab(
      tab: typeof activeTab,
      tabsEl: HTMLElement,
      contentEl: HTMLElement,
    ) {
      activeTab = tab;
      Array.from(tabsEl.children).forEach((t, i) => {
        const labels = ["coverage", "switcher"];
        styleTab(t as HTMLElement, labels[i] === tab);
      });
      contentEl.innerHTML = "";
      renderTabContent(contentEl);
    }

    function renderTabContent(container: HTMLElement) {
      if (activeTab === "coverage") renderCoverageTab(container);
      else renderSwitcherTab(container);
    }

    // -----------------------------------------------------------------------
    // Coverage tab
    // -----------------------------------------------------------------------
    function renderCoverageTab(container: HTMLElement) {
      // Filter + search bar
      const controls = document.createElement("div");
      controls.style.cssText =
        "padding:8px 16px;border-bottom:1px solid #21262d;display:flex;gap:6px;align-items:center;flex-shrink:0";

      const filterBtns: Array<[string, typeof activeFilter]> = [
        ["all", "all"],
        ["missing", "missing"],
        ["fallback", "fallback"],
        ["complete", "complete"],
      ];
      filterBtns.forEach(([label, val]) => {
        const btn = makeFilterBtn(label, activeFilter === val);
        btn.onclick = () => {
          activeFilter = val;
          controls
            .querySelectorAll("button")
            .forEach((b, i) =>
              styleFilterBtn(b as HTMLButtonElement, filterBtns[i][1] === val),
            );
          refreshList();
        };
        controls.appendChild(btn);
      });

      const spacer = document.createElement("div");
      spacer.style.cssText = "flex:1";
      controls.appendChild(spacer);

      const searchInput = document.createElement("input");
      searchInput.type = "text";
      searchInput.placeholder = "Search keys…";
      searchInput.value = searchQuery;
      searchInput.style.cssText = `
        background:#010409;border:1px solid #21262d;border-radius:6px;
        color:#e2e8f0;font-size:11px;font-family:ui-monospace,monospace;
        padding:5px 9px;outline:none;width:160px;
      `;
      searchInput.oninput = (e) => {
        searchQuery = (e.target as HTMLInputElement).value;
        refreshList();
      };
      controls.appendChild(searchInput);

      // List
      listWrap = document.createElement("div");
      listWrap.style.cssText = "overflow-y:auto;flex:1;padding:4px 0";

      container.appendChild(controls);
      container.appendChild(listWrap);
      refreshList();
    }

    // -----------------------------------------------------------------------
    // Switcher tab
    // -----------------------------------------------------------------------
    function renderSwitcherTab(container: HTMLElement) {
      const wrap = document.createElement("div");
      wrap.style.cssText = "padding:24px 20px;flex:1";

      const intro = document.createElement("p");
      intro.style.cssText =
        "font-size:13px;color:#8b949e;margin-bottom:20px;line-height:1.6";
      intro.textContent =
        "Switch the active locale for this page without manually changing the URL. The page will reload in the selected locale.";
      wrap.appendChild(intro);

      const currentRow = document.createElement("div");
      currentRow.style.cssText =
        "display:flex;align-items:center;gap:10px;margin-bottom:20px;font-size:12px;color:#8b949e";
      currentRow.innerHTML = `
        <span>Current locale:</span>
        <span style="font-family:ui-monospace,monospace;font-size:12px;color:#58a6ff;
          background:#0d1b2d;border:0.5px solid #1a3a5c;padding:2px 10px;border-radius:10px">
          ${config?.currentLocale ?? "—"}
        </span>
      `;
      wrap.appendChild(currentRow);

      const label = document.createElement("div");
      label.style.cssText =
        "font-size:11px;font-weight:500;color:#484f58;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px";
      label.textContent = "Switch to";
      wrap.appendChild(label);

      localeButtons = document.createElement("div");
      localeButtons.style.cssText = "display:flex;gap:8px;flex-wrap:wrap";
      wrap.appendChild(localeButtons);
      updateLocaleButtons();

      container.appendChild(wrap);
    }

    function updateLocaleButtons() {
      if (!localeButtons || !config) return;
      localeButtons.innerHTML = "";

      config.locales.forEach((locale) => {
        const isCurrent = locale === config!.currentLocale;
        const btn = document.createElement("button");
        btn.style.cssText = `
          font-size:13px;font-weight:500;padding:8px 20px;
          border-radius:8px;cursor:${isCurrent ? "default" : "pointer"};
          border:1px solid ${isCurrent ? "#388bfd" : "#30363d"};
          background:${isCurrent ? "#0d1b2d" : "#161b22"};
          color:${isCurrent ? "#58a6ff" : "#c9d1d9"};
          font-family:ui-sans-serif,system-ui,sans-serif;
          transition:all .15s;
        `;
        btn.textContent = locale + (isCurrent ? " ✓" : "");
        btn.title = isCurrent ? "Current locale" : `Switch to ${locale}`;
        if (!isCurrent) {
          btn.onmouseenter = () => {
            btn.style.borderColor = "#58a6ff";
            btn.style.color = "#58a6ff";
          };
          btn.onmouseleave = () => {
            btn.style.borderColor = "#30363d";
            btn.style.color = "#c9d1d9";
          };
          btn.onclick = () => switchLocale(locale);
        }
        localeButtons!.appendChild(btn);
      });
    }

    function switchLocale(locale: string) {
      const currentPath = window.location.pathname;
      // Send to server — server computes the redirected URL and responds
      const payload: LocaleSwitchPayload = { locale, currentUrl: currentPath };
      server.send("astro-i18n-toolkit:switch-locale", payload);
    }

    server.on<{ redirectUrl: string }>(
      "astro-i18n-toolkit:redirect",
      ({ redirectUrl }) => {
        // Set cookie — middleware will pick it up on the redirected request
        document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(redirectUrl)}; path=/; max-age=5; SameSite=Lax`;
        // Navigate — middleware reads cookie and redirects properly
        window.location.href = redirectUrl;
      },
    );

    // -----------------------------------------------------------------------
    // Update summary bar in header
    // -----------------------------------------------------------------------
    function updateSummaryBar() {
      if (!summaryBar || !coverage) return;
      const missing = coverage.keys.filter(
        (k) => k.status === "missing",
      ).length;
      const fallback = coverage.keys.filter(
        (k) => k.status === "fallback",
      ).length;
      const total = coverage.totalKeys;
      summaryBar.innerHTML = `
        <span style="color:#f85149">✗ ${missing} missing</span>
        <span style="color:#d29922">~ ${fallback} fallback</span>
        <span style="color:#8b949e">${total} keys</span>
      `;
    }

    // -----------------------------------------------------------------------
    // Refresh the coverage list (scroll preserved)
    // -----------------------------------------------------------------------
    function refreshList() {
      if (!listWrap || !coverage) return;
      const saved = listWrap.scrollTop;
      listWrap.innerHTML = "";

      let filtered = coverage.keys.filter((k) => {
        const q = searchQuery.toLowerCase();
        const matchesSearch =
          !q ||
          k.key.toLowerCase().includes(q) ||
          k.referenceValue.toLowerCase().includes(q);
        const matchesFilter =
          activeFilter === "all" || k.status === activeFilter;
        return matchesSearch && matchesFilter;
      });

      if (filtered.length === 0) {
        const empty = document.createElement("div");
        empty.style.cssText =
          "text-align:center;color:#484f58;padding:28px;font-size:12px";
        empty.textContent = searchQuery
          ? "No keys match your search."
          : "No locale files found. Check your localesDir config.";
        listWrap.appendChild(empty);
        listWrap.scrollTop = saved;
        return;
      }

      // Group header: per-locale summary pills at top
      if (
        coverage.summary.length > 0 &&
        activeFilter === "all" &&
        !searchQuery
      ) {
        const summaryRow = document.createElement("div");
        summaryRow.style.cssText =
          "display:flex;gap:8px;flex-wrap:wrap;padding:8px 16px 4px";
        coverage.summary.forEach((s) => {
          const pill = document.createElement("div");
          const pct = s.percent;
          const color =
            pct === 100 ? "#3fb950" : pct >= 80 ? "#d29922" : "#f85149";
          pill.style.cssText = `
            font-size:11px;padding:4px 10px;border-radius:8px;
            background:#161b22;border:0.5px solid #30363d;
            display:flex;align-items:center;gap:6px;
          `;
          pill.innerHTML = `
            <span style="font-family:ui-monospace,monospace;color:#e2e8f0;font-weight:500">${s.locale}</span>
            <span style="color:${color};font-weight:600">${pct}%</span>
            <span style="color:#484f58">${s.complete}/${s.total}</span>
          `;
          summaryRow.appendChild(pill);
        });
        listWrap.appendChild(summaryRow);
      }

      // Key rows
      filtered.forEach((key) => listWrap!.appendChild(makeKeyRow(key)));
      listWrap.scrollTop = saved;
    }

    // -----------------------------------------------------------------------
    // Build a single key row
    // -----------------------------------------------------------------------
    function makeKeyRow(k: KeyCoverage): HTMLElement {
      const row = document.createElement("div");
      row.style.cssText = `
        display:flex;align-items:flex-start;gap:9px;
        padding:6px 16px;transition:background .1s;
        border-left:2px solid ${statusColor(k.status)};
      `;
      row.onmouseenter = () => (row.style.background = "#111822");
      row.onmouseleave = () => (row.style.background = "transparent");

      const dot = document.createElement("span");
      dot.style.cssText = `width:7px;height:7px;border-radius:50%;flex-shrink:0;margin-top:4px;background:${statusColor(k.status)}`;

      const main = document.createElement("div");
      main.style.cssText = "flex:1;min-width:0";

      const keyEl = document.createElement("div");
      keyEl.style.cssText =
        "font-family:ui-monospace,monospace;font-size:12px;color:#e2e8f0;margin-bottom:2px";
      keyEl.textContent = k.key;

      const meta = document.createElement("div");
      meta.style.cssText =
        "display:flex;gap:6px;align-items:center;flex-wrap:wrap";

      if (k.referenceValue) {
        const val = document.createElement("span");
        val.style.cssText =
          "font-size:11px;color:#6e7681;font-style:italic;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
        val.textContent = `"${k.referenceValue}"`;
        meta.appendChild(val);
      }

      if (k.missingIn.length > 0) {
        k.missingIn.forEach((locale) => {
          const badge = document.createElement("span");
          badge.style.cssText = `
            font-size:10px;font-weight:500;padding:1px 6px;border-radius:10px;
            background:#2d1316;color:#f85149;border:0.5px solid #f8514933;
            font-family:ui-monospace,monospace;
          `;
          badge.textContent = `missing: ${locale}`;
          meta.appendChild(badge);
        });
      }

      main.appendChild(keyEl);
      main.appendChild(meta);

      const statusBadge = makeStatusBadge(k.status);

      row.appendChild(dot);
      row.appendChild(main);
      row.appendChild(statusBadge);

      const divider = document.createElement("div");
      divider.style.cssText = "height:0.5px;background:#161b22;margin:0 16px";
      const wrapper = document.createElement("div");
      wrapper.appendChild(row);
      wrapper.appendChild(divider);
      return wrapper;
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------
    function makeTab(
      label: string,
      active: boolean,
      onClick: () => void,
    ): HTMLElement {
      const tab = document.createElement("button");
      styleTab(tab, active);
      tab.textContent = label;
      tab.onclick = onClick;
      return tab;
    }

    function styleTab(el: HTMLElement, active: boolean) {
      el.style.cssText = `
        font-size:12px;padding:8px 14px;cursor:pointer;
        border:none;border-bottom:2px solid ${active ? "#58a6ff" : "transparent"};
        background:transparent;color:${active ? "#e2e8f0" : "#8b949e"};
        font-family:ui-sans-serif,system-ui,sans-serif;transition:color .15s;
      `;
    }

    function makeFilterBtn(label: string, active: boolean): HTMLButtonElement {
      const btn = document.createElement("button");
      styleFilterBtn(btn, active);
      btn.textContent = label;
      return btn;
    }

    function styleFilterBtn(btn: HTMLButtonElement, active: boolean) {
      btn.style.cssText = `
        font-size:11px;padding:3px 9px;border-radius:100px;
        border:0.5px solid ${active ? "#30363d" : "#21262d"};
        background:${active ? "#21262d" : "transparent"};
        color:${active ? "#e2e8f0" : "#8b949e"};cursor:pointer;
        font-family:ui-sans-serif,system-ui,sans-serif;
      `;
    }

    function makeStatusBadge(status: string): HTMLElement {
      const colors: Record<string, [string, string]> = {
        complete: ["#0d2e0d", "#3fb950"],
        fallback: ["#1a1a0d", "#d29922"],
        missing: ["#2d1316", "#f85149"],
      };
      const [bg, fg] = colors[status] || colors.missing;
      const b = document.createElement("span");
      b.style.cssText = `
        font-size:10px;font-weight:500;padding:1px 7px;border-radius:10px;
        background:${bg};color:${fg};border:0.5px solid ${fg}33;flex-shrink:0;
      `;
      b.textContent = status;
      return b;
    }

    function statusColor(status: string): string {
      return status === "complete"
        ? "#3fb950"
        : status === "fallback"
          ? "#d29922"
          : "#f85149";
    }
  },
});
