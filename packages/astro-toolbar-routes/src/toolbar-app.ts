import { defineToolbarApp } from "astro/toolbar";
import type { RoutesPayload, RouteInfo } from "./types.js";

export default defineToolbarApp({
  init(canvas, app, server) {
    // -----------------------------------------------------------------------
    // State
    // -----------------------------------------------------------------------
    let payload: RoutesPayload | null = null;
    let searchQuery = "";
    let panelBuilt = false;
    let listWrap: HTMLDivElement | null = null;
    let countEl: HTMLSpanElement | null = null;

    // -----------------------------------------------------------------------
    // Request routes from server
    // -----------------------------------------------------------------------
    function requestRoutes() {
      const currentPath = window.location.pathname;
      server.send("astro-toolbar-routes:request", { currentPath });
    }

    requestRoutes();

    server.on<RoutesPayload>("astro-toolbar-routes:data", (data) => {
      payload = data;
      if (panelBuilt) {
        refreshList();
        updateCount();
      } else {
        buildPanel();
      }
    });

    app.onToggled(({ state }) => {
      if (state) {
        // Re-request on every open — picks up new routes added during dev
        requestRoutes();
      }
    });

    // -----------------------------------------------------------------------
    // Build the full panel — only once
    // -----------------------------------------------------------------------
    function buildPanel() {
      canvas.innerHTML = "";
      panelBuilt = false;

      const root = document.createElement("div");
      root.style.cssText = `
        position: fixed;
        bottom: 72px;
        left: 50%;
        transform: translateX(-50%);
        width: 600px;
        max-width: calc(100vw - 32px);
        max-height: 70vh;
        background: #0d1117;
        border: 1px solid #21262d;
        border-radius: 12px;
        font-family: ui-sans-serif, system-ui, sans-serif;
        font-size: 13px;
        color: #e6edf3;
        box-shadow: 0 24px 64px rgba(0,0,0,0.6);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        z-index: 9999;
      `;

      // ── Header ─────────────────────────────────────────────────────────────
      const header = document.createElement("div");
      header.style.cssText = `
        padding: 14px 16px 12px;
        border-bottom: 1px solid #21262d;
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-shrink: 0;
      `;

      const titleWrap = document.createElement("div");
      titleWrap.style.cssText = "display:flex;align-items:center;gap:10px";

      const title = document.createElement("span");
      title.style.cssText = "font-size:14px;font-weight:600;color:#e6edf3";
      title.textContent = "Route Map";

      countEl = document.createElement("span");
      countEl.style.cssText = `
        font-size:10px;font-weight:500;padding:2px 8px;
        border-radius:10px;background:#161b22;
        border:0.5px solid #30363d;color:#8b949e;
      `;

      titleWrap.appendChild(title);
      titleWrap.appendChild(countEl);
      header.appendChild(titleWrap);

      // Stats bar inline
      const statsBar = document.createElement("div");
      statsBar.id = "routes-stats";
      statsBar.style.cssText =
        "display:flex;gap:14px;font-size:11px;color:#8b949e";
      header.appendChild(statsBar);

      // ── Search ──────────────────────────────────────────────────────────────
      const searchWrap = document.createElement("div");
      searchWrap.style.cssText =
        "padding:10px 16px;border-bottom:1px solid #21262d;flex-shrink:0";

      const searchInput = document.createElement("input");
      searchInput.type = "text";
      searchInput.placeholder = "Search routes...";
      searchInput.value = searchQuery;
      searchInput.style.cssText = `
        width:100%;background:#010409;border:1px solid #21262d;
        border-radius:6px;color:#e6edf3;font-size:12px;
        font-family:ui-monospace,'Cascadia Code',monospace;
        padding:7px 10px;outline:none;box-sizing:border-box;
      `;
      searchInput.oninput = (e) => {
        searchQuery = (e.target as HTMLInputElement).value;
        refreshList();
      };
      searchWrap.appendChild(searchInput);

      // ── List ────────────────────────────────────────────────────────────────
      listWrap = document.createElement("div");
      listWrap.style.cssText = "overflow-y:auto;flex:1;padding:6px 0";

      root.appendChild(header);
      root.appendChild(searchWrap);
      root.appendChild(listWrap);
      canvas.appendChild(root);

      panelBuilt = true;
      updateCount();
      refreshList();

      setTimeout(() => searchInput.focus(), 50);
    }

    // -----------------------------------------------------------------------
    // Update count badge
    // -----------------------------------------------------------------------
    function updateCount() {
      if (!countEl || !payload) return;
      countEl.textContent = `${payload.total} routes`;

      const statsBar = canvas.querySelector(
        "#routes-stats",
      ) as HTMLElement | null;
      if (!statsBar) return;
      statsBar.innerHTML = `
        <span style="color:#3fb950">● ${payload.staticCount} static</span>
        <span style="color:#f85149">● ${payload.ssrCount} SSR</span>
        <span style="color:#58a6ff">● ${payload.endpointCount} endpoints</span>
      `;
    }

    // -----------------------------------------------------------------------
    // Refresh only the list — scroll preserved
    // -----------------------------------------------------------------------
    function refreshList() {
      if (!listWrap || !payload) return;

      const savedScroll = listWrap.scrollTop;
      listWrap.innerHTML = "";

      const q = searchQuery.toLowerCase();
      const filtered = payload.routes.filter(
        (r) =>
          r.pattern.toLowerCase().includes(q) ||
          r.component.toLowerCase().includes(q),
      );

      if (filtered.length === 0) {
        const empty = document.createElement("div");
        empty.style.cssText =
          "text-align:center;color:#484f58;padding:28px 16px;font-size:12px";
        empty.textContent = searchQuery
          ? "No routes match your search."
          : "No routes found.";
        listWrap.appendChild(empty);
        return;
      }

      // Group by kind
      const groups: Record<string, RouteInfo[]> = {};
      for (const r of filtered) {
        if (!groups[r.kind]) groups[r.kind] = [];
        groups[r.kind].push(r);
      }

      const kindOrder = ["page", "endpoint", "redirect", "fallback", "other"];
      for (const kind of kindOrder) {
        if (!groups[kind]?.length) continue;

        const groupHeader = document.createElement("div");
        groupHeader.style.cssText = `
          padding:6px 16px 3px;font-size:10px;font-weight:600;
          text-transform:uppercase;letter-spacing:.09em;color:${kindColor(kind)};
        `;
        groupHeader.textContent = kindLabel(kind);
        listWrap.appendChild(groupHeader);

        for (const route of groups[kind]) {
          listWrap.appendChild(makeRow(route, payload!.currentPath));
        }
      }

      listWrap.scrollTop = savedScroll;
    }

    // -----------------------------------------------------------------------
    // Build a single route row
    // -----------------------------------------------------------------------
    function makeRow(route: RouteInfo, currentPath: string): HTMLElement {
      const isActive =
        currentPath === route.pattern ||
        (!route.isDynamic && currentPath === route.pattern);
      const isNavigable = !route.isDynamic && route.kind !== "endpoint";

      const row = document.createElement("div");
      row.style.cssText = `
        display:flex;align-items:center;gap:10px;
        padding:7px 16px;
        cursor:${isNavigable ? "pointer" : "default"};
        background:${isActive ? "rgba(56,139,253,.08)" : "transparent"};
        border-left:2px solid ${isActive ? "#388bfd" : "transparent"};
        transition:background .1s;
      `;
      if (isNavigable) {
        row.onmouseenter = () => {
          if (!isActive) row.style.background = "#161b22";
        };
        row.onmouseleave = () => {
          if (!isActive) row.style.background = "transparent";
        };
        row.onclick = () => {
          window.location.href = route.pattern;
        };
      }

      // Render mode dot
      const dot = document.createElement("span");
      dot.style.cssText = `
        width:7px;height:7px;border-radius:50%;flex-shrink:0;
        background:${route.renderMode === "static" ? "#3fb950" : "#f85149"};
      `;
      dot.title =
        route.renderMode === "static"
          ? "Static (prerendered)"
          : "SSR (on-demand)";

      // Pattern
      const patternEl = document.createElement("span");
      patternEl.style.cssText = `
        font-family:ui-monospace,'Cascadia Code',monospace;
        font-size:12px;
        color:${route.isDynamic ? "#e3b341" : "#e6edf3"};
        flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
      `;
      // Highlight dynamic segments
      patternEl.innerHTML = route.pattern
        .replace(/(\[.*?\])/g, '<span style="color:#e3b341">$1</span>')
        .replace(/(\[\.\.\..*?\])/g, '<span style="color:#e3b341">$1</span>');

      // Tags
      const tags = document.createElement("div");
      tags.style.cssText = "display:flex;gap:5px;flex-shrink:0";

      if (route.renderMode === "ssr") {
        tags.appendChild(makeTag("SSR", "#f85149", "#2d1316"));
      }
      if (route.isDynamic) {
        tags.appendChild(makeTag("dynamic", "#e3b341", "#2d2612"));
      }
      if (route.kind === "endpoint") {
        tags.appendChild(makeTag("endpoint", "#58a6ff", "#0d1b2d"));
      }
      if (route.kind === "redirect") {
        tags.appendChild(makeTag("redirect", "#bc8cff", "#1a1030"));
      }

      // Navigate arrow (only for navigable static routes)
      if (isNavigable) {
        const arrow = document.createElement("span");
        arrow.style.cssText = "color:#484f58;font-size:11px;flex-shrink:0";
        arrow.textContent = "→";
        tags.appendChild(arrow);
      }

      row.appendChild(dot);
      row.appendChild(patternEl);
      row.appendChild(tags);

      return row;
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------
    function makeTag(text: string, color: string, bg: string): HTMLElement {
      const t = document.createElement("span");
      t.style.cssText = `
        font-size:10px;font-weight:500;padding:1px 6px;
        border-radius:10px;background:${bg};color:${color};
        border:0.5px solid ${color}33;
      `;
      t.textContent = text;
      return t;
    }

    function kindLabel(kind: string): string {
      switch (kind) {
        case "page":
          return "📄 Pages";
        case "endpoint":
          return "⚡ Endpoints";
        case "redirect":
          return "↩ Redirects";
        case "fallback":
          return "🔀 Fallbacks";
        default:
          return "📦 Other";
      }
    }

    function kindColor(kind: string): string {
      switch (kind) {
        case "page":
          return "#8b949e";
        case "endpoint":
          return "#58a6ff";
        case "redirect":
          return "#bc8cff";
        default:
          return "#484f58";
      }
    }
  },
});
