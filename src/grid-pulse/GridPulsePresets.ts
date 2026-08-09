import type {
    GridPulseBoxOptions,
    GridPulseConnectionOptions,
    GridPulseCrosshairOptions,
    GridPulseDetectionOptions,
    GridPulseEffectOptions,
    GridPulseGridOptions,
    GridPulseHudOptions,
    GridPulseInteractionOptions,
    GridPulseLabelOptions,
    GridPulseMotionOptions,
    GridPulseThemeOptions,
} from "./GridPulseOptionTypes"

/**
 * The eleven named presets from the parity plan's §5.1 inventory:
 * loupe, telemetry, plate, survey, lattice, contour, hairline, swarm, field,
 * viewfinder, tracking.
 *
 * PROVENANCE: the original implementations were never delivered to this
 * repository. These are new configuration bundles authored against the plan's
 * one-line descriptions and the requirement that all eleven render visibly
 * distinctly (rubric D6). They are option bundles only — every knob they turn
 * is public API, so a preset is exactly reproducible by hand.
 *
 * Merge order in the component: defaults ← preset bundle ← caller overrides.
 * A caller's explicit option always wins over the preset.
 */

export const GRID_PULSE_SCAN_PRESETS = [
    "loupe",
    "telemetry",
    "plate",
    "survey",
    "lattice",
    "contour",
    "hairline",
    "swarm",
    "field",
    "viewfinder",
    "tracking",
] as const

export type GridPulseScanPreset = (typeof GRID_PULSE_SCAN_PRESETS)[number]

export interface GridPulsePresetBundle {
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
    theme?: Partial<GridPulseThemeOptions>
}

