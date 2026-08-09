import type { CSSProperties } from "react"
import type { GridPulseScanPreset } from "./GridPulsePresets"
import type { GridPulseConnectionAnimation } from "./ConnectionAnimationPolicy"
import type { GridPulseBoxAnimation } from "./ScanBoxAnimationPolicy"
import type { GridPulseCrosshairFollowMode } from "./CrosshairMotionPolicy"
import type {
    GridPulseLabelCoordinateStyle,
    GridPulseLabelTimeFormat,
} from "./LabelTokenPolicy"
import type { ScanSweepDirection, ScanSweepEasing, ScanSweepMode } from "./ScanSweepPolicy"
import type { GridPulseTouchBehavior } from "./TouchInteractionPolicy"
import type { GridPulseRescanTransition } from "./RescanTransitionPolicy"
import type { BitmapAnchor, BitmapDotShape, BitmapMatrix, BitmapMethod } from "./BitmapEffectPolicy"
import type { BitmapPaletteName } from "./DitherPalettePolicy"
import type { ThermalPalette } from "./ThermalEffectPolicy"
import type { PixelAnchorMode, PixelSamplingMode, PixelShape } from "./PixelatedEffectPolicy"
import type { CodeAnchorMode, CodeColorMode, CodeSamplingMode } from "./CodeEffectPolicy"

/**
 * Public option surface for Grid Pulse Scan Pro.
 *
 * Types live apart from the renderer so the API can be inspected, documented,
 * and asserted on without loading React or a canvas. `GridPulseScanPro.tsx`
 * re-exports everything here; nothing should import this file directly.
 */

export type {
    GridPulseLabelCoordinateStyle,
    GridPulseLabelTimeFormat,
} from "./LabelTokenPolicy"
export type { GridPulseCrosshairFollowMode } from "./CrosshairMotionPolicy"

export type GridPulseMediaType = "auto" | "image" | "video"
export type GridPulseDetectionMode = "auto" | "person" | "detail" | "custom"
export type GridPulseActivationMode = "hover" | "always" | "tap"
export type GridPulseGridAnimation = "dash" | "drift" | "pulse" | "scan" | "hybrid"
export type GridPulseGridScanDirection = "horizontal" | "vertical" | "diagonal"
export type { GridPulseConnectionAnimation } from "./ConnectionAnimationPolicy"
export type { GridPulseBoxAnimation } from "./ScanBoxAnimationPolicy"
export type GridPulseEffect = "none" | "bitmap" | "pixelated" | "code" | "xray" | "thermal"
export type GridPulseEffectScope = "boxes" | "media" | "both"
export type GridPulseAspectRatio =
    | "free"
    | "16:9"
    | "3:2"
    | "4:3"
    | "1:1"
    | "4:5"
    | "9:16"
    | "21:8"

export interface GridPulsePoint {
    /** Normalized horizontal position, from 0 to 1. */
    x: number
    /** Normalized vertical position, from 0 to 1. */
    y: number
    /** Optional confidence from 0 to 1. */
    score?: number
    /** Optional stable identifier used by label templates. */
    id?: string
}

export interface GridPulseMediaOptions {
    type: GridPulseMediaType
    crossOrigin: "anonymous" | "use-credentials" | null
    poster?: string
    objectFit: "cover" | "contain" | "fill"
    /** Normalized focal position. */
    positionX: number
    /** Normalized focal position. */
    positionY: number
    mirror: boolean
    videoAutoPlay: boolean
    videoLoop: boolean
    videoMuted: boolean
    videoPlaybackRate: number
}

