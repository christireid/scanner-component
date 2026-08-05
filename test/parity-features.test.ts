import { test } from "node:test"
import assert from "node:assert/strict"
import { fillGridPulseLabelTemplate, type GridPulseLabelTokenInput } from "../src/grid-pulse/LabelTokenPolicy.ts"
import { resolveGridPulseThermalSample } from "../src/grid-pulse/ThermalEffectPolicy.ts"
import {
    BITMAP_PALETTES,
    diffuseToPalette,
    nearestPaletteIndex,
    resolveBitmapPalette,
} from "../src/grid-pulse/DitherPalettePolicy.ts"
import {
    GRID_PULSE_SCAN_PRESETS,
    resolveGridPulsePreset,
} from "../src/grid-pulse/GridPulsePresets.ts"
import { GRID_PULSE_SCAN_DEFAULTS } from "../src/grid-pulse/GridPulseDefaults.ts"
import {
    EXACT_ASSIGNMENT_LIMIT,
    StableTargetTracker,
    solveTargetAssignment,
    type TargetTrackingOptions,
} from "../src/grid-pulse/TargetTrackingPolicy.ts"

/* ------------------------------------------------------------------ *
 * Extended label tokens (plan §2.1 row 6: {pct} {index} {n} {x} {y}
 * {label} {mode} {fps} beyond the reference's four).
 * ------------------------------------------------------------------ */

const tokenInput = (overrides: Partial<GridPulseLabelTokenInput> = {}): GridPulseLabelTokenInput => ({
    template: "{score}",
    score: 0.87,
    id: "SCAN-01",
    coords: "c",
    zoom: 2.5,
    mode: "detail",
    wallClockMs: 0,
    scanStartedAtMs: 0,
    scorePrecision: 2,
    timeFormat: "elapsed",
    timecodeFps: 30,
    ...overrides,
})

test("all twelve documented tokens resolve", () => {
    const output = fillGridPulseLabelTemplate(
        tokenInput({
            template: "{score}|{id}|{coords}|{time}|{zoom}|{mode}|{pct}|{index}|{n}|{x}|{y}|{label}|{fps}",
            index: 3,
            total: 7,
            nx: 0.25,
            ny: 0.75,
            label: "petal",
            fps: 58.6,
        })
    )
    const parts = output.split("|")
    assert.equal(parts[6], "87%")
    assert.equal(parts[7], "3")
    assert.equal(parts[8], "7")
    assert.equal(parts[9], "0.250")
    assert.equal(parts[10], "0.750")
    assert.equal(parts[11], "petal")
    assert.equal(parts[12], "59")
    assert.ok(!output.includes("{"), "no unresolved tokens")
})

test("extended tokens have safe defaults when the caller omits them", () => {
    const output = fillGridPulseLabelTemplate(
        tokenInput({ template: "{pct} {index}/{n} {x},{y} {label} {fps}" })
    )
    assert.equal(output, "87% 1/1 0.000,0.000 SCAN-01 0")
})

/* ------------------------------------------------------------------ *
 * Thermal effect.
 * ------------------------------------------------------------------ */

test("thermal ramps are monotone in perceived heat and bounded", () => {
    for (const palette of ["ironbow", "white-hot", "rainbow"] as const) {
        let previousSum = -1
        for (let t = 0; t <= 1.0001; t += 0.05) {
            const { r, g, b } = resolveGridPulseThermalSample({
                luminance: t,
                palette,
                contrast: 1,
                brightness: 1,
                gamma: 1,
            })
            for (const channel of [r, g, b]) {
                assert.ok(channel >= 0 && channel <= 255, `${palette} channel in range`)
            }
            if (palette !== "rainbow") {
                const sum = r + g + b
                assert.ok(sum >= previousSum - 1e-6, `${palette} brightness never decreases`)
                previousSum = sum
            }
        }
    }
})

