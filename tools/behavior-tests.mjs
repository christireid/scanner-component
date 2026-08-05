#!/usr/bin/env node
/**
 * Browser behaviour suite (our side only — see docs/UNREACHABLE.md for why the
 * reference cannot be driven). Requires `npm run dev` on :5173 after
 * `node tools/build-behavior-harness.mjs`, plus playwright and the
 * preinstalled Chromium. Writes docs/captures/behavior-log.json; exits 1 on
 * any failing check. The video case uses public/test-media/dahlia-pan.webm,
 * a VP8 WebM recorded in-browser via canvas captureStream + MediaRecorder.
 */
import { chromium } from "playwright"
import { writeFileSync } from "node:fs"

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell", args: ["--no-sandbox"] })
const results = []
const record = (name, pass, detail) => { results.push({ name, pass, detail }); console.log(`${pass ? "PASS" : "FAIL"}  ${name} — ${detail}`) }
const open = async (query, options = {}) => {
    const context = await browser.newContext({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1, ...options })
    const page = await context.newPage()
    await page.goto(`http://127.0.0.1:5173/harness-behavior/behavior.html?${query}`, { waitUntil: "domcontentloaded" })
    await page.evaluate(() => window.__ready)
    return { context, page }
}

/* 1 — video pathway: playback advances, scans re-acquire, identities persist */
{
    const { context, page } = await open("src=/test-media/dahlia-pan.webm&activation=always&autoRescan=900&mode=detail")
    await page.waitForTimeout(4200)
    // The engine keeps the video element detached and paints it to canvas, so
    // playback is proven by the media canvas changing between two samples.
    const video = await page.evaluate(async () => {
        const canvas = document.querySelector("canvas")
        const snap = () => canvas.getContext("2d").getImageData(0, 0, 300, 200).data
        const a = snap()
        await new Promise(resolve => setTimeout(resolve, 600))
        const b = snap()
        let diff = 0
        for (let i = 0; i < a.length; i += 16) diff += Math.abs(a[i] - b[i])
        return { motion: diff }
    })
    const scans = await page.evaluate(() => window.__scans.length)
    const idStability = await page.evaluate(() => {
        const runs = window.__scans
        if (runs.length < 3) return { ok: false, note: `only ${runs.length} scans` }
        const last = runs[runs.length - 1].map(p => p.id)
        const prev = runs[runs.length - 2].map(p => p.id)
        const kept = last.filter(id => prev.includes(id)).length
        return { ok: kept >= Math.min(last.length, prev.length) * 0.5, note: `${kept}/${last.length} ids persisted across rescan` }
    })
    record("video plays and paints", video.motion > 1000, `media-canvas motion over 600ms = ${video.motion}`)
    record("video re-acquisition scans", scans >= 3, `${scans} scans in 4.2s at 900ms interval`)
    record("tracking identities persist on video", idStability.ok, idStability.note)
    await page.screenshot({ path: "/home/user/scanner-component/docs/captures/media/video-tracking.jpg", type: "jpeg", quality: 70 })
    await context.close()
}

/* 2 — hover activation and hover-out dismissal */
{
    const { context, page } = await open("activation=hover")
    // Headless mouse starts at (0,0), inside the stage — park it outside first
    // so the pre-hover state is genuinely un-hovered.
    await page.mouse.move(600, 900)
    await page.waitForTimeout(500)
    const before = await page.evaluate(() => document.querySelector("[data-grid-pulse-active]").dataset.gridPulseActive)
    await page.mouse.move(600, 400)
    await page.waitForTimeout(400)
    const during = await page.evaluate(() => document.querySelector("[data-grid-pulse-active]").dataset.gridPulseActive)
    await page.mouse.move(600, 900) // outside the 800px stage
    await page.waitForTimeout(500)  // leaveDelay 90ms + exit 220ms + margin
    const after = await page.evaluate(() => document.querySelector("[data-grid-pulse-active]").dataset.gridPulseActive)
    record("hover activates, hover-out dismisses", before === "false" && during === "true" && after === "false", `before=${before} during=${during} after=${after}`)
    await context.close()
}

/* 3 — click-to-rescan changes the point set and honours the click focus */
{
    const { context, page } = await open("activation=always")
    await page.waitForTimeout(600)
    const scansBefore = await page.evaluate(() => window.__scans.length)
    await page.mouse.click(300, 200) // normalized ~ (0.25, 0.25)
    await page.waitForTimeout(700)
    const { scansAfter, focus } = await page.evaluate(() => {
        const runs = window.__scans
        const last = runs[runs.length - 1]
        const near = last.find(p => Math.hypot(p.x - 0.25, p.y - 0.25) < 0.01)
        return { scansAfter: runs.length, focus: near ? `${near.id}@(${near.x.toFixed(2)},${near.y.toFixed(2)})` : null }
    })
    record("click-to-rescan commits a new scan", scansAfter > scansBefore, `${scansBefore} → ${scansAfter}`)
    record("rescan focuses the clicked position", Boolean(focus), focus || "no point within 0.01 of click")
    await context.close()
}

