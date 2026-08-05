import { test } from "node:test"
import { coherentNoise2D, fractalNoise2D, RenderingPipeline, RENDERER_PROFILES } from "../src/grid-pulse/RenderingPipeline.ts"

test("rendering-pipeline suite (ported from SpecimenGridPulse-Pro-v2.8)", () => {

    function assert(condition: boolean, message: string) {
        if (!condition) throw new Error(message)
    }

    const sampleA = coherentNoise2D(1.25, 4.5, 7)
    const sampleB = coherentNoise2D(1.25, 4.5, 7)
    assert(sampleA === sampleB, "coherent noise must be deterministic")
    assert(sampleA >= -1 && sampleA <= 1, "coherent noise must be normalized")

    const fractal = fractalNoise2D(0.7, 1.2, 3, 4)
    assert(fractal >= -1 && fractal <= 1, "fractal noise must be normalized")

    const pipeline = new RenderingPipeline()
    assert(Math.abs(pipeline.targetInterval(true, RENDERER_PROFILES.feature) - 20) < 0.001, "feature active FPS budget")
    assert(pipeline.targetInterval(false, RENDERER_PROFILES.feature) > pipeline.targetInterval(true, RENDERER_PROFILES.feature), "idle budget must be lower")

    for (const profile of Object.values(RENDERER_PROFILES)) {
        assert(profile.lens.magnification > 0, `${profile.profile}: magnification`)
        assert(profile.targetFps >= profile.idleFps, `${profile.profile}: frame budget`)
        assert(profile.temporalPersistence >= 0 && profile.temporalPersistence <= 1, `${profile.profile}: persistence range`)
    }

    console.log(JSON.stringify({
        status: "PASS",
        deterministicNoise: sampleA,
        fractalNoise: fractal,
        profiles: Object.keys(RENDERER_PROFILES).length,
        featureActiveIntervalMs: pipeline.targetInterval(true, RENDERER_PROFILES.feature),
        featureIdleIntervalMs: pipeline.targetInterval(false, RENDERER_PROFILES.feature),
    }, null, 2))

})
