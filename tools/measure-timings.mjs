#!/usr/bin/env node
/**
 * Our-side behavioural timing measurement (rubric C1/C2/C4/C5/C6 and the
 * §5.3 chip-contrast floor), measured in real Chromium against the behaviour
 * harness. These are OUR values, recorded so that the moment reference
 * captures exist the comparison in §7C is immediate. They are not evidence
 * about the reference. Writes docs/captures/timings.json.
 *
 * Requires: node tools/build-behavior-harness.mjs, dev server on :5173,
 * playwright + the preinstalled Chromium.
 */
import { chromium } from "playwright"
import { writeFileSync } from "node:fs"

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell", args: ["--no-sandbox"] })
const out = {}
const open = async (query, options = {}) => {
    const context = await browser.newContext({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1, ...options })
    const page = await context.newPage()
    await page.goto(`http://127.0.0.1:5173/harness-behavior/behavior.html?${query}`, { waitUntil: "domcontentloaded" })
    await page.evaluate(() => window.__ready)
    return { context, page }
}

/* C1/C2 — reveal duration and stagger, from per-frame bridge snapshots.
   Measured on the very first scan after load: matched rescans keep their old
   revealedAt (by design), so only fresh identities reveal. Completion is the
   eased value crossing 0.99, which for the shipped easeOut cubic happens at
   ~0.785 × revealDuration. */
{
    const { context, page } = await open("activation=always&mode=detail")
    const measured = await page.evaluate(async () => {
        const frames = []
        const stop = window.__bridge.subscribe(snapshot => {
            frames.push({ now: snapshot.now, reveals: snapshot.points.map(point => point.reveal) })
        })
        await new Promise(resolve => setTimeout(resolve, 1800))
        stop()
        const count = Math.max(0, ...frames.map(frame => frame.reveals.length))
        const starts = []
        const completes = []
        for (let index = 0; index < count; index += 1) {
            const start = frames.find(frame => (frame.reveals[index] ?? 0) > 0.001 && (frame.reveals[index] ?? 0) < 0.9)
            const complete = frames.find(frame => (frame.reveals[index] ?? 0) >= 0.99)
            if (start && complete) {
                starts.push(start.now)
                completes.push(complete.now)
            }
        }
        starts.sort((a, b) => a - b)
        completes.sort((a, b) => a - b)
        const staggers = starts.slice(1).map((value, index) => value - starts[index])
        return {
            pointsMeasured: starts.length,
            totalRevealMs: starts.length ? Number((Math.max(...completes) - Math.min(...starts)).toFixed(1)) : null,
            perPointRevealTo99Ms: starts.length ? Number((completes[0] - starts[0]).toFixed(1)) : null,
            meanStaggerMs: staggers.length ? Number((staggers.reduce((sum, value) => sum + value, 0) / staggers.length).toFixed(1)) : null,
            staggersMs: staggers.map(value => Number(value.toFixed(1))),
        }
    })
    out.reveal = {
        configured: { revealDurationMs: 420, easedTo99AtMs: 330, staggerMs: 90 },
        measured,
    }
    console.log("reveal:", JSON.stringify(measured))
    await context.close()
}

/* C4 — sweep period, from the bright band's row in the first box */
{
    const { context, page } = await open("activation=always")
    const measured = await page.evaluate(async () => {
        await new Promise(resolve => setTimeout(resolve, 900))
        const box = window.__bridge.getSnapshot().boxes[0]
        if (!box) return { error: "no box" }
        const canvases = document.querySelectorAll("#stage canvas")
        const overlay = canvases[canvases.length - 1]
        const ctx = overlay.getContext("2d")
        const dpr = overlay.width / overlay.clientWidth
        const x = Math.round((box.x + box.width / 2) * dpr)
        const y0 = Math.round(box.y * dpr)
        const h = Math.round(box.height * dpr)
        const samples = []
        let previous = null
        const t0 = performance.now()
        await new Promise(resolve => {
            const tick = () => {
                const t = performance.now() - t0
                if (t > 4200) return resolve()
                const column = ctx.getImageData(x, y0, 1, h).data
                // The media crop is static, so the moving band is the row of
                // greatest change between consecutive frames.
                if (previous) {
                    let bestRow = 0
                    let bestValue = -1
                    for (let row = 0; row < h; row += 1) {
                        const value =
                            Math.abs(column[row * 4] - previous[row * 4]) +
                            Math.abs(column[row * 4 + 1] - previous[row * 4 + 1]) +
                            Math.abs(column[row * 4 + 2] - previous[row * 4 + 2])
                        if (value > bestValue) { bestValue = value; bestRow = row }
                    }
                    if (bestValue > 30) samples.push({ t, row: bestRow / h })
                }
                previous = column
                requestAnimationFrame(tick)
            }
            requestAnimationFrame(tick)
        })
        // Wrap detection: the band position jumps from high back to low.
        const wraps = []
        for (let i = 1; i < samples.length; i += 1) {
            if (samples[i - 1].row > 0.7 && samples[i].row < 0.3) wraps.push(samples[i].t)
        }
        const periods = wraps.slice(1).map((value, index) => value - wraps[index])
        return {
            wraps: wraps.length,
            periodsMs: periods.map(value => Number(value.toFixed(0))),
            meanPeriodMs: periods.length ? Number((periods.reduce((sum, value) => sum + value, 0) / periods.length).toFixed(0)) : null,
        }
    })
    out.sweep = { configured: { periodMs: 1450, direction: "vertical", mode: "loop" }, measured }
    console.log("sweep:", JSON.stringify(measured))
    await context.close()
}

