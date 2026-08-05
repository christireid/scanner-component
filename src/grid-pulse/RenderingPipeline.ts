export type RendererProfileName =
    | "feature"
    | "survey"
    | "scientific"
    | "medical"
    | "blueprint"
    | "security"
    | "botanical"

export interface LensOptions {
    magnification: number
    barrelDistortion: number
    chromaticAberration: number
    fresnel: number
    refraction: number
    bloom: number
}

export interface PipelineOptions {
    profile: RendererProfileName
    noiseStrength: number
    temporalPersistence: number
    particleDensity: number
    lightingStrength: number
    targetFps: number
    idleFps: number
    lens: LensOptions
}

export interface LensSourceRect {
    sx: number
    sy: number
    sw: number
    sh: number
}

export interface LensDestinationRect {
    x: number
    y: number
    width: number
    height: number
}

export interface ParticleFieldOptions {
    width: number
    height: number
    now: number
    intensity: number
    accent: string
}

export const RENDERER_PROFILES: Record<RendererProfileName, PipelineOptions> = {
    feature: {
        profile: "feature",
        noiseStrength: 0.34,
        temporalPersistence: 0.12,
        particleDensity: 0.14,
        lightingStrength: 0.45,
        targetFps: 50,
        idleFps: 18,
        lens: { magnification: 2.2, barrelDistortion: 0.045, chromaticAberration: 0.8, fresnel: 0.2, refraction: 0.32, bloom: 0.18 },
    },
    survey: {
        profile: "survey",
        noiseStrength: 0.12,
        temporalPersistence: 0.06,
        particleDensity: 0.05,
        lightingStrength: 0.28,
        targetFps: 36,
        idleFps: 12,
        lens: { magnification: 1.7, barrelDistortion: 0.02, chromaticAberration: 0.2, fresnel: 0.08, refraction: 0.12, bloom: 0.08 },
    },
    scientific: {
        profile: "scientific",
        noiseStrength: 0.18,
        temporalPersistence: 0.08,
        particleDensity: 0.08,
        lightingStrength: 0.32,
        targetFps: 42,
        idleFps: 14,
        lens: { magnification: 2.35, barrelDistortion: 0.028, chromaticAberration: 0.28, fresnel: 0.14, refraction: 0.2, bloom: 0.12 },
    },
    medical: {
        profile: "medical",
        noiseStrength: 0.08,
        temporalPersistence: 0.16,
        particleDensity: 0.03,
        lightingStrength: 0.38,
        targetFps: 40,
        idleFps: 12,
        lens: { magnification: 2.45, barrelDistortion: 0.018, chromaticAberration: 0.08, fresnel: 0.16, refraction: 0.18, bloom: 0.2 },
    },
    blueprint: {
        profile: "blueprint",
        noiseStrength: 0.14,
        temporalPersistence: 0.04,
        particleDensity: 0.04,
        lightingStrength: 0.3,
        targetFps: 38,
        idleFps: 12,
        lens: { magnification: 1.9, barrelDistortion: 0.02, chromaticAberration: 0.12, fresnel: 0.1, refraction: 0.1, bloom: 0.1 },
    },
    security: {
        profile: "security",
        noiseStrength: 0.58,
        temporalPersistence: 0.24,
        particleDensity: 0.24,
        lightingStrength: 0.52,
        targetFps: 48,
        idleFps: 18,
        lens: { magnification: 2.05, barrelDistortion: 0.055, chromaticAberration: 1.1, fresnel: 0.16, refraction: 0.36, bloom: 0.24 },
    },
    botanical: {
        profile: "botanical",
        noiseStrength: 0.3,
        temporalPersistence: 0.1,
        particleDensity: 0.16,
        lightingStrength: 0.42,
        targetFps: 44,
        idleFps: 16,
        lens: { magnification: 2.3, barrelDistortion: 0.04, chromaticAberration: 0.54, fresnel: 0.22, refraction: 0.28, bloom: 0.2 },
    },
}

function fract(value: number) {
    return value - Math.floor(value)
}

function hash2(x: number, y: number, seed = 0) {
    return fract(Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123)
}

function fade(value: number) {
    return value * value * value * (value * (value * 6 - 15) + 10)
}

