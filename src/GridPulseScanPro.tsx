/**
 * Grid Pulse Scan Pro — authoritative public entry point.
 *
 * Every consumer, demo, test, and tool imports from this module. The
 * implementation lives in `./grid-pulse/`, and nothing outside this file should
 * reach into that directory directly. Adding a policy module means re-exporting
 * its public surface here, so the shipped API always has exactly one definition.
 */
import SpecimenGridPulse from "./grid-pulse/SpecimenGridPulse"

/**
 * Default export: the integrated Specimen + Grid Pulse renderer, matching the
 * v2.8 stable entry contract — `composition: "grid-pulse"` renders the plain
 * Grid Pulse engine, `"specimen"` the Specimen overlay alone, `"integrated"`
 * (default) both. The lower-level engine stays available as `GridPulseScan`.
 */
export default SpecimenGridPulse
export { SpecimenGridPulse }
export { SpecimenGridPulse as GridPulseScanPro }
export { default as GridPulseScan } from "./grid-pulse/GridPulseScan"

export {
    SPECIMEN_GRID_PRESETS,
    SPECIMEN_GRID_PULSE_DEFAULTS,
} from "./grid-pulse/SpecimenGridPulse"
export type {
    SpecimenGridPulseProps,
    SpecimenGridOptions,
    SpecimenGridPreset,
    SpecimenGridFinish,
    SpecimenGridComposition,
    SpecimenGridInteraction,
} from "./grid-pulse/SpecimenGridPulse"

export { GRID_PULSE_SCAN_DEFAULTS } from "./grid-pulse/GridPulseScan"
export { parseBoxShadow } from "./grid-pulse/BoxShadowPolicy"
export type { GridPulseBoxShadow } from "./grid-pulse/BoxShadowPolicy"

export type {
    GridPulseAspectRatio,
    GridPulseActivationMode,
    GridPulseBoxAnimation,
    GridPulseBoxLayout,
    GridPulseBoxOptions,
    GridPulseConnectionAnimation,
    GridPulseConnectionOptions,
    GridPulseCrosshairFollowMode,
    GridPulseCrosshairOptions,
    GridPulseDetectionMode,
    GridPulseDetectionOptions,
    GridPulseEffect,
    GridPulseEffectOptions,
    GridPulseEffectScope,
    GridPulseFrameBox,
    GridPulseFrameListener,
    GridPulseFramePoint,
    GridPulseFrameSnapshot,
    GridPulseGridAnimation,
    GridPulseGridOptions,
    GridPulseGridScanDirection,
    GridPulseInteractionOptions,
    GridPulseLabelCoordinateStyle,
    GridPulseLabelOptions,
    GridPulseLabelTimeFormat,
    GridPulseMediaOptions,
    GridPulseMediaType,
    GridPulseMotionOptions,
    GridPulsePoint,
    GridPulseRenderBridge,
    GridPulseRenderingOptions,
    GridPulseScanProps,
    GridPulseThemeOptions,
} from "./grid-pulse/GridPulseScan"

/* ------------------------------------------------------------------ *
 * Policy surface.
 *
 * These are pure and browser-free by design: the test suite and the
 * measurement tools exercise the component's visual and behavioural
 * contracts through them without needing a canvas.
 * ------------------------------------------------------------------ */

export {
    chooseAdaptiveChrome,
    contrastRatio,
    relativeLuminance,
    dualToneVisibilityContrast,
    adaptiveChromeZoneIndex,
    buildAdaptiveChromeZonePalette,
    averageRgba,
    rgbaForChromeBackground,
    oppositeChromeKind,
} from "./grid-pulse/AdaptiveChrome"
export type {
    AdaptiveChromeDecision,
    AdaptiveChromeZonePalette,
    RgbColor,
} from "./grid-pulse/AdaptiveChrome"

export {
    analyzeAdaptiveChromeRegion,
    resolveAdaptiveChromeStyle,
} from "./grid-pulse/AdaptiveChromePolicy"
export type {
    AdaptiveChromeRegionStats,
    AdaptiveChromeStyle,
} from "./grid-pulse/AdaptiveChromePolicy"

