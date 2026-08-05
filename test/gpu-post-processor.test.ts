import { test } from "node:test"
import {
    FRAGMENT_SHADER_SOURCE,
    VERTEX_SHADER_SOURCE,
    resolveGpuBackend,
} from "../src/grid-pulse/GpuPostProcessor.ts"

test("gpu-post-processor suite (ported from SpecimenGridPulse-Pro-v2.8)", () => {

    function assert(condition: unknown, message: string) {
        if (!condition) throw new Error(message)
    }

    assert(resolveGpuBackend("auto", true) === "webgl2", "auto should prefer WebGL2")
    assert(resolveGpuBackend("auto", false) === "canvas2d", "auto should fall back")
    assert(resolveGpuBackend("webgl2", false) === "canvas2d", "forced WebGL2 should fail safely")
    assert(resolveGpuBackend("canvas2d", true) === "canvas2d", "Canvas2D should remain forced")
    assert(VERTEX_SHADER_SOURCE.includes("#version 300 es"), "vertex shader must target GLSL ES 3")
    assert(FRAGMENT_SHADER_SOURCE.includes("u_chromatic"), "fragment shader must expose chromatic aberration")
    assert(FRAGMENT_SHADER_SOURCE.includes("u_bloom"), "fragment shader must expose bloom")
    assert(FRAGMENT_SHADER_SOURCE.includes("u_scan"), "fragment shader must expose scan energy")
    assert(FRAGMENT_SHADER_SOURCE.includes("u_noise"), "fragment shader must expose procedural grain")
    assert(FRAGMENT_SHADER_SOURCE.includes("distortUv"), "fragment shader must distort UVs")
    console.log("GPU post-processor tests passed")

})
