import { test } from "node:test"
import { degradeQuality, resolveVisionQuality, shouldDegradeQuality } from "../src/grid-pulse/AdaptiveQuality.ts"

test("adaptive-quality suite (ported from SpecimenGridPulse-Pro-v2.8)", () => {

    function assert(condition: unknown, message: string) {
        if (!condition) throw new Error(message)
    }

    assert(resolveVisionQuality("auto", { devicePixelRatio: 1, deviceMemory: 16, hardwareConcurrency: 12, reducedMotion: false, compact: false, webgl2Available: true }).tier === "ultra", "high-end devices should resolve to ultra")
    assert(resolveVisionQuality("auto", { devicePixelRatio: 3, deviceMemory: 4, hardwareConcurrency: 4, reducedMotion: false, compact: true, webgl2Available: true }).tier === "balanced", "compact devices should resolve to balanced")
    assert(resolveVisionQuality("auto", { devicePixelRatio: 2, deviceMemory: 2, hardwareConcurrency: 2, reducedMotion: false, compact: false, webgl2Available: true }).tier === "low", "constrained devices should resolve to low")
    assert(resolveVisionQuality("auto", { devicePixelRatio: 1, reducedMotion: true, compact: false, webgl2Available: true }).tier === "low", "reduced motion should resolve to low")
    assert(degradeQuality("ultra") === "high", "ultra should degrade to high")
    assert(degradeQuality("high") === "balanced", "high should degrade to balanced")
    assert(degradeQuality("balanced") === "low", "balanced should degrade to low")
    assert(shouldDegradeQuality(30, 3, 50), "sustained slow frames should degrade")
    assert(!shouldDegradeQuality(18, 3, 50), "frames within budget should not degrade")
    console.log("adaptive quality tests passed")

})
