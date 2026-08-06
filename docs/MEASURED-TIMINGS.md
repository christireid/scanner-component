# Measured behavioural timings — our side

Rubric §7C compares timings against the live reference, which is unreachable
here ([UNREACHABLE.md](./UNREACHABLE.md) §1). This table is **our half of that
comparison**, measured in real Chromium by `tools/measure-timings.mjs`
(raw values: `docs/captures/timings.json`), so the comparison is immediate the
moment reference captures exist. Nothing here is evidence about the reference.

Sampling is rAF-quantized: one 60 Hz frame ≈ 16.7 ms of inherent tolerance.

| Rubric row | Quantity | Configured | Measured | Note |
| --- | --- | --- | --- | --- |
| C1 | Total reveal, first point start → last point at 99% | 4×90 + ~330 ≈ 690 ms (5 points) | **683.3 ms** | within one frame |
| C1 | Per-point reveal to 99% of eased value | ~330 ms (easeOut cubic on 420 ms) | **316.6 ms** | 0.99 of easeOut(420 ms) lands at 0.785 × duration |
| C2 | Per-point stagger | 90 ms | **91.7 ms mean** (83.3, 100, 83.3, 100) | frame quantization |
| C4 | Box sweep period | 1450 ms, vertical, loop | **1458 ms mean** (1435, 1482) | ±1 frame |
| C5 | Crosshair latency to 99% of a 600 px jump | 95 ms | **109.5 ms** | +14.5 ms, under one rAF frame |
| C6 | Hover-out deactivation | 90 ms leave delay | **105.7 ms** | delay + ~1 frame |
| C6 | Hover-out to fully cleared overlay | 90 + 220 = 310 ms | **339.2 ms** | fade completes then the loop idles |
| §5.3 | Chip text contrast (composited pixels) | floor 13.9:1 | **17.1:1** | white text on the default chip backing over dark media |
| — | Resize re-projection | exact | **0 of 5 points misprojected** at 1200→900 px | `applySize` re-projects from normalized coordinates |

Method notes recorded honestly:

- Reveal is measured on the **first scan after load**. Matched rescan points
  keep their original `revealedAt` by design, so a rescan of a static image
  re-reveals nothing — the first measurement attempt hit exactly that and was
  an instrument bug, not a finding.
- The sweep detector tracks the row of greatest **temporal change** in a box
  column; absolute brightness fails on bright media.
- The crosshair number carries the `deltaMs` clamp caveat: a long first frame
  covers more of the gap at once.
