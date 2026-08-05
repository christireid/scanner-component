#!/usr/bin/env node
/**
 * Local capture instrument (OUR side only — the reference is unreachable here,
 * see docs/UNREACHABLE.md). Requires `npm run dev` on :5173, plus playwright
 * and the preinstalled Chromium at /opt/pw-browsers. Writes docs/captures/.
 */
import { chromium } from "playwright"
import { mkdirSync, writeFileSync } from "node:fs"

const OUT = "/home/user/scanner-component/docs/captures"
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell",
    args: ["--no-sandbox"],
})

const capture = async (file, width, height, out, { dpr = 2, settleMs = 1400 } = {}) => {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr })
    const page = await context.newPage()
    const errors = []
    page.on("pageerror", e => errors.push(String(e)))
    page.on("console", m => { if (m.type() === "error") errors.push(m.text()) })
    await page.goto(`http://127.0.0.1:5173/harness/${file}`, { waitUntil: "domcontentloaded", timeout: 30000 })
    const ready = await page.evaluate(() => window.__harnessReady)
    await page.waitForTimeout(settleMs)
    await page.screenshot({ path: `${OUT}/${out}`, type: "jpeg", quality: 72 })
    await context.close()
    return { ready, errors }
}

const results = []
const presets = ["loupe", "telemetry", "plate", "survey", "lattice", "contour", "hairline", "swarm", "field", "viewfinder", "tracking"]
for (const name of presets) {
    const r = await capture(`preset-${name}-1200.html`, 1200, 800, `preset-${name}-1200.jpg`)
    results.push({ id: `preset-${name}`, ...r })
    console.log(`preset-${name}: ready=${r.ready} errors=${r.errors.length}`)
    if (r.errors.length) console.log("   ", r.errors.slice(0, 2).join(" | "))
}
for (const [w, h] of [[390, 844], [768, 1024], [1440, 900], [2560, 1440]]) {
    const r = await capture(`default-${w}.html`, w, h, `default-${w}.jpg`)
    results.push({ id: `default-${w}`, ...r })
    console.log(`default-${w}: ready=${r.ready} errors=${r.errors.length}`)
    if (r.errors.length) console.log("   ", r.errors.slice(0, 2).join(" | "))
}
for (const name of ["effect-thermal", "effect-diffusion", "specimen-feature-tracking", "specimen-viewfinder", "specimen-botanical-analysis"]) {
    const r = await capture(`${name}-1200.html`, 1200, 800, `${name}-1200.jpg`)
    results.push({ id: name, ...r })
    console.log(`${name}: ready=${r.ready} errors=${r.errors.length}`)
    if (r.errors.length) console.log("   ", r.errors.slice(0, 2).join(" | "))
}
writeFileSync(`${OUT}/capture-log.json`, JSON.stringify(results, null, 2))
await browser.close()
