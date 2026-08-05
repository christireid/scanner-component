export type GridPulseScoredDetectionMode = "auto" | "person" | "detail"

export interface GridPulseDetectionModeSignal {
    edge: number
    texture: number
    skin: number
    center: number
}

export interface GridPulseDetectionModeWeights {
    detailEdgeWeight: number
    detailTextureWeight: number
    personSkinWeight: number
    autoPersonWeight: number
    modeDiversity: number
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))

export interface GridPulseDetectionModeScore {
    score: number
    detail: number
    person: number
}

/**
 * Produces deliberately different saliency fields for Auto, Person, and Detail.
 * The policy is pure so the mode contract can be tested without a browser canvas.
 */
export function resolveGridPulseDetectionModeScore(
    mode: GridPulseScoredDetectionMode,
    signal: GridPulseDetectionModeSignal,
    weights: GridPulseDetectionModeWeights
): GridPulseDetectionModeScore {
    const edgeWeight = clamp01(weights.detailEdgeWeight)
    const textureWeight = clamp01(weights.detailTextureWeight)
    const detailWeightTotal = Math.max(0.0001, edgeWeight + textureWeight)
    const detail = clamp01(
        (clamp01(signal.edge) * edgeWeight + clamp01(signal.texture) * textureWeight) / detailWeightTotal
    )

    const skinWeight = clamp01(weights.personSkinWeight)
    const person = clamp01(
        clamp01(signal.skin) * skinWeight +
        detail * (1 - skinWeight) * 0.62 +
        clamp01(signal.center) * (1 - skinWeight) * 0.38
    )

    if (mode === "detail") return { score: detail, detail, person }
    if (mode === "person") return { score: person, detail, person }

    const personWeight = clamp01(weights.autoPersonWeight)
    const diversity = clamp01(weights.modeDiversity)
    const dominant = Math.max(detail * (1 - personWeight * 0.28), person * personWeight)
    const complementary = Math.min(detail, person)
    return {
        score: clamp01(dominant + complementary * diversity),
        detail,
        person,
    }
}
