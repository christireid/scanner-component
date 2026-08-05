import type { VisionSceneGraph } from "./VisionSceneGraph"

export type VisionPluginPhase = "before-overlay" | "after-overlay" | "post-process"

export interface VisionPluginNode {
    id: string
    x: number
    y: number
    px: number
    py: number
    score: number
    reveal: number
}

export interface VisionPluginContext {
    ctx: CanvasRenderingContext2D
    width: number
    height: number
    now: number
    dt: number
    active: boolean
    compact: boolean
    reducedMotion: boolean
    pointer: { x: number; y: number; strength: number }
    nodes: VisionPluginNode[]
    scene: VisionSceneGraph
    media: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement | null
    requestFrame: () => void
    effects: InspectionEffectStack
}

export interface VisionPlugin {
    id: string
    name: string
    phase?: VisionPluginPhase
    enabled?: boolean
    setup?: () => void | (() => void)
    render: (context: VisionPluginContext) => void
}

export interface VisionTheme {
    id: string
    colors: {
        background: string
        line: string
        accent: string
        labelBackground: string
        labelText: string
    }
    typography: {
        fontFamily: string
        labelScale: number
    }
    motion: {
        speed: number
        idleMotion: boolean
        springStiffness: number
        springDamping: number
        springMass: number
    }
    optics: {
        barrelDistortion: number
        chromaticAberration: number
        fresnel: number
        refraction: number
        bloom: number
    }
    atmosphere: {
        grain: number
        vignette: number
        scanlines: number
        particles: number
        persistence: number
        proceduralNoise: number
    }
}

export const SCIENTIFIC_VISION_THEME: VisionTheme = {
    id: "scientific",
    colors: {
        background: "#020403",
        line: "#f5f5f0",
        accent: "#b7ff46",
        labelBackground: "#0b0d09",
        labelText: "#f5f5f0",
    },
    typography: {
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        labelScale: 1,
    },
    motion: {
        speed: 1,
        idleMotion: true,
        springStiffness: 170,
        springDamping: 19,
        springMass: 1,
    },
    optics: {
        barrelDistortion: 0.045,
        chromaticAberration: 0.8,
        fresnel: 0.2,
        refraction: 0.32,
        bloom: 0.18,
    },
    atmosphere: {
        grain: 0.12,
        vignette: 0.28,
        scanlines: 0.12,
        particles: 0.14,
        persistence: 0.12,
        proceduralNoise: 0.34,
    },
}

export type InspectionEffectName =
    | "zoom"
    | "distortion"
    | "refraction"
    | "edge-emphasis"
    | "false-color"
    | "grain"
    | "bloom"

export interface InspectionEffect {
    type: InspectionEffectName
    enabled?: boolean
    intensity?: number
}

export class InspectionEffectStack {
    private effects: InspectionEffect[]

    constructor(effects: InspectionEffect[] = []) {
        this.effects = effects.filter(effect => effect.enabled !== false)
    }

    list(): readonly InspectionEffect[] {
        return this.effects
    }

    has(type: InspectionEffectName): boolean {
        return this.effects.some(effect => effect.type === type)
    }

    intensity(type: InspectionEffectName, fallback = 0): number {
        return this.effects.find(effect => effect.type === type)?.intensity ?? fallback
    }
}

export interface VisionPerformanceMetrics {
    frameCount: number
    averageFrameMs: number
    /** Mean of the most recent 20 frames — the signal adaptive quality reacts to. */
    recentAverageFrameMs: number
    lastFrameMs: number
    maxFrameMs: number
    droppedFrames: number
    estimatedFps: number
}

export class VisionPerformanceMonitor {
    private frameCount = 0
    private totalFrameMs = 0
    private lastFrameMs = 0
    private maxFrameMs = 0
    private droppedFrames = 0
    // Lifetime averages respond too slowly for quality control: early fast
    // frames dilute a later collapse. A short window tracks what the renderer
    // is doing NOW.
    private recent: number[] = []

