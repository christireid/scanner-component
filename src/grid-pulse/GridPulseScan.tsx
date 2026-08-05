import {
    CSSProperties,
    KeyboardEvent,
    PointerEvent as ReactPointerEvent,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react"
import { buildGridPulseConnectionPairs } from "./GridPulseConnectionTopology"
import { analyzeAdaptiveChromeRegion, resolveAdaptiveChromeStyle } from "./AdaptiveChromePolicy"
import { StableTargetTracker } from "./TargetTrackingPolicy"
import {
    adaptiveChromeZoneIndex,
    averageRgba,
    buildAdaptiveChromeZonePalette,
    chooseAdaptiveChrome,
    rgbaForChromeBackground,
} from "./AdaptiveChrome"
import {
    layoutGridPulseBoxes,
    layoutGridPulseTrackingFrames,
    nearestPointOnGridPulseBox,
} from "./GridPulseGeometry"
import {
    resolveGridPulseBatchStart,
    resolveGridPulseRevealProgress,
} from "./ReducedMotionPolicy"
import { resolveGridPulseGridAnimation } from "./GridAnimationPolicy"
import { resolveGridPulseConnectionAnimation } from "./ConnectionAnimationPolicy"
import { resolveGridPulseBoxAnimation } from "./ScanBoxAnimationPolicy"
import { resolveGridPulseCrosshairMotion } from "./CrosshairMotionPolicy"
import { resolveGridPulseInteractionAlpha } from "./InteractionTransitionPolicy"
import { resolveGridPulseRescanTransition } from "./RescanTransitionPolicy"
import { resolveGridPulseXraySample } from "./XrayEffectPolicy"
import { parseBoxShadow } from "./BoxShadowPolicy"
import { resolveGridPulsePreset } from "./GridPulsePresets"
import { resolveGridPulseThermalSample } from "./ThermalEffectPolicy"
import { diffuseToPalette, resolveBitmapPalette } from "./DitherPalettePolicy"
import { quantizeChannel, resolvePixelatedGrid } from "./PixelatedEffectPolicy"
import { resolveCodeGlyph, resolveCodeGrid, resolveCodeSignal } from "./CodeEffectPolicy"
import { resolveBitmapGrid, bitmapThresholdAt, quantizeBitmapLevel } from "./BitmapEffectPolicy"
import { resolveScanSweepState } from "./ScanSweepPolicy"
import {
    calculateGridPulseSkinScore,
    scoreGridPulseDetectionField,
    selectGridPulseDetectionPoints,
} from "./DetectionFieldPolicy"
import { resolveGridPulseTouchBehavior } from "./TouchInteractionPolicy"
export * from "./GridPulseOptionTypes"
export {
    GRID_PULSE_SCAN_DEFAULTS,
} from "./GridPulseDefaults"
import type {
    GridPulseAspectRatio,
    GridPulseBoxOptions,
    GridPulseConnectionOptions,
    GridPulseCrosshairOptions,
    GridPulseDetectionMode,
    GridPulseDetectionOptions,
    GridPulseEffectOptions,
    GridPulseFrameBox,
    GridPulseFrameListener,
    GridPulseFramePoint,
    GridPulseFrameSnapshot,
    GridPulseGridOptions,
    GridPulseLabelOptions,
    GridPulseMediaOptions,
    GridPulseMediaType,
    GridPulseMotionOptions,
    GridPulsePoint,
    GridPulseRenderBridge,
    GridPulseScanProps,
    GridPulseThemeOptions,
} from "./GridPulseOptionTypes"
import {
    DEFAULT_BOXES,
    DEFAULT_CONNECTIONS,
    DEFAULT_CROSSHAIR,
    DEFAULT_DETECTION,
    DEFAULT_EFFECT,
    DEFAULT_GRID,
    DEFAULT_INTERACTION,
    DEFAULT_LABELS,
    DEFAULT_MEDIA,
    DEFAULT_MOTION,
    DEFAULT_RENDERING,
    DEFAULT_THEME,
} from "./GridPulseDefaults"
import {
    fillGridPulseLabelTemplate,
    resolveGridPulseLabelCoordinateStyle,
} from "./LabelTokenPolicy"
type PixelPoint = GridPulsePoint & {
    px: number
    py: number
    score: number
    id: string
    revealedAt: number
}

type ScanBox = GridPulseFrameBox

type Size = { width: number; height: number; dpr: number }
type Rgb = { r: number; g: number; b: number }
type AdaptiveChromePalette = {
    globalColor: string
    globalKind: "light" | "dark"
    pointColors: string[]
    pointKinds: Array<"light" | "dark">
    zoneColumns: number
    zoneRows: number
    zoneColors: string[]
    zoneKinds: Array<"light" | "dark">
    pointOpacityMultipliers: number[]
    pointLabelBackgroundOpacities: number[]
    pointGlowStrengths: number[]
    zoneOpacityMultipliers: number[]
}
type GridPulseVideoElement = HTMLVideoElement & {
    requestVideoFrameCallback?: (callback: (now: number, metadata: unknown) => void) => number
    cancelVideoFrameCallback?: (handle: number) => void
}

type GridPulseDetectedFace = {
    boundingBox: DOMRectReadOnly
}

type GridPulseNativeFaceDetector = {
    detect: (source: CanvasImageSource) => Promise<GridPulseDetectedFace[]>
}

type GridPulseNativeFaceDetectorConstructor = new (options?: {
    fastMode?: boolean
    maxDetectedFaces?: number
}) => GridPulseNativeFaceDetector

const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value))

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

const createCanvas = (width = 1, height = 1) => {
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, Math.round(width))
    canvas.height = Math.max(1, Math.round(height))
    return canvas
}

const resizeCanvas = (canvas: HTMLCanvasElement, width: number, height: number) => {
    const w = Math.max(1, Math.round(width))
    const h = Math.max(1, Math.round(height))
    if (canvas.width !== w) canvas.width = w
    if (canvas.height !== h) canvas.height = h
}

const parseColor = (color: string): Rgb => {
    if (typeof document === "undefined") return { r: 255, g: 255, b: 255 }
    const canvas = parseColor.canvas || (parseColor.canvas = createCanvas())
    const ctx = canvas.getContext("2d")
    if (!ctx) return { r: 255, g: 255, b: 255 }
    ctx.fillStyle = "#ffffff"
    ctx.fillStyle = color
    const normalized = ctx.fillStyle
    if (normalized.startsWith("#")) {
        const hex = normalized.slice(1)
        if (hex.length === 3) {
            return {
                r: parseInt(hex[0] + hex[0], 16),
                g: parseInt(hex[1] + hex[1], 16),
                b: parseInt(hex[2] + hex[2], 16),
            }
        }
        if (hex.length >= 6) {
            return {
                r: parseInt(hex.slice(0, 2), 16),
                g: parseInt(hex.slice(2, 4), 16),
                b: parseInt(hex.slice(4, 6), 16),
            }
        }
    }
    const match = normalized.match(/[\d.]+/g)
    return match
        ? { r: Number(match[0]), g: Number(match[1]), b: Number(match[2]) }
        : { r: 255, g: 255, b: 255 }
}
parseColor.canvas = undefined as HTMLCanvasElement | undefined

const sampleCanvasColor = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number
): Rgb => {
    const safeRadius = Math.max(1, Math.round(radius))
    const left = clamp(Math.round(x) - safeRadius, 0, Math.max(0, ctx.canvas.width - 1))
    const top = clamp(Math.round(y) - safeRadius, 0, Math.max(0, ctx.canvas.height - 1))
    const width = Math.max(1, Math.min(safeRadius * 2 + 1, ctx.canvas.width - left))
    const height = Math.max(1, Math.min(safeRadius * 2 + 1, ctx.canvas.height - top))
    return averageRgba(ctx.getImageData(left, top, width, height).data)
}

const sampleCanvasRegion = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number
) => {
    const safeRadius = Math.max(1, Math.round(radius))
    const left = clamp(Math.round(x) - safeRadius, 0, Math.max(0, ctx.canvas.width - 1))
    const top = clamp(Math.round(y) - safeRadius, 0, Math.max(0, ctx.canvas.height - 1))
    const width = Math.max(1, Math.min(safeRadius * 2 + 1, ctx.canvas.width - left))
    const height = Math.max(1, Math.min(safeRadius * 2 + 1, ctx.canvas.height - top))
    const data = ctx.getImageData(left, top, width, height).data
    return { color: averageRgba(data), stats: analyzeAdaptiveChromeRegion(data, width, height) }
}

const buildAdaptiveChromePalette = (
    globalCtx: CanvasRenderingContext2D,
    pointCtx: CanvasRenderingContext2D,
    width: number,
    height: number,
    points: PixelPoint[],
    theme: GridPulseThemeOptions
): AdaptiveChromePalette => {
    const light = parseColor(theme.chromeLight)
    const dark = parseColor(theme.chromeDark)
    const radius = Math.max(1, theme.chromeSampleRadius)
    const zoneColumns = Math.max(1, Math.min(6, Math.round(theme.chromeZoneColumns)))
    const zoneRows = Math.max(1, Math.min(6, Math.round(theme.chromeZoneRows)))
    const globalSamples: Rgb[] = []
    for (let row = 0; row < zoneRows; row += 1) {
        for (let column = 0; column < zoneColumns; column += 1) {
            globalSamples.push(
                sampleCanvasColor(
                    globalCtx,
                    ((column + 0.5) / zoneColumns) * width,
                    ((row + 0.5) / zoneRows) * height,
                    radius
                )
            )
        }
    }
    const zonePalette = buildAdaptiveChromeZonePalette(
        globalSamples,
        zoneColumns,
        zoneRows,
        light,
        dark,
        theme.chromeMinContrast
    )
    const global = globalSamples.reduce(
        (total, color) => ({ r: total.r + color.r, g: total.g + color.g, b: total.b + color.b }),
        { r: 0, g: 0, b: 0 }
    )
    const globalBackground = {
        r: global.r / globalSamples.length,
        g: global.g / globalSamples.length,
        b: global.b / globalSamples.length,
    }
    const globalDecision = chooseAdaptiveChrome(
        globalBackground,
        light,
        dark,
        theme.chromeMinContrast
    )
    const pointRegions = points.map(point =>
        sampleCanvasRegion(pointCtx, point.px, point.py, radius)
    )
    const pointDecisions = pointRegions.map(region =>
        chooseAdaptiveChrome(region.color, light, dark, theme.chromeMinContrast)
    )
    const pointStyles = pointRegions.map((region, index) =>
        theme.adaptiveChromeElements
            ? resolveAdaptiveChromeStyle(
                  region.stats,
                  pointDecisions[index].contrast,
                  theme.chromeMinContrast,
                  theme.chromeContrastCompensation,
                  theme.chromeBusySimplification,
                  theme.chromeAdaptiveGlow
              )
            : { opacityMultiplier: 1, labelBackgroundOpacity: 0.62, glowStrength: 0, simplify: 0 }
    )
    const zoneStyles = globalSamples.map((_color, index) => {
        const decision = zonePalette.decisions[index]
        const stats = sampleCanvasRegion(
            globalCtx,
            ((index % zoneColumns) + 0.5) / zoneColumns * width,
            (Math.floor(index / zoneColumns) + 0.5) / zoneRows * height,
            radius
        ).stats
        return theme.adaptiveChromeElements
            ? resolveAdaptiveChromeStyle(
                  stats,
                  decision.contrast,
                  theme.chromeMinContrast,
                  theme.chromeContrastCompensation,
                  theme.chromeBusySimplification,
                  theme.chromeAdaptiveGlow
              )
            : { opacityMultiplier: 1, labelBackgroundOpacity: 0.62, glowStrength: 0, simplify: 0 }
    })
    return {
        globalColor: globalDecision.color === "light" ? theme.chromeLight : theme.chromeDark,
        globalKind: globalDecision.color,
        pointColors: pointDecisions.map(decision =>
            decision.color === "light" ? theme.chromeLight : theme.chromeDark
        ),
        pointKinds: pointDecisions.map(decision => decision.color),
        zoneColumns: zonePalette.columns,
        zoneRows: zonePalette.rows,
        zoneColors: zonePalette.decisions.map(decision =>
            decision.color === "light" ? theme.chromeLight : theme.chromeDark
        ),
        zoneKinds: zonePalette.decisions.map(decision => decision.color),
        pointOpacityMultipliers: pointStyles.map(style => style.opacityMultiplier),
        pointLabelBackgroundOpacities: pointStyles.map(style => style.labelBackgroundOpacity),
        pointGlowStrengths: pointStyles.map(style => style.glowStrength),
        zoneOpacityMultipliers: zoneStyles.map(style => style.opacityMultiplier),
    }
}

/**
 * Single entry point for box placement so the overlay renderer and the frame
 * snapshot published on the render bridge can never disagree about geometry.
 */
const resolveGridPulseBoxLayout = (
    points: readonly PixelPoint[],
    width: number,
    height: number,
    options: GridPulseBoxOptions,
    compact: boolean,
    parallax: { x: number; y: number }
): ScanBox[] => {
    if (options.layout !== "tracking") {
        return layoutGridPulseBoxes(points, width, height, options, compact)
    }
    return layoutGridPulseTrackingFrames(points, width, height, {
        compact,
        scale: Math.max(0.1, options.trackingScale),
        safeTop: Math.max(0, options.trackingSafeTop),
        safeBottom: Math.max(0, options.trackingSafeBottom),
        padding: Math.max(0, options.padding),
        minGap: Math.max(0, options.trackingMinGap),
        parallaxX: parallax.x,
        parallaxY: parallax.y,
    })
}

const aspectRatioValue = (ratio: GridPulseAspectRatio | undefined) => {
    if (!ratio || ratio === "free") return undefined
    const [w, h] = ratio.split(":").map(Number)
    return `${w} / ${h}`
}