export interface GridPulseDetectionOptions {
    mode: GridPulseDetectionMode
    pointCount: number
    minDistance: number
    edgeSensitivity: number
    personBias: number
    centerBias: number
    /** Relative importance of structural edges in Detail mode. */
    detailEdgeWeight: number
    /** Relative importance of local texture in Detail mode. */
    detailTextureWeight: number
    /** Skin-region contribution in Person mode. */
    personSkinWeight: number
    /** Person-signal contribution used by Auto mode. */
    autoPersonWeight: number
    /** Complementary signal retained by Auto mode to avoid collapsing into one detector. */
    modeDiversity: number
    /** Normalized region used to bias automatic feature selection. */
    focusX: number
    focusY: number
    focusRadius: number
    focusStrength: number
    /** Blends rescans with the previous point set to reduce video jitter. */
    temporalSmoothing: number
    preservePointIds: boolean
    /** Legacy nearest-neighbor matching or stable global assignment. */
    trackingMode: "legacy" | "stable"
    /** Maximum normalized assignment cost for an existing target. */
    trackingMaxDistance: number
    /** Number of missed acquisition frames retained before dropping a target. */
    trackingMaxLostFrames: number
    /** Position smoothing used by stable tracking. */
    trackingSmoothing: number
    /** Velocity smoothing used by stable tracking. */
    trackingVelocitySmoothing: number
    /** Predicts the next position from the estimated target velocity. */
    trackingPrediction: boolean
    /** Weight of confidence change in assignment cost. */
    trackingScoreWeight: number
    clickSearchRadius: number
    seed: number
    manualPoints: GridPulsePoint[]
    /**
     * Optional detector hook. When provided it replaces the built-in saliency
     * scan: it receives the decoded media canvas and must return normalized
     * points. Exceptions and rejections fall back to the built-in detector.
     * Note: the hook participates in options identity by presence, not by
     * function identity — swap `mode` or another field to force a re-scan.
     */
    customDetector:
        | ((context: {
              canvas: HTMLCanvasElement
              width: number
              height: number
              count: number
              focus: GridPulsePoint | null
          }) => GridPulsePoint[] | Promise<GridPulsePoint[]>)
        | null
    mobilePointLimit: number
}

export type GridPulseGridStyle = "lines" | "crosses"

export interface GridPulseGridOptions {
    visible: boolean
    /**
     * `lines` is the continuous ruled grid; `crosses` replaces every major
     * intersection with a `+` registration mark and every subdivision with a
     * survey dot — the tactical-HUD backdrop.
     */
    style: GridPulseGridStyle
    animate: boolean
    /** Animation system. `dash` preserves the pre-v2.15 behavior. */
    animation: GridPulseGridAnimation
    speed: number
    /** CSS-pixel grid drift per second on each axis. */
    driftX: number
    driftY: number
    /** Strength of the low-frequency whole-grid luminance pulse. */
    pulseStrength: number
    /** Width of the traveling energy band as a fraction of the frame. */
    scanWidth: number
    /** Additional opacity applied inside the traveling energy band. */
    scanStrength: number
    scanDirection: GridPulseGridScanDirection
    spacing: number
    color: string
    opacity: number
    lineWidth: number
    dash: number[]
    subdivisions: number
}

export interface GridPulseConnectionOptions {
    visible: boolean
    /** Which connection families are rendered. Leaders preserve the original marker-to-box rail; points adds point-to-point topology. */
    topology: "leaders" | "points" | "both"
    /** Point-to-point routing strategy used when topology includes points. */
    pointTopology: "nearest" | "chain" | "hub"
    color: string
    opacity: number
    lineWidth: number
    dash: number[]
    tickMarks: boolean
    tickSpacing: number
    tickLength: number
    pointSize: number
    pointShape: "square" | "circle" | "cross"
    pulse: boolean
    /** Progressive line construction and traveling energy packet. */
    animation: GridPulseConnectionAnimation
    drawDuration: number
    stagger: number
    flowSpeed: number
    flowLength: number
    flowOpacity: number
}

export interface GridPulseCrosshairOptions {
    visible: boolean
    followPointer: boolean
    /** Immediate pointer lock or frame-rate-independent eased tracking. */
    followMode: GridPulseCrosshairFollowMode
    /** Approximate time in milliseconds to cover 99% of the pointer gap. */
    followResponse: number
    /** Remaining CSS-pixel distance below which the follower snaps to target. */
    snapThreshold: number
    /** Return to frame center after pointer exit instead of holding the last position. */
    returnToCenter: boolean
    color: string
    opacity: number
    lineWidth: number
    dash: number[]
    radius: number
    showCoordinates: boolean
    coordinateStyle: "latlon" | "percent" | "pixels"
    font: string
    labelOffsetX: number
    labelOffsetY: number
}

export type GridPulseBoxLayout = "callout" | "tracking"

