import { test } from "node:test"
import assert from "node:assert/strict"
import {
    bitmapThresholdAt,
    quantizeBitmapLevel,
    resolveBitmapGrid,
} from "../src/grid-pulse/BitmapEffectPolicy.ts"
import {
    quantizeChannel,
    resolvePixelatedGrid,
} from "../src/grid-pulse/PixelatedEffectPolicy.ts"
import {
    resolveCodeGlyph,
    resolveCodeGrid,
    resolveCodeSignal,
} from "../src/grid-pulse/CodeEffectPolicy.ts"
import { resolveGridPulseXraySample } from "../src/grid-pulse/XrayEffectPolicy.ts"
import {
    analyzeAdaptiveChromeRegion,
    resolveAdaptiveChromeStyle,
} from "../src/grid-pulse/AdaptiveChromePolicy.ts"
import {
    adaptiveChromeZoneIndex,
    averageRgba,
    buildAdaptiveChromeZonePalette,
    chooseAdaptiveChrome,
    contrastRatio,
    dualToneVisibilityContrast,
    relativeLuminance,
} from "../src/grid-pulse/AdaptiveChrome.ts"

test("bitmap grid covers the frame and centres only when asked", () => {
    const anchored = resolveBitmapGrid({ width: 200, height: 130, scale: 3, anchor: "image" })
    assert.equal(anchored.cellSize, 3)
    assert.ok(anchored.columns * anchored.cellSize >= 200)
    assert.ok(anchored.rows * anchored.cellSize >= 130)
    assert.deepEqual([anchored.offsetX, anchored.offsetY], [0, 0])

    const centred = resolveBitmapGrid({ width: 200, height: 130, scale: 3, anchor: "center" })
    assert.ok(centred.offsetX <= 0 && centred.offsetY <= 0, "centring pulls the lattice back")
})

test("every Bayer matrix threshold stays in range and varies by cell", () => {
    for (const matrix of ["bayer2", "bayer4", "bayer8"] as const) {
        const seen = new Set<number>()
        for (let y = 0; y < 8; y += 1) {
            for (let x = 0; x < 8; x += 1) {
                const value = bitmapThresholdAt(matrix, x, y, 0.52, 1)
                assert.ok(value >= 0 && value <= 1, `${matrix} threshold in range`)
                seen.add(Number(value.toFixed(6)))
            }
        }
        assert.ok(seen.size > 1, `${matrix} must dither, not flat-threshold`)
    }
})

test("negative dither coordinates wrap instead of reading out of bounds", () => {
    assert.equal(bitmapThresholdAt("bayer4", -1, -1, 0.5, 1), bitmapThresholdAt("bayer4", 3, 3, 0.5, 1))
})

test("bitmap intensity zero collapses the dither to a flat threshold", () => {
    for (let x = 0; x < 4; x += 1) {
        assert.equal(bitmapThresholdAt("bayer4", x, 1, 0.52, 0), 0.52)
    }
})

test("bitmap level quantization snaps to the requested step count", () => {
    assert.equal(quantizeBitmapLevel(0.4, 2), 0)
    assert.equal(quantizeBitmapLevel(0.6, 2), 1)
    assert.equal(quantizeBitmapLevel(0.5, 3), 0.5)
    assert.equal(quantizeBitmapLevel(2, 4), 1, "out-of-range input clamps")
})

test("pixel grid keeps the gap inside the cell", () => {
    const geometry = resolvePixelatedGrid({
        width: 300,
        height: 200,
        cellSize: 9,
        gap: 40,
        anchor: "image",
    })
    assert.equal(geometry.cellSize, 9)
    assert.ok(geometry.gap < geometry.cellSize, "gap can never erase the block")
    assert.ok(geometry.columns * geometry.cellSize >= 300)
})

test("channel quantization is identity at zero or one level", () => {
    for (const levels of [0, 1]) {
        assert.equal(quantizeChannel(137, levels), 137)
    }
    assert.equal(quantizeChannel(137, 2), 255)
    assert.equal(quantizeChannel(100, 2), 0)
    assert.equal(quantizeChannel(999, 4), 255, "input clamps to 0..255")
})

test("code grid enforces a legible minimum cell", () => {
    const geometry = resolveCodeGrid(400, 300, 1, "image")
    assert.equal(geometry.cellSize, 4)
    assert.ok(geometry.columns * geometry.cellSize >= 400)
})