const inferMediaType = (src: string, type: GridPulseMediaType): "image" | "video" => {
    if (type !== "auto") return type
    const clean = src.split(/[?#]/)[0].toLowerCase()
    return /\.(mp4|webm|ogv|mov|m4v|m3u8)$/.test(clean) ? "video" : "image"
}

const formatCoordinate = (
    x: number,
    y: number,
    width: number,
    height: number,
    style: GridPulseCrosshairOptions["coordinateStyle"]
) => {
    if (style === "pixels") return `${Math.round(x)} X · ${Math.round(y)} Y`
    if (style === "percent") {
        return `${((x / Math.max(1, width)) * 100).toFixed(2)} X · ${(
            (y / Math.max(1, height)) * 100
        ).toFixed(2)} Y`
    }
    const lon = (x / Math.max(1, width)) * 360 - 180
    const lat = 90 - (y / Math.max(1, height)) * 180
    const latDir = lat >= 0 ? "N" : "S"
    const lonDir = lon >= 0 ? "E" : "W"
    return `${Math.abs(lat).toFixed(4)}° ${latDir} · ${Math.abs(lon).toFixed(4)}° ${lonDir}`
}

const roundedRectPath = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
) => {
    const r = clamp(radius, 0, Math.min(width, height) / 2)
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + width - r, y)
    ctx.quadraticCurveTo(x + width, y, x + width, y + r)
    ctx.lineTo(x + width, y + height - r)
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
    ctx.lineTo(x + r, y + height)
    ctx.quadraticCurveTo(x, y + height, x, y + height - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
}

const applyBitmap = (
    source: HTMLCanvasElement,
    target: HTMLCanvasElement,
    options: GridPulseEffectOptions
) => {
    const targetCtx = target.getContext("2d")
    if (!targetCtx) return
    const grid = resolveBitmapGrid({
        width: source.width,
        height: source.height,
        scale: options.bitmapScale,
        anchor: options.bitmapAnchor,
    })
    const sample = createCanvas(grid.columns, grid.rows)
    const sampleCtx = sample.getContext("2d", { willReadFrequently: true })
    if (!sampleCtx) return
    sampleCtx.drawImage(source, 0, 0, grid.columns, grid.rows)
    const image = sampleCtx.getImageData(0, 0, grid.columns, grid.rows)
    const data = image.data
    const tint = parseColor(options.tint)
    const background = parseColor(options.background)
    targetCtx.clearRect(0, 0, target.width, target.height)
    targetCtx.fillStyle = options.background
    targetCtx.fillRect(0, 0, target.width, target.height)
    const cell = grid.cellSize

    if (options.bitmapMethod === "diffusion") {
        // Floyd–Steinberg error diffusion onto the selected palette. The
        // diffusion buffer is gamma-adjusted RGB so the palette match sees the
        // same tone curve as the other bitmap methods.
        const palette = resolveBitmapPalette(options.bitmapPalette, tint, background)
        const rgb = new Float32Array(grid.columns * grid.rows * 3)
        const gamma = Math.max(0.05, options.bitmapGamma)
        for (let cellIndex = 0; cellIndex < grid.columns * grid.rows; cellIndex += 1) {
            const sourceIndex = cellIndex * 4
            const targetIndex = cellIndex * 3
            rgb[targetIndex] = Math.pow(clamp(data[sourceIndex] / 255, 0, 1), gamma) * 255
            rgb[targetIndex + 1] = Math.pow(clamp(data[sourceIndex + 1] / 255, 0, 1), gamma) * 255
            rgb[targetIndex + 2] = Math.pow(clamp(data[sourceIndex + 2] / 255, 0, 1), gamma) * 255
        }
        const indices = diffuseToPalette(rgb, grid.columns, grid.rows, palette)
        for (let y = 0; y < grid.rows; y += 1) {
            for (let x = 0; x < grid.columns; x += 1) {
                const chosen = palette[indices[y * grid.columns + x]]
                targetCtx.fillStyle = `rgb(${Math.round(chosen.r)},${Math.round(chosen.g)},${Math.round(chosen.b)})`
                if (options.bitmapDotShape === "circle") {
                    targetCtx.beginPath()
                    targetCtx.arc(grid.offsetX + x * cell + cell / 2, grid.offsetY + y * cell + cell / 2, cell * 0.5, 0, Math.PI * 2)
                    targetCtx.fill()
                } else {
                    targetCtx.fillRect(grid.offsetX + x * cell, grid.offsetY + y * cell, cell, cell)
                }
            }
        }
        return
    }

    // Ordered and threshold methods honour a named palette by quantizing the
    // dithered level onto it; the default "none" palette preserves the
    // original tint-on-background behaviour exactly.
    const namedPalette = options.bitmapPalette !== "none"
        ? resolveBitmapPalette(options.bitmapPalette, tint, background)
        : null
    for (let y = 0; y < grid.rows; y++) {
        for (let x = 0; x < grid.columns; x++) {
            const i = (y * grid.columns + x) * 4
            const raw = (data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722) / 255
            const luminance = Math.pow(clamp(raw, 0, 1), Math.max(0.05, options.bitmapGamma))
            let level = 0
            if (options.bitmapMethod === "threshold") {
                level = luminance >= options.bitmapThreshold ? 1 : 0
            } else if (options.bitmapMethod === "ordered") {
                level = luminance >= bitmapThresholdAt(options.bitmapMatrix, x, y, options.bitmapThreshold, options.intensity) ? 1 : 0
            } else {
                level = quantizeBitmapLevel(luminance, options.bitmapLevels)
            }
            if (namedPalette) {
                const paletteIndex = Math.min(
                    namedPalette.length - 1,
                    Math.round(level * (namedPalette.length - 1))
                )
                const chosen = namedPalette[paletteIndex]
                const px = grid.offsetX + x * cell
                const py = grid.offsetY + y * cell
                targetCtx.fillStyle = `rgb(${Math.round(chosen.r)},${Math.round(chosen.g)},${Math.round(chosen.b)})`
                if (options.bitmapDotShape === "circle" || options.bitmapMethod === "halftone") {
                    targetCtx.beginPath()
                    targetCtx.arc(px + cell / 2, py + cell / 2, Math.max(0.5, cell * 0.5 * Math.max(level, 0.35)), 0, Math.PI * 2)
                    targetCtx.fill()
                } else {
                    targetCtx.fillRect(px, py, cell, cell)
                }
                continue
            }
            if (level <= 0) continue
            const px = grid.offsetX + x * cell
            const py = grid.offsetY + y * cell
            const radius = options.bitmapMethod === "halftone" ? Math.max(0.5, cell * 0.5 * level) : cell * 0.5
            targetCtx.fillStyle = `rgba(${Math.round(background.r + (tint.r - background.r) * level)},${Math.round(background.g + (tint.g - background.g) * level)},${Math.round(background.b + (tint.b - background.b) * level)},1)`
            if (options.bitmapDotShape === "circle" || options.bitmapMethod === "halftone") {
                targetCtx.beginPath()
                targetCtx.arc(px + cell / 2, py + cell / 2, radius, 0, Math.PI * 2)
                targetCtx.fill()
            } else {
                targetCtx.fillRect(px, py, cell, cell)
            }
        }
    }
}

const applyPixelated = (
    source: HTMLCanvasElement,
    target: HTMLCanvasElement,
    options: GridPulseEffectOptions
) => {
    const targetCtx = target.getContext("2d")
    if (!targetCtx) return
    const geometry = resolvePixelatedGrid({
        width: source.width,
        height: source.height,
        cellSize: options.pixelSize,
        gap: options.pixelGap,
        anchor: options.pixelAnchor,
    })
    const sample = createCanvas(geometry.columns, geometry.rows)
    const sampleCtx = sample.getContext("2d", { willReadFrequently: true })
    if (!sampleCtx) return

    sampleCtx.imageSmoothingEnabled = options.pixelSampling === "average"
    if (options.pixelSampling === "average") {
        sampleCtx.drawImage(source, 0, 0, geometry.columns, geometry.rows)
    } else {
        const sourceCtx = source.getContext("2d", { willReadFrequently: true })
        if (!sourceCtx) return
        const sourceData = sourceCtx.getImageData(0, 0, source.width, source.height).data
        const image = sampleCtx.createImageData(geometry.columns, geometry.rows)
        for (let row = 0; row < geometry.rows; row += 1) {
            for (let column = 0; column < geometry.columns; column += 1) {
                const sx = Math.min(source.width - 1, Math.max(0, Math.floor(geometry.offsetX + column * geometry.cellSize + geometry.cellSize / 2)))
                const sy = Math.min(source.height - 1, Math.max(0, Math.floor(geometry.offsetY + row * geometry.cellSize + geometry.cellSize / 2)))
                const sourceIndex = (sy * source.width + sx) * 4
                const targetIndex = (row * geometry.columns + column) * 4
                image.data[targetIndex] = sourceData[sourceIndex]
                image.data[targetIndex + 1] = sourceData[sourceIndex + 1]
                image.data[targetIndex + 2] = sourceData[sourceIndex + 2]
                image.data[targetIndex + 3] = sourceData[sourceIndex + 3]
            }
        }
        sampleCtx.putImageData(image, 0, 0)
    }

    const sampled = sampleCtx.getImageData(0, 0, geometry.columns, geometry.rows).data
    targetCtx.clearRect(0, 0, target.width, target.height)
    const visibleSize = Math.max(1, geometry.cellSize - geometry.gap)
    const radius = Math.max(0, Math.min(visibleSize / 2, visibleSize * clamp(options.pixelRadius, 0, 0.5)))

    for (let row = 0; row < geometry.rows; row += 1) {
        for (let column = 0; column < geometry.columns; column += 1) {
            const index = (row * geometry.columns + column) * 4
            const r = quantizeChannel(sampled[index], options.pixelLevels)
            const g = quantizeChannel(sampled[index + 1], options.pixelLevels)
            const b = quantizeChannel(sampled[index + 2], options.pixelLevels)
            const a = sampled[index + 3] / 255
            const x = geometry.offsetX + column * geometry.cellSize + geometry.gap / 2
            const y = geometry.offsetY + row * geometry.cellSize + geometry.gap / 2
            targetCtx.fillStyle = `rgba(${r},${g},${b},${a})`
            if (options.pixelShape === "rounded" && radius > 0) {
                targetCtx.beginPath()
                targetCtx.roundRect(x, y, visibleSize, visibleSize, radius)
                targetCtx.fill()
            } else {
                targetCtx.fillRect(x, y, visibleSize, visibleSize)
            }
        }
    }
}
const applyCode = (
    source: HTMLCanvasElement,
    target: HTMLCanvasElement,
    options: GridPulseEffectOptions
) => {
    const geometry = resolveCodeGrid(
        source.width,
        source.height,
        options.codeCellSize,
        options.codeAnchor
    )
    const sample = createCanvas(geometry.columns, geometry.rows)
    const sampleCtx = sample.getContext("2d", { willReadFrequently: true })
    const targetCtx = target.getContext("2d")
    if (!sampleCtx || !targetCtx) return

    sampleCtx.imageSmoothingEnabled = options.codeSampling === "average"
    sampleCtx.imageSmoothingQuality = "high"
    sampleCtx.drawImage(source, 0, 0, geometry.columns, geometry.rows)
    const data = sampleCtx.getImageData(0, 0, geometry.columns, geometry.rows).data
    const luminance = new Float32Array(geometry.columns * geometry.rows)
    for (let index = 0; index < luminance.length; index += 1) {
        const sourceIndex = index * 4
        luminance[index] =
            (data[sourceIndex] * 0.2126 +
                data[sourceIndex + 1] * 0.7152 +
                data[sourceIndex + 2] * 0.0722) /
            255
    }

    targetCtx.clearRect(0, 0, target.width, target.height)
    targetCtx.save()
    targetCtx.globalAlpha = clamp(options.codeBackgroundOpacity * options.intensity, 0, 1)
    targetCtx.fillStyle = options.background
    targetCtx.fillRect(0, 0, target.width, target.height)
    targetCtx.restore()
    targetCtx.font = `${Math.max(5, Math.round(geometry.cellSize * 0.82))}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`
    targetCtx.textAlign = "center"
    targetCtx.textBaseline = "middle"

    for (let row = 0; row < geometry.rows; row += 1) {
        for (let column = 0; column < geometry.columns; column += 1) {
            const cellIndex = row * geometry.columns + column
            const pixelIndex = cellIndex * 4
            const left = column > 0 ? luminance[cellIndex - 1] : luminance[cellIndex]
            const right =
                column + 1 < geometry.columns ? luminance[cellIndex + 1] : luminance[cellIndex]
            const top = row > 0 ? luminance[cellIndex - geometry.columns] : luminance[cellIndex]
            const bottom =
                row + 1 < geometry.rows
                    ? luminance[cellIndex + geometry.columns]
                    : luminance[cellIndex]
            const edge = clamp(Math.hypot(right - left, bottom - top) * 1.8, 0, 1)
            const signal = resolveCodeSignal(
                luminance[cellIndex],
                edge,
                options.codeEdgeWeight,
                options.codeGamma
            )
            const glyph = resolveCodeGlyph(signal, options.codeCharacters, options.codeThreshold)
            if (!glyph) continue

            if (options.codeColorMode === "source") {
                targetCtx.fillStyle = `rgb(${data[pixelIndex]},${data[pixelIndex + 1]},${data[pixelIndex + 2]})`
            } else if (options.codeColorMode === "luminance") {
                const value = Math.round(signal * 255)
                targetCtx.fillStyle = `rgb(${value},${value},${value})`
            } else {
                targetCtx.fillStyle = options.tint
            }
            targetCtx.globalAlpha = clamp(
                (0.16 + signal * 0.84) * options.codeOpacity * options.intensity,
                0,
                1
            )
            targetCtx.fillText(
                glyph,
                geometry.offsetX + (column + 0.5) * geometry.cellSize,
                geometry.offsetY + (row + 0.5) * geometry.cellSize
            )
        }
    }
    targetCtx.globalAlpha = 1
}

const applyXray = (
    source: HTMLCanvasElement,
    target: HTMLCanvasElement,
    options: GridPulseEffectOptions
) => {
    const targetCtx = target.getContext("2d", { willReadFrequently: true })
    if (!targetCtx) return
    targetCtx.clearRect(0, 0, target.width, target.height)
    targetCtx.drawImage(source, 0, 0, target.width, target.height)
    const image = targetCtx.getImageData(0, 0, target.width, target.height)
    const data = image.data
    const width = image.width
    const height = image.height
    const luminance = new Float32Array(width * height)
    for (let pixel = 0, i = 0; pixel < luminance.length; pixel += 1, i += 4) {
        luminance[pixel] =
            (data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722) / 255
    }
    const tint = parseColor(options.tint)
    const mix = clamp(options.intensity, 0, 1)
    for (let y = 0; y < height; y += 1) {
        const up = Math.max(0, y - 1)
        const down = Math.min(height - 1, y + 1)
        for (let x = 0; x < width; x += 1) {
            const left = Math.max(0, x - 1)
            const right = Math.min(width - 1, x + 1)
            const pixel = y * width + x
            const i = pixel * 4
            const gx = luminance[y * width + right] - luminance[y * width + left]
            const gy = luminance[down * width + x] - luminance[up * width + x]
            const edgeMagnitude = Math.sqrt(gx * gx + gy * gy)
            const value = resolveGridPulseXraySample({
                luminance: luminance[pixel],
                edgeMagnitude,
                invert: options.xrayInvert,
                contrast: options.xrayContrast,
                brightness: options.xrayBrightness,
                edgeStrength: options.xrayEdgeStrength,
                edgeThreshold: options.xrayEdgeThreshold,
                glow: options.xrayGlow,
                preserveDetail: options.xrayPreserveDetail,
            })
            data[i] = lerp(data[i], tint.r * value, mix)
            data[i + 1] = lerp(data[i + 1], tint.g * value, mix)
            data[i + 2] = lerp(data[i + 2], tint.b * value, mix)
        }
    }
    targetCtx.putImageData(image, 0, 0)
}

const applyThermal = (
    source: HTMLCanvasElement,
    target: HTMLCanvasElement,
    options: GridPulseEffectOptions
) => {
    const targetCtx = target.getContext("2d", { willReadFrequently: true })
    if (!targetCtx) return
    targetCtx.clearRect(0, 0, target.width, target.height)
    targetCtx.drawImage(source, 0, 0, target.width, target.height)
    const image = targetCtx.getImageData(0, 0, target.width, target.height)
    const data = image.data
    const mix = clamp(options.intensity, 0, 1)
    for (let i = 0; i < data.length; i += 4) {
        const luminance =
            (data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722) / 255
        const sample = resolveGridPulseThermalSample({
            luminance,
            palette: options.thermalPalette,
            contrast: options.thermalContrast,
            brightness: options.thermalBrightness,
            gamma: options.thermalGamma,
        })
        data[i] = lerp(data[i], sample.r, mix)
        data[i + 1] = lerp(data[i + 1], sample.g, mix)
        data[i + 2] = lerp(data[i + 2], sample.b, mix)
    }
    targetCtx.putImageData(image, 0, 0)
}

const applyEffect = (
    source: HTMLCanvasElement,
    target: HTMLCanvasElement,
    options: GridPulseEffectOptions
) => {
    resizeCanvas(target, source.width, source.height)
    const ctx = target.getContext("2d")
    if (!ctx) return
    if (options.type === "none") {
        ctx.clearRect(0, 0, target.width, target.height)
        ctx.drawImage(source, 0, 0)
        return
    }
    if (options.type === "bitmap") applyBitmap(source, target, options)
    else if (options.type === "pixelated") applyPixelated(source, target, options)
    else if (options.type === "code") applyCode(source, target, options)
    else if (options.type === "thermal") applyThermal(source, target, options)
    else applyXray(source, target, options)
}

const drawMediaToCanvas = (
    ctx: CanvasRenderingContext2D,
    source: CanvasImageSource,
    sourceWidth: number,
    sourceHeight: number,
    width: number,
    height: number,
    media: GridPulseMediaOptions
) => {
    ctx.clearRect(0, 0, width, height)
    const fit = media.objectFit
    if (fit === "fill") {
        ctx.save()
        if (media.mirror) {
            ctx.translate(width, 0)
            ctx.scale(-1, 1)
        }
        ctx.drawImage(source, 0, 0, width, height)
        ctx.restore()
        return
    }
    const scale =
        fit === "contain"
            ? Math.min(width / sourceWidth, height / sourceHeight)
            : Math.max(width / sourceWidth, height / sourceHeight)
    const drawWidth = sourceWidth * scale
    const drawHeight = sourceHeight * scale
    const x = (width - drawWidth) * clamp(media.positionX, 0, 1)
    const y = (height - drawHeight) * clamp(media.positionY, 0, 1)
    ctx.save()
    if (media.mirror) {
        ctx.translate(width, 0)
        ctx.scale(-1, 1)
        ctx.drawImage(source, width - x - drawWidth, y, drawWidth, drawHeight)
    } else {
        ctx.drawImage(source, x, y, drawWidth, drawHeight)
    }
    ctx.restore()
}

const drawGridEnergyBand = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    frame: ReturnType<typeof resolveGridPulseGridAnimation>,
    drawLines: () => void
) => {
    if (frame.scanStrength <= 0 || frame.scanWidth <= 0) return
    ctx.save()
    const bandWidth = Math.max(1, frame.scanWidth)
    if (frame.scanDirection === "horizontal") {
        ctx.beginPath()
        ctx.rect(0, frame.scanPosition - bandWidth / 2, width, bandWidth)
        ctx.clip()
    } else if (frame.scanDirection === "vertical") {
        ctx.beginPath()
        ctx.rect(frame.scanPosition - bandWidth / 2, 0, bandWidth, height)
        ctx.clip()
    } else {
        const travel = width + height
        const position = frame.scanPosition
        ctx.translate(position - travel / 2, height / 2)
        ctx.rotate(-Math.PI / 4)
        ctx.beginPath()
        ctx.rect(-bandWidth / 2, -travel, bandWidth, travel * 2)
        ctx.clip()
        ctx.rotate(Math.PI / 4)
        ctx.translate(-(position - travel / 2), -height / 2)
    }
    ctx.globalAlpha *= frame.scanStrength
    drawLines()
    ctx.restore()
}

