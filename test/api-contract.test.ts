import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { GRID_PULSE_SCAN_DEFAULTS } from "../src/grid-pulse/GridPulseDefaults.ts"
import { parseBoxShadow } from "../src/grid-pulse/BoxShadowPolicy.ts"
import { resolveGridPulseTouchBehavior } from "../src/grid-pulse/TouchInteractionPolicy.ts"

/**
 * The non-regression contract. These assertions describe the shipped API and
 * shipped defaults, so any silent change to the public surface fails here
 * rather than in a consumer's project.
 */

const OPTION_GROUPS = [
    "media",
    "detection",
    "grid",
    "connections",
    "crosshair",
    "boxes",
    "labels",
    "effect",
    "interaction",
    "motion",
    "rendering",
    "theme",
] as const

test("every documented option group ships defaults", () => {
    for (const group of OPTION_GROUPS) {
        assert.ok(group in GRID_PULSE_SCAN_DEFAULTS, `${group} defaults exist`)
        assert.equal(
            typeof GRID_PULSE_SCAN_DEFAULTS[group],
            "object",
            `${group} defaults are an object`
        )
    }
    assert.equal(Object.keys(GRID_PULSE_SCAN_DEFAULTS).length, OPTION_GROUPS.length)
})

test("no default is undefined or NaN", () => {
    for (const [group, values] of Object.entries(GRID_PULSE_SCAN_DEFAULTS)) {
        for (const [key, value] of Object.entries(values as unknown as Record<string, unknown>)) {
            assert.notEqual(value, undefined, `${group}.${key} is defined`)
            if (typeof value === "number") {
                assert.ok(Number.isFinite(value), `${group}.${key} is finite`)
            }
        }
    }
})

test("the marketplace feature scope is present in the defaults", () => {
    const { detection, effect, grid, crosshair, connections, boxes, interaction, media } =
        GRID_PULSE_SCAN_DEFAULTS
    assert.ok(["auto", "person", "detail", "custom"].includes(detection.mode))
    assert.equal(grid.visible, true)
    assert.equal(grid.animate, true)
    assert.ok(["leaders", "points", "both"].includes(connections.topology))
    assert.equal(connections.tickMarks, true)
    assert.equal(boxes.scanSweep, true)
    assert.equal(crosshair.visible, true)
    assert.equal(crosshair.showCoordinates, true)
    assert.equal(interaction.clickToRescan, true)
    assert.ok(["none", "bitmap", "pixelated", "code", "xray"].includes(effect.type))
    assert.equal(media.type, "auto", "image and video are both resolvable")
})

test("superset capabilities remain configurable", () => {
    const { detection, boxes, connections, effect, theme, rendering } = GRID_PULSE_SCAN_DEFAULTS
    assert.equal(detection.trackingMode, "stable", "target tracking is on by default")
    assert.ok(detection.temporalSmoothing > 0, "video reacquisition smoothing is on")
    assert.ok(["nearest", "chain", "hub"].includes(connections.pointTopology), "point meshes")
    assert.ok(["threshold", "ordered", "halftone"].includes(effect.bitmapMethod), "dither modes")
    assert.ok(effect.codeEdgeWeight > 0, "code contour tracing")
    assert.ok(effect.pixelLevels >= 0, "pixel density modes")
    assert.ok(["callout", "tracking"].includes(boxes.layout), "Specimen tracking frames")
    assert.equal(typeof boxes.trackingParallax, "number", "tracking parallax")
    assert.equal(theme.adaptiveChromeElements, true)
    assert.equal(rendering.demandDriven, true)
})

test("timing defaults stay inside sane human ranges", () => {
    const { motion, interaction, boxes } = GRID_PULSE_SCAN_DEFAULTS
    assert.ok(motion.revealDuration > 0 && motion.revealDuration <= 1200)
    assert.ok(motion.stagger >= 0 && motion.stagger <= 400)
    assert.ok(interaction.enterDuration > 0 && interaction.enterDuration <= 600)
    assert.ok(interaction.exitDuration > 0 && interaction.exitDuration <= 600)
    assert.ok(interaction.leaveDelay >= 0 && interaction.leaveDelay <= 500)
    assert.ok(boxes.animationStagger >= 0 && boxes.animationStagger <= 400)
})