    record(frameMs: number, targetFrameMs: number): VisionPerformanceMetrics {
        this.frameCount += 1
        this.totalFrameMs += frameMs
        this.lastFrameMs = frameMs
        this.maxFrameMs = Math.max(this.maxFrameMs, frameMs)
        this.recent.push(frameMs)
        if (this.recent.length > 20) this.recent.shift()
        if (frameMs > targetFrameMs * 1.5) this.droppedFrames += 1
        return this.snapshot()
    }

    snapshot(): VisionPerformanceMetrics {
        const averageFrameMs = this.frameCount ? this.totalFrameMs / this.frameCount : 0
        const recentAverageFrameMs = this.recent.length
            ? this.recent.reduce((sum, value) => sum + value, 0) / this.recent.length
            : 0
        return {
            frameCount: this.frameCount,
            averageFrameMs,
            recentAverageFrameMs,
            lastFrameMs: this.lastFrameMs,
            maxFrameMs: this.maxFrameMs,
            droppedFrames: this.droppedFrames,
            estimatedFps: recentAverageFrameMs > 0 ? 1000 / recentAverageFrameMs : 0,
        }
    }
}

export interface VisionTimelinePoint {
    x: number
    y: number
    id?: string
    score?: number
}

export interface VisionTimelineFrame {
    at: number
    points: VisionTimelinePoint[]
}

export class VisionTimeline {
    private frames: VisionTimelineFrame[] = []
    private readonly maxFrames: number

    // An explicit field rather than a TS parameter property so the module loads
    // under Node's strip-only TypeScript mode, which the test runner uses.
    constructor(maxFrames = 120) {
        this.maxFrames = maxFrames
    }

    push(at: number, points: VisionTimelinePoint[]): void {
        this.frames.push({ at, points: points.map(point => ({ ...point })) })
        if (this.frames.length > this.maxFrames) this.frames.splice(0, this.frames.length - this.maxFrames)
    }

    list(): readonly VisionTimelineFrame[] {
        return this.frames
    }

    nearest(at: number): VisionTimelineFrame | null {
        if (!this.frames.length) return null
        return this.frames.reduce((best, frame) =>
            Math.abs(frame.at - at) < Math.abs(best.at - at) ? frame : best
        )
    }

    clear(): void {
        this.frames = []
    }
}

export interface VisionCaptureOptions {
    fps?: number
    mimeType?: string
    videoBitsPerSecond?: number
}

export interface VisionCaptureController {
    start: (options?: VisionCaptureOptions) => Promise<void>
    stop: () => Promise<Blob>
    isRecording: () => boolean
}

export function createCanvasCaptureController(canvas: HTMLCanvasElement): VisionCaptureController {
    let recorder: MediaRecorder | null = null
    let chunks: Blob[] = []

    return {
        async start(options = {}) {
            if (recorder?.state === "recording") return
            if (!("captureStream" in canvas)) throw new Error("Canvas captureStream is not supported in this browser.")
            const stream = canvas.captureStream(options.fps ?? 60)
            const mimeType = options.mimeType ?? "video/webm;codecs=vp9"
            const supported = typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mimeType)
            recorder = new MediaRecorder(stream, {
                mimeType: supported ? mimeType : "video/webm",
                videoBitsPerSecond: options.videoBitsPerSecond ?? 8_000_000,
            })
            chunks = []
            recorder.ondataavailable = event => {
                if (event.data.size) chunks.push(event.data)
            }
            recorder.start(100)
        },
        stop() {
            return new Promise<Blob>((resolve, reject) => {
                if (!recorder || recorder.state === "inactive") {
                    reject(new Error("No active capture session."))
                    return
                }
                const activeRecorder = recorder
                activeRecorder.onerror = event => reject(new Error(`Capture failed: ${event.type}`))
                activeRecorder.onstop = () => {
                    resolve(new Blob(chunks, { type: activeRecorder.mimeType || "video/webm" }))
                    recorder = null
                    chunks = []
                }
                activeRecorder.stop()
            })
        },
        isRecording() {
            return recorder?.state === "recording"
        },
    }
}