/* 4 — keyboard: Enter scans, Escape deactivates */
{
    const { context, page } = await open("activation=tap")
    await page.focus("[data-grid-pulse-active]")
    const scans0 = await page.evaluate(() => window.__scans.length)
    await page.keyboard.press("Enter")
    await page.waitForTimeout(600)
    const active1 = await page.evaluate(() => document.querySelector("[data-grid-pulse-active]").dataset.gridPulseActive)
    const scans1 = await page.evaluate(() => window.__scans.length)
    await page.keyboard.press("Escape")
    await page.waitForTimeout(300)
    const active2 = await page.evaluate(() => document.querySelector("[data-grid-pulse-active]").dataset.gridPulseActive)
    record("Enter activates and scans; Escape deactivates", active1 === "true" && scans1 > scans0 && active2 === "false", `active=${active1}→${active2} scans ${scans0}→${scans1}`)
    await context.close()
}

/* 5 — touch tap requests a focused rescan (auto behaviour on hover activation) */
{
    const { context, page } = await open("activation=hover", { hasTouch: true })
    const scans0 = await page.evaluate(() => window.__scans.length)
    await page.touchscreen.tap(700, 300)
    await page.waitForTimeout(700)
    const scans1 = await page.evaluate(() => window.__scans.length)
    const active = await page.evaluate(() => document.querySelector("[data-grid-pulse-active]").dataset.gridPulseActive)
    record("touch tap activates and rescans", scans1 > scans0 && active === "true", `scans ${scans0}→${scans1} active=${active}`)
    await context.close()
}

/* 6 — mirror flips the media horizontally */
{
    const luminanceProfile = async mirror => {
        const { context, page } = await open(`activation=always&mirror=${mirror}`)
        await page.waitForTimeout(400)
        const profile = await page.evaluate(() => {
            const canvas = document.querySelector("canvas") // media canvas is first
            const ctx = canvas.getContext("2d")
            const { data, width } = ctx.getImageData(0, Math.floor(canvas.height / 2), canvas.width, 1)
            const columns = []
            for (let x = 0; x < width; x += 8) {
                const i = x * 4
                columns.push(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114)
            }
            return columns
        })
        await context.close()
        return profile
    }
    const normal = await luminanceProfile(0)
    const mirrored = await luminanceProfile(1)
    const reversed = [...mirrored].reverse()
    let diffDirect = 0
    let diffReversed = 0
    for (let i = 0; i < normal.length; i += 1) {
        diffDirect += Math.abs(normal[i] - mirrored[i])
        diffReversed += Math.abs(normal[i] - reversed[i])
    }
    record("mirror flips the media", diffReversed < diffDirect * 0.35, `direct=${(diffDirect / normal.length).toFixed(1)} reversed=${(diffReversed / normal.length).toFixed(1)} per column`)
}

/* 7 — aspect ratios shape the host box */
{
    for (const [aspect, expected] of [["16:9", 16 / 9], ["1:1", 1]]) {
        const { context, page } = await open(`activation=always&aspect=${encodeURIComponent(aspect)}`)
        const ratio = await page.evaluate(() => {
            const host = document.querySelector("[data-grid-pulse-active]")
            const rect = host.getBoundingClientRect()
            return rect.width / rect.height
        })
        record(`aspect ${aspect} honoured`, Math.abs(ratio - expected) < 0.02, `rendered ${ratio.toFixed(3)} vs ${expected.toFixed(3)}`)
        await context.close()
    }
}

/* 8 — reduced motion freezes the overlay */
{
    const { context, page } = await open("activation=always", { reducedMotion: "reduce" })
    await page.waitForTimeout(800)
    const frames = await page.evaluate(async () => {
        const canvases = document.querySelectorAll("canvas")
        const overlay = canvases[canvases.length - 1]
        const snap = () => overlay.getContext("2d").getImageData(0, 0, 300, 200).data
        const a = snap()
        await new Promise(resolve => setTimeout(resolve, 700))
        const b = snap()
        let diff = 0
        for (let i = 0; i < a.length; i += 16) diff += Math.abs(a[i] - b[i])
        return diff
    })
    record("reduced motion freezes the overlay", frames === 0, `pixel diff over 700ms = ${frames}`)
    await context.close()
}

writeFileSync("/home/user/scanner-component/docs/captures/behavior-log.json", JSON.stringify(results, null, 2))
const failed = results.filter(r => !r.pass)
console.log(`\n${results.length} checks, ${failed.length} failed`)
await browser.close()
process.exit(failed.length ? 1 : 0)