export interface GridPulseBoxOptions {
    visible: boolean
    /**
     * `callout` keeps the Grid Pulse Scan magnified card offset from its marker.
     * `tracking` places a Specimen-style frame centered on the feature itself.
     */
    layout: GridPulseBoxLayout
    /** Size multiplier applied to tracking frames. */
    trackingScale: number
    /** Reserved chrome space above tracking frames, in CSS pixels. */
    trackingSafeTop: number
    /** Reserved chrome space below tracking frames, in CSS pixels. */
    trackingSafeBottom: number
    /** Minimum separation enforced between tracking frames, in CSS pixels. */
    trackingMinGap: number
    /** CSS-pixel parallax applied to tracking frames from the pointer position. */
    trackingParallax: number
    width: number
    height: number
    mobileScale: number
    zoom: number
    gap: number
    padding: number
    borderColor: string
    borderOpacity: number
    borderWidth: number
    radius: number
    backgroundColor: string
    shadow: string
    cornerBrackets: boolean
    cornerLength: number
    cornerWidth: number
    /** Bracket stroke opacity, independent of the frame border. */
    cornerOpacity: number
    scanSweep: boolean
    scanColor: string
    scanOpacity: number
    scanWidth: number
    scanDirection: ScanSweepDirection
    scanDuration: number
    scanDelay: number
    scanMode: ScanSweepMode
    scanEasing: ScanSweepEasing
    scanBandWidth: number
    scanSoftness: number
    scanTrail: number
    avoidOverlap: boolean
    clampToBounds: boolean
    /** Progressive target lock, frame construction, media reveal, and settling. */
    animation: GridPulseBoxAnimation
    animationStagger: number
    lockDuration: number
    unfoldDuration: number
    mediaDelay: number
    settleDuration: number
    ambientBreath: number
}

export interface GridPulseLabelOptions {
    visible: boolean
    /** Tokens: {score}, {id}, {coords}, {time}, {zoom}, {mode}. */
    template: string
    /** Number of decimal places emitted by {score}. */
    scorePrecision: number
    /** Coordinate formatting for {coords}; inherit follows the crosshair setting. */
    coordinateStyle: GridPulseLabelCoordinateStyle
    /** Deterministic clock, scan-relative elapsed time, SMPTE-like timecode, or legacy locale output. */
    timeFormat: GridPulseLabelTimeFormat
    /** Frame rate used only by the timecode formatter. */
    timecodeFps: number
    color: string
    background: string
    borderColor: string
    borderWidth: number
    font: string
    paddingX: number
    paddingY: number
    offsetX: number
    offsetY: number
    uppercase: boolean
    /** Letter tracking in em. The measured chip calibration is 0.085em. */
    letterSpacing: number
}

export interface GridPulseEffectOptions {
    type: GridPulseEffect
    scope: GridPulseEffectScope
    intensity: number
    tint: string
    background: string
    pixelSize: number
    /** Space between rendered pixel blocks, in CSS pixels. */
    pixelGap: number
    /** Optional RGB quantization levels. Zero preserves continuous sampled colour. */
    pixelLevels: number
    /** Average each source cell or sample its center point. */
    pixelSampling: PixelSamplingMode
    /** Anchor blocks to the image origin or center the full block lattice. */
    pixelAnchor: PixelAnchorMode
    /** Square or softly rounded rendered blocks. */
    pixelShape: PixelShape
    /** Rounded-block corner radius as a fraction of the visible block size. */
    pixelRadius: number
    bitmapScale: number
    bitmapThreshold: number
    bitmapMethod: BitmapMethod
    /** Named dither palette applied by the ordered and diffusion methods. */
    bitmapPalette: BitmapPaletteName
    bitmapMatrix: BitmapMatrix
    bitmapLevels: number
    bitmapAnchor: BitmapAnchor
    bitmapDotShape: BitmapDotShape
    bitmapGamma: number
    codeCellSize: number
    codeCharacters: string
    codeOpacity: number
    /** Sampling used to derive each glyph cell. */
    codeSampling: CodeSamplingMode
    /** Anchor the glyph lattice to the image origin or center it in the frame. */
    codeAnchor: CodeAnchorMode
    /** Tint every glyph, preserve sampled source colour, or derive monochrome luminance. */
    codeColorMode: CodeColorMode
    /** Fraction of glyph selection driven by local structural edges. */
    codeEdgeWeight: number
    /** Suppresses cells whose mapped signal is below this threshold. */
    codeThreshold: number
    /** Tone curve applied before selecting a glyph. */
    codeGamma: number
    /** Opacity of the effect background fill. */
    codeBackgroundOpacity: number
    xrayContrast: number
    xrayBrightness: number
    /** Inverts source luminance before the X-Ray tone curve. */
    xrayInvert: boolean
    /** Strength applied to local luminance gradients. */
    xrayEdgeStrength: number
    /** Gradient floor below which sensor noise is suppressed. */
    xrayEdgeThreshold: number
    /** Amount of structural edge energy mixed into the final X-Ray value. */
    xrayGlow: number
    /** Amount of original source luminance retained after inversion. */
    xrayPreserveDetail: number
    /** False-colour ramp used by the Thermal effect. */
    thermalPalette: ThermalPalette
    thermalContrast: number
    thermalBrightness: number
    /** Tone curve applied before the thermal ramp lookup. */
    thermalGamma: number
    /** Limits expensive video effect refreshes while preserving 60fps overlay motion. */
    refreshRate: number
}

