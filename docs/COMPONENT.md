# Grid Pulse Scan Pro — component reference

A dependency-free React + Canvas tactical media scanner. Images and video,
hover / tap / always-on activation, saliency and skin-region detection with
optional native face detection, magnified callouts or centred tracking frames,
connector ticks, a coordinate crosshair, click-to-rescan, and four media
effects.

---

## Import

There is exactly one entry point, exporting two renderers.

```tsx
// The integrated Specimen + Grid Pulse renderer (default export):
import SpecimenGridPulse from "./src/GridPulseScanPro"
// The lower-level Grid Pulse engine:
import { GridPulseScan } from "./src/GridPulseScanPro"
```

`SpecimenGridPulse` wraps the engine with ten scene presets, a HUD, a preset
rail, plugin phases, GPU post-processing, and finish layers; its
`composition` option selects `"integrated"` (default), `"grid-pulse"` (engine
only), or `"specimen"` (overlay only). Everything below documents the engine;
the Specimen surface is typed in full on `SpecimenGridPulseProps`.

Everything public is re-exported from that file — the component, the defaults,
every option type, and every pure policy function. Nothing outside it should
import from `src/grid-pulse/`; `api-contract.test.ts` enforces this.

```tsx
import GridPulseScan, {
    GRID_PULSE_SCAN_DEFAULTS,
    type GridPulseScanProps,
    type GridPulseRenderBridge,
} from "./src/GridPulseScanPro"
```

## Minimal usage

```tsx
<GridPulseScan src="/media/portrait.jpg" style={{ width: "100%", height: 560 }} />
```

## Props

| Prop | Type | Purpose |
| --- | --- | --- |
| `src` | `string` | Image or video URL. Required. |
| `alt` | `string` | Accessible description. |
| `aspectRatio` | `"free" \| "16:9" \| "3:2" \| "4:3" \| "1:1" \| "4:5" \| "9:16" \| "21:8"` | Frame shape. |
| `media` | `Partial<GridPulseMediaOptions>` | Fit, focal point, mirroring, video playback. |
| `detection` | `Partial<GridPulseDetectionOptions>` | Mode, point count, spacing, focus bias, tracking. |
| `grid` | `Partial<GridPulseGridOptions>` | Spacing, colour, animation channels. |
| `connections` | `Partial<GridPulseConnectionOptions>` | Topology, ticks, draw and flow animation. |
| `crosshair` | `Partial<GridPulseCrosshairOptions>` | Follow behaviour, coordinate readout. |
| `boxes` | `Partial<GridPulseBoxOptions>` | Layout, size, zoom, brackets, sweep, acquisition animation. |
| `labels` | `Partial<GridPulseLabelOptions>` | Chip template, tokens, typography. |
| `effect` | `Partial<GridPulseEffectOptions>` | Effect type, scope, and per-effect settings. |
| `interaction` | `Partial<GridPulseInteractionOptions>` | Activation, rescan, touch model, transitions. |
| `motion` | `Partial<GridPulseMotionOptions>` | Reveal timing, easing, reduced-motion policy. |
| `rendering` | `Partial<GridPulseRenderingOptions>` | Frame-rate caps, DPR cap, demand-driven loop. |
| `theme` | `Partial<GridPulseThemeOptions>` | Background, adaptive chrome, halo. |
| `className`, `style` | | Applied to the host element. |
| `ariaLabel` | `string` | Overrides `alt` for the accessible name. |
| `onReady` | `() => void` | Media decoded and first frame drawn. |
| `onScan` | `(points: GridPulsePoint[]) => void` | Fires on every committed detection set. |
| `onActiveChange` | `(active: boolean) => void` | Overlay activation changed. |
| `onError` | `(error: Error) => void` | Media or effect failure. Effects degrade rather than throw. |
| `onRenderBridge` | `(bridge: GridPulseRenderBridge \| null) => void` | Imperative API handle. |

