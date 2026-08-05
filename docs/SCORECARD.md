# Parity scorecard — v3.0.0-rc.1

Every row carries exactly one of four states.

| State | Meaning |
| --- | --- |
| **PASS** | Measured, and the measurement satisfies the row. |
| **PARTIAL** | Measured, and the measurement partly satisfies the row. |
| **FAIL** | Measured, and the measurement does not satisfy the row. |
| **UNVERIFIABLE-HERE** | Not measured, because the measurement is impossible in this environment. The reason is stated per row. |

**No total is computed.** Sections B and C are worth 60 of the 100 points and
are entirely unverifiable here, so any total would be a guess dressed as a
score. The reason is recorded once in [UNREACHABLE.md](./UNREACHABLE.md) §1:
`framer.com` and `*.framer.website` are denied by this session's egress policy,
so the reference runtime was never observed.

---

## Section A — Scope parity (20 points)

The marketplace feature list for **Grid Pulse Scan**, plus the **Specimen**
capabilities this component is meant to absorb.

| # | Row | State | Evidence |
| --- | --- | --- | --- |
| A1 | Auto, Person, Detail detection modes | PASS | `DetectionModePolicy.ts`; 3 modes produce measurably different point sets (`detection.test.ts`). |
| A2 | Animated grid | PASS | `GridAnimationPolicy.ts` — 5 animation modes, 3 scan directions. |
| A3 | Point and box connections with tick marks | PASS | `connections.topology` = leaders / points / both; `tickMarks`, `tickSpacing`, `tickLength`. |
| A4 | Box scan sweeps | PASS | `ScanSweepPolicy.ts` — 4 directions, 3 modes, 2 easings. |
| A5 | Crosshair and coordinate readout | PASS | `crosshair.showCoordinates`; latlon / percent / pixels. |
| A6 | `{score}`, `{id}`, `{coords}`, `{time}` tokens | PASS | `LabelTokenPolicy.ts`; also `{zoom}` and `{mode}`. Verified by `labels.test.ts`. |
| A7 | Click-to-rescan | PASS | `interaction.clickToRescan`, with a focused rescan around the click. |
| A8 | Always-on operation | PASS | `interaction.activation: "always"`. |
| A9 | Bitmap, Pixelated, Code, X-Ray effects | PASS | Four effect policies, each with its own option group. |
| A10 | Image and video pathways | PASS | `inferMediaType`, `requestVideoFrameCallback`, playback options. |
| A11 | Aspect ratios and mirroring | PASS | 8 ratios; `media.mirror`. |
| A12 | Configurable grid, crosshair, connections, labels, boxes, interaction, rendering, detection | PASS | 12 option groups, 238 properties. |
| A13 | Specimen-style centred tracking frames | PASS | `boxes.layout: "tracking"` — see [PARITY-LOG](./PARITY-LOG.md) iteration 3. |
| A14 | Superset: tracking, video reacquisition, point meshes, dither modes, contour tracing, density modes, parallax, viewfinder telemetry, custom detector hooks, imperative API | PASS | Asserted row by row in `api-contract.test.ts`; `GridPulseRenderBridge` provides the imperative API. |
| A15 | End-to-end scope confirmed against the reference listings | **UNVERIFIABLE-HERE** | Both marketplace pages return 403 at CONNECT. The feature list this section is checked against came from the task description, not from an observed page. |

**Section A: 14 PASS, 1 UNVERIFIABLE-HERE.**

---

## Section B — Visual fidelity (30 points)

Every row requires a side-by-side comparison at 1200 px / DPR 2 on identical
media. None was possible.

| # | Row | State | What we have instead |
| --- | --- | --- | --- |
| B1 | Box dimensions | UNVERIFIABLE-HERE | Ours: 112 × 112 px, × 0.76 when the frame is under 600 px. The reference's are unknown. |
| B2 | Marker form and scale | UNVERIFIABLE-HERE | Ours: 7 px square outline plus a 2 px core; circle and cross available. |
| B3 | Chip typography and padding | UNVERIFIABLE-HERE | Ours: 9 px monospace, 5 px / 3 px padding, offset 5 / 5 from the box corner. |
| B4 | Exact token formatting | UNVERIFIABLE-HERE | Ours is fully specified and tested; the reference's output strings were never seen. The shipped default template is a change from the delivered build — see [PARITY-LOG](./PARITY-LOG.md) iteration 2. |
| B5 | Grid spacing and opacity | UNVERIFIABLE-HERE | Ours: 150 px, opacity 0.14, 1 px, dash [2, 7], 2 subdivisions. |
| B6 | Accent and chrome colours | UNVERIFIABLE-HERE | Ours: `#ffffff` chrome on `#000000`, adaptive light/dark selection available. |
| B7 | Connector and tick geometry | UNVERIFIABLE-HERE | Ours: 1 px, dash [2, 6], ticks every 34 px, 5 px long. |
| B8 | Corner-bracket geometry | UNVERIFIABLE-HERE | Ours: 12 px arms, 2 px stroke, clamped to a third of the box. |
| B9 | HUD placement | UNVERIFIABLE-HERE | Not applicable to this build — the HUD is a v2.34 artifact that was not delivered. See [UNREACHABLE.md](./UNREACHABLE.md) §2. |
| B10 | Overall structural similarity | UNVERIFIABLE-HERE | No reference frame exists to compare against. |