export interface GridPulseInteractionOptions {
    activation: GridPulseActivationMode
    clickToRescan: boolean
    rescanOnEnter: boolean
    deactivateOnLeave: boolean
    autoRescanInterval: number
    mobileAlwaysOn: boolean
    /** Touch-only interaction model; auto derives behavior from activation and mobileAlwaysOn. */
    touchBehavior: GridPulseTouchBehavior
    /** Delay before press-hold touch deactivation after release. */
    touchReleaseDelay: number
    /** Whether touch activation should request a focused rescan. */
    touchRescan: boolean
    /** Whether touch motion updates the crosshair position. */
    touchCrosshair: boolean
    cursor: CSSProperties["cursor"]
    keyboardControls: boolean
    /** Delay before hover-out deactivation, allowing brief pointer excursions. */
    leaveDelay: number
    /** Overlay fade-in duration after activation. */
    enterDuration: number
    /** Overlay fade-out duration after deactivation. */
    exitDuration: number
    /** Visual treatment used when replacing one detection set with another. */
    rescanTransition: GridPulseRescanTransition
    /** Fade-out duration for the outgoing detection set. */
    rescanExitDuration: number
    /** Optional blackout gap between outgoing and incoming detection sets. */
    rescanGap: number
    /** Fade-in duration for the newly committed detection set. */
    rescanEnterDuration: number
}

export interface GridPulseMotionOptions {
    revealDuration: number
    stagger: number
    scanDuration: number
    pulseDuration: number
    easing: "linear" | "easeOut" | "easeInOut"
    respectReducedMotion: boolean
    /** When reduced motion is active, reveal the full detection batch at once or preserve sequential pops. */
    reducedMotionReveal: "instant" | "staggered"
}

export interface GridPulseThemeOptions {
    background: string
    overlayWhenInactive: boolean
    inactiveOpacity: number
    /** Selects light or dark scanner chrome from sampled media luminance. */
    adaptiveChrome: boolean
    /** Light chrome candidate used by adaptive contrast. */
    chromeLight: string
    /** Dark chrome candidate used by adaptive contrast. */
    chromeDark: string
    /** Radius, in CSS pixels, sampled around each detection point. */
    chromeSampleRadius: number
    /** Requested contrast target. The strongest available candidate is used if custom colors miss it. */
    chromeMinContrast: number
    /** Uses one global chrome color or a regional palette for full-frame overlays. */
    chromeSpatialMode: "global" | "regional"
    /** Number of horizontal sample zones used by regional adaptive chrome. */
    chromeZoneColumns: number
    /** Number of vertical sample zones used by regional adaptive chrome. */
    chromeZoneRows: number
    /** Adds an opposite-tone underlay so thin full-frame chrome survives texture changes inside a zone. */
    chromeHalo: boolean
    /** CSS-pixel expansion applied around grid and crosshair strokes. */
    chromeHaloWidth: number
    /** Absolute overlay opacity for the opposite-tone underlay. */
    chromeHaloOpacity: number
    /** Adapts opacity, label backing, and glow from local image structure. */
    adaptiveChromeElements: boolean
    /** Strength of compensation when configured chrome misses the contrast target. */
    chromeContrastCompensation: number
    /** Reduces decorative intensity in busy, high-edge regions. */
    chromeBusySimplification: number
    /** Enables restrained glow in low-contrast regions. */
    chromeAdaptiveGlow: boolean
}

