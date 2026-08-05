import { ChangeEvent, CSSProperties, useMemo, useState } from "react"
import SpecimenGridPulse, {
    SPECIMEN_GRID_PRESETS,
    SpecimenGridComposition,
    SpecimenGridFinish,
    SpecimenGridPreset,
} from "../GridPulseScanPro"
import { GridPulseEffect, GridPulsePoint } from "../GridPulseScanPro"

export interface SpecimenGridPulsePlaygroundProps {
    src?: string
    style?: CSSProperties
}

const BOTANICAL_ANCHORS: GridPulsePoint[] = [
    { x: 0.19, y: 0.27, score: 0.99, id: "FROND-01" },
    { x: 0.66, y: 0.22, score: 0.97, id: "FROND-02" },
    { x: 0.49, y: 0.43, score: 0.95, id: "VEIN-03" },
    { x: 0.76, y: 0.58, score: 0.92, id: "VEIN-04" },
    { x: 0.34, y: 0.72, score: 0.89, id: "EDGE-05" },
    { x: 0.82, y: 0.83, score: 0.86, id: "EDGE-06" },
]

const panelStyle: CSSProperties = {
    display: "grid",
    alignContent: "start",
    gap: 13,
    padding: 16,
    border: "1px solid rgba(255,255,255,.1)",
    borderRadius: 14,
    background: "linear-gradient(180deg,rgba(12,14,11,.96),rgba(6,7,6,.96))",
    boxShadow: "0 24px 70px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.04)",
    color: "#f5f5f0",
    font: "12px/1.4 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
}

const labelStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "118px minmax(0,1fr)",
    alignItems: "center",
    gap: 10,
}

const inputStyle: CSSProperties = {
    width: "100%",
    minWidth: 0,
    accentColor: "#cfff55",
}

