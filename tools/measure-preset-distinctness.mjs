#!/usr/bin/env node
/**
 * Rubric D6 instrument: pairwise mean-absolute-difference of the engine
 * overlay canvas alpha channel across the 11 named presets, plus per-preset
 * chrome coverage. Composite-frame diffs live in docs/captures/
 * preset-distinctness.json alongside these numbers. Requires the dev server.
 */
import { chromium } from "playwright"
import { writeFileSync } from "node:fs"
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell", args: ["--no-sandbox"] })
const context = await browser.newContext({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 })
const presets = ["loupe", "telemetry", "plate", "survey", "lattice", "contour", "hairline", "swarm", "field", "viewfinder", "tracking"]
const overlays = {}
for (const name of presets) {
    const page = await context.newPage()
    await page.goto(`http://127.0.0.1:5173/harness/preset-${name}-1200.html`, { waitUntil: "domcontentloaded" })
    await page.evaluate(() => window.__harnessReady)
    await page.waitForTimeout(1600)
    overlays[name] = await page.evaluate(() => {
        // The engine overlay is the LAST canvas inside the component host.
        const host = document.querySelector("[data-grid-pulse-ready]")
        const canvases = host.querySelectorAll("canvas")
        const overlay = canvases[canvases.length - 1]
        const ctx = overlay.getContext("2d")
        const w = 300, h = 200
        const sample = document.createElement("canvas")
        sample.width = w
        sample.height = h
        const sctx = sample.getContext("2d")
        sctx.drawImage(overlay, 0, 0, w, h)
        const data = sctx.getImageData(0, 0, w, h).data
        const alpha = []
        let coverage = 0
        for (let i = 3; i < data.length; i += 4) {
            alpha.push(data[i])
            if (data[i] > 8) coverage += 1
        }
        return { alpha, coverage: coverage / (w * h) }
    })
    await page.close()
}
const rows = []
for (let a = 0; a < presets.length; a += 1) {
    for (let b = a + 1; b < presets.length; b += 1) {
        const ga = overlays[presets[a]].alpha
        const gb = overlays[presets[b]].alpha
        let sum = 0
        for (let i = 0; i < ga.length; i += 1) sum += Math.abs(ga[i] - gb[i])
        rows.push({ pair: `${presets[a]} vs ${presets[b]}`, meanAbsAlphaDiff: Number((sum / ga.length).toFixed(2)) })
    }
}
rows.sort((x, y) => x.meanAbsAlphaDiff - y.meanAbsAlphaDiff)
console.log("overlay coverage per preset:")
for (const name of presets) console.log(`  ${name}: ${(overlays[name].coverage * 100).toFixed(1)}%`)
console.log("least distinct overlay pairs:")
for (const row of rows.slice(0, 5)) console.log(`  ${row.pair}: ${row.meanAbsAlphaDiff}`)
writeFileSync("/home/user/scanner-component/docs/captures/preset-distinctness.json", JSON.stringify({
    method: "overlay-canvas alpha channel, 300x200 downsample, mean absolute difference; coverage = share of pixels with alpha > 8",
    coverage: Object.fromEntries(presets.map(name => [name, Number((overlays[name].coverage * 100).toFixed(2))])),
    pairs: rows,
}, null, 2))
await browser.close()
