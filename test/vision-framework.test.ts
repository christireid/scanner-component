import { test } from "node:test"
import {
    InspectionEffectStack,
    SCIENTIFIC_VISION_THEME,
    VisionPerformanceMonitor,
    VisionTimeline,
} from "../src/grid-pulse/VisionFramework.ts"

test("vision-framework suite (ported from SpecimenGridPulse-Pro-v2.8)", () => {

    function assert(condition: unknown, message: string): asserts condition {
        if (!condition) throw new Error(message)
    }

    const stack = new InspectionEffectStack([
        { type: "zoom", intensity: 1 },
        { type: "grain", intensity: 0.2 },
        { type: "bloom", enabled: false, intensity: 1 },
    ])
    assert(stack.has("zoom"), "zoom effect should be present")
    assert(!stack.has("bloom"), "disabled effects should be excluded")
    assert(stack.intensity("grain") === 0.2, "effect intensity should be retained")

    const monitor = new VisionPerformanceMonitor()
    monitor.record(10, 16.67)
    const metrics = monitor.record(30, 16.67)
    assert(metrics.frameCount === 2, "frame count should increment")
    assert(metrics.droppedFrames === 1, "slow frame should count as dropped")
    assert(metrics.maxFrameMs === 30, "maximum frame duration should be tracked")

    const timeline = new VisionTimeline(2)
    timeline.push(100, [{ x: 0.1, y: 0.2, id: "a", score: 1 }])
    timeline.push(200, [{ x: 0.2, y: 0.3, id: "b", score: 0.9 }])
    timeline.push(300, [{ x: 0.3, y: 0.4, id: "c", score: 0.8 }])
    assert(timeline.list().length === 2, "timeline should enforce capacity")
    assert(timeline.nearest(220)?.at === 200, "nearest timeline frame should be returned")
    assert(SCIENTIFIC_VISION_THEME.optics.refraction > 0, "theme optics should be configured")

    console.log(JSON.stringify({
        effects: stack.list().length,
        metrics,
        timelineFrames: timeline.list().length,
        theme: SCIENTIFIC_VISION_THEME.id,
    }, null, 2))

})
