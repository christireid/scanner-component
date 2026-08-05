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

- **Specimen renderer in headless Chromium: ~6 rAF/s.** `headless_shell` has
  no GPU; the WebGL2 path cannot initialise and the CPU fallback carries the
  full lens/noise/persistence stack. Not representative of GPU-backed
  browsers; not tuned here. The engine path is unaffected (50–62 rAF/s).
- **First diffusion pass on the 23 MP source took 3.1 s** to first ready;
  subsequent refreshes are throttled. Large-source diffusion cost scales with
  the bitmap grid, not the source, so `bitmapScale` is the lever.
- Detection-placement quality on these photos is assessed by inspection of the
  committed captures, not by a ground-truth metric — these photographs have no
  annotated truth regions. The numeric floors remain measured on the synthetic
  corpus (BASELINE.md).
