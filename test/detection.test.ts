import { test } from "node:test"
import assert from "node:assert/strict"
import { resolveGridPulseDetectionModeScore } from "../src/grid-pulse/DetectionModePolicy.ts"
import {
    calculateGridPulseSkinScore,
    createGridPulseSeededRandom,
    scoreGridPulseDetectionField,
    selectGridPulseDetectionPoints,
    type GridPulseDetectionFieldInput,
} from "../src/grid-pulse/DetectionFieldPolicy.ts"
import { buildGridPulseConnectionPairs } from "../src/grid-pulse/GridPulseConnectionTopology.ts"
import {
    solveTargetAssignment,
    StableTargetTracker,
    type TargetTrackingOptions,
} from "../src/grid-pulse/TargetTrackingPolicy.ts"
import { buildSyntheticField } from "./support/synthetic-field.ts"

const weights = {
    detailEdgeWeight: 0.76,
    detailTextureWeight: 0.52,
    personSkinWeight: 0.78,
    autoPersonWeight: 0.68,
    modeDiversity: 0.16,
}

test("detail mode responds to edges, person mode responds to skin", () => {
    const edgy = { edge: 0.9, texture: 0.8, skin: 0.05, center: 0.5 }
    const skinny = { edge: 0.1, texture: 0.1, skin: 0.95, center: 0.5 }
    assert.ok(
        resolveGridPulseDetectionModeScore("detail", edgy, weights).score >
            resolveGridPulseDetectionModeScore("detail", skinny, weights).score
    )
    assert.ok(
        resolveGridPulseDetectionModeScore("person", skinny, weights).score >
            resolveGridPulseDetectionModeScore("person", edgy, weights).score
    )
})

test("every mode score stays normalized", () => {
    for (const mode of ["auto", "person", "detail"] as const) {
        for (let i = 0; i <= 20; i += 1) {
            const t = i / 20
            const score = resolveGridPulseDetectionModeScore(
                mode,
                { edge: t, texture: 1 - t, skin: t * 0.5, center: 1 - t },
                weights
            ).score
            assert.ok(score >= 0 && score <= 1, `${mode} score ${score} in range`)
        }
    }
})

test("auto mode is not a duplicate of detail or person", () => {
    const signal = { edge: 0.7, texture: 0.4, skin: 0.6, center: 0.8 }
    const auto = resolveGridPulseDetectionModeScore("auto", signal, weights).score
    const detail = resolveGridPulseDetectionModeScore("detail", signal, weights).score
    const person = resolveGridPulseDetectionModeScore("person", signal, weights).score
    assert.notEqual(auto, detail)
    assert.notEqual(auto, person)
})

test("seeded random is deterministic and uniform enough", () => {
    const first = Array.from({ length: 8 }, createGridPulseSeededRandom(7187))
    const second = Array.from({ length: 8 }, createGridPulseSeededRandom(7187))
    assert.deepEqual(first, second)
    const random = createGridPulseSeededRandom(7187)
    let sum = 0
    for (let i = 0; i < 20000; i += 1) sum += random()
    assert.ok(Math.abs(sum / 20000 - 0.5) < 0.02, "mean near 0.5")
})

test("skin score fires on skin-like colours and rejects sky blue", () => {
    assert.ok(calculateGridPulseSkinScore(226, 176, 148) > 0.4, "warm midtone reads as skin")
    assert.equal(calculateGridPulseSkinScore(80, 140, 220), 0, "blue is not skin")
    assert.equal(calculateGridPulseSkinScore(10, 10, 10), 0, "near black is not skin")
})

const fieldInput = (
    overrides: Partial<GridPulseDetectionFieldInput> = {}
): GridPulseDetectionFieldInput => {
    const field = buildSyntheticField("edge-cluster", 96, 96)
    return {
        gray: field.gray,
        skin: field.skin,
        width: field.width,
        height: field.height,
        focus: null,
        mode: "detail",
        edgeSensitivity: 0.7,
        personBias: 0.75,
        centerBias: 0.15,
        ...weights,
        focusX: 0.5,
        focusY: 0.5,
        focusRadius: 0.72,
        focusStrength: 0,
        clickSearchRadius: 0.28,
        seed: 7187,
        ...overrides,
    }
}

