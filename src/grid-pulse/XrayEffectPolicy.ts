export interface GridPulseXraySampleInput {
    luminance: number
    edgeMagnitude: number
    invert: boolean
    contrast: number
    brightness: number
    edgeStrength: number
    edgeThreshold: number
    glow: number
    preserveDetail: number
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

/**
 * Resolves one normalized X-Ray output value. Keeping this math outside the
 * canvas renderer makes the visual policy deterministic and independently testable.
 */
export const resolveGridPulseXraySample = ({
    luminance,
    edgeMagnitude,
    invert,
    contrast,
    brightness,
    edgeStrength,
    edgeThreshold,
    glow,
    preserveDetail,
}: GridPulseXraySampleInput) => {
    const source = clamp01(luminance)
    const baseSource = invert ? 1 - source : source
    const contrasted = clamp01((baseSource - 0.5) * Math.max(0, contrast) + 0.5)
    const base = clamp01(contrasted * Math.max(0, brightness))
    const edge = clamp01(
        (Math.max(0, edgeMagnitude) - clamp01(edgeThreshold)) * Math.max(0, edgeStrength)
    )
    const detailedBase = base * (1 - clamp01(preserveDetail)) + source * clamp01(preserveDetail)
    const structural = edge * clamp01(glow)
    return clamp01(Math.max(detailedBase, structural))
}