export default function SpecimenGridPulsePlayground({
    src = "/xray-lilies.jpeg",
    style,
}: SpecimenGridPulsePlaygroundProps) {
    const [preset, setPreset] = useState<SpecimenGridPreset>("Feature Tracking")
    const [composition, setComposition] = useState<SpecimenGridComposition>("integrated")
    const [finish, setFinish] = useState<SpecimenGridFinish>("laboratory")
    const [effect, setEffect] = useState<GridPulseEffect>("none")
    const [magnification, setMagnification] = useState(2.15)
    const [distortion, setDistortion] = useState(2.4)
    const [density, setDensity] = useState(18)
    const [guideOpacity, setGuideOpacity] = useState(0.86)
    const [trackingFrameScale, setTrackingFrameScale] = useState(1)
    const [focusX, setFocusX] = useState(0.5)
    const [focusY, setFocusY] = useState(0.5)
    const [focusRadius, setFocusRadius] = useState(0.72)
    const [labelScale, setLabelScale] = useState(1)
    const [accent, setAccent] = useState("#cfff55")
    const [useImageAnchors, setUseImageAnchors] = useState(true)
    const [pointCount, setPointCount] = useState(BOTANICAL_ANCHORS.length)
    const [active, setActive] = useState(true)

    const detection = useMemo(
        () =>
            useImageAnchors
                ? {
                      mode: "custom" as const,
                      pointCount: BOTANICAL_ANCHORS.length,
                      manualPoints: BOTANICAL_ANCHORS,
                      mobilePointLimit: 3,
                      minDistance: 0.1,
                  }
                : {
                      mode: "detail" as const,
                      pointCount: 6,
                      mobilePointLimit: 3,
                      edgeSensitivity: 0.74,
                      centerBias: 0.08,
                  },
        [useImageAnchors]
    )

    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
                alignItems: "start",
                gap: "clamp(12px, 2vw, 18px)",
                width: "100%",
                padding: 18,
                boxSizing: "border-box",
                border: "1px solid rgba(255,255,255,.06)",
                borderRadius: 20,
                background: "radial-gradient(circle at 38% 10%,rgba(207,255,85,.055),transparent 36%),#050605",
                boxShadow: "0 34px 100px rgba(0,0,0,.24)",
                ...style,
            }}
        >
            <div style={{ display: "grid", gap: 10, minWidth: 0 }}>
                <SpecimenGridPulse
                    src={src}
                    alt="Botanical canopy analyzed with synchronized Specimen tracking frames and Grid Pulse telemetry"
                    aspectRatio="4:5"
                    preset={preset}
                    onPresetChange={setPreset}
                    onScan={points => setPointCount(points.length)}
                    onActiveChange={setActive}
                    media={{ objectFit: "cover", positionX: 0.5, positionY: 0.5 }}
                    detection={detection}
                    specimen={{
                        composition,
                        finish,
                        accentColor: accent,
                        magnification,
                        distortion,
                        density,
                        guideOpacity,
                        trackingFrameScale,
                        focusX,
                        focusY,
                        focusRadius,
                        labelScale,
                        showGuideLines: true,
                        guideStyle: "hybrid",
                        showControls: true,
                        controlVariant: "rail",
                        maxOverlayFps: 40,
                        mediaSampleRate: 18,
                    }}
                    interaction={{
                        activation: "always",
                        clickToRescan: true,
                        mobileAlwaysOn: true,
                        cursor: "crosshair",
                    }}
                    effect={{
                        type: effect,
                        scope: effect === "none" ? "boxes" : "both",
                        refreshRate: 12,
                    }}
                    rendering={{
                        maxFps: 60,
                        staticImageFps: 24,
                        inactiveFps: 4,
                        dprCap: 2,
                        demandDriven: true,
                        useVideoFrameCallback: true,
                        pauseWhenOffscreen: true,
                    }}
                    style={{ minHeight: 420 }}
                />
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        color: "rgba(255,255,255,.42)",
                        font: "650 8px/1.3 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                        letterSpacing: ".1em",
                        textTransform: "uppercase",
                    }}
                >
                    <span>{active ? "Scanner active" : "Scanner idle"}</span>
                    <span>{pointCount} registered regions</span>
                </div>
            </div>

            <aside style={panelStyle}>
                <div style={{ display: "grid", gap: 4 }}>
                    <strong style={{ fontSize: 13, letterSpacing: ".1em" }}>COMPOSITE CONTROLS</strong>
                    <span style={{ color: "rgba(255,255,255,.42)", fontSize: 9 }}>
                        Specimen composition + Grid Pulse detection
                    </span>
                </div>

                <label style={labelStyle}>
                    <span>Preset</span>
                    <select value={preset} onChange={(event: ChangeEvent<HTMLSelectElement>) => setPreset(event.target.value as SpecimenGridPreset)} style={inputStyle}>
                        {SPECIMEN_GRID_PRESETS.map(option => <option key={option}>{option}</option>)}
                    </select>
                </label>

                <label style={labelStyle}>
                    <span>Composition</span>
                    <select value={composition} onChange={(event: ChangeEvent<HTMLSelectElement>) => setComposition(event.target.value as SpecimenGridComposition)} style={inputStyle}>
                        <option value="integrated">Integrated</option>
                        <option value="grid-pulse">Grid Pulse only</option>
                        <option value="specimen">Specimen only</option>
                    </select>
                </label>

                <label style={labelStyle}>
                    <span>Finish</span>
                    <select value={finish} onChange={(event: ChangeEvent<HTMLSelectElement>) => setFinish(event.target.value as SpecimenGridFinish)} style={inputStyle}>
                        <option value="laboratory">Laboratory</option>
                        <option value="editorial">Editorial</option>
                        <option value="minimal">Minimal</option>
                    </select>
                </label>

                <label style={labelStyle}>
                    <span>Media effect</span>
                    <select value={effect} onChange={(event: ChangeEvent<HTMLSelectElement>) => setEffect(event.target.value as GridPulseEffect)} style={inputStyle}>
                        <option value="none">None</option>
                        <option value="bitmap">Bitmap</option>
                        <option value="pixelated">Pixelated</option>
                        <option value="code">Code</option>
                        <option value="xray">X-Ray</option>
                    </select>
                </label>

                <label style={labelStyle}>
                    <span>Image anchors</span>
                    <input
                        type="checkbox"
                        checked={useImageAnchors}
                        onChange={(event: ChangeEvent<HTMLInputElement>) => setUseImageAnchors(event.target.checked)}
                        style={{ ...inputStyle, width: 16, justifySelf: "start" }}
                    />
                </label>

                <label style={labelStyle}>
                    <span>Magnification</span>
                    <input type="range" min="1" max="4" step="0.05" value={magnification} onChange={(event: ChangeEvent<HTMLInputElement>) => setMagnification(Number(event.target.value))} style={inputStyle} />
                </label>

                <label style={labelStyle}>
                    <span>Distortion</span>
                    <input type="range" min="0" max="12" step="0.1" value={distortion} onChange={(event: ChangeEvent<HTMLInputElement>) => setDistortion(Number(event.target.value))} style={inputStyle} />
                </label>

                <label style={labelStyle}>
                    <span>Density</span>
                    <input type="range" min="4" max="30" step="1" value={density} onChange={(event: ChangeEvent<HTMLInputElement>) => setDensity(Number(event.target.value))} style={inputStyle} />
                </label>
                <label style={labelStyle}>
                    <span>Guide opacity</span>
                    <input type="range" min="0" max="1" step="0.01" value={guideOpacity} onChange={(event: ChangeEvent<HTMLInputElement>) => setGuideOpacity(Number(event.target.value))} style={inputStyle} />
                </label>

                <label style={labelStyle}>
                    <span>Tracking scale</span>
                    <input type="range" min="0.65" max="1.45" step="0.01" value={trackingFrameScale} onChange={(event: ChangeEvent<HTMLInputElement>) => setTrackingFrameScale(Number(event.target.value))} style={inputStyle} />
                </label>


                <label style={labelStyle}>
                    <span>Focus X</span>
                    <input type="range" min="0" max="1" step="0.01" value={focusX} onChange={(event: ChangeEvent<HTMLInputElement>) => setFocusX(Number(event.target.value))} style={inputStyle} />
                </label>

                <label style={labelStyle}>
                    <span>Focus Y</span>
                    <input type="range" min="0" max="1" step="0.01" value={focusY} onChange={(event: ChangeEvent<HTMLInputElement>) => setFocusY(Number(event.target.value))} style={inputStyle} />
                </label>

                <label style={labelStyle}>
                    <span>Focus radius</span>
                    <input type="range" min="0.08" max="1" step="0.01" value={focusRadius} onChange={(event: ChangeEvent<HTMLInputElement>) => setFocusRadius(Number(event.target.value))} style={inputStyle} />
                </label>

                <label style={labelStyle}>
                    <span>Label scale</span>
                    <input type="range" min="0.75" max="1.5" step="0.05" value={labelScale} onChange={(event: ChangeEvent<HTMLInputElement>) => setLabelScale(Number(event.target.value))} style={inputStyle} />
                </label>

                <label style={labelStyle}>
                    <span>Accent</span>
                    <input type="color" value={accent} onChange={(event: ChangeEvent<HTMLInputElement>) => setAccent(event.target.value)} style={inputStyle} />
                </label>

                <p style={{ margin: 0, paddingTop: 4, color: "rgba(255,255,255,.48)", fontSize: 9 }}>
                    Move over the canopy to drive the tracking web. Click or tap any feature to promote it to the lead inspection region.
                </p>
            </aside>
        </div>
    )
}
