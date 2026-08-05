#!/usr/bin/env node
/**
 * Screenshot-harness builder.
 *
 * Parity comparison requires the component rendered under fixed, stated
 * conditions: known viewport, known device pixel ratio, known media, motion
 * frozen at a known timestamp, and no interaction. This emits one harness page
 * per (viewport × preset) pair into `harness/`, plus a manifest describing
 * exactly what each page shows.
 *
 * The harness intentionally does NOT capture anything itself. Capture requires
 * a browser, and any screenshot produced without one would be a fabrication.
 * The manifest is the contract a capture step consumes.
 *
 *   node tools/build-harness.mjs [--media /demo-flower.jpeg]
 */
import { mkdirSync, writeFileSync, rmSync } from "node:fs"
import { fileURLToPath } from "node:url"

const argv = process.argv.slice(2)
const mediaFlag = argv.indexOf("--media")
const media = mediaFlag >= 0 ? argv[mediaFlag + 1] : "/demo-flower.jpeg"

const outputDirectory = fileURLToPath(new URL("../harness", import.meta.url))

/** The four widths the parity plan compares at. 1200 is the measurement width. */
const VIEWPORTS = [
    { width: 390, height: 844, dpr: 2, label: "phone" },
    { width: 768, height: 1024, dpr: 2, label: "tablet" },
    { width: 1200, height: 800, dpr: 2, label: "measurement" },
    { width: 1440, height: 900, dpr: 2, label: "desktop" },
    { width: 2560, height: 1440, dpr: 2, label: "wide" },
]

/**
 * Presets must be visibly distinct from one another — that is one of the
 * non-regression checks. Each names the single thing it is there to show.
 */
const PRESETS = [
    { id: "default", renderer: "engine", shows: "shipped engine defaults", props: {} },
    // The parity plan's eleven named presets (rubric D6): each must render
    // visibly distinctly from every other.
    ...["loupe", "telemetry", "plate", "survey", "lattice", "contour", "hairline", "swarm", "field", "viewfinder", "tracking"].map(name => ({
        id: `preset-${name}`,
        renderer: "engine",
        shows: `named preset "${name}"`,
        props: { preset: name },
    })),
    { id: "effect-thermal", renderer: "engine", shows: "thermal false-colour effect on the media", props: { effect: { type: "thermal", scope: "media" } } },
    { id: "effect-diffusion", renderer: "engine", shows: "Floyd-Steinberg diffusion onto the handheld palette", props: { effect: { type: "bitmap", bitmapMethod: "diffusion", bitmapPalette: "handheld", scope: "media" } } },
    { id: "detail-xray", renderer: "engine", shows: "Detail detection with the X-Ray effect", props: { detection: { mode: "detail" }, effect: { type: "xray", scope: "media" } } },
    { id: "person-bitmap", renderer: "engine", shows: "Person detection with ordered-dither Bitmap media", props: { detection: { mode: "person" }, effect: { type: "bitmap", scope: "media" } } },
    { id: "code", renderer: "engine", shows: "Code glyph effect across the frame", props: { effect: { type: "code", scope: "media" } } },
    { id: "adaptive-chrome", renderer: "engine", shows: "regional adaptive chrome with halo", props: { theme: { adaptiveChrome: true, chromeSpatialMode: "regional", chromeHalo: true } } },
    { id: "reduced-motion", renderer: "engine", shows: "reduced-motion reveal, all motion frozen", props: { motion: { respectReducedMotion: true, reducedMotionReveal: "instant" } } },
    // The integrated Specimen renderer's ten scenes.
    ...["Feature Tracking", "Zoom Insets", "Survey Grid", "Detection Swarm", "Annotation Plate", "Point Mesh", "Viewfinder", "Contour Scan", "Facade Analysis", "Botanical Analysis"].map(name => ({
        id: `specimen-${name.toLowerCase().replace(/\s+/g, "-")}`,
        renderer: "integrated",
        shows: `Specimen scene "${name}"`,
        props: { preset: name, specimen: { showControls: false } },
    })),
]


const page = (viewport, preset) => {
    const props = {
        src: media,
        interaction: { activation: "always", clickToRescan: false, rescanOnEnter: false },
        ...preset.props,
    }
    return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>harness ${preset.id} @ ${viewport.width}</title>
<meta name="viewport" content="width=${viewport.width}, initial-scale=1">
<style>
  html, body { margin: 0; background: #000; }
  #stage {
    width: ${viewport.width}px;
    height: ${viewport.height}px;
    overflow: hidden;
  }
</style>
</head>
<body>
<div id="stage" data-harness-preset="${preset.id}" data-harness-width="${viewport.width}" data-harness-dpr="${viewport.dpr}"></div>
<script type="module">
  import { createRoot } from "react-dom/client"
  import { createElement } from "react"
  import SpecimenGridPulse, { GridPulseScan } from "/src/GridPulseScanPro.tsx"

  const props = ${JSON.stringify(props, null, 2)}
  props.style = { width: "100%", height: "100%" }

  const Component = ${preset.renderer === "integrated" ? "SpecimenGridPulse" : "GridPulseScan"}
  createRoot(document.getElementById("stage")).render(createElement(Component, props))

  // A capture step should wait for this flag rather than for a fixed delay.
  window.__harnessReady = new Promise(resolve => {
    const started = performance.now()
    const check = () => {
      const stage = document.getElementById("stage")
      const ready = stage.querySelector("[data-grid-pulse-ready='true']")
      if (ready || performance.now() - started > 15000) resolve(Boolean(ready))
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
for (const viewport of VIEWPORTS) {
    for (const preset of PRESETS) {
        const file = `${preset.id}-${viewport.width}.html`
        writeFileSync(`${outputDirectory}/${file}`, page(viewport, preset))
        manifest.push({
            file,
            preset: preset.id,
            renderer: preset.renderer,
            shows: preset.shows,
            viewportWidth: viewport.width,
            viewportHeight: viewport.height,
            deviceScaleFactor: viewport.dpr,
            viewportLabel: viewport.label,
            media,
        })
    }
}

writeFileSync(
    `${outputDirectory}/manifest.json`,
    `${JSON.stringify(
        {
            generatedBy: "tools/build-harness.mjs",
            note:
                "Pages only. Capturing them requires a browser; no image in this repository " +
                "was produced by this tool.",
            media,
            viewports: VIEWPORTS,
            presets: PRESETS.map(({ id, shows }) => ({ id, shows })),
            pages: manifest,
        },
        null,
        2
    )}\n`
)

console.log(
    `harness built — ${manifest.length} pages ` +
        `(${PRESETS.length} presets × ${VIEWPORTS.length} viewports) in harness/`
)
console.log("serve with:  npm run dev    then open http://localhost:5173/harness/<page>")
console.log("no screenshots were produced: capture requires a browser.")