export {
    bitmapThresholdAt,
    quantizeBitmapLevel,
    resolveBitmapGrid,
} from "./grid-pulse/BitmapEffectPolicy"
export type {
    BitmapAnchor,
    BitmapDotShape,
    BitmapGrid,
    BitmapMatrix,
    BitmapMethod,
} from "./grid-pulse/BitmapEffectPolicy"

export {
    resolveCodeGlyph,
    resolveCodeGrid,
    resolveCodeSignal,
} from "./grid-pulse/CodeEffectPolicy"
export type {
    CodeAnchorMode,
    CodeColorMode,
    CodeGridGeometry,
    CodeSamplingMode,
} from "./grid-pulse/CodeEffectPolicy"

export { resolveGridPulseConnectionAnimation } from "./grid-pulse/ConnectionAnimationPolicy"
export type { GridPulseConnectionAnimationState } from "./grid-pulse/ConnectionAnimationPolicy"

export { resolveGridPulseCrosshairMotion } from "./grid-pulse/CrosshairMotionPolicy"
export type { GridPulseCrosshairMotionState } from "./grid-pulse/CrosshairMotionPolicy"

export { resolveGridPulseDetectionModeScore } from "./grid-pulse/DetectionModePolicy"
export type {
    GridPulseDetectionModeScore,
    GridPulseDetectionModeSignal,
    GridPulseDetectionModeWeights,
    GridPulseScoredDetectionMode,
} from "./grid-pulse/DetectionModePolicy"

export {
    scoreGridPulseDetectionField,
    selectGridPulseDetectionPoints,
} from "./grid-pulse/DetectionFieldPolicy"
export type {
    GridPulseDetectionCandidate,
    GridPulseDetectionFieldInput,
} from "./grid-pulse/DetectionFieldPolicy"

export { resolveGridPulseGridAnimation } from "./grid-pulse/GridAnimationPolicy"
export type { GridPulseGridAnimationFrame } from "./grid-pulse/GridAnimationPolicy"

export { buildGridPulseConnectionPairs } from "./grid-pulse/GridPulseConnectionTopology"
export type {
    GridPulseConnectionPoint,
    GridPulsePointTopology,
} from "./grid-pulse/GridPulseConnectionTopology"

export {
    clampNumber,
    gridPulseOverlapArea,
    layoutGridPulseBoxes,
    layoutGridPulseTrackingFrames,
    nearestPointOnGridPulseBox,
} from "./grid-pulse/GridPulseGeometry"
export type {
    GridPulseGeometryBox,
    GridPulseGeometryPoint,
    GridPulseLayoutOptions,
    GridPulseTrackingFrameOptions,
} from "./grid-pulse/GridPulseGeometry"

export { resolveGridPulseInteractionAlpha } from "./grid-pulse/InteractionTransitionPolicy"

export {
    fillGridPulseLabelTemplate,
    formatGridPulseLabelTime,
    resolveGridPulseLabelCoordinateStyle,
} from "./grid-pulse/LabelTokenPolicy"
export type {
    GridPulseCoordinateStyle,
    GridPulseLabelTokenInput,
} from "./grid-pulse/LabelTokenPolicy"

export { quantizeChannel, resolvePixelatedGrid } from "./grid-pulse/PixelatedEffectPolicy"
export type {
    PixelAnchorMode,
    PixelSamplingMode,
    PixelShape,
    PixelatedGridGeometry,
} from "./grid-pulse/PixelatedEffectPolicy"

export {
    easeGridPulseReveal,
    resolveGridPulseBatchStart,
    resolveGridPulseRevealProgress,
    resolveGridPulseRevealSpan,
} from "./grid-pulse/ReducedMotionPolicy"
export type {
    GridPulseReducedMotionReveal,
    GridPulseRevealEasing,
} from "./grid-pulse/ReducedMotionPolicy"

export { resolveGridPulseRescanTransition } from "./grid-pulse/RescanTransitionPolicy"
export type {
    GridPulseRescanTransition,
    GridPulseRescanTransitionState,
} from "./grid-pulse/RescanTransitionPolicy"

