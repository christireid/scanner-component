export type ScanSweepDirection = "vertical" | "horizontal" | "diagonal-down" | "diagonal-up"
export type ScanSweepMode = "loop" | "pingpong" | "once"
export type ScanSweepEasing = "linear" | "smooth"

export interface ScanSweepInput {
    now: number
    revealedAt: number
    index: number
    duration: number
    delay: number
    mode: ScanSweepMode
    easing: ScanSweepEasing
    reducedMotion: boolean
}

export interface ScanSweepState {
    progress: number
    active: boolean
    complete: boolean
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))
const smoothstep = (value: number) => {
    const t = clamp01(value)
    return t * t * (3 - 2 * t)
}

export const resolveScanSweepState = (input: ScanSweepInput): ScanSweepState => {
    if (input.reducedMotion) return { progress: 1, active: false, complete: true }
    const duration = Math.max(1, input.duration)
    const local = input.now - input.revealedAt - Math.max(0, input.delay) - input.index * Math.max(0, input.delay * 0.12)
    if (local < 0) return { progress: 0, active: false, complete: false }
    let raw = local / duration
    let complete = false
    if (input.mode === "once") {
        complete = raw >= 1
        raw = clamp01(raw)
    } else if (input.mode === "pingpong") {
        const cycle = ((raw % 2) + 2) % 2
        raw = cycle <= 1 ? cycle : 2 - cycle
    } else {
        raw = ((raw % 1) + 1) % 1
    }
    const progress = input.easing === "smooth" ? smoothstep(raw) : raw
    return { progress, active: input.mode !== "once" || !complete, complete }
}
