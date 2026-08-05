import { test } from "node:test"
import assert from "node:assert/strict"
import {
    clampNumber,
    gridPulseOverlapArea,
    layoutGridPulseBoxes,
    layoutGridPulseTrackingFrames,
    nearestPointOnGridPulseBox,
    type GridPulseLayoutOptions,
} from "../src/grid-pulse/GridPulseGeometry.ts"

const layoutOptions = (overrides: Partial<GridPulseLayoutOptions> = {}): GridPulseLayoutOptions => ({
    width: 112,
    height: 112,
    mobileScale: 0.76,
    gap: 64,
    padding: 8,
    avoidOverlap: true,
    clampToBounds: true,
    ...overrides,
})

const points = [
    { px: 300, py: 200 },
    { px: 620, py: 340 },
    { px: 900, py: 520 },
    { px: 180, py: 640 },
    { px: 1050, py: 160 },
]

test("clampNumber bounds values on both sides", () => {
    assert.equal(clampNumber(-5, 0, 10), 0)
    assert.equal(clampNumber(50, 0, 10), 10)
    assert.equal(clampNumber(4, 0, 10), 4)
})

test("callout layout emits exactly one box per point", () => {
    const boxes = layoutGridPulseBoxes(points, 1200, 800, layoutOptions(), false)
    assert.equal(boxes.length, points.length)
})

test("callout boxes stay inside the padded frame when clampToBounds is on", () => {
    const boxes = layoutGridPulseBoxes(points, 1200, 800, layoutOptions(), false)
    for (const box of boxes) {
        assert.ok(box.x >= 8 - 1e-6, `left edge ${box.x} inside padding`)
        assert.ok(box.y >= 8 - 1e-6, `top edge ${box.y} inside padding`)
        assert.ok(box.x + box.width <= 1200 - 8 + 1e-6, "right edge inside padding")
        assert.ok(box.y + box.height <= 800 - 8 + 1e-6, "bottom edge inside padding")
    }
})

test("callout boxes never cover their own anchor marker", () => {
    const boxes = layoutGridPulseBoxes(points, 1200, 800, layoutOptions(), false)
    for (const box of boxes) {
        const covered =
            box.anchorX > box.x &&
            box.anchorX < box.x + box.width &&
            box.anchorY > box.y &&
            box.anchorY < box.y + box.height
        assert.equal(covered, false, "anchor must remain visible outside its callout")
    }
})

test("compact layout shrinks boxes by the mobile scale", () => {
    const desktop = layoutGridPulseBoxes(points, 1200, 800, layoutOptions(), false)
    const mobile = layoutGridPulseBoxes(points, 390, 700, layoutOptions(), true)
    assert.ok(mobile[0].width < desktop[0].width, "compact boxes must be smaller")
    assert.equal(mobile[0].width, 112 * 0.76)
})

test("avoidOverlap reduces total box-to-box overlap", () => {
    const clustered = [
        { px: 400, py: 300 },
        { px: 420, py: 315 },
        { px: 440, py: 330 },
        { px: 460, py: 345 },
    ]
    const totalOverlap = (options: GridPulseLayoutOptions) => {
        const boxes = layoutGridPulseBoxes(clustered, 1200, 800, options, false)
        let sum = 0
        for (let i = 0; i < boxes.length; i += 1) {
            for (let j = i + 1; j < boxes.length; j += 1) {
                sum += gridPulseOverlapArea(boxes[i], boxes[j])
            }
        }
        return sum
    }
    assert.ok(
        totalOverlap(layoutOptions({ avoidOverlap: true })) <=
            totalOverlap(layoutOptions({ avoidOverlap: false })),
        "overlap avoidance must not increase overlap"
    )
})

test("nearestPointOnGridPulseBox lands on the box perimeter", () => {
    const box = { x: 100, y: 100, width: 200, height: 120, anchorX: 0, anchorY: 0 }
    const near = nearestPointOnGridPulseBox(50, 160, box)
    assert.equal(near.x, 100)
    assert.ok(near.y >= 100 && near.y <= 220)
})

test("layout is deterministic for identical input", () => {
    const first = layoutGridPulseBoxes(points, 1200, 800, layoutOptions(), false)
    const second = layoutGridPulseBoxes(points, 1200, 800, layoutOptions(), false)
    assert.deepEqual(first, second)
})

test("tracking frames emit one square frame per point and keep the anchor inside", () => {
    const frames = layoutGridPulseTrackingFrames(points, 1200, 800, {
        compact: false,
        scale: 1,
        safeTop: 24,
        safeBottom: 24,
        padding: 8,
        minGap: 12,
    })
    assert.equal(frames.length, points.length)
    for (const frame of frames) {
        assert.equal(frame.width, frame.height, "tracking frames are square")
        assert.ok(frame.anchorX >= frame.x && frame.anchorX <= frame.x + frame.width)
        assert.ok(frame.anchorY >= frame.y && frame.anchorY <= frame.y + frame.height)
    }
})

test("tracking frames honour the safe-area insets", () => {
    const frames = layoutGridPulseTrackingFrames(points, 1200, 800, {
        compact: false,
        scale: 1,
        safeTop: 60,
        safeBottom: 60,
        padding: 8,
        minGap: 12,
    })
    for (const frame of frames) {
        assert.ok(frame.y >= 60 - 1e-6, `top inset respected (${frame.y})`)
        assert.ok(frame.y + frame.height <= 800 - 60 + 1e-6, "bottom inset respected")
    }
})

test("tracking parallax translates frames without resizing them", () => {
    const base = layoutGridPulseTrackingFrames(points, 1200, 800, {
        compact: false,
        scale: 1,
        safeTop: 24,
        safeBottom: 24,
        padding: 8,
        minGap: 12,
    })
    const shifted = layoutGridPulseTrackingFrames(points, 1200, 800, {
        compact: false,
        scale: 1,
        safeTop: 24,
        safeBottom: 24,
        padding: 8,
        minGap: 12,
        parallaxX: 10,
        parallaxY: -6,
    })
    assert.equal(base.length, shifted.length)
    for (let index = 0; index < base.length; index += 1) {
        assert.equal(base[index].width, shifted[index].width)
    }
    assert.notDeepEqual(base, shifted, "parallax must move at least one frame")
})
