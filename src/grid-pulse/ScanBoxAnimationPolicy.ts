export type GridPulseBoxAnimation = "static" | "pop" | "unfold" | "acquire"

export interface GridPulseBoxAnimationInput {
    animation: GridPulseBoxAnimation
    now: number
    revealedAt: number
    index: number
    stagger: number
    lockDuration: number
    unfoldDuration: number
    mediaDelay: number
    settleDuration: number
    reducedMotion: boolean
}

export interface GridPulseBoxAnimationState {
    localTime: number
    lockProgress: number
    frameProgress: number
    mediaProgress: number
    settleProgress: number
    scale: number
    offsetY: number
    bracketProgress: number
    edgeProgress: number
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))
const smoothstep = (value: number) => {
    const t = clamp01(value)
    return t * t * (3 - 2 * t)
}

// Analytic under-damped spring. It gives the frame a small, bounded overshoot
// without keeping mutable per-box spring state in the render loop.
const spring = (progress: number) => {
    const t = Math.max(0, progress)
    if (t <= 0) return 0
    const response = 1 - Math.exp(-7.5 * t) * (Math.cos(10.5 * t) + 0.38 * Math.sin(10.5 * t))
    return Math.max(0, Math.min(1.055, response))
}

export const resolveGridPulseBoxAnimation = (
    input: GridPulseBoxAnimationInput
): GridPulseBoxAnimationState => {
    if (input.reducedMotion || input.animation === "static") {
        return {
            localTime: Math.max(0, input.now - input.revealedAt),
            lockProgress: 1,
            frameProgress: 1,
            mediaProgress: 1,
            settleProgress: 1,
            scale: 1,
            offsetY: 0,
            bracketProgress: 1,
            edgeProgress: 1,
        }
    }

    const localTime = Math.max(0, input.now - input.revealedAt - input.index * input.stagger)
    const lock = smoothstep(localTime / Math.max(1, input.lockDuration))
    const unfoldStart = input.animation === "pop" ? 0 : input.lockDuration * 0.55
    const unfold = spring((localTime - unfoldStart) / Math.max(1, input.unfoldDuration))
    const mediaStart = unfoldStart + input.mediaDelay
    const media = smoothstep((localTime - mediaStart) / Math.max(1, input.unfoldDuration * 0.72))
    const settleStart = mediaStart + input.unfoldDuration * 0.5
    const settle = smoothstep((localTime - settleStart) / Math.max(1, input.settleDuration))

    if (input.animation === "pop") {
        return {
            localTime,
            lockProgress: 1,
            frameProgress: unfold,
            mediaProgress: media,
            settleProgress: settle,
            scale: 0.72 + unfold * 0.28,
            offsetY: (1 - Math.min(1, unfold)) * 10,
            bracketProgress: unfold,
            edgeProgress: unfold,
        }
    }

    const bracketProgress = smoothstep((localTime - unfoldStart) / Math.max(1, input.unfoldDuration * 0.34))
    const edgeProgress = smoothstep((localTime - unfoldStart - input.unfoldDuration * 0.16) / Math.max(1, input.unfoldDuration * 0.62))
    return {
        localTime,
        lockProgress: lock,
        frameProgress: unfold,
        mediaProgress: media,
        settleProgress: settle,
        scale: input.animation === "acquire" ? 0.68 + unfold * 0.32 : 0.82 + unfold * 0.18,
        offsetY: input.animation === "acquire" ? (1 - Math.min(1, unfold)) * 12 : 0,
        bracketProgress,
        edgeProgress,
    }
}
