import {
    ChangeEvent,
    CSSProperties,
    KeyboardEvent as ReactKeyboardEvent,
    PointerEvent as ReactPointerEvent,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react"
import GridPulseScan, {
    GRID_PULSE_SCAN_DEFAULTS,
    GridPulseAspectRatio,
    GridPulseBoxOptions,
    GridPulseConnectionOptions,
    GridPulseCrosshairOptions,
    GridPulseDetectionOptions,
    GridPulseEffectOptions,
    GridPulseGridOptions,
    GridPulseInteractionOptions,
    GridPulseLabelOptions,
    GridPulseMediaOptions,
    GridPulseMotionOptions,
    GridPulseFrameSnapshot,
    GridPulsePoint,
    GridPulseRenderBridge,
    GridPulseRenderingOptions,
    GridPulseScanProps,
    GridPulseThemeOptions,
} from "./GridPulseScan"
import { layoutGridPulseTrackingFrames } from "./GridPulseGeometry"
import {
    acquisitionMotion,
    DEFAULT_ACQUISITION_SPRING,
    typedLabel,
} from "./MotionEngine"
import {
    VisionGraphMode,
    VisionSceneGraph,
    VisionSceneGraphStore,
} from "./VisionSceneGraph"
import {
    PipelineOptions,
    RendererProfileName,
    RENDERER_PROFILES,
    RenderingPipeline,
} from "./RenderingPipeline"
import {
    GpuPostProcessor,
    type GpuBackendPreference,
    type GpuCapability,
} from "./GpuPostProcessor"
import {
    createCanvasCaptureController,
    InspectionEffect,
    InspectionEffectStack,
    SCIENTIFIC_VISION_THEME,
    VisionCaptureController,
    VisionPerformanceMetrics,
    VisionPerformanceMonitor,
    VisionPlugin,
    VisionPluginContext,
    VisionTheme,
    VisionTimeline,
} from "./VisionFramework"
import {
    degradeQuality,
    QualityEnvironment,
    QualityProfile,
    resolveVisionQuality,
    shouldDegradeQuality,
    VisionQualityMode,
} from "./AdaptiveQuality"

export const SPECIMEN_GRID_PRESETS = [
    "Feature Tracking",
    "Zoom Insets",
    "Survey Grid",
    "Detection Swarm",
    "Annotation Plate",
    "Point Mesh",
    "Viewfinder",
    "Contour Scan",
    "Facade Analysis",
    "Botanical Analysis",
] as const

export type SpecimenGridPreset = (typeof SPECIMEN_GRID_PRESETS)[number]
export type SpecimenGridFinish = "minimal" | "editorial" | "laboratory"
export type SpecimenGridControlVariant = "select" | "rail"
export type SpecimenGridInteraction = "hybrid" | "pointer" | "idle" | "none"
export type SpecimenGridComposition = "integrated" | "grid-pulse" | "specimen"

export interface SpecimenGridOptions {
    enabled: boolean
    preset: SpecimenGridPreset
    composition: SpecimenGridComposition
    lineColor: string
    accentColor: string
    lineWidth: number
    fontFamily: string
    labelScale: number
    focusX: number
    focusY: number
    focusRadius: number
    showGuideLines: boolean
    guideStyle: "web" | "orthogonal" | "hybrid"
    guideOpacity: number
    trackingFrameScale: number
    overlayOpacity: number
    density: number
    magnification: number
    distortion: number
    speed: number
    parallax: number
    idleMotion: boolean
    interaction: SpecimenGridInteraction
    finish: SpecimenGridFinish
    grain: number
    vignette: number
    scanlines: number
    borderRadius: number | string
    showFrame: boolean
    showHud: boolean
    showStatus: boolean
    showControls: boolean
    controlVariant: SpecimenGridControlVariant
    controlsLabel: string
    mobileRail: boolean
    mediaSampleRate: number
    maxOverlayFps: number
    responsive: boolean
    /** Enables target-lock → line-draw → frame-pop → media-reveal choreography. */
    acquisitionChoreography: boolean
    /** Strength of the full-media animated film displacement. */
    filmDistortion: number
    /** Visibility of the traveling energy pulse across the grid. */
    gridPulse: number
    /** Graph strategy used by linked detections and mesh presets. */
    graphMode: VisionGraphMode
    /** Number of nearest neighbors used by nearest and mesh graph modes. */
    graphNeighbors: number
    /** Keeps recently replaced detections as fading context nodes. */
    temporalMemoryMs: number
    /** Maximum number of fading context nodes retained between rescans. */
    maxGhostNodes: number
    /** Seconds of stagger between each acquired region. */
    acquisitionDelay: number
    /** Spring stiffness used by frame assembly. */
    springStiffness: number
    /** Spring damping used by frame assembly. */
    springDamping: number
    /** Spring mass used by frame assembly. */
    springMass: number
    /** Enables radial acquisition waves that deform and illuminate the survey field. */
    scanWaves: boolean
    /** Strength of radial acquisition waves. */
    scanWaveStrength: number
    /** Types labels during acquisition instead of revealing them all at once. */
    typeLabels: boolean
    /** Rendering personality used by lens, noise, lighting, persistence, and particle passes. */
    rendererProfile: RendererProfileName
    /** Strength of coherent procedural noise. */
    proceduralNoise: number
    /** Previous-frame persistence used for scan trails. */
    temporalPersistence: number
    /** Sparse sensor-particle density. */
    particleDensity: number
    /** Lens barrel distortion amount. */
    lensBarrelDistortion: number
    /** Lens chromatic offset in CSS pixels. */
    lensChromaticAberration: number
    /** Lens edge-lighting strength. */
    lensFresnel: number
    /** Lens refraction strength. */
    lensRefraction: number
    /** Lens bloom strength. */
    lensBloom: number
    /** Enables the WebGL2 post-processing backend when supported. */
    gpuPostProcessing: boolean
    /** Selects automatic WebGL2 capability detection or forces a fallback. */
    gpuBackend: GpuBackendPreference
    /** Global strength applied to shader distortion. */
    gpuDistortion: number
    /** Global strength applied to the shader scan-energy band. */
    gpuScanStrength: number
}

export interface SpecimenGridPulseProps
    extends Omit<GridPulseScanProps, "style" | "className" | "onScan" | "onActiveChange" | "preset"> {
    style?: CSSProperties
    className?: string
    specimen?: Partial<SpecimenGridOptions>
    /** Convenience override for specimen.preset. */
    preset?: SpecimenGridPreset
    onPresetChange?: (preset: SpecimenGridPreset) => void
    onScan?: (points: GridPulsePoint[]) => void
    onActiveChange?: (active: boolean) => void
    /** Optional renderer plugins. Plugins may render before, after, or on top of post-processing. */
    plugins?: VisionPlugin[]
    /** Complete visual theme override mapped into the existing rendering options. */
    visionTheme?: Partial<VisionTheme>
    /** Composable inspection effects exposed to plugins and future GPU backends. */
    inspectionEffects?: InspectionEffect[]
    /** Emits lightweight internal render metrics at a throttled cadence. */
    onPerformanceMetrics?: (metrics: VisionPerformanceMetrics) => void
    /** Provides a real MediaRecorder-backed canvas capture controller. */
    onCaptureController?: (controller: VisionCaptureController) => void
    /** Optional timeline capacity for scan-history playback tooling. */
    timelineCapacity?: number
    /** Reports whether the optional GPU post-processing backend initialized. */
    onGpuCapability?: (capability: GpuCapability) => void
    /** Selects automatic adaptive quality or a fixed quality tier. */
    quality?: VisionQualityMode
    /** Reports the currently active quality profile, including runtime degradation. */
    onQualityChange?: (profile: QualityProfile) => void
}

type PixelPoint = Required<Pick<GridPulsePoint, "x" | "y">> & {
    px: number
    py: number
    score: number
    id: string
    phase: number
    reveal: number
}

type ScanBox = {
    x: number
    y: number
    width: number
    height: number
    anchorX: number
    anchorY: number
}

type MediaSource = HTMLImageElement | HTMLVideoElement | HTMLCanvasElement

type RenderEnvironment = {
    ctx: CanvasRenderingContext2D
    width: number
    height: number
    now: number
    dt: number
    points: PixelPoint[]
    boxes: ScanBox[]
    pointerX: number
    pointerY: number
    pointerStrength: number
    active: boolean
    compact: boolean
    reducedMotion: boolean
    options: SpecimenGridOptions
    media: MediaSource | null
    mediaOptions: GridPulseMediaOptions
    detectionMode: GridPulseDetectionOptions["mode"]
    scene: VisionSceneGraph
    pipeline: RenderingPipeline
    profile: PipelineOptions
}

const DEFAULT_SPECIMEN: SpecimenGridOptions = {
    enabled: true,
    preset: "Feature Tracking",
    composition: "integrated",
    lineColor: "#f5f5f0",
    accentColor: "#b7ff46",
    lineWidth: 1,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    labelScale: 1,
    focusX: 0.5,
    focusY: 0.5,
    focusRadius: 0.72,
    showGuideLines: true,
    guideStyle: "hybrid",
    guideOpacity: 0.86,
    trackingFrameScale: 1,
    overlayOpacity: 0.92,
    density: 18,
    magnification: 1.9,
    distortion: 2.4,
    speed: 1,
    parallax: 18,
    idleMotion: true,
    interaction: "hybrid",
    finish: "laboratory",
    grain: 0.14,
    vignette: 0.34,
    scanlines: 0.11,
    borderRadius: 16,
    showFrame: true,
    showHud: true,
    showStatus: true,
    showControls: true,
    controlVariant: "rail",
    controlsLabel: "PRESET",
    mobileRail: true,
    mediaSampleRate: 18,
    maxOverlayFps: 40,
    responsive: true,
    acquisitionChoreography: true,
    filmDistortion: 0.42,
    gridPulse: 0.5,
    graphMode: "mst",
    graphNeighbors: 2,
    temporalMemoryMs: 1800,
    maxGhostNodes: 6,
    acquisitionDelay: 0.055,
    springStiffness: DEFAULT_ACQUISITION_SPRING.stiffness,
    springDamping: DEFAULT_ACQUISITION_SPRING.damping,
    springMass: DEFAULT_ACQUISITION_SPRING.mass,
    scanWaves: true,
    scanWaveStrength: 0.72,
    typeLabels: true,
    rendererProfile: "feature",
    proceduralNoise: 0.34,
    temporalPersistence: 0.12,
    particleDensity: 0.14,
    lensBarrelDistortion: 0.045,
    lensChromaticAberration: 0.8,
    lensFresnel: 0.2,
    lensRefraction: 0.32,
    lensBloom: 0.18,
    gpuPostProcessing: true,
    gpuBackend: "auto",
    gpuDistortion: 0.7,
    gpuScanStrength: 0.42,
}

const DEFAULT_MEDIA: GridPulseMediaOptions = { ...GRID_PULSE_SCAN_DEFAULTS.media }

const DEFAULT_BOXES: GridPulseBoxOptions = { ...GRID_PULSE_SCAN_DEFAULTS.boxes }

const PRESET_META: Record<SpecimenGridPreset, { code: string; description: string }> = {
    "Feature Tracking": { code: "TRK", description: "Linked optical feature regions" },
    "Zoom Insets": { code: "ZIN", description: "Distorted magnified inspection windows" },
    "Survey Grid": { code: "SRV", description: "Coordinate sampling and survey geometry" },
    "Detection Swarm": { code: "DET", description: "Dense responsive detection field" },
    "Annotation Plate": { code: "ANN", description: "Measured regions with confidence data" },
    "Point Mesh": { code: "MSH", description: "Spatial mesh anchored to detections" },
    Viewfinder: { code: "VWF", description: "Camera frame and focus telemetry" },
    "Contour Scan": { code: "CTR", description: "Luminance-inspired contour scanning" },
    "Facade Analysis": { code: "ARC", description: "Architectural rhythm and feature inspection" },
    "Botanical Analysis": { code: "BIO", description: "Organic structure, frond intersections, and vein inspection" },
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const lerp = (a: number, b: number, amount: number) => a + (b - a) * amount
const TAU = Math.PI * 2

function specimenFont(options: SpecimenGridOptions, size: number, weight = 650) {
    const scaledSize = clamp(size * options.labelScale, 5, 18)
    return `${weight} ${scaledSize}px ${options.fontFamily}`
}

function alpha(color: string, opacity: number) {
    const value = color.trim()
    if (!value.startsWith("#")) return color
    const raw = value.slice(1)
    const hex = raw.length === 3 ? raw.split("").map(part => part + part).join("") : raw.slice(0, 6)
    const red = Number.parseInt(hex.slice(0, 2), 16)
    const green = Number.parseInt(hex.slice(2, 4), 16)
    const blue = Number.parseInt(hex.slice(4, 6), 16)
    if (![red, green, blue].every(Number.isFinite)) return color
    return `rgba(${red}, ${green}, ${blue}, ${clamp(opacity, 0, 1)})`
}

function hashSeed(seed: string) {
    let hash = 2166136261
    for (let index = 0; index < seed.length; index += 1) {
        hash ^= seed.charCodeAt(index)
        hash = Math.imul(hash, 16777619)
    }
    return hash >>> 0
}

function randomFactory(seed: number) {
    let value = seed || 1
    return () => {
        value += 0x6d2b79f5
        let result = value
        result = Math.imul(result ^ (result >>> 15), result | 1)
        result ^= result + Math.imul(result ^ (result >>> 7), result | 61)
        return ((result ^ (result >>> 14)) >>> 0) / 4294967296
    }
}

function aspectRatioValue(ratio: GridPulseAspectRatio | undefined) {
    if (!ratio || ratio === "free") return undefined
    const [width, height] = ratio.split(":").map(Number)
    return `${width} / ${height}`
}

function isLikelyVideoSource(src: string, media: GridPulseMediaOptions) {
    if (media.type === "video") return true
    if (media.type === "image") return false
    return /\.(mp4|webm|ogv|mov|m4v|m3u8)(?:[?#].*)?$/i.test(src)
}

function fallbackPoints(width: number, height: number, count: number, seed: string): PixelPoint[] {
    const random = randomFactory(hashSeed(seed))
    const anchors = [
        [0.23, 0.28],
        [0.73, 0.2],
        [0.72, 0.58],
        [0.3, 0.7],
        [0.52, 0.46],
        [0.16, 0.5],
        [0.86, 0.78],
        [0.5, 0.18],
    ]
    return Array.from({ length: count }, (_, index) => {
        const anchor = anchors[index % anchors.length]
        const x = clamp(anchor[0] + (random() - 0.5) * 0.08, 0.06, 0.94)
        const y = clamp(anchor[1] + (random() - 0.5) * 0.08, 0.06, 0.94)
        return {
            x,
            y,
            px: x * width,
            py: y * height,
            score: clamp(0.97 - index * 0.07 + random() * 0.03, 0.35, 1),
            id: `SCAN-${String(index + 1).padStart(2, "0")}`,
            phase: random() * TAU,
            reveal: 1,
        }
    })
}

function mediaDimensions(media: MediaSource | null) {
    if (!media) return null
    if (media instanceof HTMLVideoElement) {
        return media.videoWidth && media.videoHeight
            ? { width: media.videoWidth, height: media.videoHeight }
            : null
    }
    if (media instanceof HTMLCanvasElement) {
        return media.width && media.height ? { width: media.width, height: media.height } : null
    }
    return media.naturalWidth && media.naturalHeight
        ? { width: media.naturalWidth, height: media.naturalHeight }
        : null
}

function displayRect(
    sourceWidth: number,
    sourceHeight: number,
    width: number,
    height: number,
    media: GridPulseMediaOptions
) {
    if (media.objectFit === "fill") return { x: 0, y: 0, width, height }
    const scale =
        media.objectFit === "contain"
            ? Math.min(width / sourceWidth, height / sourceHeight)
            : Math.max(width / sourceWidth, height / sourceHeight)
    const drawWidth = sourceWidth * scale
    const drawHeight = sourceHeight * scale
    return {
        x: (width - drawWidth) * clamp(media.positionX, 0, 1),
        y: (height - drawHeight) * clamp(media.positionY, 0, 1),
        width: drawWidth,
        height: drawHeight,
    }
}

function rendererProfileForPreset(options: SpecimenGridOptions): PipelineOptions {
    const presetProfile: RendererProfileName =
        options.preset === "Survey Grid" ? "survey"
        : options.preset === "Botanical Analysis" ? "botanical"
        : options.preset === "Contour Scan" ? "medical"
        : options.preset === "Facade Analysis" ? "blueprint"
        : options.preset === "Detection Swarm" ? "security"
        : options.rendererProfile
    const base = RENDERER_PROFILES[presetProfile]
    return {
        ...base,
        noiseStrength: options.proceduralNoise,
        temporalPersistence: options.temporalPersistence,
        particleDensity: options.particleDensity,
        lens: {
            ...base.lens,
            magnification: options.magnification,
            barrelDistortion: options.lensBarrelDistortion,
            chromaticAberration: options.lensChromaticAberration,
            fresnel: options.lensFresnel,
            refraction: options.lensRefraction,
            bloom: options.lensBloom,
        },
    }
}

function drawDistortedInset(
    env: RenderEnvironment,
    point: PixelPoint,
    box: ScanBox,
    intensity: number,
    accent = false
) {
    const { ctx, media, mediaOptions, options, now } = env
    const dimensions = mediaDimensions(media)
    if (!media || !dimensions) return
    const sourceIsDisplayCanvas = media instanceof HTMLCanvasElement
    const base = sourceIsDisplayCanvas
        ? { x: 0, y: 0, width: env.width, height: env.height }
        : displayRect(dimensions.width, dimensions.height, env.width, env.height, mediaOptions)
    let normalizedX = clamp((point.px - base.x) / Math.max(1, base.width), 0, 1)
    const normalizedY = clamp((point.py - base.y) / Math.max(1, base.height), 0, 1)
    if (!sourceIsDisplayCanvas && mediaOptions.mirror) normalizedX = 1 - normalizedX

    const zoom = Math.max(0.5, options.magnification + point.score * 0.42)
    const sourceWidth = clamp(
        (box.width * dimensions.width) / Math.max(1, base.width) / zoom,
        12,
        dimensions.width
    )
    const sourceHeight = clamp(
        (box.height * dimensions.height) / Math.max(1, base.height) / zoom,
        12,
        dimensions.height
    )
    const sourceCenterX = normalizedX * dimensions.width
    const sourceCenterY = normalizedY * dimensions.height
    const sourceLeft = clamp(sourceCenterX - sourceWidth / 2, 0, dimensions.width - sourceWidth)
    const sourceTop = clamp(sourceCenterY - sourceHeight / 2, 0, dimensions.height - sourceHeight)

    ctx.save()
    ctx.beginPath()
    ctx.rect(box.x, box.y, box.width, box.height)
    ctx.clip()
    ctx.globalAlpha = clamp(options.overlayOpacity * intensity, 0, 1)

    if (!sourceIsDisplayCanvas && mediaOptions.mirror) {
        ctx.translate(box.x + box.width, box.y)
        ctx.scale(-1, 1)
        ctx.translate(-box.x, -box.y)
    }

    env.pipeline.drawLens(
        ctx,
        media,
        { sx: sourceLeft, sy: sourceTop, sw: sourceWidth, sh: sourceHeight },
        { x: box.x, y: box.y, width: box.width, height: box.height },
        now,
        point.phase,
        intensity,
        accent ? options.accentColor : options.lineColor,
        env.profile,
        env.reducedMotion
    )

    ctx.fillStyle = alpha(accent ? options.accentColor : options.lineColor, accent ? 0.09 : 0.035)
    ctx.fillRect(box.x, box.y, box.width, box.height)
    ctx.restore()
}

function drawCornerBox(
    ctx: CanvasRenderingContext2D,
    box: ScanBox,
    corner: number,
    color: string,
    lineWidth: number,
    opacity: number
) {
    const { x, y, width, height } = box
    const length = clamp(corner, 6, Math.min(width, height) / 3)
    ctx.save()
    ctx.strokeStyle = color
    ctx.lineWidth = lineWidth
    ctx.globalAlpha = opacity
    ctx.setLineDash([])
    ctx.beginPath()
    ctx.moveTo(x, y + length)
    ctx.lineTo(x, y)
    ctx.lineTo(x + length, y)
    ctx.moveTo(x + width - length, y)
    ctx.lineTo(x + width, y)
    ctx.lineTo(x + width, y + length)
    ctx.moveTo(x + width, y + height - length)
    ctx.lineTo(x + width, y + height)
    ctx.lineTo(x + width - length, y + height)
    ctx.moveTo(x + length, y + height)
    ctx.lineTo(x, y + height)
    ctx.lineTo(x, y + height - length)
    ctx.stroke()
    ctx.restore()
}

function drawTag(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    foreground: string,
    background: string,
    options: SpecimenGridOptions,
    align: "left" | "right" = "left"
) {
    ctx.save()
    ctx.font = specimenFont(options, 7)
    ctx.textBaseline = "middle"
    const horizontalPadding = clamp(4.5 * options.labelScale, 3.5, 8)
    const height = clamp(15 * options.labelScale, 13, 24)
    const width = Math.ceil(ctx.measureText(text).width + horizontalPadding * 2)
    const left = align === "right" ? x - width : x
    ctx.fillStyle = background
    ctx.fillRect(Math.round(left), Math.round(y - height), width, height)
    ctx.fillStyle = foreground
    ctx.fillText(text, Math.round(left + horizontalPadding), Math.round(y - height / 2))
    ctx.restore()
}

function drawTicks(
    ctx: CanvasRenderingContext2D,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    color: string,
    opacity: number,
    spacing = 28
) {
    const dx = endX - startX
    const dy = endY - startY
    const length = Math.max(1, Math.hypot(dx, dy))
    const nx = -dy / length
    const ny = dx / length
    ctx.save()
    ctx.strokeStyle = color
    ctx.globalAlpha = opacity
    ctx.lineWidth = 0.8
    ctx.setLineDash([2, 5])
    ctx.beginPath()
    ctx.moveTo(startX, startY)
    ctx.lineTo(endX, endY)
    ctx.stroke()
    ctx.setLineDash([])
    for (let distance = spacing; distance < length - 8; distance += spacing) {
        const progress = distance / length
        const x = lerp(startX, endX, progress)
        const y = lerp(startY, endY, progress)
        ctx.beginPath()
        ctx.moveTo(x - nx * 2.5, y - ny * 2.5)
        ctx.lineTo(x + nx * 2.5, y + ny * 2.5)
        ctx.stroke()
    }
    ctx.restore()
}

function drawScanSweep(ctx: CanvasRenderingContext2D, box: ScanBox, env: RenderEnvironment, phase = 0) {
    if (env.reducedMotion) return
    const progress = ((env.now * 0.0005 * env.options.speed + phase) % 1 + 1) % 1
    const y = box.y + box.height * progress
    const gradient = ctx.createLinearGradient(0, y - 8, 0, y + 8)
    gradient.addColorStop(0, alpha(env.options.lineColor, 0))
    gradient.addColorStop(0.48, alpha(env.options.lineColor, 0.08))
    gradient.addColorStop(0.5, alpha(env.options.lineColor, 0.7))
    gradient.addColorStop(0.52, alpha(env.options.lineColor, 0.08))
    gradient.addColorStop(1, alpha(env.options.lineColor, 0))
    ctx.save()
    ctx.beginPath()
    ctx.rect(box.x, box.y, box.width, box.height)
    ctx.clip()
    ctx.fillStyle = gradient
    ctx.fillRect(box.x, y - 8, box.width, 16)
    ctx.restore()
}


function drawSolidLine(
    ctx: CanvasRenderingContext2D,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    color: string,
    opacity: number,
    lineWidth = 0.9
) {
    ctx.save()
    ctx.strokeStyle = color
    ctx.globalAlpha = opacity
    ctx.lineWidth = lineWidth
    ctx.setLineDash([])
    ctx.beginPath()
    ctx.moveTo(startX, startY)
    ctx.lineTo(endX, endY)
    ctx.stroke()
    ctx.restore()
}

function drawFullFrame(
    ctx: CanvasRenderingContext2D,
    box: ScanBox,
    color: string,
    opacity: number,
    lineWidth: number
) {
    ctx.save()
    ctx.strokeStyle = color
    ctx.globalAlpha = opacity
    ctx.lineWidth = lineWidth
    ctx.setLineDash([])
    ctx.strokeRect(
        Math.round(box.x) + 0.5,
        Math.round(box.y) + 0.5,
        Math.round(box.width),
        Math.round(box.height)
    )
    ctx.restore()
}

function trackingFrames(env: RenderEnvironment) {
    const { width, height, points, options, compact, pointerX, pointerY } = env
    const safeTop = options.showHud ? 44 : 8
    const safeBottom =
        options.showControls && options.controlVariant === "rail"
            ? compact ? 76 : 72
            : 10
    const adjustedPoints = points.map((point, index) => ({
        px: point.px + pointerX * options.parallax * (index % 2 ? -0.12 : 0.12),
        py: point.py + pointerY * options.parallax * (index % 3 ? 0.1 : -0.1),
    }))
    const frames = layoutGridPulseTrackingFrames(adjustedPoints, width, height, {
        compact,
        scale: options.trackingFrameScale,
        safeTop,
        safeBottom,
        padding: 8,
        minGap: compact ? 4 : 8,
    })
    return frames.map((frame, index) => ({
        ...frame,
        anchorX: points[index]?.px ?? frame.anchorX,
        anchorY: points[index]?.py ?? frame.anchorY,
    }))
}

function nearestFramePoint(box: ScanBox, x: number, y: number) {
    const candidates = [
        { x: clamp(x, box.x, box.x + box.width), y: box.y },
        { x: box.x + box.width, y: clamp(y, box.y, box.y + box.height) },
        { x: clamp(x, box.x, box.x + box.width), y: box.y + box.height },
        { x: box.x, y: clamp(y, box.y, box.y + box.height) },
    ]
    return candidates.sort(
        (first, second) =>
            Math.hypot(first.x - x, first.y - y) - Math.hypot(second.x - x, second.y - y)
    )[0]
}

function focusedFrameIndex(env: RenderEnvironment, frames: ScanBox[]) {
    if (!frames.length) return 0
    const pointerX = clamp((env.pointerX + 1) * 0.5, 0, 1) * env.width
    const pointerY = clamp((env.pointerY + 1) * 0.5, 0, 1) * env.height
    let focused = 0
    let bestDistance = Number.POSITIVE_INFINITY
    frames.forEach((frame, index) => {
        const inside =
            pointerX >= frame.x - 4 &&
            pointerX <= frame.x + frame.width + 4 &&
            pointerY >= frame.y - 4 &&
            pointerY <= frame.y + frame.height + 4
        const distance = Math.hypot(
            frame.x + frame.width / 2 - pointerX,
            frame.y + frame.height / 2 - pointerY
        ) - (inside ? Math.min(frame.width, frame.height) : 0)
        if (distance < bestDistance) {
            focused = index
            bestDistance = distance
        }
    })
    return focused
}

function focusedPointIndex(env: RenderEnvironment, points: PixelPoint[]) {
    if (!points.length) return 0
    const pointerX = clamp((env.pointerX + 1) * 0.5, 0, 1) * env.width
    const pointerY = clamp((env.pointerY + 1) * 0.5, 0, 1) * env.height
    let focused = 0
    let bestDistance = Number.POSITIVE_INFINITY
    points.forEach((point, index) => {
        const distance = Math.hypot(point.px - pointerX, point.py - pointerY)
        if (distance < bestDistance) {
            focused = index
            bestDistance = distance
        }
    })
    return focused
}

function drawTrackingWeb(
    env: RenderEnvironment,
    frames: ScanBox[],
    colorForIndex: (index: number) => string,
    focusedIndex: number
) {
    const { ctx, width, height, options, pointerX, pointerY } = env
    if (!options.showGuideLines || !frames.length) return
    const hubX = clamp(width * 0.45 + pointerX * options.parallax * 0.45, 18, width - 18)
    const hubY = clamp(height * 0.56 + pointerY * options.parallax * 0.45, 18, height - 18)
    const opacity = clamp(options.guideOpacity, 0, 1)

    frames.forEach((frame, index) => {
        const target = nearestFramePoint(frame, hubX, hubY)
        if (options.guideStyle === "web" || options.guideStyle === "hybrid") {
            drawSolidLine(
                ctx,
                hubX,
                hubY,
                target.x,
                target.y,
                colorForIndex(index),
                opacity * (index === focusedIndex ? 1 : index === 0 ? 0.86 : 0.58),
                Math.max(0.7, options.lineWidth * (index === focusedIndex ? 1.12 : 0.82))
            )
        }
        if (options.guideStyle === "orthogonal" || options.guideStyle === "hybrid") {
            const elbowX = index % 2 === 0 ? target.x : hubX
            const elbowY = index % 2 === 0 ? hubY : target.y
            drawSolidLine(
                ctx,
                hubX,
                hubY,
                elbowX,
                elbowY,
                colorForIndex(index),
                opacity * 0.28,
                Math.max(0.55, options.lineWidth * 0.65)
            )
            drawSolidLine(
                ctx,
                elbowX,
                elbowY,
                target.x,
                target.y,
                colorForIndex(index),
                opacity * 0.28,
                Math.max(0.55, options.lineWidth * 0.65)
            )
        }
    })

    ctx.save()
    ctx.fillStyle = env.active ? options.accentColor : options.lineColor
    ctx.strokeStyle = env.active ? options.accentColor : options.lineColor
    ctx.globalAlpha = opacity
    ctx.lineWidth = Math.max(0.7, options.lineWidth)
    ctx.beginPath()
    ctx.arc(hubX, hubY, 3.2, 0, TAU)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(hubX, hubY, 7.5, 0, TAU)
    ctx.globalAlpha = opacity * 0.48
    ctx.stroke()
    ctx.restore()
}

function drawFrameAxisGuides(
    env: RenderEnvironment,
    frames: ScanBox[],
    opacity = 0.18
) {
    if (!env.options.showGuideLines || env.options.guideStyle === "web") return
    const { ctx, width, height, options } = env
    ctx.save()
    ctx.strokeStyle = options.lineColor
    ctx.lineWidth = Math.max(0.5, options.lineWidth * 0.6)
    ctx.globalAlpha = clamp(options.guideOpacity * opacity, 0, 1)
    ctx.setLineDash([1, 7])
    frames.forEach((frame, index) => {
        if (index > (env.compact ? 1 : 3)) return
        const x = Math.round(frame.x + frame.width / 2) + 0.5
        const y = Math.round(frame.y + frame.height / 2) + 0.5
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
        ctx.stroke()
    })
    ctx.restore()
}


function acquisitionStages(point: PixelPoint, index: number, env: RenderEnvironment) {
    return acquisitionMotion(point.reveal, env.now, index, {
        enabled: env.options.acquisitionChoreography,
        reducedMotion: env.reducedMotion,
        delay: env.options.acquisitionDelay,
        spring: {
            stiffness: env.options.springStiffness,
            damping: env.options.springDamping,
            mass: env.options.springMass,
        },
    })
}

function animatedScanBox(box: ScanBox, progress: number, breath = 1) {
    const spring = clamp(progress, 0, 1.08)
    const scale = (0.62 + spring * 0.38) * breath
    const width = box.width * scale
    const height = box.height * scale
    return {
        ...box,
        x: box.x + (box.width - width) / 2,
        y: box.y + (box.height - height) / 2 + (1 - Math.min(1, spring)) * 12,
        width,
        height,
    }
}

function drawProgressLine(
    ctx: CanvasRenderingContext2D,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    progress: number,
    color: string,
    opacity: number,
    lineWidth = 1
) {
    const t = clamp(progress, 0, 1)
    drawSolidLine(
        ctx,
        startX,
        startY,
        lerp(startX, endX, t),
        lerp(startY, endY, t),
        color,
        opacity * t,
        lineWidth
    )
}

function drawAcquisitionWave(env: RenderEnvironment, point: PixelPoint, progress: number) {
    if (!env.options.scanWaves || env.reducedMotion || progress <= 0) return
    const { ctx, options } = env
    const radius = lerp(8, Math.min(env.width, env.height) * 0.18, progress)
    ctx.save()
    ctx.strokeStyle = options.accentColor
    ctx.globalAlpha = (1 - progress) * options.scanWaveStrength * 0.65
    ctx.lineWidth = Math.max(0.7, options.lineWidth)
    ctx.beginPath()
    ctx.arc(point.px, point.py, radius, 0, TAU)
    ctx.stroke()
    ctx.globalAlpha *= 0.42
    ctx.beginPath()
    ctx.arc(point.px, point.py, radius * 0.72, 0, TAU)
    ctx.stroke()
    ctx.restore()
}

function drawReactiveGrid(env: RenderEnvironment) {
    if (!env.options.scanWaves || env.reducedMotion) return
    const { ctx, width, height, points, options } = env
    const spacing = Math.max(44, Math.min(width, height) / Math.max(8, options.density * 0.62))
    ctx.save()
    ctx.lineWidth = 0.65
    points.forEach((point, index) => {
        const motion = acquisitionStages(point, index, env)
        if (motion.wave <= 0) return
        const radius = lerp(12, Math.min(width, height) * 0.2, 1 - motion.wave * 0.35)
        const strength = motion.wave * options.scanWaveStrength
        ctx.strokeStyle = options.accentColor
        ctx.globalAlpha = strength * 0.08
        for (let x = 0; x <= width; x += spacing) {
            const dx = x - point.px
            if (Math.abs(dx) > radius) continue
            const shift = Math.sin((dx / radius) * Math.PI) * strength * 5
            ctx.beginPath()
            ctx.moveTo(x + shift, Math.max(0, point.py - radius))
            ctx.lineTo(x + shift, Math.min(height, point.py + radius))
            ctx.stroke()
        }
        for (let y = 0; y <= height; y += spacing) {
            const dy = y - point.py
            if (Math.abs(dy) > radius) continue
            const shift = Math.sin((dy / radius) * Math.PI) * strength * 5
            ctx.beginPath()
            ctx.moveTo(Math.max(0, point.px - radius), y + shift)
            ctx.lineTo(Math.min(width, point.px + radius), y + shift)
            ctx.stroke()
        }
    })
    ctx.restore()
}

function drawAtmosphericFilm(env: RenderEnvironment) {
    const { ctx, media, width, height, options, now, reducedMotion, pipeline, profile } = env
    pipeline.drawAtmosphere(
        ctx,
        media,
        width,
        height,
        now,
        clamp(options.filmDistortion, 0, 1),
        options.speed,
        reducedMotion,
        profile,
        options.accentColor
    )
}

function drawFeatureTracking(env: RenderEnvironment) {
    const { ctx, points, options, width, height, pointerX, pointerY } = env
    const frames = trackingFrames(env)
    const focusedIndex = focusedFrameIndex(env, frames)
    const colorForIndex = (index: number) =>
        index === focusedIndex || index === 0 ? options.accentColor : options.lineColor

    drawAtmosphericFilm(env)
    drawReactiveGrid(env)
    drawFrameAxisGuides(env, frames, 0.13)

    const hubX = clamp(width * 0.45 + pointerX * options.parallax * 0.45, 18, width - 18)
    const hubY = clamp(height * 0.56 + pointerY * options.parallax * 0.45, 18, height - 18)

    points.forEach((point, index) => {
        const frame = frames[index]
        if (!frame) return
        const stages = acquisitionStages(point, index, env)
        const animatedFrame = animatedScanBox(frame, stages.frame, stages.breath)
        drawAcquisitionWave(env, point, 1 - stages.wave)
        const sceneNode = env.scene.nodes[index]
        const highlighted = index === focusedIndex || index === env.scene.primaryIndex
        const color = colorForIndex(index)
        const visualWeight = sceneNode?.weight ?? point.score
        const target = nearestFramePoint(animatedFrame, hubX, hubY)

        if (options.showGuideLines) {
            drawProgressLine(
                ctx,
                hubX,
                hubY,
                target.x,
                target.y,
                stages.connector,
                color,
                options.guideOpacity * (highlighted ? 0.96 : 0.42 + visualWeight * 0.24),
                Math.max(0.7, options.lineWidth * (sceneNode?.lineWidth ?? (highlighted ? 1.12 : 0.82)))
            )
        }

        ctx.save()
        ctx.strokeStyle = color
        ctx.globalAlpha = stages.lock * (highlighted ? 0.98 : sceneNode?.opacity ?? 0.72)
        ctx.lineWidth = Math.max(0.75, options.lineWidth * (sceneNode?.lineWidth ?? 1))
        const marker = lerp(2, sceneNode?.radius ?? (highlighted ? 8 : 6), stages.lock)
        ctx.strokeRect(
            Math.round(point.px - marker / 2) + 0.5,
            Math.round(point.py - marker / 2) + 0.5,
            marker,
            marker
        )
        if (stages.lock < 1 && !env.reducedMotion) {
            ctx.beginPath()
            ctx.arc(point.px, point.py, 4 + stages.lock * 12, 0, TAU)
            ctx.globalAlpha *= 1 - stages.lock * 0.72
            ctx.stroke()
        }
        ctx.restore()

        if (stages.frame <= 0) return
        drawDistortedInset(
            env,
            point,
            animatedFrame,
            (highlighted ? 0.68 : 0.38) * stages.media,
            highlighted
        )
        if (stages.media > 0.08) {
            drawScanSweep(ctx, animatedFrame, env, index * 0.19 + (1 - stages.settle) * 0.12)
        }

        drawFullFrame(
            ctx,
            animatedFrame,
            color,
            clamp(options.guideOpacity * stages.frame * (highlighted ? 1 : 0.72), 0, 1),
            Math.max(0.75, options.lineWidth * (highlighted ? 1.15 : 0.9))
        )
        drawCornerBox(
            ctx,
            animatedFrame,
            highlighted ? 15 : 10,
            color,
            Math.max(0.8, options.lineWidth),
            stages.frame * (highlighted ? 0.98 : 0.52)
        )

        if (stages.media > 0.24) {
            const completeLabel = `TRK ${String(index + 1).padStart(2, "0")}  ${(point.score * 100).toFixed(1)}%`
            const visibleLabel = options.typeLabels
                ? typedLabel(completeLabel, stages.label)
                : completeLabel
            if (visibleLabel) {
                drawTag(
                    ctx,
                    visibleLabel,
                    animatedFrame.x,
                    animatedFrame.y,
                    highlighted ? "#10130d" : "#111111",
                    highlighted ? options.accentColor : alpha(options.lineColor, 0.96),
                    options
                )
            }
        }
    })

    const hubReveal = points.length
        ? Math.max(...points.map(point => acquisitionStages(point, points.indexOf(point), env).connector))
        : 0
    ctx.save()
    ctx.fillStyle = env.active ? options.accentColor : options.lineColor
    ctx.strokeStyle = env.active ? options.accentColor : options.lineColor
    ctx.globalAlpha = options.guideOpacity * hubReveal
    ctx.beginPath()
    ctx.arc(hubX, hubY, 3.2, 0, TAU)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(hubX, hubY, 7.5, 0, TAU)
    ctx.globalAlpha *= 0.48
    ctx.stroke()
    ctx.restore()
}

function drawZoomInsets(env: RenderEnvironment) {
    const { ctx, points, boxes, options } = env
    const frames = trackingFrames(env)
    const focusedIndex = focusedFrameIndex(env, boxes)
    drawFrameAxisGuides(env, boxes, 0.1)

    points.forEach((point, index) => {
        const box = boxes[index]
        if (!box) return
        const highlighted = index === focusedIndex
        const color = highlighted ? options.accentColor : options.lineColor

        if (options.showGuideLines) {
            const sourceFrame = frames[index]
            if (sourceFrame) {
                drawFullFrame(
                    ctx,
                    sourceFrame,
                    color,
                    options.guideOpacity * (highlighted ? 0.58 : 0.34),
                    Math.max(0.65, options.lineWidth * 0.75)
                )
            }
            drawSolidLine(
                ctx,
                point.px,
                point.py,
                box.x + box.width / 2,
                box.y + box.height / 2,
                color,
                options.guideOpacity * (highlighted ? 0.84 : 0.55),
                Math.max(0.7, options.lineWidth * 0.85)
            )
        }

        drawDistortedInset(env, point, box, 0.88, highlighted)
        drawFullFrame(ctx, box, color, highlighted ? 0.98 : 0.86, Math.max(0.75, options.lineWidth))
        drawCornerBox(ctx, box, 10, color, Math.max(1, options.lineWidth), highlighted ? 0.98 : 0.82)
        drawTicks(
            ctx,
            point.px,
            point.py,
            box.x + box.width / 2,
            box.y + box.height / 2,
            color,
            highlighted ? 0.74 : 0.42,
            22
        )
        drawScanSweep(ctx, box, env, index * 0.21)
        drawTag(
            ctx,
            `INSET ${String(index + 1).padStart(2, "0")}  ${(options.magnification + point.score * 0.42).toFixed(2)}×`,
            box.x,
            box.y,
            "#10110f",
            highlighted ? options.accentColor : alpha(options.lineColor, 0.96),
            options
        )
    })
}

function drawSurveyGrid(env: RenderEnvironment) {
    const { ctx, width, height, options, points } = env
    const focusedIndex = focusedPointIndex(env, points)
    const spacing = clamp(92 - options.density * 2.1, 30, 78)
    const offsetX = ((env.pointerX * options.parallax * 0.35) % spacing + spacing) % spacing
    const offsetY = ((env.pointerY * options.parallax * 0.35) % spacing + spacing) % spacing
    ctx.save()
    ctx.strokeStyle = options.lineColor
    ctx.lineWidth = 0.6
    ctx.globalAlpha = 0.19 * options.overlayOpacity
    ctx.setLineDash([1, 5])
    for (let x = offsetX; x < width; x += spacing) {
        ctx.beginPath()
        ctx.moveTo(Math.round(x) + 0.5, 0)
        ctx.lineTo(Math.round(x) + 0.5, height)
        ctx.stroke()
    }
    for (let y = offsetY; y < height; y += spacing) {
        ctx.beginPath()
        ctx.moveTo(0, Math.round(y) + 0.5)
        ctx.lineTo(width, Math.round(y) + 0.5)
        ctx.stroke()
    }
    ctx.setLineDash([])
    points.forEach((point, index) => {
        const radius = 10 + (index % 3) * 4
        ctx.globalAlpha = index === focusedIndex ? 0.86 : 0.44
        ctx.strokeStyle = index === focusedIndex ? options.accentColor : options.lineColor
        ctx.beginPath()
        ctx.arc(point.px, point.py, radius, 0, TAU)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(point.px - radius - 8, point.py)
        ctx.lineTo(point.px + radius + 8, point.py)
        ctx.moveTo(point.px, point.py - radius - 8)
        ctx.lineTo(point.px, point.py + radius + 8)
        ctx.stroke()
        drawTag(
            ctx,
            `${String.fromCharCode(65 + index)}${String(index + 1).padStart(2, "0")}`,
            point.px + radius + 7,
            point.py - radius + 2,
            "#111111",
            index === focusedIndex ? options.accentColor : alpha(options.lineColor, 0.92),
            options
        )
    })
    ctx.restore()
}

function drawDetectionSwarm(env: RenderEnvironment) {
    const { ctx, width, height, options, points, now } = env
    const random = randomFactory(hashSeed(`${Math.floor(width)}:${Math.floor(height)}:swarm`))
    const count = env.compact ? 34 : clamp(Math.round(options.density * 4.2), 48, 110)
    const anchors = points.length ? points : fallbackPoints(width, height, 5, "swarm")
    ctx.save()
    ctx.lineWidth = 0.65
    for (let index = 0; index < count; index += 1) {
        const anchor = anchors[index % anchors.length]
        const angle = random() * TAU + now * 0.00008 * options.speed * (index % 2 ? 1 : -1)
        const radius = 12 + random() * (env.compact ? 78 : 125)
        const x = clamp(anchor.px + Math.cos(angle) * radius + env.pointerX * options.parallax * 0.4, 4, width - 4)
        const y = clamp(anchor.py + Math.sin(angle) * radius + env.pointerY * options.parallax * 0.4, 4, height - 4)
        const highlighted = index % 19 === 0
        ctx.strokeStyle = highlighted ? options.accentColor : options.lineColor
        ctx.globalAlpha = highlighted ? 0.78 : 0.18 + random() * 0.26
        const size = highlighted ? 6 : 2 + random() * 3
        ctx.strokeRect(Math.round(x - size / 2) + 0.5, Math.round(y - size / 2) + 0.5, size, size)
        if (index < anchors.length * 3) {
            ctx.globalAlpha *= 0.35
            ctx.setLineDash([1, 5])
            ctx.beginPath()
            ctx.moveTo(anchor.px, anchor.py)
            ctx.lineTo(x, y)
            ctx.stroke()
            ctx.setLineDash([])
        }
    }
    ctx.restore()
}

function drawAnnotationPlate(env: RenderEnvironment) {
    const { ctx, points, boxes, options } = env
    const focusedIndex = focusedFrameIndex(env, boxes)
    points.forEach((point, index) => {
        const box = boxes[index]
        if (!box) return
        const focused = index === focusedIndex
        drawDistortedInset(env, point, box, focused ? 0.42 : 0.14, focused)
        drawCornerBox(ctx, box, 9, focused ? options.accentColor : options.lineColor, options.lineWidth, 0.88)
        drawTicks(ctx, point.px, point.py, box.x + box.width / 2, box.y + box.height / 2, options.lineColor, 0.42)
        const plateWidth = clamp(box.width * 0.92, 74, 160)
        const plateHeight = 31
        const plateX = clamp(box.x, 8, env.width - plateWidth - 8)
        const plateY = clamp(box.y + box.height + 5, 8, env.height - plateHeight - 8)
        ctx.save()
        ctx.fillStyle = "rgba(5,7,5,.74)"
        ctx.strokeStyle = focused ? alpha(options.accentColor, 0.62) : alpha(options.lineColor, 0.26)
        ctx.lineWidth = 0.7
        ctx.fillRect(plateX, plateY, plateWidth, plateHeight)
        ctx.strokeRect(plateX + 0.5, plateY + 0.5, plateWidth - 1, plateHeight - 1)
        ctx.font = specimenFont(options, 7)
        ctx.fillStyle = focused ? options.accentColor : options.lineColor
        ctx.fillText(`REGION ${String(index + 1).padStart(2, "0")}`, plateX + 6, plateY + 11)
        ctx.globalAlpha = 0.58
        ctx.fillStyle = options.lineColor
        ctx.fillText(`CONF ${(point.score * 100).toFixed(1)}  X ${point.x.toFixed(3)}  Y ${point.y.toFixed(3)}`, plateX + 6, plateY + 23)
        ctx.restore()
    })
}

function drawPointMesh(env: RenderEnvironment) {
    const { ctx, width, height, options, scene, now } = env
    const random = randomFactory(hashSeed("point-mesh"))
    const liveNodes = scene.nodes.filter(node => !node.ghost)
    const extras = Array.from({ length: env.compact ? 12 : 22 }, (_, index) => {
        const anchor = liveNodes[index % Math.max(1, liveNodes.length)] || { px: width / 2, py: height / 2 }
        const angle = random() * TAU + Math.sin(now * 0.00012 + index) * 0.15
        const radius = 35 + random() * Math.min(width, height) * 0.24
        return {
            x: clamp(anchor.px + Math.cos(angle) * radius, 8, width - 8),
            y: clamp(anchor.py + Math.sin(angle) * radius, 8, height - 8),
        }
    })

    ctx.save()
    scene.edges.forEach(edge => {
        const source = scene.nodes[edge.source]
        const target = scene.nodes[edge.target]
        if (!source || !target) return
        ctx.strokeStyle = edge.kind === "memory" ? options.lineColor : options.accentColor
        ctx.globalAlpha = edge.kind === "memory"
            ? Math.min(source.opacity, target.opacity) * 0.35
            : 0.08 + edge.strength * 0.28
        ctx.lineWidth = edge.kind === "mst" ? 0.9 : 0.55 + edge.strength * 0.45
        ctx.beginPath()
        ctx.moveTo(source.px, source.py)
        ctx.lineTo(target.px, target.py)
        ctx.stroke()
    })

    extras.forEach((node, index) => {
        const nearest = liveNodes
            .map(candidate => ({ candidate, distance: Math.hypot(candidate.px - node.x, candidate.py - node.y) }))
            .sort((a, b) => a.distance - b.distance)[0]
        if (nearest) {
            ctx.strokeStyle = options.lineColor
            ctx.globalAlpha = clamp(0.13 - nearest.distance / Math.max(width, height) * 0.08, 0.025, 0.11)
            ctx.lineWidth = 0.5
            ctx.beginPath()
            ctx.moveTo(node.x, node.y)
            ctx.lineTo(nearest.candidate.px, nearest.candidate.py)
            ctx.stroke()
        }
        ctx.strokeStyle = options.lineColor
        ctx.globalAlpha = 0.18 + (index % 3) * 0.025
        ctx.strokeRect(node.x - 1.2, node.y - 1.2, 2.4, 2.4)
    })

    scene.nodes.forEach(node => {
        ctx.strokeStyle = node.role === "primary" ? options.accentColor : options.lineColor
        ctx.globalAlpha = node.opacity
        ctx.lineWidth = node.lineWidth
        const size = node.radius
        ctx.strokeRect(node.px - size / 2, node.py - size / 2, size, size)
        if (node.ghost) {
            ctx.setLineDash([2, 4])
            ctx.beginPath()
            ctx.arc(node.px, node.py, size * 1.35, 0, TAU)
            ctx.stroke()
            ctx.setLineDash([])
        }
    })

    if (scene.primaryIndex >= 0) {
        ctx.fillStyle = options.accentColor
        ctx.globalAlpha = 0.7
        ctx.beginPath()
        ctx.arc(scene.centroid.x, scene.centroid.y, 2.2, 0, TAU)
        ctx.fill()
    }
    ctx.restore()
}

function drawViewfinder(env: RenderEnvironment) {
    const { ctx, width, height, options, points } = env
    const center = points[0] || { px: width / 2, py: height / 2, score: 1 }
    const x = lerp(width / 2, center.px, 0.38) + env.pointerX * options.parallax * 0.35
    const y = lerp(height / 2, center.py, 0.38) + env.pointerY * options.parallax * 0.35
    const frameWidth = width * (env.compact ? 0.58 : 0.44)
    const frameHeight = height * (env.compact ? 0.28 : 0.46)
    const box: ScanBox = {
        x: clamp(x - frameWidth / 2, 14, width - frameWidth - 14),
        y: clamp(y - frameHeight / 2, 36, height - frameHeight - 36),
        width: frameWidth,
        height: frameHeight,
        anchorX: x,
        anchorY: y,
    }
    drawCornerBox(ctx, box, 24, options.lineColor, options.lineWidth, 0.86)
    ctx.save()
    ctx.strokeStyle = options.lineColor
    ctx.globalAlpha = 0.38
    ctx.lineWidth = 0.7
    ctx.setLineDash([2, 6])
    ctx.beginPath()
    ctx.moveTo(box.x, y)
    ctx.lineTo(box.x + box.width, y)
    ctx.moveTo(x, box.y)
    ctx.lineTo(x, box.y + box.height)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.strokeStyle = options.accentColor
    ctx.globalAlpha = 0.9
    ctx.beginPath()
    ctx.arc(x, y, 22, 0, TAU)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(x, y, 4, 0, TAU)
    ctx.stroke()
    ctx.restore()
    drawTag(ctx, `FOCUS ${(center.score * 100).toFixed(1)}%`, box.x, box.y, "#10130d", options.accentColor, options)
}

function drawContourScan(env: RenderEnvironment) {
    const { ctx, width, height, options, points, now } = env
    const random = randomFactory(hashSeed("contour-scan"))
    const bands = env.compact ? 13 : 22
    ctx.save()
    ctx.strokeStyle = options.lineColor
    ctx.lineWidth = 0.7
    for (let band = 0; band < bands; band += 1) {
        const center = points[band % Math.max(1, points.length)] || { px: width / 2, py: height / 2 }
        const baseRadius = 14 + band * Math.min(width, height) / (bands * 2.1)
        const segments = 42
        ctx.globalAlpha = band % 5 === 0 ? 0.36 : 0.13
        ctx.beginPath()
        for (let segment = 0; segment <= segments; segment += 1) {
            const angle = segment / segments * TAU
            const noise = Math.sin(angle * (3 + band % 4) + now * 0.00045 * options.speed + band) * (4 + band * 0.2)
            const jitter = (random() - 0.5) * 1.3
            const radiusX = baseRadius * (1.1 + (band % 3) * 0.11) + noise + jitter
            const radiusY = baseRadius * (0.62 + (band % 4) * 0.06) + noise * 0.55
            const x = center.px + Math.cos(angle) * radiusX
            const y = center.py + Math.sin(angle) * radiusY
            if (segment === 0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
        }
        ctx.stroke()
    }
    const scanX = ((now * 0.04 * options.speed) % (width + 120)) - 60
    const gradient = ctx.createLinearGradient(scanX - 24, 0, scanX + 24, 0)
    gradient.addColorStop(0, alpha(options.accentColor, 0))
    gradient.addColorStop(0.5, alpha(options.accentColor, 0.12))
    gradient.addColorStop(1, alpha(options.accentColor, 0))
    ctx.fillStyle = gradient
    ctx.fillRect(scanX - 24, 0, 48, height)
    ctx.strokeStyle = options.accentColor
    ctx.globalAlpha = 0.62
    ctx.beginPath()
    ctx.moveTo(scanX, 0)
    ctx.lineTo(scanX, height)
    ctx.stroke()
    ctx.restore()
}

function drawFacadeAnalysis(env: RenderEnvironment) {
    const { ctx, width, height, options, points, boxes, now } = env
    const columns = env.compact ? 4 : 6
    const rows = env.compact ? 4 : 5
    const marginX = width * 0.035
    const marginY = height * 0.065
    const cellWidth = (width - marginX * 2) / columns
    const cellHeight = (height - marginY * 2) / rows
    const scanY = marginY + ((now * 0.028 * options.speed) % Math.max(1, height - marginY * 2))

    ctx.save()
    ctx.strokeStyle = options.lineColor
    ctx.lineWidth = 0.65
    ctx.globalAlpha = 0.16 * options.overlayOpacity
    ctx.setLineDash([1, 6])
    for (let column = 0; column <= columns; column += 1) {
        const x = marginX + column * cellWidth + env.pointerX * options.parallax * 0.08
        ctx.beginPath()
        ctx.moveTo(Math.round(x) + 0.5, marginY)
        ctx.lineTo(Math.round(x) + 0.5, height - marginY)
        ctx.stroke()
    }
    for (let row = 0; row <= rows; row += 1) {
        const y = marginY + row * cellHeight + env.pointerY * options.parallax * 0.08
        ctx.beginPath()
        ctx.moveTo(marginX, Math.round(y) + 0.5)
        ctx.lineTo(width - marginX, Math.round(y) + 0.5)
        ctx.stroke()
    }
    ctx.setLineDash([])

    // Sparse architectural cell indexing.
    ctx.font = specimenFont(options, 6)
    ctx.textBaseline = "top"
    for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
            if ((row + column) % 2 !== 0) continue
            const x = marginX + column * cellWidth
            const y = marginY + row * cellHeight
            ctx.globalAlpha = 0.22
            ctx.fillStyle = options.lineColor
            ctx.fillText(`${String.fromCharCode(65 + column)}${String(row + 1).padStart(2, "0")}`, x + 5, y + 5)
        }
    }

    const scanGradient = ctx.createLinearGradient(0, scanY - 16, 0, scanY + 16)
    scanGradient.addColorStop(0, alpha(options.accentColor, 0))
    scanGradient.addColorStop(0.5, alpha(options.accentColor, 0.12))
    scanGradient.addColorStop(1, alpha(options.accentColor, 0))
    ctx.globalAlpha = 1
    ctx.fillStyle = scanGradient
    ctx.fillRect(0, scanY - 16, width, 32)
    ctx.strokeStyle = options.accentColor
    ctx.globalAlpha = 0.72
    ctx.beginPath()
    ctx.moveTo(0, Math.round(scanY) + 0.5)
    ctx.lineTo(width, Math.round(scanY) + 0.5)
    ctx.stroke()
    ctx.restore()

    points.forEach((point, index) => {
        const box = boxes[index]
        if (!box) return
        const primary = index === 0 || index === 3
        drawDistortedInset(env, point, box, primary ? 0.82 : 0.48, primary)
        drawCornerBox(
            ctx,
            box,
            primary ? 14 : 10,
            primary ? options.accentColor : options.lineColor,
            options.lineWidth,
            primary ? 0.98 : 0.76
        )
        drawTicks(
            ctx,
            point.px,
            point.py,
            box.x + box.width / 2,
            box.y + box.height / 2,
            primary ? options.accentColor : options.lineColor,
            primary ? 0.7 : 0.38,
            26
        )
        drawScanSweep(ctx, box, env, index * 0.14)
        const column = clamp(Math.floor((point.px - marginX) / Math.max(1, cellWidth)), 0, columns - 1)
        const row = clamp(Math.floor((point.py - marginY) / Math.max(1, cellHeight)), 0, rows - 1)
        drawTag(
            ctx,
            `ARC ${String.fromCharCode(65 + column)}${String(row + 1).padStart(2, "0")}  ${(point.score * 100).toFixed(1)}%`,
            box.x,
            box.y,
            "#0b0d09",
            primary ? options.accentColor : alpha(options.lineColor, 0.96),
            options
        )
    })

    // Baseline ruler emphasizes the façade rhythm without obscuring the media.
    const rulerY = height - Math.max(24, marginY * 0.55)
    ctx.save()
    ctx.strokeStyle = options.lineColor
    ctx.fillStyle = options.lineColor
    ctx.globalAlpha = 0.35
    ctx.lineWidth = 0.65
    ctx.beginPath()
    ctx.moveTo(marginX, rulerY)
    ctx.lineTo(width - marginX, rulerY)
    ctx.stroke()
    for (let index = 0; index <= columns * 4; index += 1) {
        const x = marginX + (width - marginX * 2) * (index / (columns * 4))
        const major = index % 4 === 0
        ctx.beginPath()
        ctx.moveTo(x, rulerY - (major ? 7 : 3))
        ctx.lineTo(x, rulerY + (major ? 7 : 3))
        ctx.stroke()
    }
    ctx.font = specimenFont(options, 6)
    ctx.fillText("STRUCTURAL RHYTHM / NORMALIZED ELEVATION", marginX, rulerY + 10)
    ctx.restore()
}


function drawBotanicalAnalysis(env: RenderEnvironment) {
    const { ctx, width, height, options, points, boxes, now } = env
    const frames = trackingFrames(env)
    const ribs = env.compact ? 6 : clamp(Math.round(options.density * 0.62), 8, 14)
    const margin = Math.min(width, height) * 0.045

    ctx.save()
    ctx.strokeStyle = options.lineColor
    ctx.lineWidth = Math.max(0.5, options.lineWidth * 0.62)
    ctx.globalAlpha = 0.17 * options.overlayOpacity
    for (let index = 0; index < ribs; index += 1) {
        const progress = index / Math.max(1, ribs - 1)
        const startX = margin + (width - margin * 2) * progress
        const endX = width * (0.18 + 0.64 * (1 - progress))
        const bend = Math.sin(progress * Math.PI) * width * 0.16
        ctx.beginPath()
        ctx.moveTo(startX, height + margin)
        ctx.bezierCurveTo(
            startX - bend + env.pointerX * options.parallax * 0.2,
            height * 0.68,
            endX + bend + env.pointerY * options.parallax * 0.2,
            height * 0.28,
            endX,
            -margin
        )
        ctx.stroke()
    }
    ctx.restore()

    drawFrameAxisGuides(env, frames, 0.11)
    const focusedIndex = focusedFrameIndex(env, frames)
    drawTrackingWeb(
        env,
        frames,
        index =>
            index === focusedIndex || index === 0 || index === 2
                ? options.accentColor
                : options.lineColor,
        focusedIndex
    )

    points.forEach((point, index) => {
        const frame = frames[index]
        const box = boxes[index]
        if (!frame || !box) return
        const primary = index === focusedIndex || index === 2
        const color = primary ? options.accentColor : options.lineColor

        drawFullFrame(
            ctx,
            frame,
            color,
            options.guideOpacity * (primary ? 0.84 : 0.56),
            Math.max(0.72, options.lineWidth * 0.9)
        )

        // The Grid Pulse inspection window is attached to the same detected point
        // as the Specimen tracking frame, so the two systems stay spatially coherent.
        drawSolidLine(
            ctx,
            point.px,
            point.py,
            box.x + box.width / 2,
            box.y + box.height / 2,
            color,
            options.guideOpacity * (primary ? 0.8 : 0.46),
            Math.max(0.65, options.lineWidth * 0.8)
        )
        drawDistortedInset(env, point, box, primary ? 0.84 : 0.52, primary)
        drawFullFrame(ctx, box, color, primary ? 0.98 : 0.8, Math.max(0.75, options.lineWidth))
        drawCornerBox(ctx, box, primary ? 14 : 10, color, Math.max(1, options.lineWidth), primary ? 1 : 0.82)
        drawTicks(
            ctx,
            point.px,
            point.py,
            box.x + box.width / 2,
            box.y + box.height / 2,
            color,
            primary ? 0.7 : 0.38,
            24
        )
        drawScanSweep(ctx, box, env, index * 0.14)
        drawTag(
            ctx,
            `BIO ${point.id.replace("SCAN-", "")}  ${(point.score * 100).toFixed(1)}%`,
            box.x,
            box.y,
            "#0b0d09",
            primary ? options.accentColor : alpha(options.lineColor, 0.96),
            options
        )
    })

    if (!env.reducedMotion) {
        const span = width + height
        const offset = ((now * 0.00005 * options.speed) % 1) * span - height
        ctx.save()
        ctx.translate(0, height)
        ctx.rotate(-Math.PI / 4)
        const gradient = ctx.createLinearGradient(offset - 28, 0, offset + 28, 0)
        gradient.addColorStop(0, alpha(options.accentColor, 0))
        gradient.addColorStop(0.5, alpha(options.accentColor, 0.13))
        gradient.addColorStop(1, alpha(options.accentColor, 0))
        ctx.fillStyle = gradient
        ctx.fillRect(offset - 28, -span, 56, span * 2)
        ctx.strokeStyle = options.accentColor
        ctx.globalAlpha = 0.72
        ctx.beginPath()
        ctx.moveTo(offset, -span)
        ctx.lineTo(offset, span)
        ctx.stroke()
        ctx.restore()
    }
}

function drawPreset(env: RenderEnvironment) {
    switch (env.options.preset) {
        case "Feature Tracking":
            drawFeatureTracking(env)
            break
        case "Zoom Insets":
            drawZoomInsets(env)
            break
        case "Survey Grid":
            drawSurveyGrid(env)
            break
        case "Detection Swarm":
            drawDetectionSwarm(env)
            break
        case "Annotation Plate":
            drawAnnotationPlate(env)
            break
        case "Point Mesh":
            drawPointMesh(env)
            break
        case "Viewfinder":
            drawViewfinder(env)
            break
        case "Contour Scan":
            drawContourScan(env)
            break
        case "Facade Analysis":
            drawFacadeAnalysis(env)
            break
        case "Botanical Analysis":
            drawBotanicalAnalysis(env)
            break
    }
}

type PresetOverrides = {
    detection: Partial<GridPulseDetectionOptions>
    grid: Partial<GridPulseGridOptions>
    connections: Partial<GridPulseConnectionOptions>
    crosshair: Partial<GridPulseCrosshairOptions>
    boxes: Partial<GridPulseBoxOptions>
    labels: Partial<GridPulseLabelOptions>
    effect: Partial<GridPulseEffectOptions>
    motion: Partial<GridPulseMotionOptions>
    interaction: Partial<GridPulseInteractionOptions>
    theme: Partial<GridPulseThemeOptions>
}

function presetOverrides(
    preset: SpecimenGridPreset,
    specimen: SpecimenGridOptions
): PresetOverrides {
    const base: PresetOverrides = {
        detection: {},
        grid: {},
        connections: {},
        crosshair: {},
        boxes: {},
        labels: {},
        effect: {},
        motion: {},
        interaction: {},
        theme: {},
    }

    switch (preset) {
        case "Feature Tracking":
            return {
                ...base,
                detection: { pointCount: 6, mobilePointLimit: 3 },
                grid: { visible: true, spacing: 150, opacity: 0.09 },
                connections: { visible: false },
                boxes: { width: 116, height: 116, zoom: 2.35, radius: 0, visible: false },
                labels: { visible: false },
                interaction: { autoRescanInterval: 1450 },
            }
        case "Zoom Insets":
            return {
                ...base,
                detection: { pointCount: 5, mobilePointLimit: 3 },
                grid: { visible: false },
                connections: { visible: false },
                boxes: {
                    width: 154,
                    visible: false,
                    height: 96,
                    zoom: specimen.magnification,
                    radius: 0,
                    scanSweep: false,
                },
                labels: { visible: false },
            }
        case "Survey Grid":
            return {
                ...base,
                detection: { pointCount: 5, mobilePointLimit: 3 },
                grid: { visible: true, spacing: 74, opacity: 0.16, subdivisions: 2 },
                connections: { visible: false },
                crosshair: { visible: true, showCoordinates: true },
                boxes: { width: 74, height: 74, zoom: 1.7, scanSweep: false },
                labels: { visible: false },
            }
        case "Detection Swarm":
            return {
                ...base,
                detection: { pointCount: 8, mobilePointLimit: 5 },
                grid: { visible: true, spacing: 116, opacity: 0.07 },
                connections: { visible: true, pointSize: 5, pulse: true, opacity: 0.36 },
                crosshair: { visible: false },
                boxes: { width: 58, height: 58, zoom: 1.55, scanSweep: false },
                labels: { visible: false },
                interaction: { autoRescanInterval: 720 },
            }
        case "Annotation Plate":
            return {
                ...base,
                detection: { pointCount: 5, mobilePointLimit: 3 },
                grid: { visible: true, spacing: 154, opacity: 0.07 },
                connections: { visible: true, tickMarks: true, pulse: false },
                boxes: { width: 138, height: 88, zoom: 2.05, scanSweep: false },
                labels: { visible: false },
            }
        case "Point Mesh":
            return {
                ...base,
                detection: { pointCount: 7, mobilePointLimit: 5 },
                grid: { visible: false },
                connections: { visible: true, pointShape: "square", pulse: false, opacity: 0.3 },
                crosshair: { visible: false },
                boxes: { width: 48, height: 48, zoom: 1.45, scanSweep: false },
                labels: { visible: false },
                interaction: { autoRescanInterval: 1100 },
            }
        case "Viewfinder":
            return {
                ...base,
                detection: { pointCount: 3, mobilePointLimit: 2 },
                grid: { visible: true, spacing: 128, opacity: 0.06 },
                connections: { visible: false },
                crosshair: { visible: true, showCoordinates: true, radius: 18 },
                boxes: { width: 72, height: 72, zoom: 1.8, scanSweep: false },
                labels: { visible: false },
            }
        case "Contour Scan":
            return {
                ...base,
                detection: { pointCount: 4, mobilePointLimit: 3 },
                grid: { visible: true, spacing: 140, opacity: 0.05 },
                connections: { visible: false },
                crosshair: { visible: false },
                boxes: { width: 82, height: 82, zoom: 1.7, scanSweep: false },
                labels: { visible: false },
                effect: { type: "xray", scope: "boxes", intensity: 0.72 },
            }
        case "Facade Analysis":
            return {
                ...base,
                detection: { pointCount: 6, mobilePointLimit: 3, minDistance: 0.12 },
                grid: { visible: true, spacing: 128, opacity: 0.055, subdivisions: 1 },
                connections: { visible: false },
                crosshair: { visible: true, showCoordinates: true, radius: 17 },
                boxes: { width: 132, height: 86, zoom: 2.15, scanSweep: true, gap: 58, visible: false },
                labels: { visible: false },
                effect: { type: "none", scope: "boxes", intensity: 1 },
                motion: { scanDuration: 1700, pulseDuration: 2100 },
            }
        case "Botanical Analysis":
            return {
                ...base,
                detection: { pointCount: 6, mobilePointLimit: 3, minDistance: 0.1 },
                grid: { visible: true, spacing: 142, opacity: 0.045, subdivisions: 1 },
                connections: { visible: false },
                crosshair: { visible: true, showCoordinates: true, radius: 18 },
                boxes: { width: 136, height: 92, zoom: 2.25, scanSweep: true, gap: 62, visible: false },
                labels: { visible: false },
                effect: { type: "none", scope: "boxes", intensity: 1 },
                motion: { scanDuration: 1750, pulseDuration: 2200 },
            }
    }
}

function useStableCompositeOptions<T extends object>(value: T): T {
    const signature = JSON.stringify(value)
    const ref = useRef<{ signature: string; value: T }>({ signature, value })
    if (ref.current.signature !== signature) {
        ref.current = { signature, value }
    }
    return ref.current.value
}

export const SPECIMEN_GRID_PULSE_DEFAULTS = DEFAULT_SPECIMEN

export default function SpecimenGridPulse({
    src,
    alt = "Interactive specimen scan",
    aspectRatio = "free",
    media: mediaOverrides,
    detection: detectionOverrides,
    grid: gridOverrides,
    connections: connectionOverrides,
    crosshair: crosshairOverrides,
    boxes: boxOverrides,
    labels: labelOverrides,
    effect: effectOverrides,
    interaction: interactionOverrides,
    motion: motionOverrides,
    rendering: renderingOverrides,
    theme: themeOverrides,
    specimen: specimenOverrides,
    preset: presetOverride,
    className,
    style,
    ariaLabel,
    onReady,
    onScan,
    onActiveChange,
    onError,
    onPresetChange,
    plugins = [],
    visionTheme,
    inspectionEffects = [],
    onPerformanceMetrics,
    onCaptureController,
    timelineCapacity = 120,
    onGpuCapability,
    quality = "auto",
    onQualityChange,
}: SpecimenGridPulseProps) {
    const [localPreset, setLocalPreset] = useState<SpecimenGridPreset>(
        presetOverride ?? specimenOverrides?.preset ?? DEFAULT_SPECIMEN.preset
    )
    const [detectedPoints, setDetectedPoints] = useState<GridPulsePoint[]>([])
    const [active, setActive] = useState(true)
    const rootRef = useRef<HTMLDivElement | null>(null)
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const sceneStoreRef = useRef(new VisionSceneGraphStore())
    const renderingPipelineRef = useRef(new RenderingPipeline())
    const gpuPostProcessorRef = useRef(new GpuPostProcessor())
    const gpuCapabilityReportedRef = useRef<string | null>(null)
    const performanceMonitorRef = useRef(new VisionPerformanceMonitor())
    const timelineRef = useRef(new VisionTimeline(timelineCapacity))
    const captureControllerRef = useRef<VisionCaptureController | null>(null)
    const presetButtonRefs = useRef<Array<HTMLButtonElement | null>>([])
    const [renderBridge, setRenderBridge] = useState<GridPulseRenderBridge | null>(null)
    const qualityEnvironmentRef = useRef<QualityEnvironment>({
        devicePixelRatio: 1,
        deviceMemory: 4,
        hardwareConcurrency: 4,
        reducedMotion: false,
        compact: false,
        webgl2Available: false,
    })
    const slowQualitySamplesRef = useRef(0)
    const [qualityProfile, setQualityProfile] = useState<QualityProfile>(() =>
        resolveVisionQuality(quality, qualityEnvironmentRef.current)
    )

    useEffect(() => {
        const root = rootRef.current
        if (!root || typeof window === "undefined") return

        const mediaQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)")
        const resolveEnvironment = () => {
            let webgl2Available = false
            try {
                const canvas = document.createElement("canvas")
                webgl2Available = Boolean(canvas.getContext("webgl2"))
            } catch {
                webgl2Available = false
            }
            const navigatorWithMemory = navigator as Navigator & { deviceMemory?: number }
            const environment: QualityEnvironment = {
                devicePixelRatio: window.devicePixelRatio || 1,
                deviceMemory: navigatorWithMemory.deviceMemory,
                hardwareConcurrency: navigator.hardwareConcurrency,
                reducedMotion: Boolean(mediaQuery?.matches),
                compact: root.clientWidth < 720,
                webgl2Available,
            }
            qualityEnvironmentRef.current = environment
            slowQualitySamplesRef.current = 0
            setQualityProfile(resolveVisionQuality(quality, environment))
        }

        resolveEnvironment()
        const observer = typeof ResizeObserver !== "undefined"
            ? new ResizeObserver(resolveEnvironment)
            : null
        observer?.observe(root)
        mediaQuery?.addEventListener?.("change", resolveEnvironment)
        window.addEventListener("orientationchange", resolveEnvironment)
        return () => {
            observer?.disconnect()
            mediaQuery?.removeEventListener?.("change", resolveEnvironment)
            window.removeEventListener("orientationchange", resolveEnvironment)
        }
    }, [quality])

    useEffect(() => {
        onQualityChange?.(qualityProfile)
    }, [onQualityChange, qualityProfile])

    const resolvedTheme = useMemo(() => ({
        ...SCIENTIFIC_VISION_THEME,
        ...visionTheme,
        colors: { ...SCIENTIFIC_VISION_THEME.colors, ...visionTheme?.colors },
        typography: { ...SCIENTIFIC_VISION_THEME.typography, ...visionTheme?.typography },
        motion: { ...SCIENTIFIC_VISION_THEME.motion, ...visionTheme?.motion },
        optics: { ...SCIENTIFIC_VISION_THEME.optics, ...visionTheme?.optics },
        atmosphere: { ...SCIENTIFIC_VISION_THEME.atmosphere, ...visionTheme?.atmosphere },
    }), [visionTheme])

    const resolvedInspectionEffects = useMemo(
        () => new InspectionEffectStack(inspectionEffects),
        [inspectionEffects]
    )

    const specimen = useStableCompositeOptions<SpecimenGridOptions>({
        ...DEFAULT_SPECIMEN,
        lineColor: resolvedTheme.colors.line,
        accentColor: resolvedTheme.colors.accent,
        fontFamily: resolvedTheme.typography.fontFamily,
        labelScale: resolvedTheme.typography.labelScale,
        speed: resolvedTheme.motion.speed,
        idleMotion: resolvedTheme.motion.idleMotion,
        springStiffness: resolvedTheme.motion.springStiffness,
        springDamping: resolvedTheme.motion.springDamping,
        springMass: resolvedTheme.motion.springMass,
        lensBarrelDistortion: resolvedTheme.optics.barrelDistortion,
        lensChromaticAberration: resolvedTheme.optics.chromaticAberration,
        lensFresnel: resolvedTheme.optics.fresnel,
        lensRefraction: resolvedTheme.optics.refraction,
        grain: resolvedTheme.atmosphere.grain,
        vignette: resolvedTheme.atmosphere.vignette,
        scanlines: resolvedTheme.atmosphere.scanlines,
        ...specimenOverrides,
        maxOverlayFps: Math.min(
            specimenOverrides?.maxOverlayFps ?? DEFAULT_SPECIMEN.maxOverlayFps,
            qualityProfile.overlayFps
        ),
        particleDensity: (specimenOverrides?.particleDensity ?? resolvedTheme.atmosphere.particles) * qualityProfile.particleMultiplier,
        temporalPersistence: (specimenOverrides?.temporalPersistence ?? resolvedTheme.atmosphere.persistence) * qualityProfile.persistenceMultiplier,
        proceduralNoise: (specimenOverrides?.proceduralNoise ?? resolvedTheme.atmosphere.proceduralNoise) * qualityProfile.noiseMultiplier,
        lensBloom: (specimenOverrides?.lensBloom ?? resolvedTheme.optics.bloom) * qualityProfile.bloomMultiplier,
        gpuPostProcessing: (specimenOverrides?.gpuPostProcessing ?? DEFAULT_SPECIMEN.gpuPostProcessing) && qualityProfile.gpuEnabled,
        preset: presetOverride ?? localPreset,
    })

    useEffect(() => {
        if (presetOverride !== undefined) setLocalPreset(presetOverride)
    }, [presetOverride])

    const media = useStableCompositeOptions<GridPulseMediaOptions>({
        ...DEFAULT_MEDIA,
        ...mediaOverrides,
    })
    const configuredBoxes = useStableCompositeOptions<GridPulseBoxOptions>({
        ...DEFAULT_BOXES,
        ...boxOverrides,
    })
    const defaults = useMemo(() => presetOverrides(specimen.preset, specimen), [specimen])

    const effectiveDetection = useStableCompositeOptions({
        ...defaults.detection,
        focusX: specimen.focusX,
        focusY: specimen.focusY,
        focusRadius: specimen.focusRadius,
        focusStrength: 0.48,
        ...detectionOverrides,
    })
    const effectiveGrid = useStableCompositeOptions({ ...defaults.grid, ...gridOverrides })
    const effectiveConnections = useStableCompositeOptions({
        ...defaults.connections,
        ...connectionOverrides,
    })
    const effectiveCrosshair = useStableCompositeOptions({
        ...defaults.crosshair,
        ...crosshairOverrides,
    })
    const effectiveBoxes = useStableCompositeOptions<GridPulseBoxOptions>({
        ...configuredBoxes,
        ...defaults.boxes,
        ...boxOverrides,
    })
    const effectiveLabels = useStableCompositeOptions({
        ...defaults.labels,
        ...labelOverrides,
    })
    const effectiveEffect = useStableCompositeOptions({
        ...defaults.effect,
        ...effectOverrides,
    })
    const effectiveMotion = useStableCompositeOptions({
        ...defaults.motion,
        ...motionOverrides,
    })
    const videoSource = isLikelyVideoSource(src, media)
    const effectiveInteraction = useStableCompositeOptions({
        ...(videoSource ? defaults.interaction : {}),
        ...interactionOverrides,
    })
    const effectiveTheme = useStableCompositeOptions({
        ...defaults.theme,
        background: resolvedTheme.colors.background,
        foreground: resolvedTheme.colors.line,
        accent: resolvedTheme.colors.accent,
        ...themeOverrides,
    })
    const effectiveRendering = useStableCompositeOptions<GridPulseRenderingOptions>({
        staticImageFps: Math.min(30, qualityProfile.overlayFps),
        inactiveFps: Math.min(6, qualityProfile.overlayFps),
        demandDriven: true,
        useVideoFrameCallback: true,
        pauseWhenOffscreen: true,
        ...renderingOverrides,
        maxFps: Math.min(renderingOverrides?.maxFps ?? qualityProfile.overlayFps, qualityProfile.overlayFps),
        dprCap: Math.min(renderingOverrides?.dprCap ?? qualityProfile.dprCap, qualityProfile.dprCap),
    })

    const showGridPulseOverlay = specimen.composition !== "specimen"
    const showSpecimenOverlay = specimen.enabled && specimen.composition !== "grid-pulse"

    const baseGrid = showGridPulseOverlay ? effectiveGrid : { ...effectiveGrid, visible: false }
    const baseConnections = showGridPulseOverlay
        ? effectiveConnections
        : { ...effectiveConnections, visible: false }
    const baseCrosshair = showGridPulseOverlay
        ? effectiveCrosshair
        : { ...effectiveCrosshair, visible: false }
    const baseLabels = showGridPulseOverlay ? effectiveLabels : { ...effectiveLabels, visible: false }
    const baseBoxes: Partial<GridPulseBoxOptions> = showGridPulseOverlay
        ? effectiveBoxes
        : {
              ...effectiveBoxes,
              visible: false,
              borderOpacity: 0,
              cornerBrackets: false,
              scanSweep: false,
          }

    const handleScan = useCallback(
        (points: GridPulsePoint[]) => {
            setDetectedPoints(points)
            timelineRef.current.push(performance.now(), points)
            onScan?.(points)
        },
        [onScan]
    )

    const handleActiveChange = useCallback(
        (nextActive: boolean) => {
            setActive(nextActive)
            onActiveChange?.(nextActive)
        },
        [onActiveChange]
    )

    const handleRenderBridge = useCallback((bridge: GridPulseRenderBridge | null) => {
        setRenderBridge(bridge)
    }, [])

    const selectPreset = useCallback(
        (nextPreset: SpecimenGridPreset) => {
            if (presetOverride === undefined) setLocalPreset(nextPreset)
            onPresetChange?.(nextPreset)
        },
        [onPresetChange, presetOverride]
    )

    const focusPreset = useCallback(
        (index: number) => {
            const normalized = (index + SPECIMEN_GRID_PRESETS.length) % SPECIMEN_GRID_PRESETS.length
            const nextPreset = SPECIMEN_GRID_PRESETS[normalized]
            selectPreset(nextPreset)
            requestAnimationFrame(() => {
                presetButtonRefs.current[normalized]?.focus()
                presetButtonRefs.current[normalized]?.scrollIntoView({
                    behavior: "smooth",
                    block: "nearest",
                    inline: "nearest",
                })
            })
        },
        [selectPreset]
    )

    const handlePresetKeyDown = useCallback(
        (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
            let nextIndex: number | null = null
            if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = index + 1
            else if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = index - 1
            else if (event.key === "Home") nextIndex = 0
            else if (event.key === "End") nextIndex = SPECIMEN_GRID_PRESETS.length - 1
            if (nextIndex === null) return
            event.preventDefault()
            focusPreset(nextIndex)
        },
        [focusPreset]
    )

    useEffect(() => {
        const selectedIndex = SPECIMEN_GRID_PRESETS.indexOf(specimen.preset)
        presetButtonRefs.current[selectedIndex]?.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
            inline: "nearest",
        })
    }, [specimen.preset])

    useEffect(() => {
        const cleanups = plugins.map(plugin => plugin.setup?.()).filter(Boolean) as Array<() => void>
        return () => cleanups.forEach(cleanup => cleanup())
    }, [plugins])

    useEffect(() => () => gpuPostProcessorRef.current.dispose(), [])

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas || !onCaptureController) return
        captureControllerRef.current = createCanvasCaptureController(canvas)
        onCaptureController(captureControllerRef.current)
        return () => {
            captureControllerRef.current = null
        }
    }, [onCaptureController, renderBridge])

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas || !renderBridge || !showSpecimenOverlay) return
        const ctx = canvas.getContext("2d")
        if (!ctx) return

        let lastDrawAt = 0
        let previousSnapshotAt = 0
        const motionState = { x: 0, y: 0, strength: 0 }

        const drawFrame = (snapshot: GridPulseFrameSnapshot) => {
            const frameStartedAt = performance.now()
            const mediaPreset =
                specimen.preset === "Feature Tracking" ||
                specimen.preset === "Zoom Insets" ||
                specimen.preset === "Annotation Plate" ||
                specimen.preset === "Facade Analysis" ||
                specimen.preset === "Botanical Analysis"
            const targetFps = mediaPreset
                ? Math.min(specimen.maxOverlayFps, specimen.mediaSampleRate)
                : specimen.maxOverlayFps
            const interval = 1000 / clamp(targetFps, 4, 60)
            if (snapshot.now - lastDrawAt < interval && lastDrawAt > 0) {
                renderBridge.requestFrame()
                return
            }

            const width = Math.max(1, snapshot.width)
            const height = Math.max(1, snapshot.height)
            const dpr = clamp(snapshot.dpr, 1, qualityProfile.dprCap)
            const backingWidth = Math.max(1, Math.round(width * dpr))
            const backingHeight = Math.max(1, Math.round(height * dpr))
            if (canvas.width !== backingWidth) canvas.width = backingWidth
            if (canvas.height !== backingHeight) canvas.height = backingHeight
            if (canvas.style.width !== `${width}px`) canvas.style.width = `${width}px`
            if (canvas.style.height !== `${height}px`) canvas.style.height = `${height}px`

            const dt = previousSnapshotAt ? snapshot.now - previousSnapshotAt : 16.67
            previousSnapshotAt = snapshot.now
            lastDrawAt = snapshot.now

            let targetX = snapshot.pointer.x * 2 - 1
            let targetY = snapshot.pointer.y * 2 - 1
            const allowPointer = specimen.interaction === "hybrid" || specimen.interaction === "pointer"
            const allowIdle = specimen.idleMotion &&
                (specimen.interaction === "hybrid" || specimen.interaction === "idle")
            if (!allowPointer) {
                targetX = 0
                targetY = 0
            }
            if (allowIdle && (!snapshot.pointer.inside || specimen.interaction === "idle") && !snapshot.reducedMotion) {
                targetX = Math.cos(snapshot.now * 0.00021 * specimen.speed) * 0.32
                targetY = Math.sin(snapshot.now * 0.00017 * specimen.speed) * 0.26
            }
            if (specimen.interaction === "none") {
                targetX = 0
                targetY = 0
            }
            const smoothing = clamp(dt / 110, 0.03, 0.28)
            motionState.x = lerp(motionState.x, targetX, smoothing)
            motionState.y = lerp(motionState.y, targetY, smoothing)
            motionState.strength = lerp(
                motionState.strength,
                snapshot.active ? (snapshot.pointer.inside ? 0.72 : 0.34) : 0.12,
                clamp(dt / 145, 0.03, 0.26)
            )

            ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
            ctx.clearRect(0, 0, width, height)
            const compact = specimen.responsive && width < 720
            const points: PixelPoint[] = snapshot.points.map((point, index) => ({
                x: point.x,
                y: point.y,
                px: point.px,
                py: point.py,
                score: point.score,
                id: point.id,
                phase: hashSeed(point.id || String(index)) / 4294967296 * TAU,
                reveal: point.reveal,
            }))
            const boxes: ScanBox[] = snapshot.boxes.map(box => ({ ...box }))
            const mediaForFrame = mediaPreset ? snapshot.calloutCanvas : null
            const scene = sceneStoreRef.current.build(
                snapshot.now,
                points,
                boxes,
                {
                    graphMode: specimen.graphMode,
                    nearestNeighbors: specimen.graphNeighbors,
                    temporalMemoryMs: specimen.temporalMemoryMs,
                    maxGhosts: specimen.maxGhostNodes,
                    focusX: specimen.focusX,
                    focusY: specimen.focusY,
                    focusRadius: specimen.focusRadius,
                }
            )

            const rendererProfile = rendererProfileForPreset(specimen)
            const environment: RenderEnvironment = {
                ctx,
                width,
                height,
                now: snapshot.now,
                dt,
                points,
                boxes,
                pointerX: motionState.x,
                pointerY: motionState.y,
                pointerStrength: motionState.strength,
                active: snapshot.active,
                compact,
                reducedMotion: snapshot.reducedMotion,
                options: specimen,
                media: mediaForFrame,
                mediaOptions: media,
                detectionMode: (effectiveDetection.mode || "auto") as GridPulseDetectionOptions["mode"],
                scene,
                pipeline: renderingPipelineRef.current,
                profile: rendererProfile,
            }
            const pluginContext: VisionPluginContext = {
                ctx,
                width,
                height,
                now: snapshot.now,
                dt,
                active: snapshot.active,
                compact,
                reducedMotion: snapshot.reducedMotion,
                pointer: { x: motionState.x, y: motionState.y, strength: motionState.strength },
                nodes: points,
                scene,
                media: mediaForFrame,
                requestFrame: renderBridge.requestFrame,
                effects: resolvedInspectionEffects,
            }
            plugins.filter(plugin => plugin.enabled !== false && plugin.phase === "before-overlay")
                .forEach(plugin => plugin.render(pluginContext))
            drawPreset(environment)
            plugins.filter(plugin => plugin.enabled !== false && (plugin.phase ?? "after-overlay") === "after-overlay")
                .forEach(plugin => plugin.render(pluginContext))
            renderingPipelineRef.current.drawParticles(ctx, {
                width,
                height,
                now: snapshot.now,
                intensity: rendererProfile.particleDensity,
                accent: specimen.accentColor,
            })
            if (!snapshot.reducedMotion) {
                renderingPipelineRef.current.temporal.composite(
                    ctx,
                    backingWidth,
                    backingHeight,
                    rendererProfile.temporalPersistence
                )
            }
            plugins.filter(plugin => plugin.enabled !== false && plugin.phase === "post-process")
                .forEach(plugin => plugin.render(pluginContext))

            const gpuCanvas = gpuPostProcessorRef.current.process(canvas, {
                enabled: specimen.gpuPostProcessing,
                preference: specimen.gpuBackend,
                time: snapshot.now,
                distortion: specimen.gpuDistortion * rendererProfile.lens.barrelDistortion,
                chromaticAberration: specimen.lensChromaticAberration,
                bloom: specimen.lensBloom,
                scanStrength: snapshot.reducedMotion ? 0 : specimen.gpuScanStrength,
                noiseStrength: snapshot.reducedMotion ? 0 : specimen.proceduralNoise * 0.035,
                vignette: specimen.vignette * 0.7,
            })
            if (gpuCanvas) {
                ctx.save()
                ctx.setTransform(1, 0, 0, 1, 0, 0)
                ctx.clearRect(0, 0, backingWidth, backingHeight)
                ctx.drawImage(gpuCanvas, 0, 0, backingWidth, backingHeight)
                ctx.restore()
            }
            if (onGpuCapability) {
                const capability = gpuPostProcessorRef.current.capability
                const key = `${capability.backend}:${capability.available}:${capability.reason || ""}`
                if (gpuCapabilityReportedRef.current !== key) {
                    gpuCapabilityReportedRef.current = key
                    onGpuCapability(capability)
                }
            }
            const frameDuration = performance.now() - frameStartedAt
            const metrics = performanceMonitorRef.current.record(frameDuration, interval)
            if (metrics.frameCount % 20 === 0) {
                onPerformanceMetrics?.(metrics)
                if (quality === "auto") {
                    const frameBudget = 1000 / Math.max(1, qualityProfile.overlayFps)
                    slowQualitySamplesRef.current = metrics.averageFrameMs > frameBudget * 1.35
                        ? slowQualitySamplesRef.current + 1
                        : 0
                    if (shouldDegradeQuality(
                        metrics.averageFrameMs,
                        slowQualitySamplesRef.current,
                        qualityProfile.overlayFps
                    )) {
                        slowQualitySamplesRef.current = 0
                        const nextTier = degradeQuality(qualityProfile.tier)
                        setQualityProfile(resolveVisionQuality(nextTier, qualityEnvironmentRef.current))
                    }
                }
            }
            if (!snapshot.reducedMotion && (snapshot.active || specimen.idleMotion)) {
                renderBridge.requestFrame()
            }
        }

        const unsubscribe = renderBridge.subscribe(drawFrame)
        renderBridge.requestRender()
        return unsubscribe
    }, [
        effectiveDetection.mode,
        media,
        onPerformanceMetrics,
        onGpuCapability,
        quality,
        qualityProfile,
        plugins,
        renderBridge,
        showSpecimenOverlay,
        specimen,
        inspectionEffects,
        resolvedInspectionEffects,
    ])

    const radius = typeof specimen.borderRadius === "number"
        ? `${specimen.borderRadius}px`
        : specimen.borderRadius
    const rootStyle: CSSProperties = {
        position: "relative",
        width: "100%",
        height: aspectRatio === "free" ? "100%" : undefined,
        minHeight: aspectRatio === "free" ? 220 : undefined,
        aspectRatio: aspectRatioValue(aspectRatio),
        overflow: "hidden",
        isolation: "isolate",
        containerType: "inline-size",
        borderRadius: radius,
        background: effectiveTheme.background || "#000",
        fontFamily: specimen.fontFamily,
        touchAction: "pan-y pinch-zoom",
        WebkitTapHighlightColor: "transparent",
        ...style,
    }

    const finishStyle: CSSProperties = {
        position: "absolute",
        inset: 0,
        zIndex: 3,
        pointerEvents: "none",
        borderRadius: "inherit",
        background:
            specimen.finish === "minimal"
                ? `radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,${specimen.vignette * 0.55}) 100%)`
                : specimen.finish === "editorial"
                  ? `linear-gradient(90deg, rgba(7,10,6,.18), transparent 42%), radial-gradient(ellipse at 64% 42%, transparent 36%, rgba(0,0,0,${specimen.vignette}) 100%)`
                  : `radial-gradient(ellipse at center, transparent 42%, rgba(0,0,0,${specimen.vignette}) 100%), linear-gradient(115deg, rgba(255,255,255,.022), transparent 30% 70%, rgba(0,0,0,.04))`,
    }

    const meta = PRESET_META[specimen.preset]
    const useRail = specimen.controlVariant === "rail"
    const railClass = `sgp-rail${specimen.mobileRail ? " sgp-rail--mobile" : ""}`

    return (
        <div
            ref={rootRef}
            className={className}
            style={rootStyle}
            role="region"
            aria-label={ariaLabel || alt}
            data-specimen-grid-preset={specimen.preset}
            data-specimen-grid-composition={specimen.composition}
            data-specimen-grid-active={active ? "true" : "false"}
            data-specimen-grid-ready={detectedPoints.length ? "true" : "false"}
            data-vision-plugin-count={plugins.filter(plugin => plugin.enabled !== false).length}
            data-inspection-effect-count={inspectionEffects.filter(effect => effect.enabled !== false).length}
            data-vision-theme={resolvedTheme.id}
            data-vision-quality={qualityProfile.tier}
            data-vision-gpu={specimen.gpuPostProcessing ? "enabled" : "disabled"}
        >
            <style>{`
                @keyframes sgp-grain { 0%{transform:translate3d(-1%,1%,0)}25%{transform:translate3d(1%,-1%,0)}50%{transform:translate3d(.5%,1%,0)}75%{transform:translate3d(-.5%,-1%,0)}100%{transform:translate3d(-1%,1%,0)} }
                @keyframes sgp-live { 0%,100%{opacity:.45;transform:scale(.84)}50%{opacity:1;transform:scale(1)} }
                .sgp-control,.sgp-hud,.sgp-rail{font-family:inherit}
                .sgp-rail{position:absolute;z-index:8;right:16px;bottom:16px;left:16px;display:grid;grid-template-columns:repeat(${SPECIMEN_GRID_PRESETS.length},minmax(0,1fr));gap:4px;padding:5px;border:1px solid rgba(255,255,255,.09);border-radius:10px;background:rgba(6,8,5,.76);backdrop-filter:blur(16px) saturate(130%);box-shadow:0 1px 0 rgba(255,255,255,.05) inset,0 16px 44px rgba(0,0,0,.24)}
                .sgp-rail button{min-width:0;min-height:38px;padding:6px 8px;overflow:hidden;border:1px solid transparent;border-radius:6px;background:transparent;color:rgba(255,255,255,.42);text-align:left;cursor:pointer;transition:background 160ms ease,border-color 160ms ease,color 160ms ease,transform 160ms ease}
                .sgp-rail button:hover{color:rgba(255,255,255,.82);background:rgba(255,255,255,.04)}
                .sgp-rail button:focus-visible,.sgp-select select:focus-visible{outline:1px solid ${specimen.accentColor};outline-offset:2px}
                .sgp-rail button[data-active=true]{border-color:${alpha(specimen.accentColor, 0.38)};background:${alpha(specimen.accentColor, 0.10)};color:${specimen.accentColor}}
                .sgp-rail span,.sgp-rail em{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sgp-rail span{font-size:7px;font-weight:750;letter-spacing:.13em}.sgp-rail em{margin-top:4px;color:rgba(255,255,255,.46);font-size:6px;font-style:normal;font-weight:600}
                .sgp-select{position:absolute;z-index:8;top:16px;right:16px;display:inline-flex;align-items:center;gap:8px;min-height:29px;padding:0 7px 0 10px;border:1px solid rgba(255,255,255,.1);border-radius:7px;background:rgba(6,8,5,.78);backdrop-filter:blur(14px) saturate(125%);color:rgba(255,255,255,.46);font-family:inherit;font-size:${7 * specimen.labelScale}px;font-weight:650;line-height:1;letter-spacing:.13em;text-transform:uppercase}
                .sgp-select select{min-width:124px;height:27px;border:0;outline:0;background:transparent;color:rgba(255,255,255,.94);font-family:inherit;font-size:${8 * specimen.labelScale}px;font-weight:650;line-height:1}.sgp-select option{color:#f4f4f0;background:#11130f}
                @container (max-width:920px){.sgp-rail--mobile{right:10px;bottom:10px;left:10px;display:flex;gap:4px;overflow-x:auto;overscroll-behavior-x:contain;scrollbar-width:none;scroll-snap-type:x proximity;mask-image:linear-gradient(90deg,transparent,#000 14px,#000 calc(100% - 14px),transparent)}.sgp-rail--mobile::-webkit-scrollbar{display:none}.sgp-rail--mobile button{min-width:86px;scroll-snap-align:start}}
                @media(max-width:720px){.sgp-rail--mobile{right:10px;bottom:10px;left:10px;display:flex;gap:4px;overflow-x:auto;overscroll-behavior-x:contain;scrollbar-width:none;scroll-snap-type:x proximity;mask-image:linear-gradient(90deg,transparent,#000 14px,#000 calc(100% - 14px),transparent)}.sgp-rail--mobile::-webkit-scrollbar{display:none}.sgp-rail--mobile button{min-width:86px;scroll-snap-align:start}.sgp-select{top:auto;right:12px;bottom:12px;left:12px;justify-content:space-between}.sgp-select select{min-width:150px}}
                @media(prefers-reduced-motion:reduce){.sgp-grain,.sgp-live{animation:none!important}.sgp-rail button{transition:none}}
            `}</style>

            <GridPulseScan
                src={src}
                alt={alt}
                aspectRatio="free"
                media={media}
                detection={effectiveDetection}
                grid={baseGrid}
                connections={baseConnections}
                crosshair={baseCrosshair}
                boxes={baseBoxes}
                labels={baseLabels}
                effect={effectiveEffect}
                interaction={effectiveInteraction}
                motion={effectiveMotion}
                rendering={effectiveRendering}
                theme={effectiveTheme}
                ariaLabel={ariaLabel}
                onReady={onReady}
                onScan={handleScan}
                onActiveChange={handleActiveChange}
                onError={onError}
                onRenderBridge={handleRenderBridge}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
            />

            {showSpecimenOverlay ? (
                <canvas
                    ref={canvasRef}
                    aria-hidden="true"
                    style={{
                        position: "absolute",
                        inset: 0,
                        zIndex: 2,
                        display: "block",
                        width: "100%",
                        height: "100%",
                        pointerEvents: "none",
                    }}
                />
            ) : null}

            {showSpecimenOverlay ? (
                <div style={finishStyle} aria-hidden="true">
                    {specimen.finish !== "minimal" ? <div
                        className="sgp-grain"
                        style={{
                            position: "absolute",
                            inset: "-36%",
                            opacity: specimen.grain,
                            pointerEvents: "none",
                            mixBlendMode: "overlay",
                            backgroundImage:
                                "radial-gradient(circle at 12% 23%,rgba(255,255,255,.22) 0 .65px,transparent .8px),radial-gradient(circle at 73% 62%,rgba(255,255,255,.14) 0 .55px,transparent .72px),radial-gradient(circle at 42% 81%,rgba(0,0,0,.35) 0 .7px,transparent .9px)",
                            backgroundSize: "7px 7px,9px 9px,11px 11px",
                            animation: "sgp-grain .42s steps(2,end) infinite",
                        }}
                    /> : null}
                    {specimen.finish !== "minimal" ? <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            opacity: specimen.scanlines,
                            mixBlendMode: "soft-light",
                            background:
                                "repeating-linear-gradient(to bottom,transparent 0,transparent 3px,rgba(255,255,255,.1) 3.5px,transparent 4px)",
                        }}
                    /> : null}
                </div>
            ) : null}

            {showSpecimenOverlay && specimen.showFrame ? (
                <div
                    aria-hidden="true"
                    style={{
                        position: "absolute",
                        zIndex: 5,
                        inset: 8,
                        pointerEvents: "none",
                        border: "1px solid rgba(255,255,255,.07)",
                        borderRadius: `max(4px, calc(${radius} - 8px))`,
                        boxShadow: "0 0 0 1px rgba(0,0,0,.22),0 1px 0 rgba(255,255,255,.04) inset",
                    }}
                >
                    {[0, 1, 2, 3].map(index => (
                        <i
                            key={index}
                            style={{
                                position: "absolute",
                                width: 18,
                                height: 18,
                                opacity: 0.7,
                                top: index < 2 ? 7 : undefined,
                                bottom: index >= 2 ? 7 : undefined,
                                left: index === 0 || index === 3 ? 7 : undefined,
                                right: index === 1 || index === 2 ? 7 : undefined,
                                transform: `rotate(${index * 90}deg)`,
                                borderTop: `1px solid ${specimen.lineColor}`,
                                borderLeft: `1px solid ${specimen.lineColor}`,
                            }}
                        />
                    ))}
                </div>
            ) : null}

            {showSpecimenOverlay && specimen.showHud ? (
                <div
                    className="sgp-hud"
                    style={{
                        position: "absolute",
                        zIndex: 7,
                        top: 16,
                        left: 16,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 7,
                        minHeight: 27,
                        padding: "0 9px",
                        border: "1px solid rgba(255,255,255,.09)",
                        borderRadius: 6,
                        background: "rgba(6,8,5,.72)",
                        backdropFilter: "blur(14px) saturate(125%)",
                        color: "rgba(255,255,255,.62)",
                        fontSize: 7 * specimen.labelScale,
                        fontWeight: 650,
                        letterSpacing: ".13em",
                        textTransform: "uppercase",
                        pointerEvents: "none",
                    }}
                >
                    <span
                        className="sgp-live"
                        style={{
                            width: 6,
                            height: 6,
                            borderRadius: 999,
                            opacity: active ? 1 : 0.38,
                            background: active ? specimen.accentColor : specimen.lineColor,
                            boxShadow: active ? `0 0 14px ${alpha(specimen.accentColor, 0.72)}` : "none",
                            animation: active ? "sgp-live 1.65s ease-in-out infinite" : "none",
                        }}
                    />
                    <b style={{ color: "rgba(255,255,255,.94)", letterSpacing: ".05em" }}>{meta.code}</b>
                    <em style={{ color: active ? specimen.accentColor : "rgba(255,255,255,.42)", fontStyle: "normal", paddingLeft: 6, borderLeft: "1px solid rgba(255,255,255,.12)" }}>{active ? "LIVE" : "IDLE"}</em>
                </div>
            ) : null}

            {showSpecimenOverlay && specimen.showStatus && !useRail ? (
                <div
                    className="sgp-hud"
                    style={{
                        position: "absolute",
                        zIndex: 7,
                        right: 16,
                        bottom: 16,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        maxWidth: "min(320px, calc(100% - 32px))",
                        minHeight: 27,
                        padding: "0 9px",
                        border: "1px solid rgba(255,255,255,.09)",
                        borderRadius: 6,
                        background: "rgba(6,8,5,.72)",
                        backdropFilter: "blur(14px) saturate(125%)",
                        color: "rgba(255,255,255,.58)",
                        fontSize: 7 * specimen.labelScale,
                        fontWeight: 650,
                        letterSpacing: ".08em",
                        textTransform: "uppercase",
                        pointerEvents: "none",
                    }}
                >
                    <b style={{ color: specimen.accentColor }}>{detectedPoints.length || "—"}</b>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{meta.description}</span>
                </div>
            ) : null}

            <span
                role="status"
                aria-live="polite"
                style={{
                    position: "absolute",
                    width: 1,
                    height: 1,
                    padding: 0,
                    margin: -1,
                    overflow: "hidden",
                    clip: "rect(0,0,0,0)",
                    whiteSpace: "nowrap",
                    border: 0,
                }}
            >
                {`${specimen.preset}. ${detectedPoints.length} regions detected. ${active ? "Scan active." : "Scan idle."} Quality ${qualityProfile.tier}.`}
            </span>

            {showSpecimenOverlay && specimen.showControls ? (
                useRail ? (
                    <div className={railClass} role="toolbar" aria-label={specimen.controlsLabel}>
                        {SPECIMEN_GRID_PRESETS.map(option => {
                            const optionMeta = PRESET_META[option]
                            const selected = option === specimen.preset
                            return (
                                <button
                                    key={option}
                                    type="button"
                                    ref={(element: HTMLButtonElement | null) => {
                                        presetButtonRefs.current[SPECIMEN_GRID_PRESETS.indexOf(option)] = element
                                    }}
                                    aria-pressed={selected}
                                    aria-label={`${option}: ${optionMeta.description}`}
                                    tabIndex={selected ? 0 : -1}
                                    data-active={selected ? "true" : "false"}
                                    onPointerDown={(event: ReactPointerEvent<HTMLButtonElement>) => event.stopPropagation()}
                                    onKeyDown={(event: ReactKeyboardEvent<HTMLButtonElement>) =>
                                        handlePresetKeyDown(event, SPECIMEN_GRID_PRESETS.indexOf(option))
                                    }
                                    onClick={() => selectPreset(option)}
                                >
                                    <span>{optionMeta.code}</span>
                                    <em>{option}</em>
                                </button>
                            )
                        })}
                    </div>
                ) : (
                    <label className="sgp-select">
                        <span>{specimen.controlsLabel}</span>
                        <select
                            value={specimen.preset}
                            aria-label="Specimen scan preset"
                            onPointerDown={(event: ReactPointerEvent<HTMLSelectElement>) => event.stopPropagation()}
                            onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                                selectPreset(event.target.value as SpecimenGridPreset)
                            }
                        >
                            {SPECIMEN_GRID_PRESETS.map(option => (
                                <option key={option} value={option}>{option}</option>
                            ))}
                        </select>
                    </label>
                )
            ) : null}
        </div>
    )
}