**Section B: 0 PASS, 10 UNVERIFIABLE-HERE.**

---

## Section C — Behavioural fidelity (30 points)

Deterministic previews prove our policies behave consistently. They prove
nothing about whether that behaviour matches the reference.

| # | Row | State | What we have instead |
| --- | --- | --- | --- |
| C1 | Total reveal duration | UNVERIFIABLE-HERE | Ours: 420 ms per point. |
| C2 | Per-point stagger | UNVERIFIABLE-HERE | Ours: 90 ms reveal stagger, 52 ms box stagger. |
| C3 | Reveal easing | UNVERIFIABLE-HERE | Ours: `easeOut` (cubic); linear and easeInOut available. |
| C4 | Sweep period and direction | UNVERIFIABLE-HERE | Ours: 1 450 ms, vertical, looping, linear. |
| C5 | Crosshair latency | UNVERIFIABLE-HERE | Ours: 95 ms to 99% of the gap, frame-rate independent (tested at 60 and 30 Hz). |
| C6 | Hover-out timing | UNVERIFIABLE-HERE | Ours: 90 ms leave delay, then a 220 ms fade. |
| C7 | Actual rescan semantics | UNVERIFIABLE-HERE | Ours: fade out 150 ms → 35 ms gap → fade in 240 ms, with a focused search around the click. |
| C8 | Idle motion | UNVERIFIABLE-HERE | Ours: grid drift 10 / 6 px·s⁻¹, 0.2 pulse, 0.34 scan band; box breath 0.006. |
| C9 | Touch model | UNVERIFIABLE-HERE | Ours: `auto` resolves to always / tap-toggle / rescan from activation and `mobileAlwaysOn`; tested. |

**Section C: 0 PASS, 9 UNVERIFIABLE-HERE.**

---

## Section D — Non-regression (20 points)

Any failure here caps the total at 60. There are no failures.

| # | Row | State | Evidence |
| --- | --- | --- | --- |
| D1 | All 79 original checks green | UNVERIFIABLE-HERE | The suite was not delivered. [UNREACHABLE.md](./UNREACHABLE.md) §3. |
| D2 | A green suite on this build | PASS | 85 checks, 85 pass. |
| D3 | Feature inventory unchanged or grown | PASS | 0 removals; +6 properties, +1 union, +2 modes. |
| D4 | Detection quality ratio ≥ 1.30 | PASS | 5.938 (substitute corpus — [UNREACHABLE.md](./UNREACHABLE.md) §4). |
| D5 | Worst score ≥ 1.06 | PASS | 3.023 worst scene × mode (substitute corpus, reinterpreted; §4). |
| D6 | ≤ 4 of 72 points below random | PASS | 3 of 72 (substitute corpus). |
| D7 | 41 px boxes at 390 px | PASS | 85.1 px. |
| D8 | 7 px chip text at 390 px | PASS | 9.0 px. |
| D9 | Clean CSS-template lint | PASS | 0 errors, 0 warnings. |
| D10 | Clean typecheck | PASS | 0 errors. |
| D11 | All 11 presets visibly distinct | UNVERIFIABLE-HERE | 11 presets exist, render, and differ in configuration; "visibly" requires screenshots. |

**Section D: 9 PASS, 2 UNVERIFIABLE-HERE, 0 FAIL.**

---

## Honesty gate

| Check | State |
| --- | --- |
| Deterministic previews are never presented as browser evidence | PASS — every measurement in this repository names its instrument and its corpus. |
| No inferred value is recorded as a pass | PASS — 21 rows are UNVERIFIABLE-HERE rather than inferred. |
| No screenshot is committed that a browser did not produce | PASS — no screenshots are committed. |
| No module is labelled as recovered v2.30–v2.35 work | PASS — none was written. [UNREACHABLE.md](./UNREACHABLE.md) §2. |
| Substitute measurements are labelled as substitutes | PASS — D4–D6 name the corpus in every place they appear. |

---

## Completion criteria

| Criterion | State |
| --- | --- |
| ≥ 95/100 with zero Section D failures | **NOT MET** — no score can be computed; Section D has zero failures. |
| Two consecutive iterations with no new failures or findings | **NOT MET** — this is iteration 1 of the consolidated build, and it produced 5 findings. |
| Every UNVERIFIABLE-HERE row listed with its exact reason and the steps to verify it | **MET** — 21 rows above, reasons in [UNREACHABLE.md](./UNREACHABLE.md). |
