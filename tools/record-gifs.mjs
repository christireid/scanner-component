#!/usr/bin/env node
/**
 * README GIF recorder.
 *
 * Drives real component scenarios in headless Chromium and assembles GIFs
 * with true per-frame timing: screenshots are slow (~100-200ms each), so each
 * frame stores its real captured delay rather than pretending a fixed rate.
 * Frames: page.screenshot (full DOM, HUD included) → fast-png decode →
 * 2x2 box downscale → gifenc (256-colour palette from sampled frames).
 *
 * Requires the dev server on :5173 and the behaviour harness built.
 * Writes docs/gifs/*.gif. Run: node tools/record-gifs.mjs [name ...]
 */
import { chromium } from "playwright"
import { createRequire } from "node:module"
const require = createRequire(import.meta.url)
const { decode } = require("fast-png")
const jpeg = require("jpeg-js")
const { GIFEncoder, quantize, applyPalette } = require("gifenc")
import { mkdirSync, writeFileSync } from "node:fs"

const OUT = "docs/gifs"
mkdirSync(OUT, { recursive: true })

const STAGE = { x: 0, y: 0, width: 1120, height: 700 } // clip inside the 1200x800 stage
const SCALE = 2 // 2x2 box downscale → 560x350 output

const base = "http://127.0.0.1:5173/harness-behavior/behavior.html"

/**
 * Each scenario: url, total capture duration, and an optional driver that
 * receives (page, tick) — tick(fn, atMs) schedules one-shot actions on the
 * capture timeline.
 */
const SCENARIOS = {
    "hero": {
        url: `${base}?activation=hover&src=/demo-flower.jpeg`,
        durationMs: 5200,
        async drive(page, at) {
            await page.mouse.move(600, 900)
            at(600, () => page.mouse.move(560, 350, { steps: 8 }))
            at(2600, () => page.mouse.move(760, 420, { steps: 20 }))
            at(4000, () => page.mouse.move(420, 300, { steps: 20 }))
        },
    },
    "click-rescan": {
        url: `${base}?activation=always&src=/demo-flower.jpeg`,
        durationMs: 5600,
        async drive(page, at) {
            at(1200, () => page.mouse.click(320, 200))
            at(3400, () => page.mouse.click(820, 500))
        },
    },
    "detection-modes": {
        url: `${base}?activation=always&src=/test-media/saponaria-magenta.jpeg&mode=auto`,
        durationMs: 6400,
        async drive(page, at) {
            at(2100, () => page.evaluate(() => window.__setProps({ detection: { mode: "person", pointCount: 6 } })))
            at(4200, () => page.evaluate(() => window.__setProps({ detection: { mode: "detail", pointCount: 6 } })))
        },
    },
    "effects": {
        url: `${base}?activation=always&src=/test-media/dahlia-dark.jpeg`,
        durationMs: 7800,
        async drive(page, at) {
            const effects = ["bitmap", "pixelated", "code", "xray", "thermal"]
            effects.forEach((type, index) => {
                at(1300 * (index + 1), () => page.evaluate(t => window.__setProps({ effect: { type: t, scope: "media" } }), type))
            })
        },
    },
    "palettes": {
        url: `${base}?activation=always&src=/test-media/dahlia-dark.jpeg&effect=bitmap`,
        durationMs: 6000,
        async drive(page, at) {
            await page.evaluate(() => window.__setProps({ effect: { type: "bitmap", bitmapMethod: "diffusion", bitmapPalette: "duotone", scope: "media" } }))
            const palettes = ["mono4", "handheld", "amber", "cmyk"]
            palettes.forEach((palette, index) => {
                at(1200 * (index + 1), () => page.evaluate(p => window.__setProps({ effect: { type: "bitmap", bitmapMethod: "diffusion", bitmapPalette: p, scope: "media" } }), palette))
            })
        },
    },
    "presets": {
        url: `${base}?activation=always&src=/demo-flower.jpeg`,
        durationMs: 11000,
        frameEveryMs: 220,
        async drive(page, at) {
            const presets = ["loupe", "telemetry", "plate", "survey", "lattice", "contour", "hairline", "swarm", "field", "viewfinder", "tracking"]
            presets.forEach((preset, index) => {
                at(1000 * index + 1, () => page.evaluate(p => window.__setProps({ preset: p }), preset))
            })
        },
    },
    "specimen-scenes": {
        url: `${base}?activation=always&composition=integrated&src=/demo-flower.jpeg`,
        durationMs: 15000,
        frameEveryMs: 280,
        async drive(page, at) {
            const scenes = ["Zoom Insets", "Survey Grid", "Detection Swarm", "Annotation Plate", "Point Mesh", "Viewfinder", "Contour Scan", "Facade Analysis", "Botanical Analysis"]
            scenes.forEach((scene, index) => {
                at(1500 * (index + 1), () => page.evaluate(s => window.__setProps({ preset: s }), scene))
            })
        },
    },
    "video-tracking": {
        url: `${base}?activation=always&src=/test-media/dahlia-pan.webm&autoRescan=900&mode=detail`,
        durationMs: 6500,
        drive: async () => {},
    },
    "adaptive-chrome": {
        url: `${base}?activation=always&src=/test-media/xray-lilies-white.jpeg`,
        durationMs: 7000,
        async drive(page, at) {
            at(3200, () => page.evaluate(() => window.__setProps({ src: "/test-media/dahlia-dark.jpeg" })))
        },
    },
    "crosshair": {
        url: `${base}?activation=always&src=/test-media/helichrysum-soft.jpeg`,
        durationMs: 5200,
        async drive(page, at) {
            await page.evaluate(() => window.__setProps({ preset: "telemetry" }))
            await page.mouse.move(300, 250)
            at(400, () => page.mouse.move(850, 300, { steps: 24 }))
            at(2200, () => page.mouse.move(700, 550, { steps: 24 }))
            at(3800, () => page.mouse.move(350, 400, { steps: 24 }))
        },
    },
}

