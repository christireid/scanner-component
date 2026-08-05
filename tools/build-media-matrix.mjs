#!/usr/bin/env node
/**
 * Test-media matrix builder.
 *
 * Emits one harness page per (photo × scenario) into `harness-media/`, using
 * the same page contract as tools/build-harness.mjs (`window.__harnessReady`).
 * The scenarios are chosen per photo to stress what that photo is bad news
 * for: white-background chrome contrast, skin-adjacent false positives,
 * low-contrast saliency, very large sources, portrait aspect.
 */
import { mkdirSync, writeFileSync, rmSync } from "node:fs"
import { fileURLToPath } from "node:url"

const outputDirectory = fileURLToPath(new URL("../harness-media", import.meta.url))

const MEDIA = [
    { id: "dahlia", src: "/test-media/dahlia-dark.jpeg", note: "high contrast on black" },
    { id: "lilies", src: "/test-media/xray-lilies-white.jpeg", note: "translucent structures on white — chrome-contrast worst case" },
    { id: "saponaria", src: "/test-media/saponaria-magenta.jpeg", note: "warm magenta/orange — skin-adjacent tones, portrait aspect" },
    { id: "helichrysum", src: "/test-media/helichrysum-soft.jpeg", note: "soft low-contrast blur, 6016px source" },
]

const SCENARIOS = [
    { id: "default", renderer: "engine", props: {} },
    { id: "detail", renderer: "engine", props: { detection: { mode: "detail", pointCount: 6 } } },
    { id: "person", renderer: "engine", props: { detection: { mode: "person", pointCount: 6 } } },
    { id: "adaptive", renderer: "engine", props: { theme: { adaptiveChrome: true, chromeSpatialMode: "regional", chromeHalo: true } } },
    { id: "xray", renderer: "engine", props: { effect: { type: "xray", scope: "media" } } },
    { id: "thermal", renderer: "engine", props: { effect: { type: "thermal", scope: "media" } } },
    { id: "diffusion", renderer: "engine", props: { effect: { type: "bitmap", bitmapMethod: "diffusion", bitmapPalette: "duotone", scope: "media" } } },
    { id: "swarm", renderer: "engine", props: { preset: "swarm" } },
    { id: "tracking", renderer: "engine", props: { preset: "tracking" } },
    { id: "specimen", renderer: "integrated", props: { preset: "Botanical Analysis", specimen: { showControls: false } } },
]

const page = (media, scenario) => {
    const props = {
        src: media.src,
        interaction: { activation: "always", clickToRescan: false, rescanOnEnter: false },
        ...scenario.props,
    }
    return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>media ${media.id} × ${scenario.id}</title>
<style>
  html, body { margin: 0; background: #000; }
  #stage { width: 1200px; height: 800px; overflow: hidden; }
</style>
</head>
<body>
<div id="stage" data-media="${media.id}" data-scenario="${scenario.id}"></div>
<script type="module">
  import { createRoot } from "react-dom/client"
  import { createElement } from "react"
  import SpecimenGridPulse, { GridPulseScan } from "/src/GridPulseScanPro.tsx"

  const props = ${JSON.stringify(props, null, 2)}
  props.style = { width: "100%", height: "100%" }
  const Component = ${scenario.renderer === "integrated" ? "SpecimenGridPulse" : "GridPulseScan"}
  createRoot(document.getElementById("stage")).render(createElement(Component, props))

  window.__harnessReady = new Promise(resolve => {
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
}

rmSync(outputDirectory, { recursive: true, force: true })
mkdirSync(outputDirectory, { recursive: true })
const manifest = []
for (const media of MEDIA) {
    for (const scenario of SCENARIOS) {
        const file = `${media.id}-${scenario.id}.html`
        writeFileSync(`${outputDirectory}/${file}`, page(media, scenario))
        manifest.push({ file, media: media.id, note: media.note, scenario: scenario.id })
    }
}
writeFileSync(
    `${outputDirectory}/manifest.json`,
    `${JSON.stringify({ generatedBy: "tools/build-media-matrix.mjs", pages: manifest }, null, 2)}\n`
)
console.log(`media matrix built — ${manifest.length} pages (${MEDIA.length} photos × ${SCENARIOS.length} scenarios)`)