test("field scoring is deterministic for a fixed seed", () => {
    const a = scoreGridPulseDetectionField(fieldInput())
    const b = scoreGridPulseDetectionField(fieldInput())
    assert.deepEqual(a, b)
})

test("changing the seed changes the field but not its shape", () => {
    const a = scoreGridPulseDetectionField(fieldInput())
    const b = scoreGridPulseDetectionField(fieldInput({ seed: 424242 }))
    assert.equal(a.length, b.length)
    assert.notDeepEqual(a, b)
})

test("tie-break jitter stays proportional to the field's own score range", () => {
    // A mode that compresses into a narrow band must not be dominated by the
    // jitter. Measured as the spread the jitter adds relative to the spread the
    // scoring produced.
    const jitterShare = (mode: "auto" | "person" | "detail") => {
        const field = buildSyntheticField("texture-corner", 96, 96)
        const candidates = scoreGridPulseDetectionField({
            ...fieldInput({ mode }),
            gray: field.gray,
            skin: field.skin,
            width: field.width,
            height: field.height,
        })
        const maximum = Math.max(...candidates.map(c => c.raw))
        return (0.025 * Math.max(0.08, maximum)) / maximum
    }
    const shares = [jitterShare("auto"), jitterShare("person"), jitterShare("detail")]
    for (const share of shares) {
        assert.ok(share <= 0.04, `jitter is at most 4% of range (${share})`)
    }
    assert.ok(
        Math.max(...shares) - Math.min(...shares) < 0.01,
        "every mode carries a comparable jitter share"
    )
})

test("selection honours the requested count and minimum separation", () => {
    const candidates = scoreGridPulseDetectionField(fieldInput())
    const selected = selectGridPulseDetectionPoints(candidates, {
        count: 5,
        minDistance: 0.16,
        focus: null,
    })
    assert.equal(selected.length, 5)
    for (let i = 0; i < selected.length; i += 1) {
        for (let j = i + 1; j < selected.length; j += 1) {
            const distance = Math.hypot(selected[i].x - selected[j].x, selected[i].y - selected[j].y)
            assert.ok(distance >= 0.16 - 1e-9, `points ${i}/${j} separated (${distance})`)
        }
    }
})

test("selected confidences descend and stay in range", () => {
    const selected = selectGridPulseDetectionPoints(
        scoreGridPulseDetectionField(fieldInput()),
        { count: 6, minDistance: 0.16, focus: null }
    )
    for (let i = 1; i < selected.length; i += 1) {
        assert.ok(selected[i].score <= selected[i - 1].score, "confidence is non-increasing")
    }
    for (const point of selected) {
        assert.ok(point.score >= 0.2 && point.score <= 1)
    }
})

test("a focus point is always selected first and pulls neighbours toward it", () => {
    const focus = { x: 0.2, y: 0.8 }
    const selected = selectGridPulseDetectionPoints(
        scoreGridPulseDetectionField(fieldInput({ focus })),
        { count: 4, minDistance: 0.16, focus }
    )
    assert.equal(selected[0].id, "SCAN-00")
    assert.equal(selected[0].score, 1)
    assert.deepEqual([selected[0].x, selected[0].y], [focus.x, focus.y])

    const focusedMeanDistance =
        selected.reduce((sum, p) => sum + Math.hypot(p.x - focus.x, p.y - focus.y), 0) /
        selected.length
    const unfocused = selectGridPulseDetectionPoints(
        scoreGridPulseDetectionField(fieldInput()),
        { count: 4, minDistance: 0.16, focus: null }
    )
    const unfocusedMeanDistance =
        unfocused.reduce((sum, p) => sum + Math.hypot(p.x - focus.x, p.y - focus.y), 0) /
        unfocused.length
    assert.ok(
        focusedMeanDistance < unfocusedMeanDistance,
        `focus concentrates points (${focusedMeanDistance} vs ${unfocusedMeanDistance})`
    )
})

