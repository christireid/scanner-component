#!/usr/bin/env node
/**
 * Behaviour-test harness builder.
 *
 * Emits one instrumented page, `harness-behavior/behavior.html`, configured by
 * query parameters. The page exposes what a black-box browser test needs:
 *
 *   window.__scans      — every onScan payload, in order
 *   window.__activeLog  — every onActiveChange with a timestamp
 *   window.__bridge     — the live GridPulseRenderBridge
 *   window.__ready      — resolves when data-grid-pulse-ready="true"
 *
 * Params: activation=hover|always|tap, src=<url>, mirror=1, aspect=<ratio>,
 * autoRescan=<ms>, mode=<detection mode>.
 */
import { mkdirSync, writeFileSync, rmSync } from "node:fs"
import { fileURLToPath } from "node:url"

const outputDirectory = fileURLToPath(new URL("../harness-behavior", import.meta.url))

const page = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>behaviour harness</title>
<style>
  html, body { margin: 0; background: #000; }
  #stage { width: 1200px; height: 800px; overflow: hidden; }
</style>
</head>
<body>
<div id="stage"></div>
<script type="module">
  import { createRoot } from "react-dom/client"
  import { createElement } from "react"
  import { GridPulseScan } from "/src/GridPulseScanPro.tsx"

  const params = new URLSearchParams(location.search)
  window.__scans = []
  window.__activeLog = []
  window.__bridge = null

  // height:100% would defeat the CSS aspect-ratio the component sets, so it
  // is only applied for the free ratio.
  const aspect = params.get("aspect") || "free"
  const props = {
    src: params.get("src") || "/demo-flower.jpeg",
    style: aspect === "free" ? { width: "100%", height: "100%" } : { width: "100%" },
    aspectRatio: aspect,
    media: { mirror: params.get("mirror") === "1" },
    detection: { mode: params.get("mode") || "auto" },
    interaction: {
      activation: params.get("activation") || "hover",
      clickToRescan: true,
      autoRescanInterval: Number(params.get("autoRescan") || 0),
    },
    onScan: points => window.__scans.push(points.map(p => ({ ...p }))),
    onActiveChange: active => window.__activeLog.push({ active, at: performance.now() }),
    onRenderBridge: bridge => { window.__bridge = bridge },
  }
  createRoot(document.getElementById("stage")).render(createElement(GridPulseScan, props))

  window.__ready = new Promise(resolve => {
    const started = performance.now()
    const check = () => {
      const ready = document.querySelector("[data-grid-pulse-ready='true']")
      if (ready || performance.now() - started > 20000) resolve(Boolean(ready))
      else requestAnimationFrame(check)
    }
    requestAnimationFrame(check)
  })
</script>
</body>
</html>
`

rmSync(outputDirectory, { recursive: true, force: true })
mkdirSync(outputDirectory, { recursive: true })
writeFileSync(`${outputDirectory}/behavior.html`, page)
console.log("behaviour harness built — harness-behavior/behavior.html")