const BUNDLES: Record<GridPulseScanPreset, GridPulsePresetBundle> = {
    /** A magnifier: few, large, high-zoom inspection windows. */
    loupe: {
        detection: { pointCount: 3, minDistance: 0.24 },
        boxes: { width: 150, height: 150, zoom: 3.2, radius: 10, cornerLength: 16 },
        connections: { topology: "leaders", tickMarks: false, dash: [] },
        grid: { visible: false },
        crosshair: { visible: false },
        labels: { template: "{zoom} {id}" },
        hud: { visible: false },
    },
    /** Data-forward: every chip streams coordinates, clock, and frame rate. */
    telemetry: {
        detection: { pointCount: 6 },
        labels: {
            template: "{id} {coords} {time} {fps}FPS",
            timeFormat: "timecode",
        },
        crosshair: { visible: true, showCoordinates: true, coordinateStyle: "pixels" },
        connections: { topology: "both", pointTopology: "hub" },
        grid: { style: "lines", animation: "dash", spacing: 120 },
        boxes: { width: 96, height: 96, zoom: 2 },
    },
    /** An annotation plate: numbered, captioned regions, no motion flourish. */
    plate: {
        detection: { pointCount: 5, seed: 3121 },
        labels: { template: "{index}/{n} · {pct}", scorePrecision: 0 },
        boxes: {
            animation: "static",
            scanSweep: false,
            radius: 2,
            borderWidth: 1,
            shadow: "none",
            width: 150,
            height: 84,
            zoom: 1.6,
            cornerBrackets: false,
        },
        grid: { visible: false },
        connections: { topology: "leaders", dash: [], tickMarks: false },
        crosshair: { visible: false },
        motion: { revealDuration: 220, stagger: 40 },
        hud: { visible: false },
    },
    /** Coordinate survey: strong grid, percent coordinates, chained stations. */
    survey: {
        detection: { pointCount: 8, minDistance: 0.14 },
        grid: {
            visible: true,
            style: "lines",
            animation: "scan",
            spacing: 72,
            opacity: 0.3,
            subdivisions: 3,
        },
        crosshair: { visible: true, coordinateStyle: "percent" },
        connections: { topology: "points", pointTopology: "chain", tickMarks: true },
        boxes: { visible: false },
        labels: { template: "{coords}" },
    },
    /** A spatial mesh anchored to detections, nothing else. */
    lattice: {
        detection: { pointCount: 9, minDistance: 0.2, seed: 4271 },
        connections: {
            topology: "points",
            pointTopology: "nearest",
            dash: [],
            lineWidth: 1,
            pointShape: "circle",
            pointSize: 9,
        },
        boxes: { visible: false },
        grid: { visible: true, style: "lines", opacity: 0.12, animation: "drift", spacing: 120 },
        crosshair: { visible: false },
        labels: { visible: false },
        hud: { visible: false },
    },
    /**
     * Structural tracing. The plan's original used marching-squares contours;
     * that code was never delivered, so this preset drives the X-Ray edge
     * pipeline instead and says so here rather than pretending otherwise.
     */
    contour: {
        effect: {
            type: "xray",
            scope: "media",
            xrayInvert: false,
            xrayEdgeStrength: 5,
            xrayGlow: 1,
            xrayPreserveDetail: 0.08,
        },
        detection: { mode: "detail", pointCount: 6 },
        grid: { visible: false },
        boxes: { visible: false },
        connections: { topology: "points", pointTopology: "chain", lineWidth: 1.5, dash: [7, 4] },
        labels: { template: "{score}" },
        hud: { visible: false },
    },
    /** The thinnest possible chrome: quiet lines, tiny type, no ornament. */
    hairline: {
        detection: { seed: 6673 },
        grid: { style: "lines", opacity: 0.06, lineWidth: 1, dash: [], animation: "pulse", pulseStrength: 0.08 },
        connections: { lineWidth: 1, dash: [], tickMarks: false, pointSize: 4, pulse: false },
        boxes: {
            borderWidth: 1,
            cornerBrackets: false,
            scanSweep: false,
            shadow: "none",
            radius: 0,
        },
        labels: { template: "{id}", font: "8px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" },
        crosshair: { lineWidth: 1, radius: 16, opacity: 0.3 },
        hud: { visible: false },
    },
    /** Density mode: a responsive field of many small detections. */
    swarm: {
        detection: { pointCount: 24, minDistance: 0.07, mobilePointLimit: 10, seed: 9931 },
        connections: {
            topology: "points",
            pointTopology: "nearest",
            pointSize: 4,
            pulse: false,
            dash: [1, 3],
        },
        boxes: { visible: false },
        labels: { visible: false },
        motion: { stagger: 24, revealDuration: 260 },
        grid: { visible: false },
        crosshair: { visible: false },
        hud: { visible: false },
    },
    /** Ambient, always-on: the frame breathes even when nobody hovers. */
    field: {
        interaction: { activation: "always" },
        detection: { seed: 2857, pointCount: 4 },
        grid: {
            style: "lines",
            animation: "hybrid",
            spacing: 260,
            driftX: 14,
            driftY: 9,
            pulseStrength: 0.3,
            scanStrength: 0.45,
        },
        connections: { pulse: true, topology: "both", pointTopology: "nearest" },
        boxes: { visible: false },
        labels: { template: "{label}" },
        motion: { pulseDuration: 2200 },
    },
    /** Camera-style framing: reticle, timecode, tracking frames, brackets. */
    viewfinder: {
        boxes: {
            layout: "tracking",
            trackingParallax: 14,
            cornerLength: 18,
            cornerWidth: 2,
            scanSweep: false,
            backgroundColor: "transparent",
        },
        crosshair: {
            visible: true,
            radius: 30,
            showCoordinates: true,
            coordinateStyle: "pixels",
        },
        labels: { template: "REC {time} · {fps}FPS", timeFormat: "timecode" },
        grid: { style: "lines", spacing: 200, opacity: 0.1, subdivisions: 1, animation: "dash" },
        connections: { topology: "leaders", tickMarks: false },
        detection: { pointCount: 3 },
    },
    /** Video-first: stable identities, prediction, motion-tolerant matching. */
    tracking: {
        detection: {
            trackingMode: "stable",
            trackingPrediction: true,
            trackingMaxLostFrames: 6,
            temporalSmoothing: 0.55,
            pointCount: 5,
        },
        boxes: { layout: "tracking", trackingScale: 0.9 },
        connections: { topology: "points", pointTopology: "chain", dash: [4, 4] },
        labels: { template: "{id} {score}" },
        interaction: { autoRescanInterval: 1200, activation: "always" },
    },
}

export const resolveGridPulsePreset = (
    preset: GridPulseScanPreset | undefined
): GridPulsePresetBundle => (preset ? BUNDLES[preset] ?? {} : {})