Options merge shallowly per group: a partial `boxes` keeps every default you
did not name. `GRID_PULSE_SCAN_DEFAULTS` is the full set, and it is the
reference for every value quoted below.

---

## Detection

`detection.mode` is `"auto" | "person" | "detail" | "custom"`.

- **detail** weights structural edges and local texture.
- **person** weights skin regions, falling back to a detail-and-centre blend.
- **auto** mixes both and deliberately retains a complementary signal so it does
  not collapse into either.
- **custom** uses `detection.manualPoints`.

Where the browser exposes `FaceDetector`, Person mode uses it and falls back to
the saliency path when it is unavailable or throws.

Detection is deterministic: the same `seed`, media, and options always produce
the same points. `trackingMode: "stable"` runs an exact minimum-cost assignment
across frames so identities survive motion.

The scoring core is pure and lives in `DetectionFieldPolicy.ts`, which is why
the quality floors can be measured without a browser.

## Boxes

`boxes.layout` selects the placement model.

| Layout | Behaviour |
| --- | --- |
| `"callout"` *(default)* | A magnified card offset from its marker, connected by a leader line. The marker is never covered. |
| `"tracking"` | A square frame centred on the feature itself, with safe-area insets, collision avoidance, and optional pointer parallax. |

`"tracking"` is the Specimen-style model. It is off by default so existing
configurations render unchanged.

## Labels

`labels.template` accepts `{score}`, `{id}`, `{coords}`, `{time}`, `{zoom}`,
and `{mode}`. Unknown tokens are left untouched rather than blanked, so a typo
is visible instead of silent.

`{time}` honours `labels.timeFormat`:

| Format | Example |
| --- | --- |
| `clock` | `03:04:05` |
| `locale` | locale-dependent, 24-hour |
| `elapsed` | `+00:00:04.500` |
| `timecode` | `00:00:04:15` at `timecodeFps` |

## Effects

`effect.type` is `none | bitmap | pixelated | code | xray`; `effect.scope` is
`boxes | media | both`.

| Effect | Notable options |
| --- | --- |
| Bitmap | `bitmapMethod` (threshold / ordered / halftone), `bitmapMatrix` (bayer2/4/8), levels, gamma, dot shape |
| Pixelated | cell size, gap, quantization levels, sampling, shape, radius |
| Code | cell size, character set, edge weight, threshold, gamma, colour mode |
| X-Ray | contrast, brightness, invert, edge strength and threshold, glow, detail retention |

`effect.refreshRate` caps expensive video effect recomputation while the overlay
keeps running at full rate. If a canvas becomes unreadable — a cross-origin
frame, typically — the effect disables itself, reports through `onError`, and
the component keeps rendering.

## Interaction

`activation` is `hover | always | tap`. On touch, `touchBehavior: "auto"`
resolves to:

| activation / flags | Resolved |
| --- | --- |
| `mobileAlwaysOn` or `activation: "always"` | `always` |
| `activation: "tap"` | `tap-toggle` |
| otherwise | `rescan` |

Keyboard: <kbd>Enter</kbd> / <kbd>Space</kbd> activates and rescans,
<kbd>Esc</kbd> deactivates.

## Imperative API

```tsx
<GridPulseScan
    src="/media/clip.mp4"
    onRenderBridge={bridge => {
        if (!bridge) return
        const stop = bridge.subscribe(frame => {
            // frame.points, frame.boxes, frame.pointer, frame.sourceCanvas …
        })
        return stop
    }}
/>
```

| Member | Returns |
| --- | --- |
| `getSourceCanvas()` | Media-only canvas in CSS pixels. Read-only. |
| `getCalloutCanvas()` | Effect-aware source used by callouts. |
| `getSize()` | `{ width, height, dpr }` |
| `getPoints()` | Current normalized points |
| `getSnapshot()` | Last published frame |
| `subscribe(listener)` | Per-frame snapshots; returns an unsubscribe function |
| `isReady()` | Media decoded |
| `requestFrame()` / `requestRender()` / `requestMediaRender()` | Force work on a demand-driven loop |