const drawGrid = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    options: GridPulseGridOptions,
    alpha: number,
    now: number,
    reducedMotion: boolean
) => {
    if (!options.visible || alpha <= 0) return
    const spacing = Math.max(20, options.spacing)
    const frame = resolveGridPulseGridAnimation({
        now,
        width,
        height,
        spacing,
        reducedMotion,
        animate: options.animate,
        animation: options.animation,
        speed: options.speed,
        driftX: options.driftX,
        driftY: options.driftY,
        pulseStrength: options.pulseStrength,
        scanWidth: options.scanWidth,
        scanStrength: options.scanStrength,
        scanDirection: options.scanDirection,
        dash: options.dash,
    })
    const drawLines = (subdivision = false) => {
        const step = subdivision ? spacing / Math.max(1, options.subdivisions) : spacing
        const offsetX = frame.offsetX % step
        const offsetY = frame.offsetY % step
        let index = 0
        for (let x = -step + offsetX; x < width + step; x += step, index += 1) {
            if (subdivision && index % Math.max(1, options.subdivisions) === 0) continue
            ctx.beginPath()
            ctx.moveTo(Math.round(x) + 0.5, 0)
            ctx.lineTo(Math.round(x) + 0.5, height)
            ctx.stroke()
        }
        index = 0
        for (let y = -step + offsetY; y < height + step; y += step, index += 1) {
            if (subdivision && index % Math.max(1, options.subdivisions) === 0) continue
            ctx.beginPath()
            ctx.moveTo(0, Math.round(y) + 0.5)
            ctx.lineTo(width, Math.round(y) + 0.5)
            ctx.stroke()
        }
    }
    const drawCompleteGrid = () => {
        ctx.setLineDash(options.dash)
        ctx.lineDashOffset = frame.dashOffset
        drawLines(false)
        if (options.subdivisions > 1) {
            const previousAlpha = ctx.globalAlpha
            ctx.globalAlpha *= 0.52
            ctx.setLineDash([1, Math.max(8, spacing / 3)])
            drawLines(true)
            ctx.globalAlpha = previousAlpha
        }
    }
    ctx.save()
    ctx.strokeStyle = options.color
    ctx.globalAlpha = clamp(options.opacity * alpha * frame.opacityMultiplier, 0, 1)
    ctx.lineWidth = options.lineWidth
    drawCompleteGrid()
    drawGridEnergyBand(ctx, width, height, frame, drawCompleteGrid)
    ctx.restore()
}


type AdaptiveChromeZones = Pick<
    AdaptiveChromePalette,
    "zoneColumns" | "zoneRows" | "zoneColors" | "zoneKinds"
>

type AdaptiveChromeHalo = {
    enabled: boolean
    width: number
    opacity: number
    light: string
    dark: string
}

const oppositeChromeColor = (
    kind: "light" | "dark",
    halo: AdaptiveChromeHalo
) => kind === "light" ? halo.dark : halo.light

const zoneChromeColor = (
    palette: AdaptiveChromeZones,
    column: number,
    row: number,
    fallback: string
) => {
    const columns = Math.max(1, palette.zoneColumns)
    const rows = Math.max(1, palette.zoneRows)
    const safeColumn = Math.max(0, Math.min(columns - 1, column))
    const safeRow = Math.max(0, Math.min(rows - 1, row))
    return palette.zoneColors[safeRow * columns + safeColumn] || fallback
}

const zoneChromeKind = (
    palette: AdaptiveChromeZones,
    column: number,
    row: number,
    fallback: "light" | "dark" = "light"
) => {
    const columns = Math.max(1, palette.zoneColumns)
    const rows = Math.max(1, palette.zoneRows)
    const safeColumn = Math.max(0, Math.min(columns - 1, column))
    const safeRow = Math.max(0, Math.min(rows - 1, row))
    return palette.zoneKinds[safeRow * columns + safeColumn] || fallback
}

const addRegionalGradientStops = (
    gradient: CanvasGradient,
    count: number,
    colorAt: (index: number) => string
) => {
    const safeCount = Math.max(1, count)
    for (let index = 0; index < safeCount; index += 1) {
        const start = index / safeCount
        const end = (index + 1) / safeCount
        const color = colorAt(index)
        gradient.addColorStop(start, color)
        gradient.addColorStop(Math.max(start, end - 0.0001), color)
    }
}

const drawGridWithChromeZones = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    options: GridPulseGridOptions,
    alpha: number,
    now: number,
    reducedMotion: boolean,
    palette: AdaptiveChromeZones,
    halo?: AdaptiveChromeHalo
) => {
    if (!options.visible || alpha <= 0) return
    const spacing = Math.max(20, options.spacing)
    const frame = resolveGridPulseGridAnimation({
        now, width, height, spacing, reducedMotion, animate: options.animate,
        animation: options.animation, speed: options.speed, driftX: options.driftX, driftY: options.driftY,
        pulseStrength: options.pulseStrength, scanWidth: options.scanWidth, scanStrength: options.scanStrength,
        scanDirection: options.scanDirection, dash: options.dash,
    })
    const columns = Math.max(1, palette.zoneColumns)
    const rows = Math.max(1, palette.zoneRows)
    const verticalStyle = (x: number, haloPass: boolean) => {
        const column = Math.max(0, Math.min(columns - 1, Math.floor((x / Math.max(1, width)) * columns)))
        const gradient = ctx.createLinearGradient(0, 0, 0, height)
        addRegionalGradientStops(gradient, rows, row => {
            if (haloPass && halo) {
                return oppositeChromeColor(zoneChromeKind(palette, column, row), halo)
            }
            return zoneChromeColor(palette, column, row, options.color)
        })
        return gradient
    }
    const horizontalStyle = (y: number, haloPass: boolean) => {
        const row = Math.max(0, Math.min(rows - 1, Math.floor((y / Math.max(1, height)) * rows)))
        const gradient = ctx.createLinearGradient(0, 0, width, 0)
        addRegionalGradientStops(gradient, columns, column => {
            if (haloPass && halo) {
                return oppositeChromeColor(zoneChromeKind(palette, column, row), halo)
            }
            return zoneChromeColor(palette, column, row, options.color)
        })
        return gradient
    }
    const drawLines = (lineSpacing: number, skipMajor: boolean, haloPass: boolean) => {
        const offsetX = frame.offsetX % lineSpacing
        const offsetY = frame.offsetY % lineSpacing
        let index = 0
        for (let x = -lineSpacing + offsetX; x < width + lineSpacing; x += lineSpacing, index += 1) {
            if (skipMajor && index % Math.max(1, options.subdivisions) === 0) continue
            ctx.strokeStyle = verticalStyle(x, haloPass)
            ctx.beginPath()
            ctx.moveTo(Math.round(x) + 0.5, 0)
            ctx.lineTo(Math.round(x) + 0.5, height)
            ctx.stroke()
        }
        index = 0
        for (let y = -lineSpacing + offsetY; y < height + lineSpacing; y += lineSpacing, index += 1) {
            if (skipMajor && index % Math.max(1, options.subdivisions) === 0) continue
            ctx.strokeStyle = horizontalStyle(y, haloPass)
            ctx.beginPath()
            ctx.moveTo(0, Math.round(y) + 0.5)
            ctx.lineTo(width, Math.round(y) + 0.5)
            ctx.stroke()
        }
    }
    const drawPass = (haloPass: boolean) => {
        ctx.save()
        ctx.globalAlpha = haloPass && halo
            ? clamp(halo.opacity * alpha, 0, 1)
            : clamp(options.opacity * alpha * frame.opacityMultiplier, 0, 1)
        ctx.lineWidth = haloPass && halo
            ? options.lineWidth + Math.max(0, halo.width) * 2
            : options.lineWidth
        ctx.setLineDash(options.dash)
        ctx.lineDashOffset = frame.dashOffset
        drawLines(spacing, false, haloPass)
        if (options.subdivisions > 1) {
            ctx.globalAlpha *= 0.52
            ctx.setLineDash([1, Math.max(8, spacing / 3)])
            drawLines(spacing / options.subdivisions, true, haloPass)
        }
        if (!haloPass) {
            drawGridEnergyBand(ctx, width, height, frame, () => {
                ctx.setLineDash(options.dash)
                drawLines(spacing, false, false)
                if (options.subdivisions > 1) {
                    ctx.setLineDash([1, Math.max(8, spacing / 3)])
                    drawLines(spacing / options.subdivisions, true, false)
                }
            })
        }
        ctx.restore()
    }
    if (halo?.enabled && halo.opacity > 0 && halo.width > 0) drawPass(true)
    drawPass(false)
}

const drawCrosshairCoordinates = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    options: GridPulseCrosshairOptions,
    alpha: number,
    halo?: { color: string; width: number; opacity: number }
) => {
    if (!options.showCoordinates) return
    const text = formatCoordinate(x, y, width, height, options.coordinateStyle)
    ctx.save()
    ctx.font = options.font
    ctx.textAlign = "left"
    ctx.textBaseline = "middle"
    const textWidth = ctx.measureText(text).width
    let tx = x + options.labelOffsetX
    let ty = y + options.labelOffsetY
    if (tx + textWidth > width - 8) tx = x - options.labelOffsetX - textWidth
    if (ty < 10) ty = y + Math.abs(options.labelOffsetY) + 8
    if (halo && halo.width > 0 && halo.opacity > 0) {
        ctx.strokeStyle = halo.color
        ctx.lineWidth = halo.width * 2
        ctx.lineJoin = "round"
        ctx.globalAlpha = clamp(halo.opacity * alpha, 0, 1)
        ctx.strokeText(text, tx, ty)
    }
    ctx.fillStyle = options.color
    ctx.globalAlpha = clamp((options.opacity + 0.28) * alpha, 0, 1)
    ctx.fillText(text, tx, ty)
    ctx.restore()
}

const drawCrosshair = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    options: GridPulseCrosshairOptions,
    alpha: number,
    drawCoordinates = true,
    coordinateHalo?: { color: string; width: number; opacity: number }
) => {
    if (!options.visible || alpha <= 0) return
    ctx.save()
    ctx.strokeStyle = options.color
    ctx.fillStyle = options.color
    ctx.globalAlpha = clamp(options.opacity * alpha, 0, 1)
    ctx.lineWidth = options.lineWidth
    ctx.setLineDash(options.dash)
    ctx.beginPath()
    ctx.moveTo(0, Math.round(y) + 0.5)
    ctx.lineTo(width, Math.round(y) + 0.5)
    ctx.moveTo(Math.round(x) + 0.5, 0)
    ctx.lineTo(Math.round(x) + 0.5, height)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.beginPath()
    ctx.arc(x, y, options.radius, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x - options.radius - 7, y)
    ctx.lineTo(x - options.radius + 5, y)
    ctx.moveTo(x + options.radius - 5, y)
    ctx.lineTo(x + options.radius + 7, y)
    ctx.moveTo(x, y - options.radius - 7)
    ctx.lineTo(x, y - options.radius + 5)
    ctx.moveTo(x, y + options.radius - 5)
    ctx.lineTo(x, y + options.radius + 7)
    ctx.stroke()
    ctx.fillRect(x - 1.5, y - 1.5, 3, 3)
    ctx.restore()
    if (drawCoordinates) {
        drawCrosshairCoordinates(ctx, x, y, width, height, options, alpha, coordinateHalo)
    }
}

const drawCrosshairWithChromeZones = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    options: GridPulseCrosshairOptions,
    alpha: number,
    palette: AdaptiveChromeZones,
    halo?: AdaptiveChromeHalo
) => {
    if (!options.visible || alpha <= 0) return
    const columns = Math.max(1, palette.zoneColumns)
    const rows = Math.max(1, palette.zoneRows)
    const column = Math.max(0, Math.min(columns - 1, Math.floor((x / Math.max(1, width)) * columns)))
    const row = Math.max(0, Math.min(rows - 1, Math.floor((y / Math.max(1, height)) * rows)))
    const horizontalGradient = ctx.createLinearGradient(0, 0, width, 0)
    addRegionalGradientStops(horizontalGradient, columns, zoneColumn =>
        zoneChromeColor(palette, zoneColumn, row, options.color)
    )
    const verticalGradient = ctx.createLinearGradient(0, 0, 0, height)
    addRegionalGradientStops(verticalGradient, rows, zoneRow =>
        zoneChromeColor(palette, column, zoneRow, options.color)
    )
    const horizontalHaloGradient = halo ? ctx.createLinearGradient(0, 0, width, 0) : null
    if (horizontalHaloGradient && halo) {
        addRegionalGradientStops(horizontalHaloGradient, columns, zoneColumn =>
            oppositeChromeColor(zoneChromeKind(palette, zoneColumn, row), halo)
        )
    }
    const verticalHaloGradient = halo ? ctx.createLinearGradient(0, 0, 0, height) : null
    if (verticalHaloGradient && halo) {
        addRegionalGradientStops(verticalHaloGradient, rows, zoneRow =>
            oppositeChromeColor(zoneChromeKind(palette, column, zoneRow), halo)
        )
    }
    const localIndex = adaptiveChromeZoneIndex(
        x / Math.max(1, width),
        y / Math.max(1, height),
        columns,
        rows
    )
    const localColor = palette.zoneColors[localIndex] || options.color
    const localKind = palette.zoneKinds[localIndex] || "light"
    const localHaloColor = halo ? oppositeChromeColor(localKind, halo) : options.color

    const drawAxes = (
        horizontal: string | CanvasGradient,
        vertical: string | CanvasGradient,
        lineWidth: number,
        opacity: number
    ) => {
        ctx.save()
        ctx.globalAlpha = clamp(opacity * alpha, 0, 1)
        ctx.lineWidth = lineWidth
        ctx.setLineDash(options.dash)
        ctx.strokeStyle = horizontal
        ctx.beginPath()
        ctx.moveTo(0, Math.round(y) + 0.5)
        ctx.lineTo(width, Math.round(y) + 0.5)
        ctx.stroke()
        ctx.strokeStyle = vertical
        ctx.beginPath()
        ctx.moveTo(Math.round(x) + 0.5, 0)
        ctx.lineTo(Math.round(x) + 0.5, height)
        ctx.stroke()
        ctx.restore()
    }
    const drawCore = (color: string, lineWidth: number, opacity: number) => {
        ctx.save()
        ctx.globalAlpha = clamp(opacity * alpha, 0, 1)
        ctx.lineWidth = lineWidth
        ctx.strokeStyle = color
        ctx.fillStyle = color
        ctx.setLineDash([])
        ctx.beginPath()
        ctx.arc(x, y, options.radius, 0, Math.PI * 2)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(x - options.radius - 7, y)
        ctx.lineTo(x - options.radius + 5, y)
        ctx.moveTo(x + options.radius - 5, y)
        ctx.lineTo(x + options.radius + 7, y)
        ctx.moveTo(x, y - options.radius - 7)
        ctx.lineTo(x, y - options.radius + 5)
        ctx.moveTo(x, y + options.radius - 5)
        ctx.lineTo(x, y + options.radius + 7)
        ctx.stroke()
        ctx.fillRect(x - 1.5, y - 1.5, 3, 3)
        ctx.restore()
    }

    if (halo?.enabled && horizontalHaloGradient && verticalHaloGradient) {
        drawAxes(
            horizontalHaloGradient,
            verticalHaloGradient,
            options.lineWidth + Math.max(0, halo.width) * 2,
            halo.opacity
        )
        drawCore(
            localHaloColor,
            options.lineWidth + Math.max(0, halo.width) * 2,
            halo.opacity
        )
    }
    drawAxes(horizontalGradient, verticalGradient, options.lineWidth, options.opacity)
    drawCore(localColor, options.lineWidth, options.opacity)
    drawCrosshairCoordinates(
        ctx,
        x,
        y,
        width,
        height,
        { ...options, color: localColor },
        alpha,
        halo?.enabled
            ? { color: localHaloColor, width: Math.max(0, halo.width), opacity: halo.opacity }
            : undefined
    )
}