export interface GridPulseHudOptions {
    /** Master switch for the instrument frame drawn over the whole stage. */
    visible: boolean
    /** Chrome color; adaptive chrome overrides it like every other layer. */
    color: string
    opacity: number
    /** Corner brackets framing the viewport itself. */
    frameBrackets: boolean
    /** Inset, in CSS pixels, from the stage edge to the frame. */
    frameInset: number
    /** Arm length of each viewport corner bracket. */
    frameLength: number
    frameWidth: number
    /** Ruler tick marks along all four stage edges. */
    edgeTicks: boolean
    edgeTickSpacing: number
    edgeTickLength: number
    /** Live status readouts pinned inside the frame corners. */
    readout: boolean
    /** Top-left template. Tokens: {mode} {n} {fps} {w} {h}. */
    readoutPrimary: string
    /** Bottom-right template. Same tokens. */
    readoutSecondary: string
    /** Pulsing acquisition dot ahead of the primary readout. */
    statusDot: boolean
    font: string
    /** Tracking in em applied to readout text. */
    letterSpacing: number
    /** Full-stage acquisition sweep line on every scan commit. */
    sweep: boolean
    sweepDuration: number
    sweepOpacity: number
}

export interface GridPulseRenderingOptions {
    /** Maximum overlay animation rate. */
    maxFps: number
    /** Maximum media refresh rate for static images when a redraw is required. */
    staticImageFps: number
    /** Maximum frame rate while inactive. */
    inactiveFps: number
    /** Caps canvas backing-store density. */
    dprCap: number
    /** Stops the animation loop when no media or overlay work remains. */
    demandDriven: boolean
    /** Uses requestVideoFrameCallback when available instead of polling video frames. */
    useVideoFrameCallback: boolean
    /** Suspend animation work while the component is outside the viewport. */
    pauseWhenOffscreen: boolean
}

export interface GridPulseFramePoint extends GridPulsePoint {
    px: number
    py: number
    score: number
    id: string
    reveal: number
}

export interface GridPulseFrameBox {
    x: number
    y: number
    width: number
    height: number
    anchorX: number
    anchorY: number
}

export interface GridPulseFrameSnapshot {
    now: number
    width: number
    height: number
    dpr: number
    ready: boolean
    active: boolean
    reducedMotion: boolean
    pointer: Readonly<{ x: number; y: number; inside: boolean }>
    points: readonly GridPulseFramePoint[]
    boxes: readonly GridPulseFrameBox[]
    sourceCanvas: HTMLCanvasElement | null
    calloutCanvas: HTMLCanvasElement | null
}

export type GridPulseFrameListener = (snapshot: GridPulseFrameSnapshot) => void

export interface GridPulseRenderBridge {
    /** Media-only canvas in component CSS pixels. Treat as read-only. */
    getSourceCanvas: () => HTMLCanvasElement | null
    /** Effect-aware source used by callouts and Specimen inspection regions. */
    getCalloutCanvas: () => HTMLCanvasElement | null
    getSize: () => Readonly<{ width: number; height: number; dpr: number }>
    getPoints: () => readonly GridPulsePoint[]
    getSnapshot: () => GridPulseFrameSnapshot | null
    subscribe: (listener: GridPulseFrameListener) => () => void
    isReady: () => boolean
    requestFrame: () => void
    requestRender: () => void
    requestMediaRender: () => void
}

export interface GridPulseScanProps {
    src: string
    /**
     * Named configuration bundle applied beneath per-group overrides.
     * See GridPulsePresets.ts — a caller's explicit option always wins.
     */
    preset?: GridPulseScanPreset
    alt?: string
    aspectRatio?: GridPulseAspectRatio
    media?: Partial<GridPulseMediaOptions>
    detection?: Partial<GridPulseDetectionOptions>
    grid?: Partial<GridPulseGridOptions>
    connections?: Partial<GridPulseConnectionOptions>
    crosshair?: Partial<GridPulseCrosshairOptions>
    boxes?: Partial<GridPulseBoxOptions>
    labels?: Partial<GridPulseLabelOptions>
    hud?: Partial<GridPulseHudOptions>
    effect?: Partial<GridPulseEffectOptions>
    interaction?: Partial<GridPulseInteractionOptions>
    motion?: Partial<GridPulseMotionOptions>
    rendering?: Partial<GridPulseRenderingOptions>
    theme?: Partial<GridPulseThemeOptions>
    className?: string
    style?: CSSProperties
    ariaLabel?: string
    onReady?: () => void
    onScan?: (points: GridPulsePoint[]) => void
    onActiveChange?: (active: boolean) => void
    onError?: (error: Error) => void
    onRenderBridge?: (bridge: GridPulseRenderBridge | null) => void
}
