import { test } from "node:test"
import assert from "node:assert/strict"
import { resolveGridPulseGridAnimation } from "../src/grid-pulse/GridAnimationPolicy.ts"
import { resolveGridPulseConnectionAnimation } from "../src/grid-pulse/ConnectionAnimationPolicy.ts"
import { resolveGridPulseBoxAnimation } from "../src/grid-pulse/ScanBoxAnimationPolicy.ts"
import { resolveScanSweepState } from "../src/grid-pulse/ScanSweepPolicy.ts"
import { resolveGridPulseCrosshairMotion } from "../src/grid-pulse/CrosshairMotionPolicy.ts"
import {
    easeGridPulseReveal,
    resolveGridPulseBatchStart,
    resolveGridPulseRevealProgress,
    resolveGridPulseRevealSpan,
} from "../src/grid-pulse/ReducedMotionPolicy.ts"
import { resolveGridPulseInteractionAlpha } from "../src/grid-pulse/InteractionTransitionPolicy.ts"
import { resolveGridPulseRescanTransition } from "../src/grid-pulse/RescanTransitionPolicy.ts"

const gridInput = (overrides: Record<string, unknown> = {}) => ({
    now: 1000,
    width: 1200,
    height: 800,
    spacing: 150,
    reducedMotion: false,
    animate: true,
    animation: "hybrid" as const,
    speed: 1,
    driftX: 10,
    driftY: 6,
    pulseStrength: 0.2,
    scanWidth: 0.18,
    scanStrength: 0.34,
    scanDirection: "diagonal" as const,
    dash: [2, 7],
    ...overrides,
})

test("grid drift stays within one spacing period", () => {
    for (let now = 0; now <= 20000; now += 137) {
        const frame = resolveGridPulseGridAnimation(gridInput({ now }))
        assert.ok(frame.offsetX >= 0 && frame.offsetX < 150)
        assert.ok(frame.offsetY >= 0 && frame.offsetY < 150)
    }
})

test("reduced motion freezes every grid channel", () => {
    const frame = resolveGridPulseGridAnimation(gridInput({ reducedMotion: true }))
    assert.equal(frame.offsetX, 0)
    assert.equal(frame.offsetY, 0)
    assert.equal(frame.dashOffset, 0)
    assert.equal(frame.opacityMultiplier, 1)
    assert.equal(frame.scanStrength, 0)
})

test("grid animation modes activate only their own channel", () => {
    const drift = resolveGridPulseGridAnimation(gridInput({ animation: "drift" }))
    assert.ok(drift.offsetX > 0)
    assert.equal(drift.dashOffset, 0)
    assert.equal(drift.opacityMultiplier, 1)

    const pulse = resolveGridPulseGridAnimation(gridInput({ animation: "pulse" }))
    assert.equal(pulse.offsetX, 0)
    assert.notEqual(pulse.opacityMultiplier, 1)
})

test("connection draw progress is monotonic and terminates at one", () => {
    let previous = -1
    for (let now = 0; now <= 900; now += 30) {
        const state = resolveGridPulseConnectionAnimation({
            animation: "draw",
            now,
            revealedAt: 0,
            index: 0,
            duration: 420,
            stagger: 55,
            flowSpeed: 0.16,
            flowLength: 42,
            lineLength: 220,
            reducedMotion: false,
        })
        assert.ok(state.drawProgress >= previous - 1e-9, "draw progress must not go backwards")
        previous = state.drawProgress
    }
    assert.equal(previous, 1)
})

test("static connections and reduced motion render fully drawn immediately", () => {
    for (const input of [
        { animation: "static" as const, reducedMotion: false },
        { animation: "hybrid" as const, reducedMotion: true },
    ]) {
        const state = resolveGridPulseConnectionAnimation({
            now: 0,
            revealedAt: 0,
            index: 3,
            duration: 420,
            stagger: 55,
            flowSpeed: 0.16,
            flowLength: 42,
            lineLength: 220,
            ...input,
        })
        assert.equal(state.drawProgress, 1)
        assert.equal(state.animating, false)
    }
})

test("box acquire animation runs lock, frame, media, then settle in order", () => {
    const at = (now: number) =>
        resolveGridPulseBoxAnimation({
            animation: "acquire",
            now,
            revealedAt: 0,
            index: 0,
            stagger: 52,
            lockDuration: 150,
            unfoldDuration: 320,
            mediaDelay: 120,
            settleDuration: 420,
            reducedMotion: false,
        })
    const early = at(60)
    const mid = at(300)
    const late = at(1400)
    assert.ok(early.lockProgress > 0 && early.frameProgress < mid.frameProgress)
    assert.ok(mid.mediaProgress < late.mediaProgress)
    assert.ok(late.settleProgress > mid.settleProgress)
    assert.ok(Math.abs(late.scale - 1) < 0.02, "settled scale returns to unity")
})