const drawPoint = (
    ctx: CanvasRenderingContext2D,
    point: PixelPoint,
    options: GridPulseConnectionOptions,
    alpha: number,
    now: number,
    motion: GridPulseMotionOptions,
    reducedMotion: boolean
) => {
    const size = options.pointSize
    ctx.save()
    ctx.strokeStyle = options.color
    ctx.fillStyle = options.color
    ctx.globalAlpha = clamp(options.opacity * alpha, 0, 1)
    ctx.lineWidth = options.lineWidth
    if (options.pointShape === "circle") {
        ctx.beginPath()
        ctx.arc(point.px, point.py, size / 2, 0, Math.PI * 2)
        ctx.stroke()
    } else if (options.pointShape === "cross") {
        ctx.beginPath()
        ctx.moveTo(point.px - size / 2, point.py)
        ctx.lineTo(point.px + size / 2, point.py)
        ctx.moveTo(point.px, point.py - size / 2)
        ctx.lineTo(point.px, point.py + size / 2)
        ctx.stroke()
    } else {
        ctx.strokeRect(point.px - size / 2, point.py - size / 2, size, size)
    }
    ctx.fillRect(point.px - 1, point.py - 1, 2, 2)
    if (options.pulse && !reducedMotion) {
        const phase = ((now - point.revealedAt) % motion.pulseDuration) / motion.pulseDuration
        const radius = size + phase * 15
        ctx.globalAlpha = clamp(options.opacity * alpha * (1 - phase) * 0.42, 0, 1)
        ctx.beginPath()
        ctx.arc(point.px, point.py, radius, 0, Math.PI * 2)
        ctx.stroke()
    }
    ctx.restore()
}

const drawAnimatedSegment = (
    ctx: CanvasRenderingContext2D,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    startDistance: number,
    endDistance: number,
    length: number
) => {
    if (endDistance <= startDistance || length <= 0) return
    const start = clamp(startDistance / length, 0, 1)
    const end = clamp(endDistance / length, 0, 1)
    ctx.beginPath()
    ctx.moveTo(lerp(fromX, toX, start), lerp(fromY, toY, start))
    ctx.lineTo(lerp(fromX, toX, end), lerp(fromY, toY, end))
    ctx.stroke()
}

const drawPointToPointConnections = (
    ctx: CanvasRenderingContext2D,
    points: PixelPoint[],
    options: GridPulseConnectionOptions,
    alphas: number[],
    now: number,
    reducedMotion: boolean
) => {
    if (!options.visible || points.length < 2) return
    const pairs = buildGridPulseConnectionPairs(points, options.pointTopology)

    ctx.save()
    ctx.strokeStyle = options.color
    ctx.fillStyle = options.color
    ctx.lineWidth = options.lineWidth
    ctx.setLineDash(options.dash)
    pairs.forEach(([fromIndex, toIndex], pairIndex) => {
        const from = points[fromIndex]
        const to = points[toIndex]
        const alpha = clamp(options.opacity * Math.min(alphas[fromIndex] ?? 0, alphas[toIndex] ?? 0), 0, 1)
        if (alpha <= 0) return
        const dx = to.px - from.px
        const dy = to.py - from.py
        const length = Math.max(1, Math.hypot(dx, dy))
        const state = resolveGridPulseConnectionAnimation({
            animation: options.animation,
            now,
            revealedAt: Math.max(from.revealedAt, to.revealedAt),
            index: pairIndex,
            duration: options.drawDuration,
            stagger: options.stagger,
            flowSpeed: options.flowSpeed,
            flowLength: options.flowLength,
            lineLength: length,
            reducedMotion,
        })
        const visibleLength = length * state.drawProgress
        ctx.globalAlpha = alpha
        drawAnimatedSegment(ctx, from.px, from.py, to.px, to.py, 0, visibleLength, length)
        if (options.tickMarks && options.tickSpacing > 0) {
            ctx.setLineDash([])
            const nx = -dy / length
            const ny = dx / length
            for (let distance = options.tickSpacing; distance < visibleLength - 8; distance += options.tickSpacing) {
                const progress = distance / length
                const x = lerp(from.px, to.px, progress)
                const y = lerp(from.py, to.py, progress)
                const half = options.tickLength / 2
                ctx.beginPath()
                ctx.moveTo(x - nx * half, y - ny * half)
                ctx.lineTo(x + nx * half, y + ny * half)
                ctx.stroke()
            }
            ctx.setLineDash(options.dash)
        }
        if (state.flowAlpha > 0) {
            ctx.save()
            ctx.setLineDash([])
            ctx.lineWidth = options.lineWidth + 1.5
            ctx.globalAlpha = alpha * options.flowOpacity * state.flowAlpha
            drawAnimatedSegment(ctx, from.px, from.py, to.px, to.py, state.flowStart, state.flowEnd, length)
            ctx.restore()
        }
    })
    ctx.restore()
}

const drawConnection = (
    ctx: CanvasRenderingContext2D,
    point: PixelPoint,
    box: ScanBox,
    options: GridPulseConnectionOptions,
    alpha: number,
    now: number,
    index: number,
    reducedMotion: boolean
) => {
    if (!options.visible || alpha <= 0) return
    const end = nearestPointOnGridPulseBox(point.px, point.py, box)
    const dx = end.x - point.px
    const dy = end.y - point.py
    const length = Math.max(1, Math.hypot(dx, dy))
    const state = resolveGridPulseConnectionAnimation({
        animation: options.animation,
        now,
        revealedAt: point.revealedAt,
        index,
        duration: options.drawDuration,
        stagger: options.stagger,
        flowSpeed: options.flowSpeed,
        flowLength: options.flowLength,
        lineLength: length,
        reducedMotion,
    })
    const visibleLength = length * state.drawProgress
    ctx.save()
    ctx.strokeStyle = options.color
    ctx.fillStyle = options.color
    ctx.globalAlpha = clamp(options.opacity * alpha, 0, 1)
    ctx.lineWidth = options.lineWidth
    ctx.setLineDash(options.dash)
    drawAnimatedSegment(ctx, point.px, point.py, end.x, end.y, 0, visibleLength, length)
    if (options.tickMarks && options.tickSpacing > 0) {
        ctx.setLineDash([])
        const nx = -dy / length
        const ny = dx / length
        for (let d = options.tickSpacing; d < visibleLength - 8; d += options.tickSpacing) {
            const t = d / length
            const x = lerp(point.px, end.x, t)
            const y = lerp(point.py, end.y, t)
            const half = options.tickLength / 2
            ctx.beginPath()
            ctx.moveTo(x - nx * half, y - ny * half)
            ctx.lineTo(x + nx * half, y + ny * half)
            ctx.stroke()
        }
    }
    if (state.flowAlpha > 0) {
        ctx.save()
        ctx.setLineDash([])
        ctx.lineWidth = options.lineWidth + 1.5
        ctx.globalAlpha = clamp(options.opacity * alpha * options.flowOpacity * state.flowAlpha, 0, 1)
        drawAnimatedSegment(ctx, point.px, point.py, end.x, end.y, state.flowStart, state.flowEnd, length)
        ctx.restore()
    }
    if (state.drawProgress >= 0.98) {
        ctx.globalAlpha = clamp(options.opacity * alpha * 0.8, 0, 1)
        ctx.fillRect(end.x - 1.5, end.y - 1.5, 3, 3)
    }
    ctx.restore()
}

const drawBrackets = (
    ctx: CanvasRenderingContext2D,
    box: ScanBox,
    options: GridPulseBoxOptions,
    alpha: number
) => {
    if (!options.cornerBrackets) return
    const { x, y, width, height } = box
    const l = Math.min(options.cornerLength, width / 3, height / 3)
    ctx.save()
    ctx.strokeStyle = options.borderColor
    ctx.globalAlpha = clamp(options.borderOpacity * alpha, 0, 1)
    ctx.lineWidth = options.cornerWidth
    ctx.setLineDash([])
    ctx.beginPath()
    ctx.moveTo(x, y + l)
    ctx.lineTo(x, y)
    ctx.lineTo(x + l, y)
    ctx.moveTo(x + width - l, y)
    ctx.lineTo(x + width, y)
    ctx.lineTo(x + width, y + l)
    ctx.moveTo(x + width, y + height - l)
    ctx.lineTo(x + width, y + height)
    ctx.lineTo(x + width - l, y + height)
    ctx.moveTo(x + l, y + height)
    ctx.lineTo(x, y + height)
    ctx.lineTo(x, y + height - l)
    ctx.stroke()
    ctx.restore()
}

