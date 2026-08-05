export type GridPulseCrosshairFollowMode = "instant" | "smooth"

export interface GridPulseCrosshairMotionInput {
    currentX: number
    currentY: number
    targetX: number
    targetY: number
    deltaMs: number
    mode: GridPulseCrosshairFollowMode
    responseMs: number
    snapThreshold: number
    reducedMotion: boolean
}

export interface GridPulseCrosshairMotionState {
    x: number
    y: number
    settled: boolean
    distance: number
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))

/**
 * Resolves a frame-rate-independent crosshair follower.
 * `responseMs` describes the approximate time needed to cover 99% of the gap.
 */
export const resolveGridPulseCrosshairMotion = (
    input: GridPulseCrosshairMotionInput
): GridPulseCrosshairMotionState => {
    const dx = input.targetX - input.currentX
    const dy = input.targetY - input.currentY
    const distance = Math.hypot(dx, dy)
    const snapThreshold = Math.max(0, input.snapThreshold)

    if (
        input.reducedMotion ||
        input.mode === "instant" ||
        distance <= snapThreshold ||
        input.responseMs <= 0
    ) {
        return {
            x: input.targetX,
            y: input.targetY,
            settled: true,
            distance: 0,
        }
    }

    const deltaMs = Math.max(0, Math.min(100, input.deltaMs))
    // ln(100) reaches 99% response at responseMs and is stable across refresh rates.
    const alpha = clamp01(1 - Math.exp((-Math.log(100) * deltaMs) / input.responseMs))
    const x = input.currentX + dx * alpha
    const y = input.currentY + dy * alpha
    const remaining = Math.hypot(input.targetX - x, input.targetY - y)

    if (remaining <= snapThreshold) {
        return {
            x: input.targetX,
            y: input.targetY,
            settled: true,
            distance: 0,
        }
    }

    return { x, y, settled: false, distance: remaining }
}