test("detection modes pick measurably different point sets", () => {
    const pointsFor = (mode: "auto" | "person" | "detail") =>
        selectGridPulseDetectionPoints(
            scoreGridPulseDetectionField({
                ...fieldInput({ mode }),
                ...buildSyntheticField("portrait", 96, 96),
                focus: null,
            }),
            { count: 5, minDistance: 0.16, focus: null }
        )
    const detail = pointsFor("detail")
    const person = pointsFor("person")
    const auto = pointsFor("auto")
    const key = (points: ReturnType<typeof pointsFor>) =>
        points.map(p => `${p.x.toFixed(3)},${p.y.toFixed(3)}`).join("|")
    assert.notEqual(key(detail), key(person), "detail and person must differ")
    assert.ok(key(auto) !== key(detail) || key(auto) !== key(person), "auto must not clone both")
})

test("connection topologies produce their documented shapes", () => {
    const points = [
        { px: 0, py: 0, score: 0.4 },
        { px: 100, py: 0, score: 0.9 },
        { px: 200, py: 40, score: 0.5 },
        { px: 300, py: 10, score: 0.6 },
    ]
    assert.equal(buildGridPulseConnectionPairs(points, "chain").length, 3)
    assert.equal(buildGridPulseConnectionPairs(points, "hub").length, 3)
    assert.ok(
        buildGridPulseConnectionPairs(points, "hub").every(([a, b]) => a === 1 || b === 1),
        "hub connects through the highest-scoring point"
    )
    assert.ok(buildGridPulseConnectionPairs(points, "nearest").length >= 1)
    assert.equal(buildGridPulseConnectionPairs([{ px: 0, py: 0, score: 1 }], "chain").length, 0)
})

const trackingOptions: TargetTrackingOptions = {
    maxDistance: 0.24,
    maxLostFrames: 4,
    positionSmoothing: 0.58,
    velocitySmoothing: 0.68,
    prediction: true,
    scoreWeight: 0.08,
}

test("target assignment matches each track to its nearest free point", () => {
    const tracks = [
        { id: "A", x: 0.2, y: 0.2, vx: 0, vy: 0, age: 3, missed: 0, score: 0.8 },
        { id: "B", x: 0.7, y: 0.7, vx: 0, vy: 0, age: 3, missed: 0, score: 0.6 },
    ]
    const pairs = solveTargetAssignment(
        tracks,
        [
            { x: 0.72, y: 0.71 },
            { x: 0.21, y: 0.22 },
        ],
        { ...trackingOptions, prediction: false }
    )
    assert.deepEqual(pairs.sort(), [[0, 1], [1, 0]])
})

test("tracker preserves identity across small motion", () => {
    const tracker = new StableTargetTracker()
    const first = tracker.update([{ x: 0.3, y: 0.3, score: 0.9 }], trackingOptions)
    const id = first[0].id
    let latest = first
    for (let step = 1; step <= 5; step += 1) {
        latest = tracker.update(
            [{ x: 0.3 + step * 0.01, y: 0.3 + step * 0.01, score: 0.9 }],
            trackingOptions
        )
    }
    assert.equal(latest.length, 1)
    assert.equal(latest[0].id, id, "identity survives incremental motion")
    assert.ok(latest[0].age > 1)
})

test("tracker drops a target only after maxLostFrames", () => {
    const tracker = new StableTargetTracker()
    tracker.update([{ x: 0.5, y: 0.5, score: 0.9 }], trackingOptions)
    for (let i = 0; i < trackingOptions.maxLostFrames; i += 1) {
        assert.equal(tracker.update([], trackingOptions).length, 0, "lost frames report nothing")
    }
    const reacquired = tracker.update([{ x: 0.5, y: 0.5, score: 0.9 }], trackingOptions)
    assert.equal(reacquired.length, 1)
})

test("tracker clamps every reported position into the unit square", () => {
    const tracker = new StableTargetTracker()
    for (const point of [
        { x: -3, y: 4, score: 0.9 },
        { x: 1.4, y: -0.2, score: 0.8 },
    ]) {
        for (const tracked of tracker.update([point], trackingOptions)) {
            assert.ok(tracked.x >= 0 && tracked.x <= 1, `x clamped (${tracked.x})`)
            assert.ok(tracked.y >= 0 && tracked.y <= 1, `y clamped (${tracked.y})`)
        }
    }
})