test("box spring overshoot is bounded", () => {
    for (let now = 0; now <= 3000; now += 7) {
        const state = resolveGridPulseBoxAnimation({
            animation: "acquire",
            now,
            revealedAt: 0,
            index: 0,
            stagger: 52,
            lockDuration: 150,
            unfoldDuration: 320,
            mediaDelay: 120,
            settleDuration: 420,
            reducedMotion: false,
        })
        assert.ok(state.frameProgress <= 1.055 + 1e-9, `overshoot bounded (${state.frameProgress})`)
        assert.ok(state.scale <= 1.02, `scale bounded (${state.scale})`)
    }
})

test("scan sweep loop stays in range and ping-pong reverses", () => {
    const sweep = (now: number, mode: "loop" | "pingpong" | "once") =>
        resolveScanSweepState({
            now,
            revealedAt: 0,
            index: 0,
            duration: 1450,
            delay: 0,
            mode,
            easing: "linear",
            reducedMotion: false,
        })
    for (let now = 0; now <= 6000; now += 53) {
        assert.ok(sweep(now, "loop").progress >= 0 && sweep(now, "loop").progress <= 1)
    }
    assert.ok(sweep(2175, "pingpong").progress < sweep(1450, "pingpong").progress + 1e-9)
    assert.equal(sweep(5000, "once").complete, true)
    assert.equal(sweep(5000, "once").active, false)
})

test("crosshair follower is frame-rate independent", () => {
    const stepTo = (steps: number, deltaMs: number) => {
        let x = 0
        for (let i = 0; i < steps; i += 1) {
            x = resolveGridPulseCrosshairMotion({
                currentX: x,
                currentY: 0,
                targetX: 100,
                targetY: 0,
                deltaMs,
                mode: "smooth",
                responseMs: 95,
                snapThreshold: 0.35,
                reducedMotion: false,
            }).x
        }
        return x
    }
    const at60 = stepTo(12, 100 / 12)
    const at30 = stepTo(6, 100 / 6)
    assert.ok(Math.abs(at60 - at30) < 1.5, `refresh rates converge (${at60} vs ${at30})`)
})

test("crosshair snaps within the snap threshold and in instant mode", () => {
    const near = resolveGridPulseCrosshairMotion({
        currentX: 99.9,
        currentY: 0,
        targetX: 100,
        targetY: 0,
        deltaMs: 16,
        mode: "smooth",
        responseMs: 95,
        snapThreshold: 0.35,
        reducedMotion: false,
    })
    assert.equal(near.settled, true)
    assert.equal(near.x, 100)

    const instant = resolveGridPulseCrosshairMotion({
        currentX: 0,
        currentY: 0,
        targetX: 100,
        targetY: 50,
        deltaMs: 16,
        mode: "instant",
        responseMs: 95,
        snapThreshold: 0.35,
        reducedMotion: false,
    })
    assert.deepEqual([instant.x, instant.y], [100, 50])
})

test("reveal easings all start at zero and end at one", () => {
    for (const easing of ["linear", "easeOut", "easeInOut"] as const) {
        assert.equal(easeGridPulseReveal(0, easing), 0)
        assert.equal(easeGridPulseReveal(1, easing), 1)
        assert.ok(easeGridPulseReveal(0.5, easing) > 0)
    }
})

test("reduced-motion instant reveal collapses the stagger span", () => {
    const revealedAt = [1000, 1090, 1180, 1270]
    assert.equal(resolveGridPulseBatchStart(revealedAt), 1000)
    assert.equal(resolveGridPulseRevealSpan(revealedAt, true, "instant"), 0)
    assert.equal(resolveGridPulseRevealSpan(revealedAt, true, "staggered"), 270)
    assert.equal(resolveGridPulseRevealSpan(revealedAt, false, "instant"), 270)

    const progress = resolveGridPulseRevealProgress({
        now: 1000,
        revealedAt: 1270,
        batchStart: 1000,
        duration: 420,
        easing: "easeOut",
        reducedMotion: true,
        reducedMotionReveal: "instant",
    })
    assert.equal(progress, 1, "last point is already visible at batch start")
})

test("interaction alpha rises on enter and falls on exit", () => {
    const enter = resolveGridPulseInteractionAlpha({
        active: true,
        previousAlpha: 0,
        startedAt: 0,
        now: 180,
        enterDuration: 180,
        exitDuration: 220,
        reducedMotion: false,
    })
    assert.equal(enter, 1)
    const exit = resolveGridPulseInteractionAlpha({
        active: false,
        previousAlpha: 1,
        startedAt: 0,
        now: 220,
        enterDuration: 180,
        exitDuration: 220,
        reducedMotion: false,
    })
    assert.equal(exit, 0)
})

test("rescan fade holds a blackout gap, crossfade does not", () => {
    const shared = {
        now: 1010,
        startedAt: 900,
        committedAt: 1000,
        exitDuration: 150,
        gap: 35,
        enterDuration: 240,
        reducedMotion: false,
    }
    assert.equal(resolveGridPulseRescanTransition({ ...shared, mode: "fade" }).phase, "gap")
    assert.equal(resolveGridPulseRescanTransition({ ...shared, mode: "crossfade" }).phase, "entering")
    assert.equal(
        resolveGridPulseRescanTransition({ ...shared, mode: "instant" }).complete,
        true
    )
})
