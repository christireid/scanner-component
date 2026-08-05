# Real-media test report

Four user-supplied photographs, chosen (as delivered) to stress four different
failure classes. 40 scenarios captured per `tools/build-media-matrix.mjs` +
`docs/captures/media/capture-log.json`; every number below comes from that log
or from the committed captures.

| Photo | Source | Stress |
| --- | --- | --- |
| `dahlia-dark` | 3694×2146 | high contrast on black |
| `xray-lilies-white` | 3250×2600 | translucent structures on **white** — chrome-contrast worst case |
| `saponaria-magenta` | 3531×5296 portrait | warm magenta/orange, skin-adjacent tones — Person-mode false-positive bait |
| `helichrysum-soft` | 6016×3900 (23 MP) | soft low-contrast blur — saliency and downscale stress |

## Results

- **40 of 40 scenarios rendered, 0 page errors** (10 scenarios × 4 photos:
  default, detail, person, adaptive, xray, thermal, diffusion, swarm preset,
  tracking preset, Specimen Botanical Analysis).
- **Engine frame rate:** 50–62 rAF/s in every engine scenario, including the
  23 MP source. Effects are throttled by `effect.refreshRate` as designed.
- **Detection placement (visual inspection of committed captures):** points
  land on structure in all four photos — petal edges and centre on the dahlia,
  stem joints and stamen clusters on the lilies, flower clusters on the
  saponaria, blooms and stem on the helichrysum. **Person mode on the
  skin-adjacent magenta scene kept all 6 points on warm flower/stem structure;
  none landed in the flat background.**
- **Portrait media (3531×5296) in a landscape frame:** cover fit, no
  distortion, callouts sample the correct regions.

## Finding: the shipped default was illegible on white media

`lilies-default` under the pre-existing `adaptiveChrome: false` default:
white grid, leaders, markers, borders and sweep over a white photograph —
functionally invisible (kept as
`docs/captures/media/lilies-default-before.jpg`). Chips survived (dark
backing). The component's own adaptive chrome fully corrects it, choosing dark
chrome per the sampled media.

**Change:** `theme.adaptiveChrome` now defaults to **true** with
`chromeSpatialMode: "global"` (single contrast decision — the cheap path;
`regional` remains opt-in). Re-measured after the flip:

| Scenario | Chrome chosen | rAF/s |
| --- | --- | --- |
| lilies-default (white) | dark — legible | 58 |
| dahlia-default (black) | light, with per-point dark on a bright petal | 61 |
| saponaria-default | light | 61 |
| helichrysum-default (pastel) | dark | 61 |

Reverting is one flag: `theme={{ adaptiveChrome: false }}`. The reference's
own behaviour on light media is unknown (UNREACHABLE §1); this default is
justified by our legibility floor, not by claimed parity.

## Honest limitations recorded

- **Specimen renderer in headless Chromium** — originally recorded here as
  "~6 rAF/s, not tuned". Superseded by parity-log iteration 19: the real
  cause was SwiftShader passing the WebGL2 capability probe while running the
  GPU pass in software, plus a degradation loop too slow to react. After
  software-GL detection and windowed degradation, the same scenarios run at
  23–25 rAF/s against the low tier's 24 fps budget.
- **First diffusion pass on the 23 MP source took 3.1 s** to first ready;
  subsequent refreshes are throttled. Large-source diffusion cost scales with
  the bitmap grid, not the source, so `bitmapScale` is the lever.
- Detection-placement quality on these photos is assessed by inspection of the
  committed captures, not by a ground-truth metric — these photographs have no
  annotated truth regions. The numeric floors remain measured on the synthetic
  corpus (BASELINE.md).


## Behaviour suite (browser-driven)

`tools/behavior-tests.mjs` against the instrumented harness
(`tools/build-behavior-harness.mjs`); results in
`docs/captures/behavior-log.json`. **12 of 12 checks pass:**

| Check | Measured |
| --- | --- |
| Video plays and paints | media-canvas motion 1.74M units / 600 ms on the VP8 pan fixture |
| Video re-acquisition | 6 scans in 4.2 s at a 900 ms interval |
| Tracking identity on video | 5/5 ids persisted across consecutive rescans |
| Hover in / hover out | inactive → active → inactive (leave delay + exit honoured) |
| Click-to-rescan | new scan committed on click |
| Click focus | `SCAN-00@(0.25,0.25)` — exactly the clicked position |
| Keyboard | Enter activates + scans; Escape deactivates |
| Touch tap | activates and issues a focused rescan |
| Mirror | midline luminance profile matches its own reverse (8.5 vs 86.3 per column) |
| Aspect 16:9, 1:1 | rendered 1.778 and 1.000 exactly |
| Reduced motion | overlay pixel diff over 700 ms = 0 |

The video fixture is VP8 (this Chromium has no H.264, as the plan's working
notes warned) and was recorded by Chromium itself via canvas
`captureStream` + `MediaRecorder` — the same pathway the component's
`createCanvasCaptureController` uses.

### Finding: explicit clicks were diluted by stability smoothing

First run of the click-focus check failed: no committed point within 0.05 of
the click. The focused `SCAN-00` point is committed at the click, but the
stable tracker's position smoothing (0.58 toward an assigned old track) and
temporal smoothing (up to 0.42 toward a previous point within a 0.28 match
radius) dragged it up to ~0.12 normalized away — video-jitter machinery
overriding a deliberate gesture. Fixed: a scan carrying an explicit focus now
snaps the focused point back to the exact click after the smoothing pipeline.
Re-measured: `SCAN-00@(0.25,0.25)` for a click at (0.25, 0.25).