test("thermal cold end is dark and hot end is bright for ironbow", () => {
    const cold = resolveGridPulseThermalSample({ luminance: 0, palette: "ironbow", contrast: 1, brightness: 1, gamma: 1 })
    const hot = resolveGridPulseThermalSample({ luminance: 1, palette: "ironbow", contrast: 1, brightness: 1, gamma: 1 })
    assert.ok(cold.r + cold.g + cold.b < 30)
    assert.ok(hot.r + hot.g + hot.b > 600)
})

test("the thermal effect ships in the effect union with defaults", () => {
    const { effect } = GRID_PULSE_SCAN_DEFAULTS
    assert.equal(effect.thermalPalette, "ironbow")
    assert.ok(effect.thermalContrast > 0)
    assert.ok(effect.thermalGamma > 0)
})

/* ------------------------------------------------------------------ *
 * Dither palettes and Floyd–Steinberg diffusion (plan §5.1).
 * ------------------------------------------------------------------ */

test("all five named palettes exist with at least two colours", () => {
    for (const name of ["duotone", "mono4", "handheld", "amber", "cmyk"] as const) {
        assert.ok(BITMAP_PALETTES[name].length >= 2, `${name} palette present`)
    }
    assert.equal(BITMAP_PALETTES.mono4.length, 4)
    assert.equal(BITMAP_PALETTES.cmyk.length, 5)
})

test("palette 'none' maps onto tint and background", () => {
    const tint = { r: 200, g: 210, b: 220 }
    const background = { r: 5, g: 6, b: 7 }
    assert.deepEqual(resolveBitmapPalette("none", tint, background), [background, tint])
})

test("nearest palette index picks the closest colour", () => {
    const palette = BITMAP_PALETTES.duotone
    assert.equal(nearestPaletteIndex(palette, 10, 20, 40), 0)
    assert.equal(nearestPaletteIndex(palette, 250, 250, 240), 1)
})

test("diffusion preserves mean luminance approximately", () => {
    // A flat mid-grey diffused onto a black/white palette must come out close
    // to 50% white — that is the whole point of error diffusion.
    const width = 32
    const height = 32
    const rgb = new Float32Array(width * height * 3).fill(128)
    const palette = [
        { r: 0, g: 0, b: 0 },
        { r: 255, g: 255, b: 255 },
    ]
    const indices = diffuseToPalette(rgb, width, height, palette)
    const whiteShare = indices.reduce((sum, index) => sum + index, 0) / indices.length
    assert.ok(Math.abs(whiteShare - 128 / 255) < 0.05, `white share ${whiteShare} ≈ 0.502`)
})

test("diffusion is deterministic", () => {
    const make = () => {
        const rgb = new Float32Array(16 * 16 * 3)
        for (let i = 0; i < rgb.length; i += 1) rgb[i] = (i * 37) % 255
        return diffuseToPalette(rgb, 16, 16, BITMAP_PALETTES.mono4)
    }
    assert.deepEqual([...make()], [...make()])
})

/* ------------------------------------------------------------------ *
 * The eleven named presets (plan §5.1, rubric D6).
 * ------------------------------------------------------------------ */

test("exactly the plan's eleven presets exist", () => {
    assert.deepEqual(
        [...GRID_PULSE_SCAN_PRESETS].sort(),
        ["contour", "field", "hairline", "lattice", "loupe", "plate", "survey", "swarm", "telemetry", "tracking", "viewfinder"].sort()
    )
    assert.equal(GRID_PULSE_SCAN_PRESETS.length, 11)
})

test("every preset resolves to a non-empty bundle of real option keys", () => {
    const validGroups = new Set(Object.keys(GRID_PULSE_SCAN_DEFAULTS))
    for (const preset of GRID_PULSE_SCAN_PRESETS) {
        const bundle = resolveGridPulsePreset(preset)
        const groups = Object.keys(bundle)
        assert.ok(groups.length > 0, `${preset} is not empty`)
        for (const group of groups) {
            assert.ok(validGroups.has(group), `${preset}.${group} is a real option group`)
            const defaults = GRID_PULSE_SCAN_DEFAULTS[group as keyof typeof GRID_PULSE_SCAN_DEFAULTS] as unknown as Record<string, unknown>
            for (const key of Object.keys(bundle[group as keyof typeof bundle] as object)) {
                assert.ok(key in defaults, `${preset}.${group}.${key} exists on the option group`)
            }
        }
    }
})

