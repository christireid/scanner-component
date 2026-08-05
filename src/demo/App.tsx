import { useMemo, useState } from "react"
import SpecimenGridPulsePlayground from "./SpecimenGridPulsePlayground"
import CaptureApp from "./CaptureApp"
import SpecimenGridPulse, {
    GRID_PULSE_SCAN_PRESETS,
    GridPulseScan,
    SPECIMEN_GRID_PRESETS,
    type GridPulseEffect,
    type GridPulseDetectionMode,
    type GridPulseScanPreset,
    type SpecimenGridPreset,
} from "../GridPulseScanPro"

const effects: GridPulseEffect[] = ["none", "bitmap", "pixelated", "code", "xray", "thermal"]
const modes: GridPulseDetectionMode[] = ["auto", "person", "detail"]

type RendererChoice = "integrated" | "engine" | "playground" | "capture"

/**
 * Demo for the combined component.
 *
 * - "integrated" renders the default export: the Specimen + Grid Pulse
 *   renderer with its ten scene presets, HUD, and controls rail.
 * - "engine" renders the lower-level Grid Pulse engine with the parity
 *   plan's eleven named presets.
 */
export default function App() {
    const [renderer, setRenderer] = useState<RendererChoice>("integrated")
    const [specimenPreset, setSpecimenPreset] = useState<SpecimenGridPreset>("Feature Tracking")
    const [enginePreset, setEnginePreset] = useState<GridPulseScanPreset | "">("")
    const [effect, setEffect] = useState<GridPulseEffect>("none")
    const [mode, setMode] = useState<GridPulseDetectionMode>("auto")
    const [override, setOverride] = useState(false)

    const engineProps = useMemo(
        () => ({
            src: "/demo-flower.jpeg",
            alt: "Demonstration media for Grid Pulse Scan Pro",
            style: { width: "100%", height: "100%" },
            interaction: { activation: "always" as const, clickToRescan: true },
            ...(enginePreset ? { preset: enginePreset } : {}),
            ...(override
                ? {
                      detection: { mode },
                      effect: { type: effect, scope: "media" as const },
                  }
                : {}),
        }),
        [enginePreset, override, mode, effect]
    )

    return (
        <main className="page">
            <header className="toolbar">
                <div>
                    <h1>Grid Pulse Scan Pro</h1>
                    <p>
                        v3.0 canonical build · {renderer === "integrated"
                            ? `Specimen preset — ${specimenPreset}`
                            : `engine preset — ${enginePreset || "defaults"}`}
                    </p>
                </div>

                <div className="controls">
                    <label>
                        Renderer
                        <select
                            value={renderer}
                            onChange={event => setRenderer(event.target.value as RendererChoice)}
                        >
                            <option value="integrated">integrated (Specimen)</option>
                            <option value="engine">engine (Grid Pulse)</option>
                            <option value="playground">playground (v2.8)</option>
                            <option value="capture">capture app (v2.8)</option>
                        </select>
                    </label>

                    {renderer === "integrated" ? (
                        <label>
                            Scene
                            <select
                                value={specimenPreset}
                                onChange={event =>
                                    setSpecimenPreset(event.target.value as SpecimenGridPreset)
                                }
                            >
                                {SPECIMEN_GRID_PRESETS.map(name => (
                                    <option key={name}>{name}</option>
                                ))}
                            </select>
                        </label>
                    ) : (
                        <label>
                            Preset
                            <select
                                value={enginePreset}
                                onChange={event =>
                                    setEnginePreset(event.target.value as GridPulseScanPreset | "")
                                }
                            >
                                <option value="">defaults</option>
                                {GRID_PULSE_SCAN_PRESETS.map(name => (
                                    <option key={name}>{name}</option>
                                ))}
                            </select>
                        </label>
                    )}

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
                </div>
            </header>

            <section className="stage">
                {renderer === "playground" ? (
                    <SpecimenGridPulsePlayground src="/demo-flower.jpeg" style={{ width: "100%", height: "100%" }} />
                ) : renderer === "capture" ? (
                    <CaptureApp />
                ) : renderer === "integrated" ? (
                    <SpecimenGridPulse
                        key={specimenPreset}
                        src="/demo-flower.jpeg"
                        alt="Demonstration media for Specimen Grid Pulse Pro"
                        preset={specimenPreset}
                        style={{ width: "100%", height: "100%" }}
                        {...(override
                            ? {
                                  detection: { mode },
                                  effect: { type: effect, scope: "media" as const },
                              }
                            : {})}
                    />
                ) : (
                    <GridPulseScan key={enginePreset || "defaults"} {...engineProps} />
                )}
            </section>
        </main>
    )
}
