export type GridPulseConnectionAnimation = "static" | "draw" | "flow" | "hybrid"

export interface GridPulseConnectionAnimationInput {
    animation: GridPulseConnectionAnimation
    now: number
    revealedAt: number
    index: number
    duration: number
    stagger: number
    flowSpeed: number
    flowLength: number
    lineLength: number
    reducedMotion: boolean
}

export interface GridPulseConnectionAnimationState {
    drawProgress: number
    flowStart: number
    flowEnd: number
    flowAlpha: number
    animating: boolean
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))
const smoothstep = (value: number) => {
    const t = clamp01(value)
    return t * t * (3 - 2 * t)
}

/** Resolves progressive line construction and a repeating energy packet from one shared frame clock. */
export const resolveGridPulseConnectionAnimation = (
    input: GridPulseConnectionAnimationInput
): GridPulseConnectionAnimationState => {
    const staticMode = input.reducedMotion || input.animation === "static"
    if (staticMode) {
        return { drawProgress: 1, flowStart: 0, flowEnd: 0, flowAlpha: 0, animating: false }
    }

    const start = input.revealedAt + Math.max(0, input.index) * Math.max(0, input.stagger)
    const elapsed = Math.max(0, input.now - start)
    const draws = input.animation === "draw" || input.animation === "hybrid"
    const flows = input.animation === "flow" || input.animation === "hybrid"
    const drawProgress = draws
        ? smoothstep(elapsed / Math.max(1, input.duration))
        : 1

    const packetLength = Math.max(1, Math.min(input.lineLength, input.flowLength))
    const travel = Math.max(1, input.lineLength + packetLength)
    const head = flows
        ? ((elapsed * Math.max(0.001, input.flowSpeed)) % travel) - packetLength
        : -packetLength
    const flowStart = Math.max(0, head)
    const flowEnd = Math.min(input.lineLength * drawProgress, head + packetLength)
    const packetVisible = flows && flowEnd > flowStart && drawProgress > 0
    const flowAlpha = packetVisible ? Math.sin(drawProgress * Math.PI * 0.5) : 0
    const animating = drawProgress < 0.999 || flows

    return { drawProgress, flowStart, flowEnd, flowAlpha, animating }
}