const downscale = (rgba, width, height) => {
    const w = Math.floor(width / SCALE)
    const h = Math.floor(height / SCALE)
    const out = new Uint8Array(w * h * 4)
    for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) {
            let r = 0, g = 0, b = 0
            for (let dy = 0; dy < SCALE; dy += 1) {
                for (let dx = 0; dx < SCALE; dx += 1) {
                    const i = ((y * SCALE + dy) * width + x * SCALE + dx) * 4
                    r += rgba[i]; g += rgba[i + 1]; b += rgba[i + 2]
                }
            }
            const n = SCALE * SCALE
            const o = (y * w + x) * 4
            out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = 255
        }
    }
    return { data: out, width: w, height: h }
}

const wanted = process.argv.slice(2)
const names = wanted.length ? wanted : Object.keys(SCENARIOS)

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell", args: ["--no-sandbox"] })

for (const name of names) {
    const scenario = SCENARIOS[name]
    if (!scenario) { console.error(`unknown scenario ${name}`); continue }
    const context = await browser.newContext({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 })
    const page = await context.newPage()
    await page.goto(scenario.url, { waitUntil: "domcontentloaded" })
    await page.evaluate(() => window.__ready)
    await page.waitForTimeout(900)

    const pending = []
    const at = (ms, fn) => pending.push({ ms, fn, done: false })
    await scenario.drive(page, at)

    // CDP screencast streams JPEG frames asynchronously at real frame rate,
    // scaled in-browser — far faster than per-frame screenshots.
    const client = await context.newCDPSession(page)
    const frames = []
    const started = Date.now()
    client.on("Page.screencastFrame", async event => {
        frames.push({ at: Date.now() - started, base64: event.data })
        await client.send("Page.screencastFrameAck", { sessionId: event.sessionId }).catch(() => undefined)
    })
    await client.send("Page.startScreencast", {
        format: "jpeg",
        quality: 70,
        maxWidth: 500,
        maxHeight: 320,
        everyNthFrame: 2,
    })
    while (Date.now() - started < scenario.durationMs) {
        const t = Date.now() - started
        for (const action of pending) {
            if (!action.done && t >= action.ms) { action.done = true; await action.fn() }
        }
        await new Promise(resolve => setTimeout(resolve, 15))
    }
    await client.send("Page.stopScreencast").catch(() => undefined)
    await context.close()

    // Thin to the scenario cadence, decode, and letterbox-free crop to even
    // dimensions. Screencast already scaled to <=560x350 in-browser.
    const frameEvery = scenario.frameEveryMs ?? 160
    const thinned = []
    let lastAt = -Infinity
    for (const frame of frames) {
        if (frame.at - lastAt >= frameEvery) { thinned.push(frame); lastAt = frame.at }
    }
    const decoded = thinned.map(frame => {
        const image = jpeg.decode(Buffer.from(frame.base64, "base64"), { useTArray: true, formatAsRGBA: true })
        return { at: frame.at, data: new Uint8Array(image.data.buffer, image.data.byteOffset, image.data.byteLength), width: image.width, height: image.height }
    })
    const sampleStride = Math.max(1, Math.floor(decoded.length / 6))
    const sampleFrames = []
    for (let i = 0; i < decoded.length; i += sampleStride) sampleFrames.push(decoded[i].data)
    const paletteSample = new Uint8Array(sampleFrames.reduce((sum, data) => sum + data.length, 0))
    let offset = 0
    for (const data of sampleFrames) { paletteSample.set(data, offset); offset += data.length }
    const palette = quantize(paletteSample, 256)

    const gif = GIFEncoder()
    decoded.forEach((frame, index) => {
        const nextAt = decoded[index + 1] ? decoded[index + 1].at : frame.at + frameEvery
        const delay = Math.max(30, Math.round(nextAt - frame.at))
        const indexed = applyPalette(frame.data, palette)
        gif.writeFrame(indexed, frame.width, frame.height, { palette, delay })
    })
    gif.finish()
    const bytes = gif.bytes()
    writeFileSync(`${OUT}/${name}.gif`, bytes)
    console.log(`${name}.gif — ${decoded.length} frames, ${(bytes.length / 1024 / 1024).toFixed(2)} MB, ${decoded[0].width}x${decoded[0].height}`)
}

await browser.close()