/* C5 — crosshair follow latency to 99% of a 600px jump */
{
    const { context, page } = await open("activation=always")
    await page.mouse.move(300, 400)
    await page.waitForTimeout(500)
    const probe = page.evaluate(async () => {
        const start = { x: window.__bridge.getSnapshot().pointer.x, y: window.__bridge.getSnapshot().pointer.y }
        const target = { x: 900 / 1200, y: 400 / 800 }
        const gap = Math.abs(target.x - start.x)
        const t0 = performance.now()
        return await new Promise(resolve => {
            const tick = () => {
                const pointer = window.__bridge.getSnapshot().pointer
                const remaining = Math.abs(target.x - pointer.x)
                if (remaining <= gap * 0.01 || performance.now() - t0 > 1500) {
                    resolve({ latencyMs: Number((performance.now() - t0).toFixed(1)), remainingShare: remaining / gap })
                } else requestAnimationFrame(tick)
            }
            requestAnimationFrame(tick)
        })
    })
    await page.mouse.move(900, 400)
    const measured = await probe
    out.crosshair = { configured: { followResponseMs: 95, note: "time to cover 99% of the gap" }, measured }
    console.log("crosshair:", JSON.stringify(measured))
    await context.close()
}

/* C6 — hover-out: deactivation latency and overlay fade-out completion */
{
    const { context, page } = await open("activation=hover")
    await page.mouse.move(600, 900)
    await page.waitForTimeout(400)
    await page.mouse.move(600, 400)
    await page.waitForTimeout(600)
    const armed = page.evaluate(() => new Promise(resolve => {
        const t0 = performance.now()
        const host = document.querySelector("[data-grid-pulse-active]")
        const canvases = document.querySelectorAll("#stage canvas")
        const overlay = canvases[canvases.length - 1]
        const ctx = overlay.getContext("2d")
        let deactivateMs = null
        const tick = () => {
            const t = performance.now() - t0
            if (deactivateMs === null && host.dataset.gridPulseActive === "false") deactivateMs = t
            if (deactivateMs !== null) {
                const data = ctx.getImageData(0, 0, 200, 150).data
                let alpha = 0
                for (let i = 3; i < data.length; i += 40) alpha += data[i]
                if (alpha === 0 || t > 2000) {
                    resolve({ deactivateMs: Number(deactivateMs.toFixed(1)), overlayClearMs: Number(t.toFixed(1)) })
                    return
                }
            }
            if (t > 2500) resolve({ deactivateMs, overlayClearMs: null })
            else requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
    }))
    await page.mouse.move(600, 900)
    const measured = await armed
    out.hoverOut = { configured: { leaveDelayMs: 90, exitDurationMs: 220 }, measured }
    console.log("hover-out:", JSON.stringify(measured))
    await context.close()
}

/* §5.3 — chip text contrast, from composited pixels of the first chip */
{
    const { context, page } = await open("activation=always")
    await page.waitForTimeout(900)
    const measured = await page.evaluate(() => {
        const snapshot = window.__bridge.getSnapshot()
        const box = snapshot.boxes[0]
        if (!box) return { error: "no box" }
        const canvases = document.querySelectorAll("#stage canvas")
        const overlay = canvases[canvases.length - 1]
        const ctx = overlay.getContext("2d")
        const dpr = overlay.width / overlay.clientWidth
        // The chip sits at box origin + label offsets (5,5), ~15px tall.
        const region = ctx.getImageData(Math.round((box.x + 5) * dpr), Math.round((box.y + 5) * dpr), Math.round(80 * dpr), Math.round(15 * dpr)).data
        const luminance = channel => {
            const c = channel / 255
            return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
        }
        let darkest = 1
        let brightest = 0
        for (let i = 0; i < region.length; i += 4) {
            if (region[i + 3] < 200) continue // only opaque chip pixels
            const y = 0.2126 * luminance(region[i]) + 0.7152 * luminance(region[i + 1]) + 0.0722 * luminance(region[i + 2])
            if (y < darkest) darkest = y
            if (y > brightest) brightest = y
        }
        return { contrastRatio: Number(((brightest + 0.05) / (darkest + 0.05)).toFixed(1)) }
    })
    out.chipContrast = { floor: 13.9, measured }
    console.log("chip contrast:", JSON.stringify(measured))
    await context.close()
}

/* resize — committed points re-project to the new frame */
{
    const { context, page } = await open("activation=always")
    await page.waitForTimeout(700)
    await page.evaluate(() => {
        const stage = document.getElementById("stage")
        stage.style.width = "900px"
        stage.style.height = "600px"
    })
    await page.waitForTimeout(400)
    const measured = await page.evaluate(() => {
        const size = window.__bridge.getSize()
        const points = window.__bridge.getSnapshot().points
        const misprojected = points.filter(point => Math.abs(point.px - point.x * size.width) > 0.5 || Math.abs(point.py - point.y * size.height) > 0.5)
        return { width: size.width, height: size.height, points: points.length, misprojected: misprojected.length }
    })
    out.resize = { measured, pass: measured.misprojected === 0 && measured.width === 900 }
    console.log("resize:", JSON.stringify(measured))
    await context.close()
}

writeFileSync("docs/captures/timings.json", JSON.stringify(out, null, 2))
console.log("\nwritten docs/captures/timings.json")
await browser.close()
