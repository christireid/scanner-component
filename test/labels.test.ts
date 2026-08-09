import { test } from "node:test"
import assert from "node:assert/strict"
import {
    fillGridPulseLabelTemplate,
    formatGridPulseLabelTime,
    resolveGridPulseLabelCoordinateStyle,
    type GridPulseLabelTokenInput,
} from "../src/grid-pulse/LabelTokenPolicy.ts"
import { GRID_PULSE_SCAN_DEFAULTS } from "../src/grid-pulse/GridPulseDefaults.ts"

const tokenInput = (
    overrides: Partial<GridPulseLabelTokenInput> = {}
): GridPulseLabelTokenInput => ({
    template: "{score}",
    score: 0.8734,
    id: "SCAN-01",
    coords: "12.3456° N · 65.4321° W",
    zoom: 2.5,
    mode: "detail",
    wallClockMs: Date.UTC(2026, 0, 2, 3, 4, 5, 678),
    scanStartedAtMs: Date.UTC(2026, 0, 2, 3, 4, 1, 178),
    scorePrecision: 2,
    timeFormat: "elapsed",
    timecodeFps: 30,
    ...overrides,
})

test("every documented token is substituted", () => {
    const output = fillGridPulseLabelTemplate(
        tokenInput({ template: "{score}|{id}|{coords}|{zoom}|{mode}|{time}" })
    )
    const parts = output.split("|")
    assert.equal(parts[0], "0.87")
    assert.equal(parts[1], "SCAN-01")
    assert.equal(parts[2], "12.3456° N · 65.4321° W")
    assert.equal(parts[3], "2.50×")
    assert.equal(parts[4], "detail")
    assert.ok(parts[5].length > 0)
    assert.ok(!output.includes("{"), "no token braces survive")
})

test("unknown tokens are left untouched", () => {
    const output = fillGridPulseLabelTemplate(tokenInput({ template: "{score} {nope}" }))
    assert.equal(output, "0.87 {nope}")
})

test("score precision is honoured and clamped", () => {
    assert.equal(fillGridPulseLabelTemplate(tokenInput({ scorePrecision: 0 })), "1")
    assert.equal(fillGridPulseLabelTemplate(tokenInput({ scorePrecision: 4 })), "0.8734")
    assert.equal(fillGridPulseLabelTemplate(tokenInput({ scorePrecision: 99 })), "0.873400")
})

test("score is clamped into 0..1 before formatting", () => {
    assert.equal(fillGridPulseLabelTemplate(tokenInput({ score: 4 })), "1.00")
    assert.equal(fillGridPulseLabelTemplate(tokenInput({ score: -2 })), "0.00")
})

test("elapsed and timecode formats are scan-relative and deterministic", () => {
    const base = {
        wallClockMs: Date.UTC(2026, 0, 2, 3, 4, 5, 678),
        scanStartedAtMs: Date.UTC(2026, 0, 2, 3, 4, 1, 178),
        timecodeFps: 30,
    }
    assert.equal(
        formatGridPulseLabelTime({ ...base, format: "elapsed" }),
        "+00:00:04.500"
    )
    assert.equal(
        formatGridPulseLabelTime({ ...base, format: "timecode" }),
        "00:00:04:15"
    )
})

test("timecode frame index never reaches the frame rate", () => {
    for (let ms = 0; ms < 1000; ms += 7) {
        const output = formatGridPulseLabelTime({
            wallClockMs: ms,
            scanStartedAtMs: 0,
            format: "timecode",
            timecodeFps: 24,
        })
        const frame = Number(output.split(":")[3])
        assert.ok(frame >= 0 && frame <= 23, `frame ${frame} within 0..23`)
    }
})

test("label coordinate style inherits from the crosshair unless overridden", () => {
    assert.equal(resolveGridPulseLabelCoordinateStyle("inherit", "percent"), "percent")
    assert.equal(resolveGridPulseLabelCoordinateStyle("pixels", "percent"), "pixels")
})

test("the shipped default label template contains only real tokens", () => {
    const template = GRID_PULSE_SCAN_DEFAULTS.labels.template
    const rendered = fillGridPulseLabelTemplate(tokenInput({ template }))
    assert.ok(!/\{[a-z]+\}/.test(rendered), "no unresolved tokens remain")
    assert.ok(
        !/\((?:score|id|coords|time|zoom|mode)\)/.test(template),
        "a token must not be written with parentheses instead of braces"
    )
    assert.equal(rendered, "TGT 1 · 0.87")
})
