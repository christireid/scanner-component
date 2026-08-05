export type AcquisitionState =
    | "searching"
    | "locking"
    | "drawing-connector"
    | "expanding-frame"
    | "revealing-media"
    | "inspecting"
    | "settling"
    | "dormant"
    | "fading"

export interface SpringConfig {
    stiffness: number
    damping: number
    mass: number
}

export interface AcquisitionMotionOptions {
    enabled: boolean
    reducedMotion: boolean
    delay: number
    spring: SpringConfig
}

export interface AcquisitionMotion {
    state: AcquisitionState
    local: number
    lock: number
    connector: number
    frame: number
    media: number
    inspect: number
    settle: number
    label: number
    wave: number
    breath: number
}

export const DEFAULT_ACQUISITION_SPRING: SpringConfig = {
    stiffness: 170,
    damping: 19,
    mass: 1,
}

export function clamp01(value: number) {
    return Math.max(0, Math.min(1, value))
}

export function smoothstep(value: number) {
    const t = clamp01(value)
    return t * t * (3 - 2 * t)
}

/** Analytic under/critical/over-damped unit-step response. */
export function springStep(progress: number, config: SpringConfig = DEFAULT_ACQUISITION_SPRING) {
    const t = Math.max(0, progress)
    if (t <= 0) return 0
    const stiffness = Math.max(0.001, config.stiffness)
    const damping = Math.max(0, config.damping)
    const mass = Math.max(0.001, config.mass)
    const omega0 = Math.sqrt(stiffness / mass)
    const zeta = damping / (2 * Math.sqrt(stiffness * mass))

    if (zeta < 1) {
        const omegaD = omega0 * Math.sqrt(1 - zeta * zeta)
        const envelope = Math.exp(-zeta * omega0 * t)
        const response = 1 - envelope * (
            Math.cos(omegaD * t) +
            (zeta * omega0 / Math.max(omegaD, 1e-6)) * Math.sin(omegaD * t)
        )
        return Math.max(0, Math.min(1.08, response))
    }

    if (Math.abs(zeta - 1) < 0.001) {
        return clamp01(1 - Math.exp(-omega0 * t) * (1 + omega0 * t))
    }

    const root = Math.sqrt(zeta * zeta - 1)
    const r1 = -omega0 * (zeta - root)
    const r2 = -omega0 * (zeta + root)
    const response = 1 - (r2 * Math.exp(r1 * t) - r1 * Math.exp(r2 * t)) / (r2 - r1)
    return clamp01(response)
}

function phase(local: number, start: number, duration: number) {
    return clamp01((local - start) / Math.max(duration, 1e-6))
}

export function acquisitionMotion(
    reveal: number,
    nowMs: number,
    index: number,
    options: AcquisitionMotionOptions
): AcquisitionMotion {
    if (!options.enabled || options.reducedMotion) {
        return {
            state: "inspecting",
            local: 1,
            lock: 1,
            connector: 1,
            frame: 1,
            media: 1,
            inspect: 1,
            settle: 1,
            label: 1,
            wave: 0,
            breath: 1,
        }
    }

    const local = clamp01(reveal - index * options.delay)
    const lock = smoothstep(phase(local, 0, 0.16))
    const connector = smoothstep(phase(local, 0.09, 0.28))
    const framePhase = phase(local, 0.28, 0.26)
    const frame = springStep(framePhase * 0.72, options.spring)
    const media = smoothstep(phase(local, 0.43, 0.26))
    const inspect = smoothstep(phase(local, 0.58, 0.22))
    const settle = smoothstep(phase(local, 0.72, 0.28))
    const label = smoothstep(phase(local, 0.5, 0.24))
    const wavePhase = phase(local, 0.18, 0.42)
    const wave = wavePhase > 0 && wavePhase < 1 ? Math.sin(wavePhase * Math.PI) : 0
    const breath = 1 + Math.sin(nowMs * 0.00125 + index * 1.37) * 0.008 * settle

    let state: AcquisitionState = "searching"
    if (local > 0) state = "locking"
    if (local >= 0.09) state = "drawing-connector"
    if (local >= 0.28) state = "expanding-frame"
    if (local >= 0.43) state = "revealing-media"
    if (local >= 0.58) state = "inspecting"
    if (local >= 0.72) state = "settling"
    if (local >= 0.995) state = "dormant"

    return { state, local, lock, connector, frame, media, inspect, settle, label, wave, breath }
}

export function typedLabel(text: string, progress: number) {
    const count = Math.max(0, Math.min(text.length, Math.ceil(text.length * clamp01(progress))))
    return text.slice(0, count)
}
