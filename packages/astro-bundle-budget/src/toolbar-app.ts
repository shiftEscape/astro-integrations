/**
 * Astro Dev Toolbar app — bundle size inspector.
 *
 * This file runs in the browser as part of the Astro Dev Toolbar.
 * It fetches bundle metadata from the /__bundle-budget/stats endpoint
 * (served by the Vite dev plugin) and renders a live size panel.
 *
 * The entire file is excluded from production builds.
 */

// Astro toolbar apps export a default defineToolbarApp object.
// Using a dynamic import guard so this module is never included in prod bundles.

export default {
  id: 'astro-bundle-budget',

  init(canvas: ShadowRoot, eventTarget: EventTarget) {
    // -----------------------------------------------------------------------
    // Styles (scoped to shadow DOM — won't leak into the page)
    // -----------------------------------------------------------------------
    const style = document.createElement('style')
    style.textContent = `
      :host { font-family: ui-sans-serif, system-ui, sans-serif; }

      .panel {
        background: #1a1a2e;
        border: 1px solid #2e2e50;
        border-radius: 12px;
        padding: 16px 20px;
        min-width: 340px;
        max-width: 480px;
        color: #e2e2f0;
        font-size: 13px;
        line-height: 1.5;
      }

      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 14px;
        padding-bottom: 10px;
        border-bottom: 1px solid #2e2e50;
      }

      .title {
        font-size: 14px;
        font-weight: 600;
        color: #ffffff;
        display: flex;
        align-items: center;
        gap: 7px;
      }

      .dot { width: 8px; height: 8px; border-radius: 50%; background: #7c6af7; }
      .dot.ok { background: #4ade80; }
      .dot.warn { background: #f59e0b; }
      .dot.error { background: #f87171; }

      .refresh-btn {
        background: none;
        border: 1px solid #3e3e60;
        color: #9898b8;
        border-radius: 6px;
        padding: 3px 9px;
        cursor: pointer;
        font-size: 11px;
        transition: border-color .15s, color .15s;
      }
      .refresh-btn:hover { border-color: #7c6af7; color: #e2e2f0; }

      table { width: 100%; border-collapse: collapse; }
      th {
        text-align: left;
        font-size: 11px;
        font-weight: 500;
        color: #6666aa;
        text-transform: uppercase;
        letter-spacing: .05em;
        padding: 0 0 6px;
      }
      th:not(:first-child) { text-align: right; }

      td { padding: 4px 0; border-bottom: 1px solid #1e1e38; }
      td:not(:first-child) { text-align: right; font-variant-numeric: tabular-nums; }
      tr:last-child td { border-bottom: none; }

      .name { color: #c0c0e0; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .type-js  { color: #7c6af7; font-size: 11px; font-weight: 600; }
      .type-css { color: #f59e0b; font-size: 11px; font-weight: 600; }
      .size { color: #e2e2f0; }
      .size.over { color: #f87171; font-weight: 600; }

      .footer {
        margin-top: 12px;
        padding-top: 10px;
        border-top: 1px solid #2e2e50;
        display: flex;
        justify-content: space-between;
        color: #6666aa;
        font-size: 12px;
      }
      .footer strong { color: #e2e2f0; }

      .empty { color: #5555aa; padding: 12px 0; text-align: center; }
      .error-msg { color: #f87171; padding: 12px 0; }

      .violation-section { margin-top: 12px; padding-top: 10px; border-top: 1px solid #2e2e50; }
      .violation-title { font-size: 11px; font-weight: 600; color: #f87171; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 6px; }
      .violation { color: #fca5a5; font-size: 12px; line-height: 1.6; }
    `
    canvas.appendChild(style)

    // -----------------------------------------------------------------------
    // Panel markup
    // -----------------------------------------------------------------------
    const panel = document.createElement('div')
    panel.className = 'panel'
    panel.innerHTML = `
      <div class="header">
        <div class="title">
          <div class="dot" id="status-dot"></div>
          Bundle Budget
        </div>
        <button class="refresh-btn" id="refresh-btn">↻ Refresh</button>
      </div>
      <div id="content"><div class="empty">Loading…</div></div>
    `
    canvas.appendChild(panel)

    const content = canvas.getElementById('content')!
    const dot = canvas.getElementById('status-dot')!
    const refreshBtn = canvas.getElementById('refresh-btn')!

    // -----------------------------------------------------------------------
    // Data fetching — hits the Vite dev server endpoint
    // -----------------------------------------------------------------------
    async function load() {
      content.innerHTML = '<div class="empty">Loading…</div>'
      dot.className = 'dot'

      try {
        const res = await fetch('/__bundle-budget/stats')
        if (!res.ok) throw new Error(`${res.status}`)
        const data = await res.json() as BundleStats
        render(data)
      } catch (err) {
        content.innerHTML = `<div class="error-msg">
          Could not load stats. Run <code>astro build</code> first, or check the integration is configured.
          <br><br><small>${err}</small>
        </div>`
        dot.className = 'dot warn'
      }
    }

    // -----------------------------------------------------------------------
    // Rendering
    // -----------------------------------------------------------------------
    function fmt(bytes: number): string {
      if (bytes < 1000) return `${bytes} B`
      if (bytes < 1_000_000) return `${(bytes / 1000).toFixed(1)} kB`
      return `${(bytes / 1_000_000).toFixed(2)} MB`
    }

    function render(data: BundleStats) {
      const hasViolations = data.violations.length > 0

      dot.className = hasViolations ? 'dot error' : 'dot ok'

      const rows = data.assets
        .sort((a, b) => b.sizeBytes - a.sizeBytes)
        .slice(0, 12) // max 12 rows to keep panel compact
        .map((a) => {
          const isOver = data.violations.some((v) => v.subject === a.relativePath)
          const typeClass = a.type === 'js' ? 'type-js' : 'type-css'
          const sizeClass = isOver ? 'size over' : 'size'
          const shortName = a.relativePath.replace('assets/', '')
          return `<tr>
            <td class="name" title="${a.relativePath}">${shortName}</td>
            <td><span class="${typeClass}">${a.type}</span></td>
            <td class="${sizeClass}">${fmt(a.sizeBytes)}</td>
          </tr>`
        })
        .join('')

      const moreCount = Math.max(0, data.assets.length - 12)

      const violationHtml = hasViolations ? `
        <div class="violation-section">
          <div class="violation-title">⚠ ${data.violations.length} budget violation${data.violations.length > 1 ? 's' : ''}</div>
          ${data.violations.slice(0, 3).map((v) => `<div class="violation">• ${v.message}</div>`).join('')}
          ${data.violations.length > 3 ? `<div class="violation" style="color:#6666aa">…and ${data.violations.length - 3} more</div>` : ''}
        </div>` : ''

      content.innerHTML = `
        <table>
          <thead><tr>
            <th>Asset</th><th>Type</th><th>Size</th>
          </tr></thead>
          <tbody>${rows}${moreCount > 0 ? `<tr><td colspan="3" style="color:#5555aa;font-size:11px;padding-top:6px">…${moreCount} more</td></tr>` : ''}</tbody>
        </table>
        <div class="footer">
          <span>JS <strong>${fmt(data.totalJsBytes)}</strong></span>
          <span>CSS <strong>${fmt(data.totalCssBytes)}</strong></span>
          <span>${data.assets.length} assets</span>
        </div>
        ${violationHtml}
      `
    }

    refreshBtn.addEventListener('click', load)
    load()
  },
}

// ---------------------------------------------------------------------------
// Types (duplicated minimally to avoid importing from src/ at runtime)
// ---------------------------------------------------------------------------
interface BundleStats {
  assets: Array<{ relativePath: string; type: 'js' | 'css'; sizeBytes: number }>
  totalJsBytes: number
  totalCssBytes: number
  violations: Array<{ subject: string; message: string }>
}
