export type ThermalPalette = "ironbow" | "white-hot" | "rainbow"

export interface GridPulseThermalSampleInput {
    luminance: number
    palette: ThermalPalette
    contrast: number
    brightness: number
    gamma: number
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

/**
 * Piecewise-linear colour ramps. Stops are (t, r, g, b) with t ascending.
 * Ironbow is the conventional thermal-camera ramp: black → deep blue →
 * magenta → orange → yellow → white.
 */
const RAMPS: Record<ThermalPalette, ReadonlyArray<readonly [number, number, number, number]>> = {
    ironbow: [
        [0, 0, 0, 0],
        [0.15, 32, 0, 96],
        [0.35, 136, 12, 130],
        [0.58, 224, 78, 26],
        [0.8, 255, 180, 24],
        [1, 255, 255, 240],
    ],
    "white-hot": [
        [0, 0, 0, 0],
        [1, 255, 255, 255],
    ],
    rainbow: [
        [0, 8, 8, 60],
        [0.25, 0, 96, 255],
        [0.5, 0, 220, 120],
        [0.75, 255, 220, 0],
        [1, 255, 40, 40],
    ],
}

/**
 * Resolves one thermal false-colour sample from source luminance.
 * Pure so the ramp can be tested without a canvas.
 */
export const resolveGridPulseThermalSample = (
    input: GridPulseThermalSampleInput
): { r: number; g: number; b: number } => {
    const contrasted = clamp01(
        (clamp01(input.luminance) - 0.5) * Math.max(0, input.contrast) + 0.5
    )
    const t = clamp01(
        Math.pow(contrasted * Math.max(0, input.brightness), Math.max(0.1, input.gamma))
    )
    const ramp = RAMPS[input.palette]
    for (let index = 1; index < ramp.length; index += 1) {
        if (t <= ramp[index][0]) {
            const [t0, r0, g0, b0] = ramp[index - 1]
            const [t1, r1, g1, b1] = ramp[index]
            const local = t1 === t0 ? 0 : (t - t0) / (t1 - t0)
            return {
                r: r0 + (r1 - r0) * local,
                g: g0 + (g1 - g0) * local,
                b: b0 + (b1 - b0) * local,
            }
        }
    }
    const last = ramp[ramp.length - 1]
    return { r: last[1], g: last[2], b: last[3] }
}
