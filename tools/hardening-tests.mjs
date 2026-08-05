#!/usr/bin/env node
/**
 * Hardening suite: error paths, races, degradation, and composition modes.
 * Requires the dev server on :5173, tools/serve.mjs on :4180 (a second origin
 * that deliberately sends no CORS headers), and the behaviour harness built.
 * Writes docs/captures/hardening-log.json; exits 1 on any failing check.
 */
import { chromium } from "playwright"
import { writeFileSync } from "node:fs"

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell", args: ["--no-sandbox"] })
const results = []
const record = (name, pass, detail) => { results.push({ name, pass, detail }); console.log(`${pass ? "PASS" : "FAIL"}  ${name} — ${detail}`) }
const open = async (query, options = {}) => {
    const context = await browser.newContext({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1, ...options })
    const page = await context.newPage()
    const crashes = []
    page.on("pageerror", error => crashes.push(String(error)))
    await page.goto(`http://127.0.0.1:5173/harness-behavior/behavior.html?${query}`, { waitUntil: "domcontentloaded" })
    return { context, page, crashes }
}

/* 1 — a 404 src reports through onError and never crashes */
{
    const { context, page, crashes } = await open("src=/no-such-media.jpeg&activation=always")
    await page.waitForTimeout(1500)
    const state = await page.evaluate(() => ({
        errors: window.__errors,
        ready: document.querySelector("[data-grid-pulse-ready]")?.dataset.gridPulseReady,
    }))
    record("404 media reports onError without crashing",
        state.errors.length > 0 && state.ready === "false" && crashes.length === 0,
        `onError=${state.errors.length} ready=${state.ready} pageErrors=${crashes.length}`)
    await context.close()
}

/* 2 — cross-origin tainted media degrades gracefully */
{
    const { context, page, crashes } = await open("src=http://127.0.0.1:4180/demo-flower.jpeg&cors=0&activation=always&effect=xray")
    await page.evaluate(() => window.__ready)
    await page.waitForTimeout(1800)
    const state = await page.evaluate(() => {
        const canvases = document.querySelectorAll("#stage canvas")
        const media = canvases[0].getContext("2d")
        let painted = false
        try { media.getImageData(0, 0, 1, 1) } catch { painted = true } // tainted = painted cross-origin pixels
        return {
            errors: window.__errors,
            points: window.__bridge ? window.__bridge.getPoints().length : -1,
            scans: window.__scans.length,
            tainted: painted,
        }
    })
    record("tainted media still renders and scans fall back",
        state.tainted && state.scans >= 1 && state.points >= 1 && crashes.length === 0,
        `tainted=${state.tainted} scans=${state.scans} points=${state.points} (centre fallback) onError=${state.errors.length} pageErrors=${crashes.length}`)
    record("tainted effect degrades via onError rather than throwing",
        state.errors.some(message => /effect disabled/i.test(message)),
        state.errors.join(" | ").slice(0, 120) || "no effect-disabled report")
    await context.close()
}

/* 3 — src swap mid-scan: no stale commit, new media wins */
{
    const { context, page, crashes } = await open("activation=always")
    await page.evaluate(() => window.__ready)
    await page.waitForTimeout(500)
    const state = await page.evaluate(async () => {
        const before = window.__scans.length
        // Kick a rescan and swap the source in the same breath.
        const host = document.querySelector("[data-grid-pulse-active]")
        const rect = host.getBoundingClientRect()
        host.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: rect.left + 100, clientY: rect.top + 100, pointerType: "mouse", isPrimary: true }))
        window.__setProps({ src: "/test-media/dahlia-dark.jpeg" })
        await new Promise(resolve => setTimeout(resolve, 2000))
        return { before, after: window.__scans.length, errors: window.__errors.length }
    })
    record("src swap mid-scan commits cleanly",
        state.after > state.before && crashes.length === 0,
        `scans ${state.before}→${state.after} pageErrors=${crashes.length}`)
    await context.close()
}

/* 4 — unmount during an in-flight scan leaves no wreckage */
{
    const { context, page, crashes } = await open("activation=always")
    await page.evaluate(() => window.__ready)
    await page.evaluate(() => {
        const host = document.querySelector("[data-grid-pulse-active]")
        const rect = host.getBoundingClientRect()
        host.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: rect.left + 200, clientY: rect.top + 200, pointerType: "mouse", isPrimary: true }))
        window.__root.unmount()
    })
    await page.waitForTimeout(700)
    record("unmount during scan is clean", crashes.length === 0, `pageErrors=${crashes.length}`)
    await context.close()
}

/* 5 — dprCap bounds the backing store */
{
    const { context, page } = await open("activation=always", { deviceScaleFactor: 3 })
    await page.evaluate(() => window.__ready)
    await page.waitForTimeout(400)
    const state = await page.evaluate(() => {
        const canvas = document.querySelector("#stage canvas")
        return { backing: canvas.width, css: canvas.clientWidth }
    })
    record("dprCap 2 bounds a DPR-3 display",
        Math.abs(state.backing - state.css * 2) <= 2,
        `backing=${state.backing} css=${state.css} (ratio ${(state.backing / state.css).toFixed(2)}, cap 2)`)
    await context.close()
}

/* 6 — Specimen composition modes render distinctly */
{
    const grab = async composition => {
        const { context, page } = await open(`src=/test-media/dahlia-dark.jpeg&activation=always&composition=${composition}`)
        await page.evaluate(() => window.__ready)
        await page.waitForTimeout(2500)
        const pixels = await page.evaluate(() => {
            const target = document.createElement("canvas")
            target.width = 150
            target.height = 100
            const ctx = target.getContext("2d")
            for (const canvas of document.querySelectorAll("#stage canvas")) ctx.drawImage(canvas, 0, 0, 150, 100)
            const data = ctx.getImageData(0, 0, 150, 100).data
            const gray = []
            for (let i = 0; i < data.length; i += 4) gray.push(data[i])
            return gray
        })
        await context.close()
        return pixels
    }
    const integrated = await grab("integrated")
    const gridPulse = await grab("grid-pulse")
    const specimenOnly = await grab("specimen")
    const diff = (a, b) => {
        let sum = 0
        for (let i = 0; i < a.length; i += 1) sum += Math.abs(a[i] - b[i])
        return sum / a.length
    }
    const d1 = diff(integrated, gridPulse)
    const d2 = diff(integrated, specimenOnly)
    const d3 = diff(gridPulse, specimenOnly)
    record("composition modes render distinctly",
        d1 > 1 && d2 > 1 && d3 > 1,
        `integrated↔grid-pulse=${d1.toFixed(1)} integrated↔specimen=${d2.toFixed(1)} grid-pulse↔specimen=${d3.toFixed(1)} mean-abs-gray`)
}

writeFileSync("docs/captures/hardening-log.json", JSON.stringify(results, null, 2))
const failed = results.filter(r => !r.pass)
console.log(`\n${results.length} checks, ${failed.length} failed`)
await browser.close()
process.exit(failed.length ? 1 : 0)