/** Deterministic coherent value noise, structured so a shader implementation can mirror it. */
export function coherentNoise2D(x: number, y: number, seed = 0) {
    const x0 = Math.floor(x)
    const y0 = Math.floor(y)
    const tx = fade(x - x0)
    const ty = fade(y - y0)
    const a = hash2(x0, y0, seed)
    const b = hash2(x0 + 1, y0, seed)
    const c = hash2(x0, y0 + 1, seed)
    const d = hash2(x0 + 1, y0 + 1, seed)
    const top = a + (b - a) * tx
    const bottom = c + (d - c) * tx
    return (top + (bottom - top) * ty) * 2 - 1
}

export function fractalNoise2D(x: number, y: number, seed = 0, octaves = 4) {
    let amplitude = 0.5
    let frequency = 1
    let sum = 0
    let normalizer = 0
    for (let octave = 0; octave < octaves; octave += 1) {
        sum += coherentNoise2D(x * frequency, y * frequency, seed + octave * 13.17) * amplitude
        normalizer += amplitude
        amplitude *= 0.5
        frequency *= 2
    }
    return normalizer ? sum / normalizer : 0
}

function alphaColor(hex: string, alpha: number) {
    if (!hex.startsWith("#")) return hex
    const normalized = hex.slice(1)
    const value = normalized.length === 3
        ? normalized.split("").map(character => character + character).join("")
        : normalized.slice(0, 6)
    const parsed = Number.parseInt(value, 16)
    const r = (parsed >> 16) & 255
    const g = (parsed >> 8) & 255
    const b = parsed & 255
    return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha))})`
}

export class TemporalFrameBuffer {
    private canvas: HTMLCanvasElement | null = null
    private ctx: CanvasRenderingContext2D | null = null

    composite(
        target: CanvasRenderingContext2D,
        width: number,
        height: number,
        persistence: number
    ) {
        if (typeof document === "undefined" || persistence <= 0) return
        if (!this.canvas) {
            this.canvas = document.createElement("canvas")
            this.ctx = this.canvas.getContext("2d")
        }
        if (!this.canvas || !this.ctx) return
        if (this.canvas.width !== width || this.canvas.height !== height) {
            this.canvas.width = width
            this.canvas.height = height
            this.ctx.clearRect(0, 0, width, height)
        }
        target.save()
        target.globalCompositeOperation = "screen"
        target.globalAlpha = Math.max(0, Math.min(0.42, persistence))
        target.drawImage(this.canvas, 0, 0, width, height)
        target.restore()
        this.ctx.save()
        this.ctx.globalAlpha = Math.max(0, Math.min(0.96, persistence + 0.56))
        this.ctx.drawImage(target.canvas, 0, 0, width, height)
        this.ctx.restore()
    }

    reset() {
        this.ctx?.clearRect(0, 0, this.canvas?.width || 0, this.canvas?.height || 0)
    }
}

export class RenderingPipeline {
    readonly temporal = new TemporalFrameBuffer()

    drawAtmosphere(
        ctx: CanvasRenderingContext2D,
        media: CanvasImageSource | null,
        width: number,
        height: number,
        now: number,
        intensity: number,
        speed: number,
        reducedMotion: boolean,
        profile: PipelineOptions,
        accent: string
    ) {
        if (!media || intensity <= 0) return
        const strips = Math.max(12, Math.round(height / 42))
        const stripHeight = height / strips
        ctx.save()
        ctx.globalAlpha = 0.025 + intensity * 0.05
        for (let index = 0; index < strips; index += 1) {
            const progress = index / Math.max(1, strips - 1)
            const noise = reducedMotion
                ? 0
                : fractalNoise2D(progress * 3.4, now * 0.00015 * speed, index * 0.17, 3)
            const offset = noise * profile.noiseStrength * intensity * 8
            ctx.drawImage(media, 0, index * stripHeight, width, stripHeight + 1, offset, index * stripHeight, width, stripHeight + 1)
        }
        const pulse = reducedMotion ? 0.5 : (now * 0.00018 * speed) % 1
        const x = pulse * width
        const gradient = ctx.createLinearGradient(x - 100, 0, x + 100, 0)
        gradient.addColorStop(0, alphaColor(accent, 0))
        gradient.addColorStop(0.5, alphaColor(accent, 0.07 * profile.lightingStrength))
        gradient.addColorStop(1, alphaColor(accent, 0))
        ctx.fillStyle = gradient
        ctx.fillRect(x - 100, 0, 200, height)
        ctx.restore()
    }

    drawLens(
        ctx: CanvasRenderingContext2D,
        media: CanvasImageSource,
        source: LensSourceRect,
        destination: LensDestinationRect,
        now: number,
        phase: number,
        intensity: number,
        accent: string,
        profile: PipelineOptions,
        reducedMotion: boolean
    ) {
        const { x, y, width, height } = destination
        const slices = Math.max(16, Math.round(height / 5.5))
        const destinationHeight = height / slices
        ctx.save()
        ctx.beginPath()
        ctx.rect(x, y, width, height)
        ctx.clip()
        for (let index = 0; index < slices; index += 1) {
            const progress = index / Math.max(1, slices - 1)
            const centered = progress * 2 - 1
            const barrel = centered * centered * Math.sign(centered) * profile.lens.barrelDistortion * width
            const noise = reducedMotion
                ? 0
                : fractalNoise2D(progress * 4.2, now * 0.00032, phase + index * 0.03, 4)
            const refraction = noise * profile.lens.refraction * intensity * 6
            const destinationX = x + barrel + refraction
            const sourceY = source.sy + source.sh * progress
            const sourceHeight = Math.max(1, source.sh / slices + 0.7)
            ctx.drawImage(
                media,
                source.sx,
                sourceY,
                source.sw,
                sourceHeight,
                destinationX,
                y + index * destinationHeight,
                width,
                destinationHeight + 1.2
            )
            const aberration = profile.lens.chromaticAberration * intensity
            if (aberration > 0.05) {
                ctx.save()
                ctx.globalCompositeOperation = "screen"
                ctx.globalAlpha = Math.min(0.1, aberration * 0.025)
                ctx.drawImage(media, source.sx, sourceY, source.sw, sourceHeight, destinationX + aberration, y + index * destinationHeight, width, destinationHeight + 1.2)
                ctx.restore()
            }
        }
        const fresnel = ctx.createRadialGradient(
            x + width / 2,
            y + height / 2,
            Math.min(width, height) * 0.18,
            x + width / 2,
            y + height / 2,
            Math.max(width, height) * 0.72
        )
        fresnel.addColorStop(0, "rgba(255,255,255,0)")
        fresnel.addColorStop(0.72, "rgba(255,255,255,0)")
        fresnel.addColorStop(1, alphaColor(accent, profile.lens.fresnel * intensity))
        ctx.fillStyle = fresnel
        ctx.fillRect(x, y, width, height)
        if (profile.lens.bloom > 0) {
            ctx.strokeStyle = alphaColor(accent, profile.lens.bloom * intensity)
            ctx.lineWidth = 2
            ctx.strokeRect(x + 1, y + 1, width - 2, height - 2)
        }
        ctx.restore()
    }

    drawParticles(ctx: CanvasRenderingContext2D, options: ParticleFieldOptions) {
        const density = Math.max(0, Math.min(1, options.intensity))
        if (density <= 0) return
        const count = Math.round(10 + density * 42)
        ctx.save()
        ctx.fillStyle = alphaColor(options.accent, 0.16)
        for (let index = 0; index < count; index += 1) {
            const seed = index * 17.13
            const x = fract(Math.sin(seed * 12.9898) * 43758.5453) * options.width
            const baseY = fract(Math.sin(seed * 78.233) * 23421.631) * options.height
            const drift = Math.sin(options.now * 0.00017 + seed) * 18
            const y = (baseY + drift + options.height) % options.height
            const radius = index % 7 === 0 ? 1.1 : 0.55
            ctx.globalAlpha = 0.25 + fract(seed) * 0.5
            ctx.beginPath()
            ctx.arc(x, y, radius, 0, Math.PI * 2)
            ctx.fill()
        }
        ctx.restore()
    }

    targetInterval(active: boolean, profile: PipelineOptions) {
        const fps = active ? profile.targetFps : profile.idleFps
        return 1000 / Math.max(1, fps)
    }
}
