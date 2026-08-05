/**
 * Framer wrapper for the integrated Specimen + Grid Pulse renderer.
 *
 * The parity plan's §10 repository map lists `src/*.framer.tsx` wrappers with
 * property controls; none was delivered, so this is a new implementation. It
 * typechecks against the published `framer` type definitions; the runtime
 * module is provided by the Framer environment — this file is not imported by
 * the local demo build.
 *
 * Framer canvas notes:
 * - `@framerSupportedLayoutWidth any` / `@framerSupportedLayoutHeight any`
 *   let the component fill whatever frame the designer draws.
 * - Property controls cover the surface a designer reaches for; the full
 *   options API remains available through code overrides.
 */
import { CSSProperties } from "react"
import { addPropertyControls, ControlType } from "framer"
import SpecimenGridPulse, {
    SPECIMEN_GRID_PRESETS,
    type GridPulseDetectionMode,
    type GridPulseEffect,
    type SpecimenGridComposition,
    type SpecimenGridFinish,
    type SpecimenGridPreset,
} from "./GridPulseScanPro"

export interface SpecimenGridPulseFramerProps {
    style?: CSSProperties
    image?: { src?: string }
    video?: string
    preset: SpecimenGridPreset
    composition: SpecimenGridComposition
    finish: SpecimenGridFinish
    detectionMode: GridPulseDetectionMode
    pointCount: number
    effect: GridPulseEffect
    accentColor: string
    lineColor: string
    density: number
    magnification: number
    showHud: boolean
    showControls: boolean
    idleMotion: boolean
    gpuPostProcessing: boolean
    mirror: boolean
}

/**
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 800
 * @framerIntrinsicHeight 520
 */
export default function SpecimenGridPulseFramer(props: SpecimenGridPulseFramerProps) {
    const {
        style,
        image,
        video,
        preset,
        composition,
        finish,
        detectionMode,
        pointCount,
        effect,
        accentColor,
        lineColor,
        density,
        magnification,
        showHud,
        showControls,
        idleMotion,
        gpuPostProcessing,
        mirror,
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
        <SpecimenGridPulse
            src={src}
            style={{ width: "100%", height: "100%", ...style }}
            preset={preset}
            media={{ mirror }}
            detection={{ mode: detectionMode, pointCount }}
            effect={{ type: effect, scope: "media" }}
            specimen={{
                composition,
                finish,
                accentColor,
                lineColor,
                density,
                magnification,
                showHud,
                showControls,
                idleMotion,
                gpuPostProcessing,
            }}
        />
    )
}

addPropertyControls(SpecimenGridPulseFramer, {
    image: {
        type: ControlType.ResponsiveImage,
        title: "Image",
    },
    video: {
        type: ControlType.File,
        title: "Video",
        allowedFileTypes: ["mp4", "webm", "mov"],
    },
    preset: {
        type: ControlType.Enum,
        title: "Scene",
        options: [...SPECIMEN_GRID_PRESETS],
        defaultValue: "Feature Tracking",
    },
    composition: {
        type: ControlType.Enum,
        title: "Layers",
        options: ["integrated", "grid-pulse", "specimen"],
        optionTitles: ["Integrated", "Grid Pulse only", "Specimen only"],
        defaultValue: "integrated",
    },
    finish: {
        type: ControlType.Enum,
        title: "Finish",
        options: ["minimal", "editorial", "laboratory"],
        defaultValue: "laboratory",
    },
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
    effect: {
        type: ControlType.Enum,
        title: "Effect",
        options: ["none", "bitmap", "pixelated", "code", "xray", "thermal"],
        defaultValue: "none",
    },
    accentColor: {
        type: ControlType.Color,
        title: "Accent",
        defaultValue: "#b7ff46",
    },
    lineColor: {
        type: ControlType.Color,
        title: "Lines",
        defaultValue: "#f5f5f0",
    },
    density: {
        type: ControlType.Number,
        title: "Density",
        min: 4,
        max: 40,
        step: 1,
        defaultValue: 18,
    },
    magnification: {
        type: ControlType.Number,
        title: "Zoom",
        min: 1,
        max: 4,
        step: 0.1,
        defaultValue: 1.9,
    },
    showHud: { type: ControlType.Boolean, title: "HUD", defaultValue: true },
    showControls: { type: ControlType.Boolean, title: "Preset rail", defaultValue: true },
    idleMotion: { type: ControlType.Boolean, title: "Idle motion", defaultValue: true },
    gpuPostProcessing: { type: ControlType.Boolean, title: "GPU effects", defaultValue: true },
    mirror: { type: ControlType.Boolean, title: "Mirror", defaultValue: false },
})
