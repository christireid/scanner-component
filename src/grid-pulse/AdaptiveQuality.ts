export type VisionQualityMode = "auto" | "ultra" | "high" | "balanced" | "low"
export type ResolvedVisionQuality = Exclude<VisionQualityMode, "auto">

export interface QualityEnvironment {
    devicePixelRatio: number
    deviceMemory?: number
    hardwareConcurrency?: number
    reducedMotion: boolean
    compact: boolean
    webgl2Available: boolean
}

export interface QualityProfile {
    tier: ResolvedVisionQuality
    dprCap: number
    overlayFps: number
    particleMultiplier: number
    noiseMultiplier: number
    persistenceMultiplier: number
    gpuEnabled: boolean
    bloomMultiplier: number
}

const PROFILES: Record<ResolvedVisionQuality, QualityProfile> = {
    ultra: { tier: "ultra", dprCap: 2.5, overlayFps: 60, particleMultiplier: 1.35, noiseMultiplier: 1, persistenceMultiplier: 1, gpuEnabled: true, bloomMultiplier: 1.15 },
    high: { tier: "high", dprCap: 2, overlayFps: 50, particleMultiplier: 1, noiseMultiplier: .9, persistenceMultiplier: .9, gpuEnabled: true, bloomMultiplier: 1 },
    balanced: { tier: "balanced", dprCap: 1.5, overlayFps: 40, particleMultiplier: .7, noiseMultiplier: .72, persistenceMultiplier: .65, gpuEnabled: true, bloomMultiplier: .78 },
    low: { tier: "low", dprCap: 1, overlayFps: 24, particleMultiplier: .3, noiseMultiplier: .4, persistenceMultiplier: 0, gpuEnabled: false, bloomMultiplier: .35 },
}

export function resolveVisionQuality(
    mode: VisionQualityMode,
    environment: QualityEnvironment
): QualityProfile {
    if (mode !== "auto") return PROFILES[mode]
    if (environment.reducedMotion) return PROFILES.low
    const memory = environment.deviceMemory ?? 4
    const cores = environment.hardwareConcurrency ?? 4
    if (!environment.webgl2Available || memory <= 2 || cores <= 2) return PROFILES.low
    if (environment.compact || memory <= 4 || cores <= 4 || environment.devicePixelRatio > 2.5) return PROFILES.balanced
    if (memory >= 8 && cores >= 8 && environment.devicePixelRatio <= 2) return PROFILES.ultra
    return PROFILES.high
}

export function degradeQuality(current: ResolvedVisionQuality): ResolvedVisionQuality {
    if (current === "ultra") return "high"
    if (current === "high") return "balanced"
    return "low"
}

export function shouldDegradeQuality(
    averageFrameMs: number,
    consecutiveSlowSamples: number,
    targetFps: number
) {
    const budget = 1000 / Math.max(1, targetFps)
    return consecutiveSlowSamples >= 3 && averageFrameMs > budget * 1.35
}