export { resolveGridPulseBoxAnimation } from "./grid-pulse/ScanBoxAnimationPolicy"
export type { GridPulseBoxAnimationState } from "./grid-pulse/ScanBoxAnimationPolicy"

export { resolveScanSweepState } from "./grid-pulse/ScanSweepPolicy"
export type {
    ScanSweepDirection,
    ScanSweepEasing,
    ScanSweepMode,
    ScanSweepState,
} from "./grid-pulse/ScanSweepPolicy"

export { solveTargetAssignment, StableTargetTracker } from "./grid-pulse/TargetTrackingPolicy"
export type {
    TargetTrackingOptions,
    TrackedPoint,
    TrackingPointInput,
} from "./grid-pulse/TargetTrackingPolicy"

export { resolveGridPulseTouchBehavior } from "./grid-pulse/TouchInteractionPolicy"
export type {
    GridPulseTouchBehavior,
    GridPulseTouchPolicyResult,
} from "./grid-pulse/TouchInteractionPolicy"

export { resolveGridPulseXraySample } from "./grid-pulse/XrayEffectPolicy"
export type { GridPulseXraySampleInput } from "./grid-pulse/XrayEffectPolicy"

export { resolveGridPulseThermalSample } from "./grid-pulse/ThermalEffectPolicy"
export type { ThermalPalette, GridPulseThermalSampleInput } from "./grid-pulse/ThermalEffectPolicy"

export {
    BITMAP_PALETTES,
    diffuseToPalette,
    nearestPaletteIndex,
    resolveBitmapPalette,
} from "./grid-pulse/DitherPalettePolicy"
export type { BitmapPaletteName, PaletteColor } from "./grid-pulse/DitherPalettePolicy"

export {
    GRID_PULSE_SCAN_PRESETS,
    resolveGridPulsePreset,
} from "./grid-pulse/GridPulsePresets"
export type { GridPulseScanPreset, GridPulsePresetBundle } from "./grid-pulse/GridPulsePresets"

/* Vision framework surface (from the SpecimenGridPulse-Pro lineage). */
export {
    InspectionEffectStack,
    SCIENTIFIC_VISION_THEME,
    VisionPerformanceMonitor,
    VisionTimeline,
    createCanvasCaptureController,
} from "./grid-pulse/VisionFramework"
export type {
    InspectionEffect,
    InspectionEffectName,
    VisionCaptureController,
    VisionPerformanceMetrics,
    VisionPlugin,
    VisionPluginContext,
    VisionTheme,
} from "./grid-pulse/VisionFramework"
export { VisionSceneGraphStore } from "./grid-pulse/VisionSceneGraph"
export type {
    VisionGraphMode,
    VisionSceneGraph,
    VisionSceneNode,
    VisionSceneEdge,
} from "./grid-pulse/VisionSceneGraph"
export {
    RENDERER_PROFILES,
    RenderingPipeline,
    TemporalFrameBuffer,
    coherentNoise2D,
    fractalNoise2D,
} from "./grid-pulse/RenderingPipeline"
export type { PipelineOptions, RendererProfileName } from "./grid-pulse/RenderingPipeline"
export {
    DEFAULT_ACQUISITION_SPRING,
    acquisitionMotion,
    springStep,
    typedLabel,
} from "./grid-pulse/MotionEngine"
export type { AcquisitionMotion, AcquisitionState, SpringConfig } from "./grid-pulse/MotionEngine"
export { GpuPostProcessor, resolveGpuBackend } from "./grid-pulse/GpuPostProcessor"
export type { GpuBackendPreference, GpuCapability } from "./grid-pulse/GpuPostProcessor"
export {
    degradeQuality,
    resolveVisionQuality,
    shouldDegradeQuality,
} from "./grid-pulse/AdaptiveQuality"
export type { QualityProfile, VisionQualityMode } from "./grid-pulse/AdaptiveQuality"
export { confidenceHaloPlugin, effectDiagnosticPlugin } from "./grid-pulse/ExamplePlugins"
