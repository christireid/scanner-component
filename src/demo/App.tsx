import { useMemo, useState } from "react"
import GridPulseScan, {
    GRID_PULSE_SCAN_DEFAULTS,
    type GridPulseBoxLayout,
    type GridPulseDetectionMode,
    type GridPulseEffect,
    type GridPulseScanProps,
} from "../GridPulseScanPro"

const effects: GridPulseEffect[] = ["none", "bitmap", "pixelated", "code", "xray"]
const modes: GridPulseDetectionMode[] = ["auto", "person", "detail"]
const layouts: GridPulseBoxLayout[] = ["callout", "tracking"]

/**
 * The eleven presets the parity programme requires to be visibly distinct.
 * They are the same set the screenshot harness emits, so what is reviewed here
 * and what is captured there cannot drift apart.
 */
const presets: Array<{ id: string; shows: string; props: Partial<GridPulseScanProps> }> = [
    { id: "default", shows: "shipped defaults", props: {} },
    {
        id: "detail-xray",
        shows: "Detail detection, X-Ray over the whole frame",
        props: { detection: { mode: "detail" }, effect: { type: "xray", scope: "both" } },
    },
    {
        id: "person-bitmap",
        shows: "Person detection, ordered-dither Bitmap callouts",
        props: { detection: { mode: "person" }, effect: { type: "bitmap", scope: "boxes" } },
    },
    {
        id: "auto-pixelated",
        shows: "Auto detection, Pixelated callouts",
        props: { detection: { mode: "auto" }, effect: { type: "pixelated", scope: "boxes" } },
    },
    {
        id: "code",
        shows: "Code glyphs across the frame",
        props: { effect: { type: "code", scope: "both" } },
    },
    {
        id: "point-mesh",
        shows: "chained point-to-point connections",
        props: { connections: { topology: "both", pointTopology: "chain" } },
    },
    {
        id: "hub-mesh",
        shows: "hub connection topology",
        props: { connections: { topology: "points", pointTopology: "hub" } },
    },
    {
        id: "tracking-frames",
        shows: "Specimen-style centred tracking frames",
        props: { boxes: { layout: "tracking", trackingParallax: 18 } },
    },
    {
        id: "grid-scan",
        shows: "grid scan band, callouts hidden",
        props: { boxes: { visible: false }, grid: { animation: "scan" } },
    },
    {
        id: "adaptive-chrome",
        shows: "regional adaptive chrome with halo",
        props: {
            theme: {
                adaptiveChrome: true,
                chromeSpatialMode: "regional",
                chromeHalo: true,
            },
        },
    },
    {
        id: "reduced-motion",
        shows: "reduced-motion reveal",
        props: { motion: { respectReducedMotion: true, reducedMotionReveal: "instant" } },
    },
]

export default function App() {
    const [presetId, setPresetId] = useState(presets[0].id)
    const [effect, setEffect] = useState<GridPulseEffect>(GRID_PULSE_SCAN_DEFAULTS.effect.type)
    const [mode, setMode] = useState<GridPulseDetectionMode>("detail")
    const [layout, setLayout] = useState<GridPulseBoxLayout>(GRID_PULSE_SCAN_DEFAULTS.boxes.layout)
    const [override, setOverride] = useState(false)

    const preset = presets.find(candidate => candidate.id === presetId) ?? presets[0]

    // Manual controls layer on top of the preset, so a preset can be inspected
    // as-shipped and then poked at without editing the preset table.
    const props = useMemo<GridPulseScanProps>(() => {
        const base: GridPulseScanProps = {
            src: "/demo-flower.jpeg",
            alt: "Demonstration media for Grid Pulse Scan Pro",
            style: { width: "100%", height: "100%" },
            interaction: { activation: "always", clickToRescan: true },
            ...preset.props,
        }
        if (!override) return base
        return {
            ...base,
            detection: { ...base.detection, mode },
            effect: { ...base.effect, type: effect, scope: "both" },
            boxes: { ...base.boxes, layout },
        }
    }, [preset, override, effect, mode, layout])

    return (
        <main className="page">
            <header className="toolbar">
                <div>
                    <h1>Grid Pulse Scan Pro</h1>
                    <p>
                        v3.0.0-rc.1 canonical build · showing <strong>{preset.id}</strong> —{" "}
                        {preset.shows}
                    </p>
                </div>

                <div className="controls">
                    <label>
                        Preset
                        <select value={presetId} onChange={event => setPresetId(event.target.value)}>
                            {presets.map(candidate => (
                                <option key={candidate.id} value={candidate.id}>
                                    {candidate.id}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="toggle">
                        <input
                            type="checkbox"
                            checked={override}
                            onChange={event => setOverride(event.target.checked)}
                        />
                        Override
                    </label>

                    <label>
                        Effect
                        <select
                            value={effect}
                            disabled={!override}
                            onChange={event => setEffect(event.target.value as GridPulseEffect)}
                        >
                            {effects.map(value => (
                                <option key={value}>{value}</option>
                            ))}
                        </select>
                    </label>

                    <label>
                        Detection
                        <select
                            value={mode}
                            disabled={!override}
                            onChange={event =>
                                setMode(event.target.value as GridPulseDetectionMode)
                            }
                        >
                            {modes.map(value => (
                                <option key={value}>{value}</option>
                            ))}
                        </select>
                    </label>

                    <label>
                        Box layout
                        <select
                            value={layout}
                            disabled={!override}
                            onChange={event => setLayout(event.target.value as GridPulseBoxLayout)}
                        >
                            {layouts.map(value => (
                                <option key={value}>{value}</option>
                            ))}
                        </select>
                    </label>
                </div>
            </header>

            <section className="stage">
                <GridPulseScan key={presetId} {...props} />
            </section>
        </main>
    )
}