test("code signal blends luminance with edges under a gamma curve", () => {
    const flat = resolveCodeSignal(0.5, 0, 0, 1)
    assert.ok(Math.abs(flat - 0.5) < 1e-9)
    assert.ok(resolveCodeSignal(0.5, 1, 1, 1) > flat, "edge weight lifts edgy cells")
    assert.ok(resolveCodeSignal(0.5, 0, 0, 0.5) > flat, "gamma below one brightens")
})

test("code glyph selection is monotone and thresholds out empty cells", () => {
    const characters = " .:-=+*#%@"
    assert.equal(resolveCodeGlyph(0.01, characters, 0.055), "", "below threshold emits nothing")
    let previousIndex = -1
    for (let signal = 0.1; signal <= 1; signal += 0.05) {
        const glyph = resolveCodeGlyph(signal, characters, 0.055)
        const index = characters.indexOf(glyph)
        assert.ok(index >= previousIndex, "glyph density must not decrease with signal")
        previousIndex = index
    }
    assert.equal(resolveCodeGlyph(1, characters, 0), "@", "full signal picks the densest glyph")
})

test("code glyph selection never indexes past the character set", () => {
    for (const characters of ["01", " .:-=+*#%@", "AB"]) {
        assert.notEqual(resolveCodeGlyph(1, characters, 0), undefined)
        assert.ok(characters.includes(resolveCodeGlyph(1.5, characters, 0)))
    }
})

test("x-ray output is normalized for every parameter combination", () => {
    for (const invert of [false, true]) {
        for (let luminance = 0; luminance <= 1; luminance += 0.25) {
            for (let edge = 0; edge <= 1; edge += 0.25) {
                const value = resolveGridPulseXraySample({
                    luminance,
                    edgeMagnitude: edge,
                    invert,
                    contrast: 1.45,
                    brightness: 1.06,
                    edgeStrength: 3.6,
                    edgeThreshold: 0.045,
                    glow: 1,
                    preserveDetail: 0,
                })
                assert.ok(value >= 0 && value <= 1, `x-ray value ${value} in range`)
            }
        }
    }
})

test("x-ray invert flips dark and bright source values", () => {
    const shared = {
        edgeMagnitude: 0,
        contrast: 1,
        brightness: 1,
        edgeStrength: 0,
        edgeThreshold: 1,
        glow: 0,
        preserveDetail: 0,
    }
    const dark = resolveGridPulseXraySample({ ...shared, luminance: 0.1, invert: true })
    const bright = resolveGridPulseXraySample({ ...shared, luminance: 0.9, invert: true })
    assert.ok(dark > bright, "inverted x-ray brightens shadows")
})

test("x-ray preserveDetail pulls output back toward the source", () => {
    const shared = {
        luminance: 0.2,
        edgeMagnitude: 0,
        invert: true,
        contrast: 1.45,
        brightness: 1.06,
        edgeStrength: 0,
        edgeThreshold: 1,
        glow: 0,
    }
    const none = resolveGridPulseXraySample({ ...shared, preserveDetail: 0 })
    const full = resolveGridPulseXraySample({ ...shared, preserveDetail: 1 })
    assert.ok(Math.abs(full - 0.2) < Math.abs(none - 0.2), "detail retention tracks the source")
})

test("relative luminance and contrast follow WCAG", () => {
    assert.ok(Math.abs(relativeLuminance({ r: 255, g: 255, b: 255 }) - 1) < 1e-9)
    assert.ok(Math.abs(relativeLuminance({ r: 0, g: 0, b: 0 })) < 1e-9)
    const ratio = contrastRatio({ r: 255, g: 255, b: 255 }, { r: 0, g: 0, b: 0 })
    assert.ok(Math.abs(ratio - 21) < 1e-6, `black on white is 21:1 (${ratio})`)
})

test("adaptive chrome picks the higher-contrast candidate and reports it honestly", () => {
    const white = { r: 255, g: 255, b: 255 }
    const black = { r: 5, g: 5, b: 5 }
    const onDarkMedia = chooseAdaptiveChrome({ r: 12, g: 12, b: 14 }, white, black)
    assert.equal(onDarkMedia.color, "light")
    assert.ok(onDarkMedia.contrast >= 4.5)

    // Two low-contrast candidates cannot reach the target; the stronger one
    // still wins and the shortfall is reported rather than hidden.
    const impossible = chooseAdaptiveChrome(
        { r: 128, g: 128, b: 128 },
        { r: 140, g: 140, b: 140 },
        { r: 118, g: 118, b: 118 }
    )
    assert.ok(impossible.contrast < 4.5, "an unreachable target is not faked")
    assert.equal(
        impossible.contrast,
        Math.max(impossible.lightContrast, impossible.darkContrast)
    )
})