test("every colour default parses as a CSS colour literal", () => {
    const colourKeys: Array<[string, string]> = [
        ["grid.color", GRID_PULSE_SCAN_DEFAULTS.grid.color],
        ["connections.color", GRID_PULSE_SCAN_DEFAULTS.connections.color],
        ["crosshair.color", GRID_PULSE_SCAN_DEFAULTS.crosshair.color],
        ["boxes.borderColor", GRID_PULSE_SCAN_DEFAULTS.boxes.borderColor],
        ["boxes.backgroundColor", GRID_PULSE_SCAN_DEFAULTS.boxes.backgroundColor],
        ["boxes.scanColor", GRID_PULSE_SCAN_DEFAULTS.boxes.scanColor],
        ["labels.color", GRID_PULSE_SCAN_DEFAULTS.labels.color],
        ["labels.background", GRID_PULSE_SCAN_DEFAULTS.labels.background],
        ["labels.borderColor", GRID_PULSE_SCAN_DEFAULTS.labels.borderColor],
        ["effect.tint", GRID_PULSE_SCAN_DEFAULTS.effect.tint],
        ["effect.background", GRID_PULSE_SCAN_DEFAULTS.effect.background],
        ["theme.background", GRID_PULSE_SCAN_DEFAULTS.theme.background],
        ["theme.chromeLight", GRID_PULSE_SCAN_DEFAULTS.theme.chromeLight],
        ["theme.chromeDark", GRID_PULSE_SCAN_DEFAULTS.theme.chromeDark],
    ]
    const pattern = /^(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))$/
    for (const [name, value] of colourKeys) {
        assert.match(value, pattern, `${name} = ${value}`)
    }
})

test("the shipped box shadow default actually parses", () => {
    const parsed = parseBoxShadow(GRID_PULSE_SCAN_DEFAULTS.boxes.shadow)
    assert.ok(parsed, "a non-none shadow parses")
    assert.deepEqual(
        { offsetX: parsed.offsetX, offsetY: parsed.offsetY, blur: parsed.blur },
        { offsetX: 0, offsetY: 12, blur: 42 },
        "the declared offsets are the rendered offsets"
    )
    assert.equal(parsed.color, "rgba(0,0,0,.42)")
})

test("box shadow parsing accepts the CSS forms authors write", () => {
    assert.equal(parseBoxShadow("none"), null)
    assert.equal(parseBoxShadow(""), null)
    assert.deepEqual(parseBoxShadow("0 12px 42px rgba(0,0,0,.42)"), {
        offsetX: 0,
        offsetY: 12,
        blur: 42,
        color: "rgba(0,0,0,.42)",
    })
    assert.deepEqual(parseBoxShadow("0px 12px 42px #000"), {
        offsetX: 0,
        offsetY: 12,
        blur: 42,
        color: "#000",
    })
    assert.deepEqual(parseBoxShadow("2px -4px 10px 3px rgba(0, 0, 0, 0.5)"), {
        offsetX: 2,
        offsetY: -4,
        blur: 10,
        color: "rgba(0, 0, 0, 0.5)",
    })
    assert.deepEqual(parseBoxShadow("0 0 rgba(0,0,0,.4)"), {
        offsetX: 0,
        offsetY: 0,
        blur: 0,
        color: "rgba(0,0,0,.4)",
    })
})

test("touch behaviour resolves auto against activation and mobileAlwaysOn", () => {
    const base = { currentlyActive: false, phase: "down" as const }
    assert.equal(
        resolveGridPulseTouchBehavior({
            ...base,
            behavior: "auto",
            activation: "hover",
            mobileAlwaysOn: true,
        }).resolvedBehavior,
        "always"
    )
    assert.equal(
        resolveGridPulseTouchBehavior({
            ...base,
            behavior: "auto",
            activation: "tap",
            mobileAlwaysOn: false,
        }).resolvedBehavior,
        "tap-toggle"
    )
    assert.equal(
        resolveGridPulseTouchBehavior({
            ...base,
            behavior: "auto",
            activation: "hover",
            mobileAlwaysOn: false,
        }).resolvedBehavior,
        "rescan"
    )
})

test("tap-toggle flips state and press-hold releases on lift", () => {
    const toggle = resolveGridPulseTouchBehavior({
        behavior: "tap-toggle",
        activation: "tap",
        mobileAlwaysOn: false,
        currentlyActive: true,
        phase: "down",
    })
    assert.equal(toggle.active, false)

    const hold = resolveGridPulseTouchBehavior({
        behavior: "press-hold",
        activation: "hover",
        mobileAlwaysOn: false,
        currentlyActive: true,
        phase: "up",
    })
    assert.equal(hold.releaseAfterMs, true)
})

test("nothing outside the entry point reaches into the implementation directory", () => {
    for (const file of ["src/demo/App.tsx", "src/main.tsx"]) {
        const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8")
        assert.ok(
            !/from\s+"[^"]*grid-pulse\//.test(source),
            `${file} must import through src/GridPulseScanPro.tsx`
        )
    }
})

test("the entry point exports both renderers and their surfaces", () => {
    const entry = readFileSync(new URL("../src/GridPulseScanPro.tsx", import.meta.url), "utf8")
    // Default export is the integrated Specimen renderer (v2.8 stable entry
    // contract); the Grid Pulse engine stays exported alongside it.
    assert.match(entry, /export default SpecimenGridPulse/)
    assert.match(entry, /export \{ default as GridPulseScan \}/)
    assert.match(entry, /GRID_PULSE_SCAN_DEFAULTS/)
    assert.match(entry, /SPECIMEN_GRID_PRESETS/)
    assert.match(entry, /GRID_PULSE_SCAN_PRESETS/)
    assert.match(entry, /GridPulseScanProps/)
    assert.match(entry, /GridPulseRenderBridge/)
    assert.match(entry, /VisionPlugin/)
})
