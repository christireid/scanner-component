export interface GridPulseInteractionTransitionInput {
    active: boolean
    previousAlpha: number
    startedAt: number
    now: number
    enterDuration: number
    exitDuration: number
    reducedMotion: boolean
}

function clamp01(value: number): number {
    return Math.max(0, Math.min(1, value))
}

function easeOutCubic(value: number): number {
    const t = clamp01(value)
    return 1 - Math.pow(1 - t, 3)
}

function easeInCubic(value: number): number {
    const t = clamp01(value)
    return t * t * t
}

export function resolveGridPulseInteractionAlpha(
    input: GridPulseInteractionTransitionInput
): number {
    if (input.reducedMotion) return input.active ? 1 : 0
    const duration = Math.max(0, input.active ? input.enterDuration : input.exitDuration)
    if (duration === 0) return input.active ? 1 : 0
    const progress = clamp01((input.now - input.startedAt) / duration)
    if (input.active) {
        const target = easeOutCubic(progress)
        return input.previousAlpha + (1 - input.previousAlpha) * target
    }
    const target = 1 - easeInCubic(progress)
    return input.previousAlpha * target
}