test("dual-tone visibility reports the better of the two strokes", () => {
    const background = { r: 20, g: 20, b: 20 }
    const light = { r: 255, g: 255, b: 255 }
    const dark = { r: 0, g: 0, b: 0 }
    assert.equal(
        dualToneVisibilityContrast(background, light, dark),
        Math.max(contrastRatio(background, light), contrastRatio(background, dark))
    )
})

test("zone indexing covers the frame without escaping the palette", () => {
    const columns = 3
    const rows = 3
    for (const [x, y] of [[0, 0], [0.999999, 0.999999], [1.4, -2], [0.5, 0.5]]) {
        const index = adaptiveChromeZoneIndex(x, y, columns, rows)
        assert.ok(index >= 0 && index < columns * rows, `zone ${index} inside palette`)
    }
    assert.equal(adaptiveChromeZoneIndex(0.1, 0.1, 3, 3), 0)
    assert.equal(adaptiveChromeZoneIndex(0.9, 0.9, 3, 3), 8)
})

test("zone palette fills every cell even from a short sample list", () => {
    const palette = buildAdaptiveChromeZonePalette(
        [{ r: 10, g: 10, b: 10 }],
        3,
        3,
        { r: 255, g: 255, b: 255 },
        { r: 5, g: 5, b: 5 }
    )
    assert.equal(palette.decisions.length, 9)
    assert.ok(palette.decisions.every(decision => decision.color === "light"))
})

test("averageRgba weights by alpha and survives fully transparent input", () => {
    const opaque = averageRgba(new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 255]))
    assert.ok(Math.abs(opaque.r - 127.5) < 1e-6)
    const transparent = averageRgba(new Uint8ClampedArray([255, 0, 0, 0]))
    assert.deepEqual(transparent, { r: 127.5, g: 127.5, b: 127.5 })
})

test("region analysis separates a flat region from a busy one", () => {
    const flat = new Uint8ClampedArray(16 * 16 * 4).fill(128)
    const busy = new Uint8ClampedArray(16 * 16 * 4)
    for (let i = 0; i < 16 * 16; i += 1) {
        const value = i % 2 === 0 ? 0 : 255
        busy[i * 4] = value
        busy[i * 4 + 1] = value
        busy[i * 4 + 2] = value
        busy[i * 4 + 3] = 255
    }
    const flatStats = analyzeAdaptiveChromeRegion(flat, 16, 16)
    const busyStats = analyzeAdaptiveChromeRegion(busy, 16, 16)
    assert.ok(busyStats.edgeDensity > flatStats.edgeDensity)
    assert.ok(busyStats.variance > flatStats.variance)
})

test("chrome style compensates for contrast shortfall and simplifies busy regions", () => {
    const calm = { luminance: 0.5, variance: 0, edgeDensity: 0, saturation: 0 }
    const busy = { luminance: 0.5, variance: 1, edgeDensity: 1, saturation: 0.5 }
    const short = resolveAdaptiveChromeStyle(calm, 1.5, 4.5)
    const met = resolveAdaptiveChromeStyle(calm, 8, 4.5)
    assert.ok(short.opacityMultiplier > met.opacityMultiplier, "shortfall raises opacity")
    assert.ok(resolveAdaptiveChromeStyle(busy, 8, 4.5).simplify > met.simplify)
    for (const style of [short, met, resolveAdaptiveChromeStyle(busy, 1, 4.5)]) {
        assert.ok(style.opacityMultiplier >= 0.72 && style.opacityMultiplier <= 1.42)
        assert.ok(style.labelBackgroundOpacity >= 0 && style.labelBackgroundOpacity <= 1)
        assert.ok(style.glowStrength >= 0 && style.glowStrength <= 1)
    }
})

test("adaptive glow can be switched off entirely", () => {
    const stats = { luminance: 0.5, variance: 0.2, edgeDensity: 0.2, saturation: 0 }
    assert.equal(resolveAdaptiveChromeStyle(stats, 1, 4.5, 0.78, 0.52, false).glowStrength, 0)
})