## Performance

The render loop is demand-driven: with `rendering.demandDriven` on, it stops
when no media or overlay work remains and restarts on input, resize, or a video
frame. `pauseWhenOffscreen` suspends work outside the viewport,
`useVideoFrameCallback` prefers `requestVideoFrameCallback` over polling, and
`dprCap` bounds the backing store.

## Accessibility

The host element carries `role="img"` with `aria-label` and `aria-busy`, and is
focusable when `keyboardControls` is on. Both canvases are `aria-hidden`.
`motion.respectReducedMotion` honours `prefers-reduced-motion`, freezing grid
drift, sweeps, pulses, and the crosshair follower;
`motion.reducedMotionReveal` chooses between revealing the whole batch at once
and preserving sequential pops.

> **Known issue.** `role="img"` on an element that is focusable and handles
> keyboard and pointer input is a questionable pairing: assistive technology is
> told the element is a static image while it behaves as a control. This was
> inherited from v2.29 and has not been changed, because altering the accessible
> role changes announced behaviour and no reference was available to compare
> against. It is a candidate for a future iteration.


---

## Engine presets

`preset` applies one of eleven named configuration bundles beneath your
per-group overrides (your explicit options always win):

`loupe · telemetry · plate · survey · lattice · contour · hairline · swarm ·
field · viewfinder · tracking`

Each bundle only turns public knobs — `GRID_PULSE_SCAN_PRESETS` lists the
names, `resolveGridPulsePreset(name)` returns the bundle. Captures of all
eleven at 1200 px are committed under `docs/captures/`.

## Thermal effect and dither palettes

- `effect.type: "thermal"` — false-colour from luminance with
  `thermalPalette: "ironbow" | "white-hot" | "rainbow"`, plus
  `thermalContrast`, `thermalBrightness`, `thermalGamma`.
- `effect.bitmapMethod: "diffusion"` — Floyd–Steinberg error diffusion.
- `effect.bitmapPalette: "none" | "duotone" | "mono4" | "handheld" | "amber" |
  "cmyk"` — named palettes honoured by the ordered, threshold, and diffusion
  methods; `"none"` preserves the tint-on-background behaviour.

## Label tokens (full set)

`{score} {id} {coords} {time} {zoom} {mode} {pct} {index} {n} {x} {y} {label}
{fps}` — see `labels.template`. `labels.letterSpacing` (em, default 0.085) and
`labels.uppercase` (default true) carry the plan's measured chip calibration.

## Density and tracking at scale

`detection.pointCount` accepts up to 80. Identity assignment uses the exact
minimum-cost solver up to 12 points and a greedy nearest-first pass above
(`EXACT_ASSIGNMENT_LIMIT`), keeping dense fields tractable.

## Custom detector hook

```tsx
detection={{
    customDetector: async ({ canvas, width, height, count, focus }) => {
        // your model here — return normalized points
        return [{ x: 0.4, y: 0.5, score: 0.9, id: "CELL-01" }]
    },
}}
```

The hook replaces the built-in scan; exceptions or rejections fall back to
built-in detection and surface through `onError`. The hook participates in
options identity by presence, not function identity.

## Vision framework (Specimen surface)

`VisionPlugin` (phases `before-overlay | after-overlay | post-process`),
`InspectionEffectStack`, `VisionTheme` / `SCIENTIFIC_VISION_THEME`,
`VisionPerformanceMonitor`, `VisionTimeline`,
`createCanvasCaptureController` (MediaRecorder-backed),
`VisionSceneGraphStore` (nearest / mst / mesh), `RenderingPipeline` with
`RENDERER_PROFILES`, `GpuPostProcessor` with automatic WebGL2 detection and
canvas2d fallback, and adaptive quality (`resolveVisionQuality`,
`degradeQuality`). All exported from the entry point.
