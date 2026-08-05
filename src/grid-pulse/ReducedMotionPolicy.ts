export type GridPulseRevealEasing = "linear" | "easeOut" | "easeInOut"
export type GridPulseReducedMotionReveal = "instant" | "staggered"

export interface GridPulseRevealProgressInput {
    now: number
    revealedAt: number
    batchStart: number
    duration: number
    easing: GridPulseRevealEasing
    reducedMotion: boolean
    reducedMotionReveal: GridPulseReducedMotionReveal
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

export const easeGridPulseReveal = (value: number, easing: GridPulseRevealEasing) => {
    const x = clamp01(value)
    if (easing === "linear") return x
    if (easing === "easeInOut") {
        return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2
    }
    return 1 - Math.pow(1 - x, 3)
}

export const resolveGridPulseBatchStart = (revealedAt: readonly number[]) => {
    let earliest = Number.POSITIVE_INFINITY
    for (const timestamp of revealedAt) {
        if (Number.isFinite(timestamp)) earliest = Math.min(earliest, timestamp)
    }
    return Number.isFinite(earliest) ? earliest : 0
}

export const resolveGridPulseRevealProgress = ({
    now,
    revealedAt,
    batchStart,
    duration,
    easing,
    reducedMotion,
    reducedMotionReveal,
}: GridPulseRevealProgressInput) => {
    if (reducedMotion) {
        const effectiveStart = reducedMotionReveal === "instant" ? batchStart : revealedAt
        return now >= effectiveStart ? 1 : 0
    }
    return easeGridPulseReveal((now - revealedAt) / Math.max(1, duration), easing)
}

export const resolveGridPulseRevealSpan = (
    revealedAt: readonly number[],
    reducedMotion: boolean,
    reducedMotionReveal: GridPulseReducedMotionReveal
) => {
    if (revealedAt.length < 2) return 0
    if (reducedMotion && reducedMotionReveal === "instant") return 0
    const finite = revealedAt.filter(Number.isFinite)
    if (finite.length < 2) return 0
    return Math.max(...finite) - Math.min(...finite)
}
