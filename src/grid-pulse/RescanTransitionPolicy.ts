export type GridPulseRescanTransition = "instant" | "fade" | "crossfade"

export interface GridPulseRescanTransitionInput {
    mode: GridPulseRescanTransition
    now: number
    startedAt: number
    committedAt: number
    exitDuration: number
    gap: number
    enterDuration: number
    reducedMotion: boolean
}

export interface GridPulseRescanTransitionState {
    alpha: number
    phase: "idle" | "exiting" | "gap" | "entering" | "complete"
    complete: boolean
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))
const smoothstep = (value: number) => {
    const t = clamp01(value)
    return t * t * (3 - 2 * t)
}

export function resolveGridPulseRescanTransition(
    input: GridPulseRescanTransitionInput
): GridPulseRescanTransitionState {
    if (input.startedAt <= 0) return { alpha: 1, phase: "idle", complete: true }
    if (input.reducedMotion || input.mode === "instant") {
        return input.committedAt > 0
            ? { alpha: 1, phase: "complete", complete: true }
            : { alpha: 1, phase: "idle", complete: false }
    }

    const exitDuration = Math.max(0, input.exitDuration)
    const enterDuration = Math.max(0, input.enterDuration)
    const gap = Math.max(0, input.gap)

    if (input.committedAt <= 0) {
        const progress = exitDuration === 0 ? 1 : (input.now - input.startedAt) / exitDuration
        return { alpha: 1 - smoothstep(progress), phase: "exiting", complete: false }
    }

    const elapsed = Math.max(0, input.now - input.committedAt)
    if (input.mode === "crossfade") {
        const progress = enterDuration === 0 ? 1 : elapsed / enterDuration
        const alpha = smoothstep(progress)
        return { alpha, phase: alpha >= 0.9999 ? "complete" : "entering", complete: alpha >= 0.9999 }
    }

    if (elapsed < gap) return { alpha: 0, phase: "gap", complete: false }
    const progress = enterDuration === 0 ? 1 : (elapsed - gap) / enterDuration
    const alpha = smoothstep(progress)
    return { alpha, phase: alpha >= 0.9999 ? "complete" : "entering", complete: alpha >= 0.9999 }
}
