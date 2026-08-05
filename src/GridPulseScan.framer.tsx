/**
 * Framer wrapper for the Grid Pulse engine — the surface that mirrors the
 * reference marketplace component's control set: media, detection mode,
 * effect, aspect ratio, mirror, activation, and the chrome basics.
 *
 * New implementation (the plan's §10 wrapper was never delivered). Typechecks
 * against the published `framer` type definitions; Framer provides the module
 * at runtime. Not part of the local demo build.
 */
import { CSSProperties } from "react"
import { addPropertyControls, ControlType } from "framer"
import {
    GRID_PULSE_SCAN_PRESETS,
    GridPulseScan,
    type GridPulseActivationMode,
    type GridPulseAspectRatio,
    type GridPulseDetectionMode,
    type GridPulseEffect,
    type GridPulseScanPreset,
} from "./GridPulseScanPro"

export interface GridPulseScanFramerProps {
    style?: CSSProperties
    image?: { src?: string }
    video?: string
    preset?: GridPulseScanPreset | "none"
    aspectRatio: GridPulseAspectRatio
    mirror: boolean
    detectionMode: GridPulseDetectionMode
    pointCount: number
    activation: GridPulseActivationMode
    clickToRescan: boolean
    effect: GridPulseEffect
    gridVisible: boolean
    gridOpacity: number
    crosshairVisible: boolean
    boxesVisible: boolean
    labelTemplate: string
    adaptiveChrome: boolean
    chromeColor: string
}

/**
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 800
 * @framerIntrinsicHeight 520
 */
export default function GridPulseScanFramer(props: GridPulseScanFramerProps) {
    const {
        style,
        image,
        video,
        preset,
        aspectRatio,
        mirror,
        detectionMode,
        pointCount,
        activation,
        clickToRescan,
        effect,
        gridVisible,
        gridOpacity,
        crosshairVisible,
        boxesVisible,
        labelTemplate,
        adaptiveChrome,
        chromeColor,
    } = props
    const src = video || image?.src || ""
    if (!src) {
        return (
            <div
                style={{
                    ...style,
                    display: "grid",
                    placeItems: "center",
                    background: "#050605",
                    color: "#a9ada5",
                    font: "12px ui-monospace, monospace",
                    borderRadius: 12,
                }}
            >
                Set an image or video in the properties panel
            </div>
        )
    }
    return (
        <GridPulseScan
            src={src}
            style={{ width: "100%", height: "100%", ...style }}
            {...(preset && preset !== "none" ? { preset } : {})}
            aspectRatio={aspectRatio}
            media={{ mirror }}
            detection={{ mode: detectionMode, pointCount }}
            interaction={{ activation, clickToRescan }}
            effect={{ type: effect, scope: "media" }}
            grid={{ visible: gridVisible, opacity: gridOpacity }}
            crosshair={{ visible: crosshairVisible }}
            boxes={{ visible: boxesVisible }}
            labels={{ template: labelTemplate }}
            theme={{ adaptiveChrome, chromeLight: chromeColor }}
        />
    )
}

addPropertyControls(GridPulseScanFramer, {
    image: { type: ControlType.ResponsiveImage, title: "Image" },
    video: {
        type: ControlType.File,
        title: "Video",
        allowedFileTypes: ["mp4", "webm", "mov"],
    },
    preset: {
        type: ControlType.Enum,
        title: "Preset",
        options: ["none", ...GRID_PULSE_SCAN_PRESETS],
        defaultValue: "none",
    },
    aspectRatio: {
        type: ControlType.Enum,
        title: "Aspect",
        options: ["free", "16:9", "3:2", "4:3", "1:1", "4:5", "9:16", "21:8"],
        defaultValue: "free",
    },
    mirror: { type: ControlType.Boolean, title: "Mirror", defaultValue: false },
    detectionMode: {
        type: ControlType.Enum,
        title: "Detection",
        options: ["auto", "person", "detail"],
        defaultValue: "auto",
    },
    pointCount: {
        type: ControlType.Number,
        title: "Points",
        min: 1,
        max: 80,
        step: 1,
        defaultValue: 5,
    },
    activation: {
        type: ControlType.Enum,
        title: "Activate",
        options: ["hover", "always", "tap"],
        defaultValue: "hover",
    },
    clickToRescan: { type: ControlType.Boolean, title: "Click rescan", defaultValue: true },
    effect: {
        type: ControlType.Enum,
        title: "Effect",
        options: ["none", "bitmap", "pixelated", "code", "xray", "thermal"],
        defaultValue: "none",
    },
    gridVisible: { type: ControlType.Boolean, title: "Grid", defaultValue: true },
    gridOpacity: {
        type: ControlType.Number,
        title: "Grid opacity",
        min: 0,
        max: 1,
        step: 0.01,
        defaultValue: 0.14,
        hidden: props => !props.gridVisible,
    },
    crosshairVisible: { type: ControlType.Boolean, title: "Crosshair", defaultValue: true },
    boxesVisible: { type: ControlType.Boolean, title: "Zoom boxes", defaultValue: true },
    labelTemplate: {
        type: ControlType.String,
        title: "Chip text",
        defaultValue: "{score} ({zoom})",
    },
    adaptiveChrome: { type: ControlType.Boolean, title: "Adaptive chrome", defaultValue: true },
    chromeColor: {
        type: ControlType.Color,
        title: "Chrome",
        defaultValue: "#ffffff",
        hidden: props => Boolean(props.adaptiveChrome),
    },
})