const drawLabel = (
    ctx: CanvasRenderingContext2D,
    box: ScanBox,
    point: PixelPoint,
    options: GridPulseLabelOptions,
    meta: {
        coords: string
        zoom: number
        mode: GridPulseDetectionMode
        wallClockMs: number
        scanStartedAtMs: number
        index: number
        total: number
        fps: number
    },
    alpha: number
) => {
    if (!options.visible || alpha <= 0) return
    let text = fillGridPulseLabelTemplate({
        template: options.template,
        score: point.score,
        id: point.id,
        coords: meta.coords,
        zoom: meta.zoom,
        mode: meta.mode,
        wallClockMs: meta.wallClockMs,
        scanStartedAtMs: meta.scanStartedAtMs,
        scorePrecision: options.scorePrecision,
        timeFormat: options.timeFormat,
        timecodeFps: options.timecodeFps,
        index: meta.index,
        total: meta.total,
        nx: point.x,
        ny: point.y,
        fps: meta.fps,
    })
    if (options.uppercase) text = text.toUpperCase()
    ctx.save()
    ctx.font = options.font
    // Letter tracking. Canvas letterSpacing takes a CSS length; em is resolved
    // against the parsed font size so the option reads like CSS.
    if (options.letterSpacing !== 0 && "letterSpacing" in ctx) {
        const fontSize = Number((options.font.match(/(\d+(?:\.\d+)?)px/) || [])[1]) || 10
        ;(ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing =
            `${(options.letterSpacing * fontSize).toFixed(3)}px`
    }
    ctx.textAlign = "left"
    ctx.textBaseline = "top"
    const metrics = ctx.measureText(text)
    const fontHeight = Math.max(9, Math.ceil(metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent))
    const width = metrics.width + options.paddingX * 2
    const height = fontHeight + options.paddingY * 2
    const x = box.x + options.offsetX
    const y = box.y + options.offsetY
    ctx.globalAlpha = alpha
    ctx.fillStyle = options.background
    ctx.fillRect(x, y, width, height)
    if (options.borderWidth > 0) {
        ctx.strokeStyle = options.borderColor
        ctx.lineWidth = options.borderWidth
        ctx.strokeRect(x, y, width, height)
    }
    ctx.fillStyle = options.color
    ctx.fillText(text, x + options.paddingX, y + options.paddingY)
    ctx.restore()
}

const drawZoomBox = (
    ctx: CanvasRenderingContext2D,
    sourceCanvas: HTMLCanvasElement,
    box: ScanBox,
    point: PixelPoint,
    boxOptions: GridPulseBoxOptions,
    labelOptions: GridPulseLabelOptions,
    detectionMode: GridPulseDetectionMode,
    alpha: number,
    now: number,
    motion: GridPulseMotionOptions,
    reducedMotion: boolean,
    componentWidth: number,
    componentHeight: number,
    crosshairCoordinateStyle: GridPulseCrosshairOptions["coordinateStyle"],
    wallClockMs: number,
    scanStartedAtMs: number,
    index: number,
    totalPoints: number,
    overlayFps: number
) => {
    const bw = Math.max(1, Math.round(box.width))
    const bh = Math.max(1, Math.round(box.height))
    const sampleWidth = bw / Math.max(0.1, boxOptions.zoom)
    const sampleHeight = bh / Math.max(0.1, boxOptions.zoom)
    let sx = point.px - sampleWidth / 2
    let sy = point.py - sampleHeight / 2
    sx = clamp(sx, 0, Math.max(0, sourceCanvas.width - sampleWidth))
    sy = clamp(sy, 0, Math.max(0, sourceCanvas.height - sampleHeight))

    const animationState = resolveGridPulseBoxAnimation({
        animation: boxOptions.animation,
        now,
        revealedAt: point.revealedAt,
        index,
        stagger: boxOptions.animationStagger,
        lockDuration: boxOptions.lockDuration,
        unfoldDuration: boxOptions.unfoldDuration,
        mediaDelay: boxOptions.mediaDelay,
        settleDuration: boxOptions.settleDuration,
        reducedMotion,
    })
    const breath = reducedMotion
        ? 1
        : 1 + Math.sin(now * 0.00135 + index * 1.17) * boxOptions.ambientBreath * animationState.settleProgress
    const frameAlpha = alpha * clamp(animationState.frameProgress, 0, 1)
    const mediaAlpha = alpha * animationState.mediaProgress
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    const scale = animationState.scale * breath
    const offsetY = animationState.offsetY
    const animatedBox: ScanBox = {
        ...box,
        x: cx + (box.x - cx) * scale,
        y: cy + offsetY + (box.y - cy) * scale,
        width: box.width * scale,
        height: box.height * scale,
    }

    // Target-lock ring is drawn before the box enters, so acquisition reads as
    // marker -> lock -> frame construction rather than an unrelated pop-in.
    if (animationState.lockProgress > 0 && animationState.frameProgress < 0.98) {
        ctx.save()
        const lockRadius = 4 + animationState.lockProgress * 10
        ctx.strokeStyle = boxOptions.borderColor
        ctx.globalAlpha = clamp(boxOptions.borderOpacity * alpha * (1 - animationState.frameProgress * 0.6), 0, 1)
        ctx.lineWidth = Math.max(1, boxOptions.borderWidth)
        ctx.beginPath()
        ctx.arc(point.px, point.py, lockRadius, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()
    }

    ctx.save()
    ctx.translate(cx, cy + offsetY)
    ctx.scale(scale, scale)
    ctx.translate(-cx, -cy)
    const shadow = parseBoxShadow(boxOptions.shadow)
    if (shadow && frameAlpha > 0.02) {
        ctx.save()
        ctx.shadowColor = shadow.color
        ctx.shadowBlur = shadow.blur
        ctx.shadowOffsetX = shadow.offsetX
        ctx.shadowOffsetY = shadow.offsetY
        ctx.fillStyle = boxOptions.backgroundColor
        ctx.globalAlpha = frameAlpha
        roundedRectPath(ctx, box.x, box.y, box.width, box.height, boxOptions.radius)
        ctx.fill()
        ctx.restore()
    }
    roundedRectPath(ctx, box.x, box.y, box.width, box.height, boxOptions.radius)
    ctx.clip()
    ctx.globalAlpha = frameAlpha
    ctx.fillStyle = boxOptions.backgroundColor
    ctx.fillRect(box.x, box.y, box.width, box.height)
    ctx.globalAlpha = mediaAlpha
    ctx.drawImage(
        sourceCanvas,
        sx,
        sy,
        sampleWidth,
        sampleHeight,
        box.x,
        box.y,
        box.width,
        box.height
    )
    if (boxOptions.scanSweep && animationState.mediaProgress > 0.12) {
        const sweep = resolveScanSweepState({
            now,
            revealedAt: point.revealedAt,
            index,
            duration: boxOptions.scanDuration > 0 ? boxOptions.scanDuration : motion.scanDuration,
            delay: boxOptions.scanDelay,
            mode: boxOptions.scanMode,
            easing: boxOptions.scanEasing,
            reducedMotion,
        })
        if (sweep.active) {
            const band = Math.max(1, boxOptions.scanBandWidth)
            const softness = clamp(boxOptions.scanSoftness, 0.05, 0.95)
            const trail = clamp(boxOptions.scanTrail, 0, 1)
            const color = parseColor(boxOptions.scanColor)
            const transparent = `rgba(${color.r},${color.g},${color.b},0)`
            const solid = `rgba(${color.r},${color.g},${color.b},1)`
            ctx.save()
            ctx.globalAlpha = boxOptions.scanOpacity * mediaAlpha
            if (boxOptions.scanDirection === "horizontal") {
                const x = box.x + sweep.progress * box.width
                const gradient = ctx.createLinearGradient(x - band * (0.5 + trail), 0, x + band * 0.5, 0)
                gradient.addColorStop(0, transparent)
                gradient.addColorStop(clamp(0.5 - softness * 0.35, 0.05, 0.48), transparent)
                gradient.addColorStop(0.5, solid)
                gradient.addColorStop(clamp(0.5 + softness * 0.35, 0.52, 0.95), transparent)
                gradient.addColorStop(1, transparent)
                ctx.fillStyle = gradient
                ctx.fillRect(x - band * (0.5 + trail), box.y, band * (1 + trail), box.height)
                ctx.globalAlpha = clamp(boxOptions.scanOpacity * 1.12 * mediaAlpha, 0, 1)
                ctx.fillStyle = boxOptions.scanColor
                ctx.fillRect(x, box.y, boxOptions.scanWidth, box.height)
            } else if (boxOptions.scanDirection === "diagonal-down" || boxOptions.scanDirection === "diagonal-up") {
                const span = box.width + box.height
                const position = -box.height + sweep.progress * span
                const sign = boxOptions.scanDirection === "diagonal-down" ? 1 : -1
                ctx.translate(box.x, box.y)
                ctx.transform(1, sign, 0, 1, 0, 0)
                const gradient = ctx.createLinearGradient(position - band, 0, position + band, 0)
                gradient.addColorStop(0, transparent)
                gradient.addColorStop(0.5, solid)
                gradient.addColorStop(1, transparent)
                ctx.fillStyle = gradient
                ctx.fillRect(position - band, -box.height * 2, band * 2, box.height * 4)
                ctx.globalAlpha = clamp(boxOptions.scanOpacity * 1.12 * mediaAlpha, 0, 1)
                ctx.fillStyle = boxOptions.scanColor
                ctx.fillRect(position, -box.height * 2, boxOptions.scanWidth, box.height * 4)
            } else {
                const y = box.y + sweep.progress * box.height
                const gradient = ctx.createLinearGradient(0, y - band * (0.5 + trail), 0, y + band * 0.5)
                gradient.addColorStop(0, transparent)
                gradient.addColorStop(clamp(0.5 - softness * 0.35, 0.05, 0.48), transparent)
                gradient.addColorStop(0.5, solid)
                gradient.addColorStop(clamp(0.5 + softness * 0.35, 0.52, 0.95), transparent)
                gradient.addColorStop(1, transparent)
                ctx.fillStyle = gradient
                ctx.fillRect(box.x, y - band * (0.5 + trail), box.width, band * (1 + trail))
                ctx.globalAlpha = clamp(boxOptions.scanOpacity * 1.12 * mediaAlpha, 0, 1)
                ctx.fillStyle = boxOptions.scanColor
                ctx.fillRect(box.x, y, box.width, boxOptions.scanWidth)
            }
            ctx.restore()
        }
    }
    ctx.restore()

    ctx.save()
    roundedRectPath(ctx, animatedBox.x, animatedBox.y, animatedBox.width, animatedBox.height, boxOptions.radius)
    ctx.strokeStyle = boxOptions.borderColor
    ctx.globalAlpha = clamp(boxOptions.borderOpacity * frameAlpha * animationState.edgeProgress, 0, 1)
    ctx.lineWidth = boxOptions.borderWidth
    ctx.stroke()
    ctx.restore()
    drawBrackets(ctx, animatedBox, boxOptions, frameAlpha * animationState.bracketProgress)
    drawLabel(
        ctx,
        animatedBox,
        point,
        labelOptions,
        {
            coords: formatCoordinate(
                point.px,
                point.py,
                componentWidth,
                componentHeight,
                resolveGridPulseLabelCoordinateStyle(
                    labelOptions.coordinateStyle,
                    crosshairCoordinateStyle
                )
            ),
            zoom: boxOptions.zoom,
            mode: detectionMode,
            wallClockMs,
            scanStartedAtMs,
            index: index + 1,
            total: totalPoints,
            fps: overlayFps,
        },
        alpha * animationState.mediaProgress
    )
}

const detectFacePoints = async (
    canvas: HTMLCanvasElement,
    width: number,
    height: number
): Promise<GridPulsePoint[]> => {
    const faceDetectorHost = globalThis as typeof globalThis & {
        FaceDetector?: GridPulseNativeFaceDetectorConstructor
    }
    const FaceDetectorConstructor = faceDetectorHost.FaceDetector
    if (!FaceDetectorConstructor) return []
    try {
        const detector = new FaceDetectorConstructor({ fastMode: true, maxDetectedFaces: 8 })
        const faces = await detector.detect(canvas)
        return faces.map((face, index) => {
            const box = face.boundingBox
            return {
                x: clamp((box.x + box.width / 2) / width, 0, 1),
                y: clamp((box.y + box.height * 0.43) / height, 0, 1),
                score: clamp(0.96 - index * 0.04, 0.72, 0.99),
                id: `FACE-${String(index + 1).padStart(2, "0")}`,
            }
        })
    } catch {
        return []
    }
}

const detectFeaturePoints = (
    canvas: HTMLCanvasElement,
    options: GridPulseDetectionOptions,
    focus: GridPulsePoint | null,
    count: number
): GridPulsePoint[] => {
    const maxDimension = 124
    const scale = Math.min(1, maxDimension / Math.max(canvas.width, canvas.height))
    const w = Math.max(24, Math.round(canvas.width * scale))
    const h = Math.max(24, Math.round(canvas.height * scale))
    const sample = createCanvas(w, h)
    const ctx = sample.getContext("2d", { willReadFrequently: true })
    if (!ctx) return []
    ctx.drawImage(canvas, 0, 0, w, h)
    let pixels: Uint8ClampedArray
    try {
        pixels = ctx.getImageData(0, 0, w, h).data
    } catch {
        return []
    }
    const gray = new Float32Array(w * h)
    const skin = new Float32Array(w * h)
    for (let i = 0; i < w * h; i++) {
        const p = i * 4
        const r = pixels[p]
        const g = pixels[p + 1]
        const b = pixels[p + 2]
        gray[i] = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255
        skin[i] = calculateGridPulseSkinScore(r, g, b)
    }
    const candidates = scoreGridPulseDetectionField({
        gray,
        skin,
        width: w,
        height: h,
        focus: focus ? { x: focus.x, y: focus.y } : null,
        mode: options.mode === "custom" ? "auto" : options.mode,
        edgeSensitivity: options.edgeSensitivity,
        personBias: options.personBias,
        centerBias: options.centerBias,
        detailEdgeWeight: options.detailEdgeWeight,
        detailTextureWeight: options.detailTextureWeight,
        personSkinWeight: options.personSkinWeight,
        autoPersonWeight: options.autoPersonWeight,
        modeDiversity: options.modeDiversity,
        focusX: options.focusX,
        focusY: options.focusY,
        focusRadius: options.focusRadius,
        focusStrength: options.focusStrength,
        clickSearchRadius: options.clickSearchRadius,
        seed: options.seed,
    })
    return selectGridPulseDetectionPoints(candidates, {
        count,
        minDistance: options.minDistance,
        focus: focus ? { x: focus.x, y: focus.y } : null,
    })
}

function useStableOptions<T extends object>(value: T): T {
    const signature = JSON.stringify(value)
    const ref = useRef<{ signature: string; value: T }>({ signature, value })
    if (ref.current.signature !== signature) {
        ref.current = { signature, value }
    }
    return ref.current.value
}

/**
 * GridPulseScan
 *
 * A dependency-free React + Canvas tactical media scanner. It supports images and video,
 * hover/tap/always-on activation, native face detection where available, saliency and
 * skin-region fallback detection, magnified callouts, connector ticks, coordinate crosshair,
 * click-to-rescan, and None/Bitmap/Pixelated/Code/X-Ray effects.
 */
export default function GridPulseScan({
    src,
    preset,
    alt = "Interactive scanned media",
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
    className,
    style,
    ariaLabel,
    onReady,
    onScan,
    onActiveChange,
    onError,
    onRenderBridge,
}: GridPulseScanProps) {
    // defaults ← preset bundle ← caller overrides: presets are convenience,
    // never authority.
    const presetBundle = resolveGridPulsePreset(preset)
    const media = useStableOptions({ ...DEFAULT_MEDIA, ...mediaOverrides })
    const detection = useStableOptions({ ...DEFAULT_DETECTION, ...presetBundle.detection, ...detectionOverrides })
    const grid = useStableOptions({ ...DEFAULT_GRID, ...presetBundle.grid, ...gridOverrides })
    const connections = useStableOptions({ ...DEFAULT_CONNECTIONS, ...presetBundle.connections, ...connectionOverrides })
    const crosshair = useStableOptions({ ...DEFAULT_CROSSHAIR, ...presetBundle.crosshair, ...crosshairOverrides })
    const boxes = useStableOptions({ ...DEFAULT_BOXES, ...presetBundle.boxes, ...boxOverrides })
    const labels = useStableOptions({ ...DEFAULT_LABELS, ...presetBundle.labels, ...labelOverrides })
    const effect = useStableOptions({ ...DEFAULT_EFFECT, ...presetBundle.effect, ...effectOverrides })
    const interaction = useStableOptions({ ...DEFAULT_INTERACTION, ...presetBundle.interaction, ...interactionOverrides })
    const motion = useStableOptions({ ...DEFAULT_MOTION, ...presetBundle.motion, ...motionOverrides })
    const rendering = useStableOptions({ ...DEFAULT_RENDERING, ...renderingOverrides })
    const theme = useStableOptions({ ...DEFAULT_THEME, ...presetBundle.theme, ...themeOverrides })

    const wrapperRef = useRef<HTMLDivElement | null>(null)
    const mediaCanvasRef = useRef<HTMLCanvasElement | null>(null)
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const sizeRef = useRef<Size>({ width: 1, height: 1, dpr: 1 })
    const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null)
    const fullEffectCanvasRef = useRef<HTMLCanvasElement | null>(null)
    const subscribersRef = useRef<Set<GridPulseFrameListener>>(new Set())
    const lastSnapshotRef = useRef<GridPulseFrameSnapshot | null>(null)
    const effectRef = useRef(effect)
    effectRef.current = effect
    const imageRef = useRef<HTMLImageElement | null>(null)
    const videoRef = useRef<HTMLVideoElement | null>(null)
    const sourceReadyRef = useRef(false)
    const sourceDimensionsRef = useRef({ width: 1, height: 1 })
    const frameRequestRef = useRef<number | null>(null)
    const ensureFrameRef = useRef<() => void>(() => undefined)
    const videoFrameCallbackRef = useRef<number | null>(null)
    const effectUnavailableRef = useRef(false)
    const adaptiveChromeDirtyRef = useRef(true)
    const adaptiveChromePaletteRef = useRef<AdaptiveChromePalette>({
        globalColor: theme.chromeLight,
        globalKind: "light",
        pointColors: [],
        pointKinds: [],
        zoneColumns: Math.max(1, Math.round(theme.chromeZoneColumns)),
        zoneRows: Math.max(1, Math.round(theme.chromeZoneRows)),
        zoneColors: [],
        zoneKinds: [],
        pointOpacityMultipliers: [],
        pointLabelBackgroundOpacities: [],
        pointGlowStrengths: [],
        zoneOpacityMultipliers: [],
    })
    const videoUsesFrameCallbackRef = useRef(false)
    const pointsRef = useRef<PixelPoint[]>([])
    const targetTrackerRef = useRef(new StableTargetTracker())
    const pointerRef = useRef({ x: 0.5, y: 0.5, inside: false })
    const crosshairPositionRef = useRef({ x: 0.5, y: 0.5, settled: true })
    const crosshairFrameTimeRef = useRef(0)
    const activeRef = useRef(interaction.activation === "always")
    const interactionAlphaRef = useRef(interaction.activation === "always" ? 1 : 0)
    const interactionTransitionStartedRef = useRef(performance.now())
    const interactionTransitionFromRef = useRef(interaction.activation === "always" ? 1 : 0)
    const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const touchReleaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const activationStartedRef = useRef(performance.now())
    const scanCommittedAtRef = useRef(Date.now())
    const lastEffectUpdateRef = useRef(0)
    const sourceGenerationRef = useRef(0)
    const latestScanRequestRef = useRef(0)
    const pendingScanRef = useRef<{ id: number; generation: number; focus?: GridPulsePoint } | null>(null)
    const scanningRef = useRef(false)
    const rescanStartedAtRef = useRef(0)
    const rescanCommittedAtRef = useRef(0)
    const rescanTransitionActiveRef = useRef(false)
    const visibleRef = useRef(true)
    const mediaDirtyRef = useRef(true)
    const overlayDirtyRef = useRef(true)
    const lastFrameRef = useRef(0)
    /** Exponentially smoothed overlay frame rate. Feeds the {fps} label token. */
    const overlayFpsRef = useRef(0)
    const lastMediaFrameRef = useRef(0)
    const reducedMotionRef = useRef(false)
    const isCoarsePointerRef = useRef(false)
    const [activeState, setActiveState] = useState(interaction.activation === "always")
    const [readyState, setReadyState] = useState(false)

    const setActive = useCallback(
        (next: boolean) => {
            if (activeRef.current === next) return
            const now = performance.now()
            activeRef.current = next
            interactionTransitionFromRef.current = interactionAlphaRef.current
            interactionTransitionStartedRef.current = now
            activationStartedRef.current = now
            overlayDirtyRef.current = true
            ensureFrameRef.current()
            setActiveState(next)
            onActiveChange?.(next)
        },
        [onActiveChange]
    )

    const commitPoints = useCallback(
        (rawPoints: GridPulsePoint[], anchor?: GridPulsePoint) => {
            const { width, height } = sizeRef.current
            const now = performance.now()
            const trackedRawPoints = detection.trackingMode === "stable"
                ? targetTrackerRef.current.update(rawPoints, {
                      maxDistance: Math.max(0.02, detection.trackingMaxDistance),
                      maxLostFrames: Math.max(0, Math.round(detection.trackingMaxLostFrames)),
                      positionSmoothing: clamp(detection.trackingSmoothing, 0, 0.98),
                      velocitySmoothing: clamp(detection.trackingVelocitySmoothing, 0, 0.98),
                      prediction: detection.trackingPrediction,
                      scoreWeight: Math.max(0, detection.trackingScoreWeight),
                  })
                : rawPoints
            const limitedCount =
                width < 600
                    ? Math.min(trackedRawPoints.length, Math.max(1, detection.mobilePointLimit))
                    : trackedRawPoints.length
            const previous = pointsRef.current
            const usedPrevious = new Set<number>()
            const smoothing = clamp(detection.temporalSmoothing, 0, 0.94)
            const matchRadius = Math.max(0.04, detection.minDistance * 1.75)
            const next = trackedRawPoints.slice(0, limitedCount).map((point, index) => {
                const rawX = clamp(point.x, 0, 1)
                const rawY = clamp(point.y, 0, 1)
                let matchedIndex = -1
                let matchedDistance = Number.POSITIVE_INFINITY
                previous.forEach((candidate, candidateIndex) => {
                    if (usedPrevious.has(candidateIndex)) return
                    const distance = Math.hypot(candidate.x - rawX, candidate.y - rawY)
                    if (distance < matchedDistance && distance <= matchRadius) {
                        matchedDistance = distance
                        matchedIndex = candidateIndex
                    }
                })
                const matched = matchedIndex >= 0 ? previous[matchedIndex] : null
                if (matchedIndex >= 0) usedPrevious.add(matchedIndex)
                const x = matched ? lerp(rawX, matched.x, smoothing) : rawX
                const y = matched ? lerp(rawY, matched.y, smoothing) : rawY
                return {
                    x,
                    y,
                    px: x * width,
                    py: y * height,
                    score: clamp(point.score ?? matched?.score ?? 1 - index * 0.13, 0, 1),
                    id:
                        point.id ||
                        (detection.preservePointIds ? matched?.id : undefined) ||
                        `SCAN-${String(index + 1).padStart(2, "0")}`,
                    revealedAt: matched?.revealedAt ?? now + index * motion.stagger,
                }
            })
            // An explicit click is the user's exact target. The stable tracker
            // and temporal smoothing both pull a fresh focus point toward
            // detection history (by up to ~0.12 normalized with the shipped
            // settings) — right for video jitter, wrong for a deliberate
            // gesture. Snap the focused point back to the click.
            if (anchor) {
                const anchorX = clamp(anchor.x, 0, 1)
                const anchorY = clamp(anchor.y, 0, 1)
                let anchorIndex = next.findIndex(point => point.id === "SCAN-00")
                if (anchorIndex < 0 && next.length > 0) {
                    let best = 0
                    let bestDistance = Number.POSITIVE_INFINITY
                    next.forEach((point, index) => {
                        const distance = Math.hypot(point.x - anchorX, point.y - anchorY)
                        if (distance < bestDistance) {
                            bestDistance = distance
                            best = index
                        }
                    })
                    anchorIndex = best
                }
                if (anchorIndex >= 0) {
                    const focused = next[anchorIndex]
                    next[anchorIndex] = {
                        ...focused,
                        x: anchorX,
                        y: anchorY,
                        px: anchorX * width,
                        py: anchorY * height,
                    }
                }
            }
            pointsRef.current = next
            scanCommittedAtRef.current = Date.now()
            if (rescanTransitionActiveRef.current) {
                rescanCommittedAtRef.current = performance.now()
            }
            adaptiveChromeDirtyRef.current = true
            overlayDirtyRef.current = true
            ensureFrameRef.current()
            onScan?.(next.map(({ x, y, score, id }) => ({ x, y, score, id })))
        },
        [
            detection.minDistance,
            detection.mobilePointLimit,
            detection.preservePointIds,
            detection.temporalSmoothing,
            detection.trackingMode,
            detection.trackingMaxDistance,
            detection.trackingMaxLostFrames,
            detection.trackingSmoothing,
            detection.trackingVelocitySmoothing,
            detection.trackingPrediction,
            detection.trackingScoreWeight,
            motion.stagger,
            onScan,
        ]
    )


    const runScanQueue = useCallback(async () => {
        if (scanningRef.current) return
        scanningRef.current = true
        try {
            while (pendingScanRef.current) {
                const request = pendingScanRef.current
                pendingScanRef.current = null
                if (
                    !sourceReadyRef.current ||
                    !sourceCanvasRef.current ||
                    request.generation !== sourceGenerationRef.current
                ) {
                    continue
                }

                const canvas = sourceCanvasRef.current
                const requestedCount = clamp(Math.round(detection.pointCount), 1, 80)
                const source = videoRef.current || imageRef.current
                if (source) {
                    const { width, height } = sizeRef.current
                    resizeCanvas(canvas, width, height)
                    const sourceContext = canvas.getContext("2d", { willReadFrequently: true })
                    if (sourceContext) {
                        const sourceDimensions = sourceDimensionsRef.current
                        drawMediaToCanvas(
                            sourceContext,
                            source,
                            sourceDimensions.width,
                            sourceDimensions.height,
                            width,
                            height,
                            media
                        )
                    }
                }
                try {
                    // A supplied detector hook overrides the built-in scan
                    // entirely; failures fall through to the built-in path.
                    if (detection.customDetector) {
                        try {
                            const hookPoints = await detection.customDetector({
                                canvas,
                                width: canvas.width,
                                height: canvas.height,
                                count: requestedCount,
                                focus: request.focus || null,
                            })
                            if (
                                Array.isArray(hookPoints) &&
                                hookPoints.length > 0 &&
                                request.id === latestScanRequestRef.current &&
                                request.generation === sourceGenerationRef.current
                            ) {
                                commitPoints(
                                    hookPoints
                                        .filter(point => Number.isFinite(point.x) && Number.isFinite(point.y))
                                        .slice(0, requestedCount)
                                        .map((point, index) => ({
                                            x: clamp(point.x, 0, 1),
                                            y: clamp(point.y, 0, 1),
                                            score: clamp(point.score ?? 1 - index * 0.08, 0, 1),
                                            id: point.id || `HOOK-${String(index + 1).padStart(2, "0")}`,
                                        }))
                                )
                                overlayDirtyRef.current = true
                                continue
                            }
                        } catch (hookError) {
                            onError?.(
                                hookError instanceof Error
                                    ? new Error(`Custom detector failed, using built-in detection: ${hookError.message}`)
                                    : new Error("Custom detector failed, using built-in detection.")
                            )
                        }
                    }

                    if (detection.mode === "custom" && detection.manualPoints.length > 0) {
                        const customPoints: GridPulsePoint[] = []
                        if (request.focus) {
                            customPoints.push({ ...request.focus, score: 1, id: "SCAN-00" })
                        }
                        for (const point of detection.manualPoints) {
                            if (customPoints.length >= requestedCount) break
                            if (
                                customPoints.some(existing =>
                                    Math.hypot(existing.x - point.x, existing.y - point.y) < detection.minDistance
                                )
                            ) continue
                            customPoints.push(point)
                        }
                        if (
                            request.id === latestScanRequestRef.current &&
                            request.generation === sourceGenerationRef.current
                        ) {
                            commitPoints(customPoints.slice(0, requestedCount), request.focus)
                            overlayDirtyRef.current = true
                        }
                        continue
                    }

                    const facePoints =
                        detection.mode === "auto" || detection.mode === "person"
                            ? await detectFacePoints(canvas, canvas.width, canvas.height)
                            : []

                    // Latest-request-wins: a newer click, resize, or source change invalidates this result.
                    if (
                        request.id !== latestScanRequestRef.current ||
                        request.generation !== sourceGenerationRef.current
                    ) {
                        continue
                    }

                    const remaining = Math.max(
                        0,
                        requestedCount - facePoints.length - (request.focus ? 1 : 0)
                    )
                    const featurePoints = detectFeaturePoints(
                        canvas,
                        detection,
                        request.focus || null,
                        Math.max(requestedCount, remaining + facePoints.length)
                    )
                    const combined: GridPulsePoint[] = []
                    if (request.focus) {
                        combined.push({ ...request.focus, score: 1, id: "SCAN-00" })
                    }
                    for (const face of facePoints) {
                        if (combined.length >= requestedCount) break
                        if (
                            combined.some(point =>
                                Math.hypot(point.x - face.x, point.y - face.y) < detection.minDistance
                            )
                        ) continue
                        combined.push(face)
                    }
                    for (const point of featurePoints) {
                        if (combined.length >= requestedCount) break
                        if (
                            combined.some(existing =>
                                Math.hypot(existing.x - point.x, existing.y - point.y) < detection.minDistance
                            )
                        ) continue
                        combined.push(point)
                    }
                    if (combined.length === 0) {
                        combined.push({ x: 0.5, y: 0.5, score: 1, id: "SCAN-01" })
                    }
                    if (
                        request.id === latestScanRequestRef.current &&
                        request.generation === sourceGenerationRef.current
                    ) {
                        commitPoints(combined, request.focus)
                        overlayDirtyRef.current = true
                    }
                } catch (error) {
                    if (
                        request.id === latestScanRequestRef.current &&
                        request.generation === sourceGenerationRef.current
                    ) {
                        onError?.(error instanceof Error ? error : new Error(String(error)))
                    }
                }
            }
        } finally {
            scanningRef.current = false
            // A request can arrive between the while condition and finally.
            if (pendingScanRef.current) void runScanQueue()
        }
    }, [commitPoints, detection, media, onError])

    const scan = useCallback(
        async (focus?: GridPulsePoint) => {
            if (!sourceReadyRef.current || !sourceCanvasRef.current) return
            rescanStartedAtRef.current = performance.now()
            rescanCommittedAtRef.current = 0
            rescanTransitionActiveRef.current = true
            overlayDirtyRef.current = true
            ensureFrameRef.current()
            const request = {
                id: ++latestScanRequestRef.current,
                generation: sourceGenerationRef.current,
                focus,
            }
            pendingScanRef.current = request
            await runScanQueue()
        },
        [runScanQueue]
    )

    useEffect(() => {
        if (typeof window === "undefined") return
        isCoarsePointerRef.current = window.matchMedia?.("(pointer: coarse)").matches ?? false
        if (motion.respectReducedMotion) {
            const query = window.matchMedia?.("(prefers-reduced-motion: reduce)")
            reducedMotionRef.current = query?.matches ?? false
            const update = () => {
                reducedMotionRef.current = query?.matches ?? false
                overlayDirtyRef.current = true
                ensureFrameRef.current()
            }
            query?.addEventListener?.("change", update)
            return () => query?.removeEventListener?.("change", update)
        }
        reducedMotionRef.current = false
    }, [motion.respectReducedMotion])

    useEffect(() => {
        const element = wrapperRef.current
        const overlayCanvas = canvasRef.current
        const mediaCanvas = mediaCanvasRef.current
        if (!element || !overlayCanvas || !mediaCanvas) return

        let lastWidth = 0
        let lastHeight = 0
        let lastDpr = 0
        const applySize = (widthValue: number, heightValue: number) => {
            const width = Math.max(1, widthValue)
            const height = Math.max(1, heightValue)
            const dpr = clamp(window.devicePixelRatio || 1, 1, Math.max(1, rendering.dprCap))
            if (
                Math.abs(width - lastWidth) < 0.25 &&
                Math.abs(height - lastHeight) < 0.25 &&
                Math.abs(dpr - lastDpr) < 0.01
            ) {
                return
            }
            lastWidth = width
            lastHeight = height
            lastDpr = dpr
            sizeRef.current = { width, height, dpr }
            for (const canvas of [mediaCanvas, overlayCanvas]) {
                canvas.width = Math.max(1, Math.round(width * dpr))
                canvas.height = Math.max(1, Math.round(height * dpr))
                canvas.style.width = `${width}px`
                canvas.style.height = `${height}px`
            }
            if (sourceCanvasRef.current) resizeCanvas(sourceCanvasRef.current, width, height)
            if (fullEffectCanvasRef.current) resizeCanvas(fullEffectCanvasRef.current, width, height)
            pointsRef.current = pointsRef.current.map(point => ({
                ...point,
                px: point.x * width,
                py: point.y * height,
            }))
            adaptiveChromeDirtyRef.current = true
            mediaDirtyRef.current = true
            overlayDirtyRef.current = true
            ensureFrameRef.current()
        }

        const measure = () => {
            const rect = element.getBoundingClientRect()
            applySize(rect.width, rect.height)
        }
        measure()

        if (typeof ResizeObserver !== "undefined") {
            const observer = new ResizeObserver(entries => {
                const rect = entries[0]?.contentRect
                if (rect) applySize(rect.width, rect.height)
            })
            observer.observe(element)
            return () => observer.disconnect()
        }

        window.addEventListener("resize", measure, { passive: true })
        return () => window.removeEventListener("resize", measure)
    }, [rendering.dprCap])

    useEffect(() => {
        const root = wrapperRef.current
        if (!root || typeof IntersectionObserver === "undefined") return
        const observer = new IntersectionObserver(
            ([entry]) => {
                visibleRef.current = entry?.isIntersecting ?? true
                if (visibleRef.current) {
                    mediaDirtyRef.current = true
                    overlayDirtyRef.current = true
                    ensureFrameRef.current()
                }
            },
            { rootMargin: "120px" }
        )
        observer.observe(root)
        return () => observer.disconnect()
    }, [])

    useEffect(() => {
        sourceCanvasRef.current = createCanvas()
        fullEffectCanvasRef.current = createCanvas()
        mediaDirtyRef.current = true
        overlayDirtyRef.current = true
        ensureFrameRef.current()
        return () => {
            sourceCanvasRef.current = null
            fullEffectCanvasRef.current = null
        }
    }, [])

    useEffect(() => {
        if (!onRenderBridge) return
        const bridge: GridPulseRenderBridge = {
            getSourceCanvas: () => sourceCanvasRef.current,
            getCalloutCanvas: () => {
                const currentEffect = effectRef.current
                const boxEffectEnabled =
                    currentEffect.type !== "none" &&
                    (currentEffect.scope === "boxes" || currentEffect.scope === "both")
                return boxEffectEnabled ? fullEffectCanvasRef.current : sourceCanvasRef.current
            },
            getSize: () => ({ ...sizeRef.current }),
            getPoints: () =>
                pointsRef.current.map(({ x, y, score, id }) => ({ x, y, score, id })),
            getSnapshot: () => lastSnapshotRef.current,
            subscribe: listener => {
                subscribersRef.current.add(listener)
                const snapshot = lastSnapshotRef.current
                if (snapshot) listener(snapshot)
                overlayDirtyRef.current = true
                ensureFrameRef.current()
                return () => subscribersRef.current.delete(listener)
            },
            isReady: () => sourceReadyRef.current,
            requestFrame: () => {
                ensureFrameRef.current()
            },
            requestRender: () => {
                overlayDirtyRef.current = true
                ensureFrameRef.current()
            },
            requestMediaRender: () => {
                mediaDirtyRef.current = true
                overlayDirtyRef.current = true
                ensureFrameRef.current()
            },
        }
        onRenderBridge(bridge)
        return () => onRenderBridge(null)
    }, [onRenderBridge])

    useEffect(() => {
        sourceGenerationRef.current += 1
        effectUnavailableRef.current = false
        latestScanRequestRef.current += 1
        pendingScanRef.current = null
        sourceReadyRef.current = false
        setReadyState(false)
        pointsRef.current = []
        mediaDirtyRef.current = true
        overlayDirtyRef.current = true
        ensureFrameRef.current()
        imageRef.current = null
        if (videoRef.current) {
            videoRef.current.pause()
            videoRef.current.removeAttribute("src")
            videoRef.current.load()
            videoRef.current = null
        }
        if (!src) {
            onError?.(new Error("GridPulseScan requires a non-empty src prop."))
            return
        }
        const resolvedType = inferMediaType(src, media.type)
        let disposed = false
        if (resolvedType === "video") {
            const video = document.createElement("video")
            if (media.crossOrigin) video.crossOrigin = media.crossOrigin
            video.src = src
            if (media.poster) video.poster = media.poster
            video.autoplay = media.videoAutoPlay
            video.loop = media.videoLoop
            video.muted = media.videoMuted
            video.defaultMuted = media.videoMuted
            video.playsInline = true
            video.preload = "auto"
            video.playbackRate = clamp(media.videoPlaybackRate, 0.25, 4)
            const ready = () => {
                if (disposed) return
                sourceDimensionsRef.current = {
                    width: Math.max(1, video.videoWidth),
                    height: Math.max(1, video.videoHeight),
                }
                videoRef.current = video
                sourceReadyRef.current = true
                mediaDirtyRef.current = true
                overlayDirtyRef.current = true
                ensureFrameRef.current()
                setReadyState(true)
                if (media.videoAutoPlay) {
                    void video.play().catch(() => {
                        // Autoplay policies may require a user gesture. Rendering still begins from poster/current frame.
                    })
                }
                onReady?.()
            }
            const fail = () => {
                if (!disposed) onError?.(new Error(`Unable to load video: ${src}`))
            }
            video.addEventListener("loadeddata", ready, { once: true })
            video.addEventListener("error", fail, { once: true })
            video.load()
            return () => {
                disposed = true
                video.pause()
                video.removeEventListener("loadeddata", ready)
                video.removeEventListener("error", fail)
                video.removeAttribute("src")
                video.load()
            }
        }
        const image = new Image()
        if (media.crossOrigin) image.crossOrigin = media.crossOrigin
        image.decoding = "async"
        image.onload = () => {
            if (disposed) return
            sourceDimensionsRef.current = {
                width: Math.max(1, image.naturalWidth),
                height: Math.max(1, image.naturalHeight),
            }
            imageRef.current = image
            sourceReadyRef.current = true
            mediaDirtyRef.current = true
            overlayDirtyRef.current = true
            ensureFrameRef.current()
            setReadyState(true)
            onReady?.()
        }
        image.onerror = () => {
            if (!disposed) onError?.(new Error(`Unable to load image: ${src}`))
        }
        image.src = src
        return () => {
            disposed = true
            image.onload = null
            image.onerror = null
            imageRef.current = null
        }
    }, [media.crossOrigin, media.poster, media.type, onError, onReady, src])

    useEffect(() => {
        const video = videoRef.current
        if (!video) return
        video.loop = media.videoLoop
        video.muted = media.videoMuted
        video.defaultMuted = media.videoMuted
        video.playbackRate = clamp(media.videoPlaybackRate, 0.25, 4)
        if (media.videoAutoPlay && video.paused) {
            void video.play().catch(() => undefined)
        } else if (!media.videoAutoPlay && !video.paused) {
            video.pause()
        }
        mediaDirtyRef.current = true
        ensureFrameRef.current()
    }, [
        media.videoAutoPlay,
        media.videoLoop,
        media.videoMuted,
        media.videoPlaybackRate,
    ])

    useEffect(() => {
        const video = videoRef.current as GridPulseVideoElement | null
        videoUsesFrameCallbackRef.current = false
        if (
            !readyState ||
            !video ||
            !rendering.useVideoFrameCallback ||
            !video.requestVideoFrameCallback
        ) {
            return
        }

        let disposed = false
        videoUsesFrameCallbackRef.current = true
        const onVideoFrame = () => {
            if (disposed) return
            mediaDirtyRef.current = true
            overlayDirtyRef.current = true
            ensureFrameRef.current()
            videoFrameCallbackRef.current = video.requestVideoFrameCallback?.(onVideoFrame) ?? null
        }
        videoFrameCallbackRef.current = video.requestVideoFrameCallback(onVideoFrame)

        return () => {
            disposed = true
            videoUsesFrameCallbackRef.current = false
            if (
                videoFrameCallbackRef.current !== null &&
                video.cancelVideoFrameCallback
            ) {
                video.cancelVideoFrameCallback(videoFrameCallbackRef.current)
            }
            videoFrameCallbackRef.current = null
        }
    }, [readyState, rendering.useVideoFrameCallback, src])

    useEffect(() => {
        mediaDirtyRef.current = true
        overlayDirtyRef.current = true
        lastEffectUpdateRef.current = 0
        effectUnavailableRef.current = false
        adaptiveChromeDirtyRef.current = true
        ensureFrameRef.current()
    }, [
        effect,
        media.mirror,
        media.objectFit,
        media.positionX,
        media.positionY,
        theme.background,
        theme.adaptiveChrome,
        theme.chromeLight,
        theme.chromeDark,
        theme.chromeSampleRadius,
        theme.chromeMinContrast,
        theme.chromeSpatialMode,
        theme.chromeZoneColumns,
        theme.chromeZoneRows,
    ])

    useEffect(() => {
        if (!readyState) return
        const timer = window.setTimeout(() => void scan(), 80)
        return () => window.clearTimeout(timer)
    }, [readyState, scan])

    useEffect(() => {
        if (interaction.activation === "always") {
            setActive(true)
        } else if (interaction.activation === "hover") {
            setActive(pointerRef.current.inside && !isCoarsePointerRef.current)
        } else if (interaction.mobileAlwaysOn && isCoarsePointerRef.current) {
            setActive(true)
        } else {
            setActive(false)
        }
    }, [interaction.activation, interaction.mobileAlwaysOn, setActive])

    useEffect(() => {
        if (!interaction.autoRescanInterval || interaction.autoRescanInterval < 250) return
        const id = window.setInterval(() => {
            if (activeRef.current) void scan()
        }, interaction.autoRescanInterval)
        return () => window.clearInterval(id)
    }, [interaction.autoRescanInterval, scan])

    useEffect(() => {
        let disposed = false

        const schedule = () => {
            if (disposed || frameRequestRef.current !== null) return
            if (rendering.pauseWhenOffscreen && !visibleRef.current) return
            frameRequestRef.current = requestAnimationFrame(render)
        }

        const render = (now: number) => {
            frameRequestRef.current = null
            if (disposed || (rendering.pauseWhenOffscreen && !visibleRef.current)) return

            const mediaCanvas = mediaCanvasRef.current
            const overlayCanvas = canvasRef.current
            const sourceCanvas = sourceCanvasRef.current
            const fullEffectCanvas = fullEffectCanvasRef.current
            if (!mediaCanvas || !overlayCanvas || !sourceCanvas || !fullEffectCanvas) return

            const video = videoRef.current
            const image = imageRef.current
            const videoIsPlaying = Boolean(video && !video.paused && !video.ended)
            const targetFps = videoIsPlaying
                ? rendering.maxFps
                : activeRef.current
                  ? rendering.maxFps
                  : rendering.inactiveFps
            const frameInterval = 1000 / clamp(targetFps, 1, 120)
            if (now - lastFrameRef.current < frameInterval) {
                schedule()
                return
            }
            const frameDelta = now - lastFrameRef.current
            if (frameDelta > 0 && frameDelta < 1000) {
                const instantFps = 1000 / frameDelta
                overlayFpsRef.current = overlayFpsRef.current === 0
                    ? instantFps
                    : overlayFpsRef.current * 0.9 + instantFps * 0.1
            }
            lastFrameRef.current = now
            // Resolve wall-clock tokens once per rendered frame so every chip agrees at second boundaries.
            const frameWallClockMs = Date.now()

            const { width, height, dpr } = sizeRef.current
            const expectedWidth = Math.max(1, Math.round(width * dpr))
            const expectedHeight = Math.max(1, Math.round(height * dpr))
            for (const canvas of [mediaCanvas, overlayCanvas]) {
                if (canvas.width !== expectedWidth || canvas.height !== expectedHeight) {
                    canvas.width = expectedWidth
                    canvas.height = expectedHeight
                    mediaDirtyRef.current = true
                    overlayDirtyRef.current = true
                }
            }
            resizeCanvas(sourceCanvas, width, height)
            resizeCanvas(fullEffectCanvas, width, height)

            const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true })
            const mediaCtx = mediaCanvas.getContext("2d")
            const overlayCtx = overlayCanvas.getContext("2d")
            if (!sourceCtx || !mediaCtx || !overlayCtx) return

            const source = video || image
            const sourceAvailable = Boolean(sourceReadyRef.current && source)
            const mediaFps = video ? rendering.maxFps : rendering.staticImageFps
            const mediaInterval = 1000 / clamp(mediaFps, 1, 120)
            const videoNeedsPolling = videoIsPlaying && !videoUsesFrameCallbackRef.current
            const shouldRefreshMedia =
                sourceAvailable &&
                (mediaDirtyRef.current ||
                    (videoNeedsPolling && now - lastMediaFrameRef.current >= mediaInterval))

            if (shouldRefreshMedia && source) {
                const sourceDimensions = sourceDimensionsRef.current
                drawMediaToCanvas(
                    sourceCtx,
                    source,
                    sourceDimensions.width,
                    sourceDimensions.height,
                    width,
                    height,
                    media
                )
                adaptiveChromeDirtyRef.current = true

                const mediaEffectEnabled =
                    !effectUnavailableRef.current &&
                    effect.type !== "none" &&
                    (effect.scope === "media" || effect.scope === "both")
                const calloutEffectEnabled =
                    !effectUnavailableRef.current &&
                    effect.type !== "none" &&
                    (effect.scope === "boxes" || effect.scope === "both")
                if (mediaEffectEnabled || calloutEffectEnabled) {
                    const refreshMs = 1000 / clamp(effect.refreshRate, 1, 60)
                    if (
                        now - lastEffectUpdateRef.current >= refreshMs ||
                        !lastEffectUpdateRef.current ||
                        mediaDirtyRef.current
                    ) {
                        try {
                            applyEffect(sourceCanvas, fullEffectCanvas, effect)
                        } catch (error) {
                            effectUnavailableRef.current = true
                            const fallbackContext = fullEffectCanvas.getContext("2d")
                            fallbackContext?.clearRect(0, 0, fullEffectCanvas.width, fullEffectCanvas.height)
                            fallbackContext?.drawImage(sourceCanvas, 0, 0)
                            onError?.(
                                error instanceof Error
                                    ? new Error(`Grid Pulse effect disabled: ${error.message}`)
                                    : new Error("Grid Pulse effect disabled because the media canvas is not readable.")
                            )
                        }
                        lastEffectUpdateRef.current = now
                    }
                }

                mediaCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
                mediaCtx.clearRect(0, 0, width, height)
                mediaCtx.fillStyle = theme.background
                mediaCtx.fillRect(0, 0, width, height)
                mediaCtx.drawImage(
                    mediaEffectEnabled ? fullEffectCanvas : sourceCanvas,
                    0,
                    0,
                    width,
                    height
                )
                mediaDirtyRef.current = false
                overlayDirtyRef.current = true
                lastMediaFrameRef.current = now
            } else if (!sourceAvailable && mediaDirtyRef.current) {
                mediaCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
                mediaCtx.clearRect(0, 0, width, height)
                mediaCtx.fillStyle = theme.background
                mediaCtx.fillRect(0, 0, width, height)
                mediaDirtyRef.current = false
            }

            const active = activeRef.current
            const revealBatchStart = resolveGridPulseBatchStart(
                pointsRef.current.map(point => point.revealedAt)
            )
            const transitionAlpha = resolveGridPulseInteractionAlpha({
                active,
                previousAlpha: interactionTransitionFromRef.current,
                startedAt: interactionTransitionStartedRef.current,
                now,
                enterDuration: interaction.enterDuration,
                exitDuration: interaction.exitDuration,
                reducedMotion: reducedMotionRef.current,
            })
            interactionAlphaRef.current = transitionAlpha
            const rescanTransitionState = resolveGridPulseRescanTransition({
                mode: interaction.rescanTransition,
                now,
                startedAt: rescanTransitionActiveRef.current ? rescanStartedAtRef.current : 0,
                committedAt: rescanCommittedAtRef.current,
                exitDuration: interaction.rescanExitDuration,
                gap: interaction.rescanGap,
                enterDuration: interaction.rescanEnterDuration,
                reducedMotion: reducedMotionRef.current,
            })
            if (rescanTransitionActiveRef.current && rescanTransitionState.complete) {
                rescanTransitionActiveRef.current = false
                rescanStartedAtRef.current = 0
                rescanCommittedAtRef.current = 0
            }
            const inactiveFloor = theme.overlayWhenInactive
                ? clamp(theme.inactiveOpacity, 0, 1)
                : 0
            const overlayAlpha =
                (inactiveFloor + (1 - inactiveFloor) * transitionAlpha) *
                rescanTransitionState.alpha
            const interactionAnimating =
                !reducedMotionRef.current &&
                transitionAlpha > 0.0001 &&
                transitionAlpha < 0.9999
            const rescanAnimating =
                rescanTransitionActiveRef.current && !rescanTransitionState.complete
            const revealsAnimating =
                !reducedMotionRef.current &&
                pointsRef.current.some(
                    point => now < point.revealedAt + Math.max(1, motion.revealDuration)
                )
            const pointer = pointerRef.current
            const targetCrosshairX = crosshair.followPointer
                ? (pointer.inside || !crosshair.returnToCenter ? pointer.x : 0.5)
                : 0.5
            const targetCrosshairY = crosshair.followPointer
                ? (pointer.inside || !crosshair.returnToCenter ? pointer.y : 0.5)
                : 0.5
            const previousCrosshair = crosshairPositionRef.current
            const crosshairMotion = resolveGridPulseCrosshairMotion({
                currentX: previousCrosshair.x,
                currentY: previousCrosshair.y,
                targetX: targetCrosshairX,
                targetY: targetCrosshairY,
                deltaMs: crosshairFrameTimeRef.current > 0 ? now - crosshairFrameTimeRef.current : 16.67,
                mode: crosshair.followMode,
                responseMs: crosshair.followResponse,
                snapThreshold: crosshair.snapThreshold / Math.max(1, Math.max(width, height)),
                reducedMotion: reducedMotionRef.current,
            })
            crosshairFrameTimeRef.current = now
            crosshairPositionRef.current = {
                x: crosshairMotion.x,
                y: crosshairMotion.y,
                settled: crosshairMotion.settled,
            }
            const crosshairAnimating = crosshair.followPointer && !crosshairMotion.settled
            // Tracking frames drift with the pointer. Derived once so the drawn
            // overlay and the published snapshot share identical geometry.
            const boxParallax = {
                x: (crosshairPositionRef.current.x - 0.5) * boxes.trackingParallax,
                y: (crosshairPositionRef.current.y - 0.5) * boxes.trackingParallax,
            }
            // Transitions must keep the loop alive even while the overlay is at
            // alpha 0: the rescan fade passes through a fully transparent gap
            // phase, and gating those frames behind `overlayAlpha > 0` freezes
            // the loop mid-blackout with the overlay cleared. It looked fine
            // under a pointer (any event revives the loop) and died headless —
            // found by instrumenting rAF counts in a real browser.
            const transitionsAnimating =
                !reducedMotionRef.current && (interactionAnimating || rescanAnimating)
            const overlayAnimated =
                transitionsAnimating ||
                (overlayAlpha > 0 &&
                    !reducedMotionRef.current &&
                    (grid.animate || connections.pulse || connections.animation !== "static" || boxes.scanSweep || boxes.animation !== "static" ||
                    revealsAnimating || crosshairAnimating))
            const shouldDrawOverlay = overlayDirtyRef.current || overlayAnimated

            if (shouldDrawOverlay) {
                overlayCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
                overlayCtx.clearRect(0, 0, width, height)
            }
            if (shouldDrawOverlay && sourceAvailable && overlayAlpha > 0) {
                const points = pointsRef.current
                if (theme.adaptiveChrome && adaptiveChromeDirtyRef.current) {
                    try {
                        const mediaChromeCanvas =
                            effect.type !== "none" &&
                            (effect.scope === "media" || effect.scope === "both")
                                ? fullEffectCanvas
                                : sourceCanvas
                        const pointChromeCanvas =
                            effect.type !== "none" &&
                            (effect.scope === "boxes" || effect.scope === "both")
                                ? fullEffectCanvas
                                : sourceCanvas
                        const globalChromeCtx =
                            mediaChromeCanvas.getContext("2d", { willReadFrequently: true }) || sourceCtx
                        const pointChromeCtx =
                            pointChromeCanvas.getContext("2d", { willReadFrequently: true }) || sourceCtx
                        adaptiveChromePaletteRef.current = buildAdaptiveChromePalette(
                            globalChromeCtx,
                            pointChromeCtx,
                            width,
                            height,
                            points,
                            theme
                        )
                    } catch {
                        adaptiveChromePaletteRef.current = {
                            globalColor: theme.chromeLight,
                            globalKind: "light",
                            pointColors: points.map(() => theme.chromeLight),
                            pointKinds: points.map(() => "light" as const),
                            zoneColumns: Math.max(1, Math.round(theme.chromeZoneColumns)),
                            zoneRows: Math.max(1, Math.round(theme.chromeZoneRows)),
                            zoneColors: Array.from(
                                { length: Math.max(1, Math.round(theme.chromeZoneColumns)) * Math.max(1, Math.round(theme.chromeZoneRows)) },
                                () => theme.chromeLight
                            ),
                            zoneKinds: Array.from(
                                { length: Math.max(1, Math.round(theme.chromeZoneColumns)) * Math.max(1, Math.round(theme.chromeZoneRows)) },
                                () => "light" as const
                            ),
                            pointOpacityMultipliers: points.map(() => 1),
                            pointLabelBackgroundOpacities: points.map(() => 0.62),
                            pointGlowStrengths: points.map(() => 0),
                            zoneOpacityMultipliers: Array.from(
                                { length: Math.max(1, Math.round(theme.chromeZoneColumns)) * Math.max(1, Math.round(theme.chromeZoneRows)) },
                                () => 1
                            ),
                        }
                    }
                    adaptiveChromeDirtyRef.current = false
                }
                const chromePalette = adaptiveChromePaletteRef.current
                const globalChrome = theme.adaptiveChrome ? chromePalette.globalColor : null
                const globalHaloColor = theme.adaptiveChrome
                    ? (chromePalette.globalKind === "light" ? theme.chromeDark : theme.chromeLight)
                    : null
                const adaptiveHalo: AdaptiveChromeHalo | undefined =
                    theme.adaptiveChrome && theme.chromeHalo
                        ? {
                              enabled: true,
                              width: Math.max(0, theme.chromeHaloWidth),
                              opacity: clamp(theme.chromeHaloOpacity, 0, 1),
                              light: theme.chromeLight,
                              dark: theme.chromeDark,
                          }
                        : undefined
                const resolvedGrid = globalChrome ? { ...grid, color: globalChrome } : grid
                const resolvedCrosshair = globalChrome
                    ? { ...crosshair, color: globalChrome }
                    : crosshair
                const resolvedPointConnections = globalChrome
                    ? { ...connections, color: globalChrome }
                    : connections
                const useRegionalChrome =
                    theme.adaptiveChrome &&
                    theme.chromeSpatialMode === "regional" &&
                    chromePalette.zoneColors.length > 0
                if (useRegionalChrome) {
                    drawGridWithChromeZones(
                        overlayCtx,
                        width,
                        height,
                        grid,
                        overlayAlpha,
                        now,
                        reducedMotionRef.current,
                        chromePalette,
                        adaptiveHalo
                    )
                } else {
                    if (adaptiveHalo && globalHaloColor) {
                        drawGrid(
                            overlayCtx,
                            width,
                            height,
                            {
                                ...grid,
                                color: globalHaloColor,
                                opacity: adaptiveHalo.opacity,
                                lineWidth: grid.lineWidth + adaptiveHalo.width * 2,
                            },
                            overlayAlpha,
                            now,
                            reducedMotionRef.current
                        )
                    }
                    drawGrid(
                        overlayCtx,
                        width,
                        height,
                        resolvedGrid,
                        overlayAlpha,
                        now,
                        reducedMotionRef.current
                    )
                }
                const crossX = crosshairPositionRef.current.x * width
                const crossY = crosshairPositionRef.current.y * height
                if (useRegionalChrome) {
                    drawCrosshairWithChromeZones(
                        overlayCtx,
                        crossX,
                        crossY,
                        width,
                        height,
                        crosshair,
                        overlayAlpha,
                        chromePalette,
                        adaptiveHalo
                    )
                } else {
                    if (adaptiveHalo && globalHaloColor) {
                        drawCrosshair(
                            overlayCtx,
                            crossX,
                            crossY,
                            width,
                            height,
                            {
                                ...crosshair,
                                color: globalHaloColor,
                                opacity: adaptiveHalo.opacity,
                                lineWidth: crosshair.lineWidth + adaptiveHalo.width * 2,
                            },
                            overlayAlpha,
                            false
                        )
                    }
                    drawCrosshair(
                        overlayCtx,
                        crossX,
                        crossY,
                        width,
                        height,
                        resolvedCrosshair,
                        overlayAlpha,
                        true,
                        adaptiveHalo && globalHaloColor
                            ? {
                                  color: globalHaloColor,
                                  width: adaptiveHalo.width,
                                  opacity: adaptiveHalo.opacity,
                              }
                            : undefined
                    )
                }
                const isMobile = width < 600
                const laidOut = resolveGridPulseBoxLayout(
                    points,
                    width,
                    height,
                    boxes,
                    isMobile,
                    boxParallax
                )
                const pointRevealAlphas = points.map(point =>
                    resolveGridPulseRevealProgress({
                        now,
                        revealedAt: point.revealedAt,
                        batchStart: revealBatchStart,
                        duration: motion.revealDuration,
                        easing: motion.easing,
                        reducedMotion: reducedMotionRef.current,
                        reducedMotionReveal: motion.reducedMotionReveal,
                    }) * overlayAlpha
                )
                if (connections.topology === "points" || connections.topology === "both") {
                    drawPointToPointConnections(
                        overlayCtx,
                        points,
                        resolvedPointConnections,
                        pointRevealAlphas,
                        now,
                        reducedMotionRef.current
                    )
                }
                if (connections.topology === "leaders" || connections.topology === "both") {
                    points.forEach((point, index) => {
                        const revealAlpha = pointRevealAlphas[index]
                        if (revealAlpha <= 0) return
                        const pointColor = theme.adaptiveChrome
                            ? chromePalette.pointColors[index] || chromePalette.globalColor
                            : connections.color
                        drawConnection(
                            overlayCtx,
                            point,
                            laidOut[index],
                            {
                                ...connections,
                                color: pointColor,
                                opacity: clamp(
                                    connections.opacity *
                                        (chromePalette.pointOpacityMultipliers[index] || 1),
                                    0,
                                    1
                                ),
                            },
                            revealAlpha,
                            now,
                            index,
                            reducedMotionRef.current
                        )
                    })
                }
                points.forEach((point, index) => {
                    const reveal = resolveGridPulseRevealProgress({
                        now,
                        revealedAt: point.revealedAt,
                        batchStart: revealBatchStart,
                        duration: motion.revealDuration,
                        easing: motion.easing,
                        reducedMotion: reducedMotionRef.current,
                        reducedMotionReveal: motion.reducedMotionReveal,
                    })
                    if (reveal <= 0) return
                    const pointColor = theme.adaptiveChrome
                        ? chromePalette.pointColors[index] || chromePalette.globalColor
                        : connections.color
                    const pointKind = theme.adaptiveChrome
                        ? chromePalette.pointKinds[index] || chromePalette.globalKind
                        : "light"
                    const chromeOpacityMultiplier = theme.adaptiveChrome
                        ? chromePalette.pointOpacityMultipliers[index] || 1
                        : 1
                    const labelBackgroundOpacity = theme.adaptiveChrome
                        ? chromePalette.pointLabelBackgroundOpacities[index] || 0.62
                        : 0.62
                    const glowStrength = theme.adaptiveChrome
                        ? chromePalette.pointGlowStrengths[index] || 0
                        : 0
                    const resolvedConnections = {
                        ...connections,
                        color: pointColor,
                        opacity: clamp(connections.opacity * chromeOpacityMultiplier, 0, 1),
                    }
                    const resolvedBoxes = theme.adaptiveChrome
                        ? {
                              ...boxes,
                              borderColor: pointColor,
                              scanColor: pointColor,
                              shadow: glowStrength > 0
                                  ? `0px 0px ${Math.round(12 + glowStrength * 24)}px rgba(255,255,255,${(0.08 + glowStrength * 0.18).toFixed(3)})`
                                  : boxes.shadow,
                          }
                        : boxes
                    const resolvedLabels = theme.adaptiveChrome
                        ? {
                              ...labels,
                              color: pointColor,
                              background: rgbaForChromeBackground(pointKind, labelBackgroundOpacity),
                              borderColor: pointKind === "light"
                                  ? "rgba(255,255,255,.36)"
                                  : "rgba(0,0,0,.32)",
                          }
                        : labels
                    drawPoint(
                        overlayCtx,
                        point,
                        resolvedConnections,
                        reveal * overlayAlpha,
                        now,
                        motion,
                        reducedMotionRef.current
                    )
                    if (boxes.visible) {
                        drawZoomBox(
                            overlayCtx,
                            effect.type !== "none" &&
                                (effect.scope === "boxes" || effect.scope === "both")
                                ? fullEffectCanvas
                                : sourceCanvas,
                            laidOut[index],
                            point,
                            resolvedBoxes,
                            resolvedLabels,
                            detection.mode,
                            reveal * overlayAlpha,
                            now,
                            motion,
                            reducedMotionRef.current,
                            width,
                            height,
                            crosshair.coordinateStyle,
                            frameWallClockMs,
                            scanCommittedAtRef.current,
                            index,
                            points.length,
                            overlayFpsRef.current
                        )
                    }
                })
            }

            const snapshotPoints = pointsRef.current.map((point): GridPulseFramePoint => ({
                x: point.x,
                y: point.y,
                px: point.px,
                py: point.py,
                score: point.score,
                id: point.id,
                reveal: resolveGridPulseRevealProgress({
                    now,
                    revealedAt: point.revealedAt,
                    batchStart: revealBatchStart,
                    duration: motion.revealDuration,
                    easing: motion.easing,
                    reducedMotion: reducedMotionRef.current,
                    reducedMotionReveal: motion.reducedMotionReveal,
                }),
            }))
            const snapshotBoxes = resolveGridPulseBoxLayout(
                pointsRef.current,
                width,
                height,
                boxes,
                width < 600,
                boxParallax
            )
            const boxEffectEnabled =
                !effectUnavailableRef.current &&
                effect.type !== "none" &&
                (effect.scope === "boxes" || effect.scope === "both")
            const snapshot: GridPulseFrameSnapshot = {
                now,
                width,
                height,
                dpr,
                ready: sourceReadyRef.current,
                active,
                reducedMotion: reducedMotionRef.current,
                pointer: {
                    x: crosshairPositionRef.current.x,
                    y: crosshairPositionRef.current.y,
                    inside: pointerRef.current.inside,
                },
                points: snapshotPoints,
                boxes: snapshotBoxes,
                sourceCanvas,
                calloutCanvas: boxEffectEnabled ? fullEffectCanvas : sourceCanvas,
            }
            lastSnapshotRef.current = snapshot
            subscribersRef.current.forEach(listener => {
                try {
                    listener(snapshot)
                } catch (error) {
                    onError?.(
                        error instanceof Error
                            ? error
                            : new Error("GridPulse frame subscriber failed.")
                    )
                }
            })
            if (shouldDrawOverlay) overlayDirtyRef.current = false

            const needsAnotherFrame =
                !rendering.demandDriven ||
                videoNeedsPolling ||
                overlayAnimated ||
                mediaDirtyRef.current ||
                overlayDirtyRef.current
            if (needsAnotherFrame) schedule()
        }

        ensureFrameRef.current = schedule
        schedule()
        return () => {
            disposed = true
            ensureFrameRef.current = () => undefined
            if (frameRequestRef.current !== null) cancelAnimationFrame(frameRequestRef.current)
            frameRequestRef.current = null
        }
    }, [
        boxes,
        connections,
        crosshair,
        detection.mode,
        effect,
        grid,
        labels,
        media,
        motion,
        onError,
        rendering,
        theme,
    ])

    const normalizedPointer = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
        const rect = event.currentTarget.getBoundingClientRect()
        return {
            x: clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1),
            y: clamp((event.clientY - rect.top) / Math.max(1, rect.height), 0, 1),
        }
    }, [])

    const handlePointerEnter = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            if (leaveTimerRef.current) {
                clearTimeout(leaveTimerRef.current)
                leaveTimerRef.current = null
            }
            const point = normalizedPointer(event)
            pointerRef.current = { ...point, inside: true }
            overlayDirtyRef.current = true
            ensureFrameRef.current()
            if (interaction.activation === "hover") {
                setActive(true)
                if (interaction.rescanOnEnter) void scan()
            } else if (interaction.mobileAlwaysOn && event.pointerType === "touch") {
                setActive(true)
            }
        },
        [interaction.activation, interaction.mobileAlwaysOn, interaction.rescanOnEnter, normalizedPointer, scan, setActive]
    )

    const handlePointerMove = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            if (event.pointerType === "touch" && !interaction.touchCrosshair) return
            const point = normalizedPointer(event)
            pointerRef.current = { ...point, inside: true }
            overlayDirtyRef.current = true
            ensureFrameRef.current()
        },
        [interaction.touchCrosshair, normalizedPointer]
    )

    const handlePointerLeave = useCallback(() => {
        pointerRef.current.inside = false
        overlayDirtyRef.current = true
        ensureFrameRef.current()
        if (
            interaction.activation === "hover" &&
            interaction.deactivateOnLeave &&
            !isCoarsePointerRef.current
        ) {
            if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current)
            const delay = Math.max(0, interaction.leaveDelay)
            if (delay === 0 || reducedMotionRef.current) {
                setActive(false)
            } else {
                leaveTimerRef.current = setTimeout(() => {
                    leaveTimerRef.current = null
                    if (!pointerRef.current.inside) setActive(false)
                }, delay)
            }
        }
    }, [
        interaction.activation,
        interaction.deactivateOnLeave,
        interaction.leaveDelay,
        setActive,
    ])

    const handlePointerDown = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            if (touchReleaseTimerRef.current) {
                clearTimeout(touchReleaseTimerRef.current)
                touchReleaseTimerRef.current = null
            }
            const point = normalizedPointer(event)
            if (event.pointerType !== "touch" || interaction.touchCrosshair) {
                pointerRef.current = { ...point, inside: true }
                overlayDirtyRef.current = true
                ensureFrameRef.current()
            }

            let requestRescan = interaction.clickToRescan
            if (event.pointerType === "touch") {
                const touch = resolveGridPulseTouchBehavior({
                    behavior: interaction.touchBehavior,
                    activation: interaction.activation,
                    mobileAlwaysOn: interaction.mobileAlwaysOn,
                    currentlyActive: activeRef.current,
                    phase: "down",
                })
                setActive(touch.active)
                requestRescan = interaction.touchRescan && touch.rescan
                event.currentTarget.setPointerCapture?.(event.pointerId)
            } else if (interaction.activation === "tap") {
                setActive(!activeRef.current)
            }

            if (requestRescan) void scan(point)
            const video = videoRef.current
            if (video && video.paused && media.videoAutoPlay) void video.play().catch(() => undefined)
        },
        [
            interaction.activation,
            interaction.clickToRescan,
            interaction.mobileAlwaysOn,
            interaction.touchBehavior,
            interaction.touchCrosshair,
            interaction.touchRescan,
            media.videoAutoPlay,
            normalizedPointer,
            scan,
            setActive,
        ]
    )

    const finishTouchInteraction = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            if (event.pointerType !== "touch") return
            const touch = resolveGridPulseTouchBehavior({
                behavior: interaction.touchBehavior,
                activation: interaction.activation,
                mobileAlwaysOn: interaction.mobileAlwaysOn,
                currentlyActive: activeRef.current,
                phase: event.type === "pointercancel" ? "cancel" : "up",
            })
            if (!touch.releaseAfterMs) return
            const release = () => {
                touchReleaseTimerRef.current = null
                setActive(false)
            }
            const delay = reducedMotionRef.current ? 0 : Math.max(0, interaction.touchReleaseDelay)
            if (delay === 0) release()
            else touchReleaseTimerRef.current = setTimeout(release, delay)
        },
        [
            interaction.activation,
            interaction.mobileAlwaysOn,
            interaction.touchBehavior,
            interaction.touchReleaseDelay,
            setActive,
        ]
    )

    const handleKeyDown = useCallback(
        (event: KeyboardEvent<HTMLDivElement>) => {
            if (!interaction.keyboardControls) return
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                setActive(true)
                void scan({ x: pointerRef.current.x, y: pointerRef.current.y })
            } else if (event.key === "Escape" && interaction.activation !== "always") {
                setActive(false)
            }
        },
        [interaction.activation, interaction.keyboardControls, scan, setActive]
    )

    const rootStyle: CSSProperties = {
        position: "relative",
        width: "100%",
        height: aspectRatio === "free" ? "100%" : undefined,
        minHeight: aspectRatio === "free" ? 180 : undefined,
        aspectRatio: aspectRatioValue(aspectRatio),
        overflow: "hidden",
        background: theme.background,
        isolation: "isolate",
        cursor: interaction.cursor,
        touchAction: interaction.touchBehavior === "press-hold" ? "none" : "manipulation",
        WebkitTapHighlightColor: "transparent",
        ...style,
    }

    return (
        <div
            ref={wrapperRef}
            className={className}
            style={rootStyle}
            role="img"
            aria-label={ariaLabel || alt}
            aria-busy={!readyState}
            tabIndex={interaction.keyboardControls ? 0 : -1}
            onPointerEnter={handlePointerEnter}
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
            onPointerDown={handlePointerDown}
            onPointerUp={finishTouchInteraction}
            onPointerCancel={finishTouchInteraction}
            onKeyDown={handleKeyDown}
            data-grid-pulse-active={activeState ? "true" : "false"}
            data-grid-pulse-ready={readyState ? "true" : "false"}
            data-grid-pulse-touch={interaction.touchBehavior}
        >
            <canvas
                ref={mediaCanvasRef}
                aria-hidden="true"
                style={{
                    position: "absolute",
                    inset: 0,
                    zIndex: 0,
                    display: "block",
                    width: "100%",
                    height: "100%",
                    pointerEvents: "none",
                }}
            />
            <canvas
                ref={canvasRef}
                aria-hidden="true"
                style={{
                    position: "absolute",
                    inset: 0,
                    zIndex: 1,
                    display: "block",
                    width: "100%",
                    height: "100%",
                    pointerEvents: "none",
                }}
            />
        </div>
    )
}