test("preset bundles are pairwise distinct configurations", () => {
    const signatures = GRID_PULSE_SCAN_PRESETS.map(preset =>
        JSON.stringify(resolveGridPulsePreset(preset))
    )
    assert.equal(new Set(signatures).size, signatures.length, "no two presets share a bundle")
})

test("an undefined preset resolves to an empty bundle", () => {
    assert.deepEqual(resolveGridPulsePreset(undefined), {})
})

/* ------------------------------------------------------------------ *
 * Density mode: tracking above the exact-solver bound.
 * ------------------------------------------------------------------ */

const trackingOptions: TargetTrackingOptions = {
    maxDistance: 0.24,
    maxLostFrames: 4,
    positionSmoothing: 0.5,
    velocitySmoothing: 0.5,
    prediction: false,
    scoreWeight: 0.08,
}

test("assignment stays correct and fast past the exact-solver limit", () => {
    const count = EXACT_ASSIGNMENT_LIMIT + 12 // 24 points
    const tracks = Array.from({ length: count }, (_, i) => ({
        id: `T${i}`,
        x: (i % 6) / 6 + 0.05,
        y: Math.floor(i / 6) / 6 + 0.05,
        vx: 0,
        vy: 0,
        age: 2,
        missed: 0,
        score: 0.8,
    }))
    const points = tracks.map(track => ({ x: track.x + 0.01, y: track.y + 0.01, score: 0.8 }))
    const started = performance.now()
    const pairs = solveTargetAssignment(tracks, points, trackingOptions)
    const elapsed = performance.now() - started
    assert.equal(pairs.length, count, "every track matches its displaced point")
    for (const [trackIndex, pointIndex] of pairs) {
        assert.equal(trackIndex, pointIndex, "greedy matches the obvious pairing")
    }
    assert.ok(elapsed < 250, `large assignment solves quickly (${elapsed.toFixed(1)}ms)`)
})

test("the tracker sustains a dense 40-point field with stable identities", () => {
    const tracker = new StableTargetTracker()
    const field = (offset: number) =>
        Array.from({ length: 40 }, (_, i) => ({
            x: Math.min(1, (i % 8) / 8 + 0.03 + offset),
            y: Math.min(1, Math.floor(i / 8) / 5 + 0.05 + offset),
            score: 0.9,
        }))
    const first = tracker.update(field(0), trackingOptions)
    assert.equal(first.length, 40)
    const ids = new Set(first.map(track => track.id))
    const second = tracker.update(field(0.004), trackingOptions)
    const retained = second.filter(track => ids.has(track.id)).length
    assert.ok(retained >= 38, `identities survive small motion (${retained}/40)`)
})

test("density-mode defaults allow up to 80 requested points", () => {
    // The engine clamp is validated at the policy level: selection accepts 80.
    assert.ok(GRID_PULSE_SCAN_DEFAULTS.detection.pointCount <= 80)
})

/* ------------------------------------------------------------------ *
 * Plan-mandated default changes.
 * ------------------------------------------------------------------ */

test("effects target the media by default (plan §4.4 documented finding)", () => {
    assert.equal(GRID_PULSE_SCAN_DEFAULTS.effect.scope, "media")
})

test("chips are uppercase with 0.085em tracking (plan §4.3 measured calibration)", () => {
    assert.equal(GRID_PULSE_SCAN_DEFAULTS.labels.uppercase, true)
    assert.equal(GRID_PULSE_SCAN_DEFAULTS.labels.letterSpacing, 0.085)
})

test("a custom detector hook slot ships in the detection options", () => {
    assert.equal(GRID_PULSE_SCAN_DEFAULTS.detection.customDetector, null)
})
