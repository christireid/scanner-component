export type GridPulseGridAnimation = "dash" | "drift" | "pulse" | "scan" | "hybrid"
export type GridPulseGridScanDirection = "horizontal" | "vertical" | "diagonal"

export interface GridPulseGridAnimationInput {
    now: number
    width: number
    height: number
    spacing: number
    reducedMotion: boolean
    animate: boolean
    animation: GridPulseGridAnimation
    speed: number
    driftX: number
    driftY: number
    pulseStrength: number
    scanWidth: number
    scanStrength: number
    scanDirection: GridPulseGridScanDirection
    dash: number[]
}

export interface GridPulseGridAnimationFrame {
    offsetX: number
    offsetY: number
    dashOffset: number
    opacityMultiplier: number
    scanPosition: number
    scanWidth: number
    scanStrength: number
    scanDirection: GridPulseGridScanDirection
}

const includesMotion = (animation: GridPulseGridAnimation, mode: Exclude<GridPulseGridAnimation, "hybrid">) =>
    animation === mode || animation === "hybrid"

const positiveModulo = (value: number, modulus: number) => {
    if (modulus <= 0) return 0
    return ((value % modulus) + modulus) % modulus
}

export const resolveGridPulseGridAnimation = (
    input: GridPulseGridAnimationInput
): GridPulseGridAnimationFrame => {
    const active = input.animate && !input.reducedMotion
    const seconds = active ? Math.max(0, input.now) / 1000 * Math.max(0, input.speed) : 0
    const dashLength = Math.max(1, input.dash.reduce((sum, value) => sum + Math.max(0, value), 0))
    const drift = active && includesMotion(input.animation, "drift")
    const dash = active && includesMotion(input.animation, "dash")
    const pulse = active && includesMotion(input.animation, "pulse")
    const scan = active && includesMotion(input.animation, "scan")
    const travel = input.scanDirection === "horizontal"
        ? input.height
        : input.scanDirection === "vertical"
            ? input.width
            : input.width + input.height
    return {
        offsetX: drift ? positiveModulo(seconds * input.driftX, Math.max(1, input.spacing)) : 0,
        offsetY: drift ? positiveModulo(seconds * input.driftY, Math.max(1, input.spacing)) : 0,
        dashOffset: dash ? -positiveModulo(seconds * 18, dashLength) : 0,
        opacityMultiplier: pulse
            ? 1 + Math.sin(seconds * Math.PI * 2 * 0.42) * Math.max(0, input.pulseStrength)
            : 1,
        scanPosition: scan ? positiveModulo(seconds * travel * 0.22, travel) : -travel,
        scanWidth: Math.max(0, Math.min(1, input.scanWidth)) * travel,
        scanStrength: scan ? Math.max(0, input.scanStrength) : 0,
        scanDirection: input.scanDirection,
    }
}
