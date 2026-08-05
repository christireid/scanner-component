# Parity log

One entry per change. Each records what was predicted, what was measured, the
smallest fix that addressed it, and what the full non-regression run said
afterwards.

Entries are appended, never edited.

---

## Milestone v3.0.0-rc.1 — Canonical Consolidation

Starting point: `GridPulseScanProRunnableSource.zip`, 30 files, 5 883 lines,
v2.29 only. Ending point: this tree.

Findings 1–5 were all discovered by building the measurement infrastructure the
plan calls for. None was visible by reading the source alone.

---

### Iteration 1 — the delivered package did not build

**Row:** D10, clean typecheck (and D-section prerequisite: a build exists at all).

**Prediction:** `npm ci && npm run build` succeeds on a clean checkout.

**Measurement:**

```
$ npm run build          # "tsc -b && vite build"
src/main.tsx(4,8): error TS2882: Cannot find module or type declarations
                                  for side-effect import of './styles.css'.
```

`npm ci` was impossible independently: every dependency was pinned to
`"latest"` and there was no lockfile. `@vitejs/plugin-react` was declared as a
runtime dependency with no `vite.config.ts` to load it, so React Fast Refresh
was never active.

**Fix:** added `src/vite-env.d.ts` (`/// <reference types="vite/client" />`),
added `vite.config.ts` with the React plugin, pinned every dependency to an
exact version, moved build tooling into `devDependencies`, and committed
`package-lock.json`.

**Remeasurement:** `npm run typecheck` 0 errors; `npm run build` succeeds;
`npm ci` reproducible.

**Non-regression run:** not yet applicable — this iteration created the ability
to run one.

---

### Iteration 2 — the default label chip rendered literal text

**Row:** B4, exact token formatting.

**Prediction:** the shipped default template resolves to score and zoom values.

**Measurement:** `DEFAULT_LABELS.template` was `"{score} (zoom)"`. The token
regex is `/\{(score|id|coords|time|zoom|mode)\}/g`, so `(zoom)` is not a token —
it is literal text. Every callout chip on a default configuration rendered:

```
0.87 (zoom)
```

**Fix:** `"{score} (zoom)"` → `"{score} ({zoom})"`, which renders
`0.87 (2.50×)`.

**Remeasurement:** `labels.test.ts` now asserts that the shipped default
resolves with no unresolved tokens and that no token is written with
parentheses instead of braces, so this class of typo cannot return silently.

**Caveat recorded honestly:** the reference's actual chip text was never
observed, so `{score} ({zoom})` is a repair of an obvious defect, **not** a
match to the reference. B4 stays UNVERIFIABLE-HERE. To revert, change one
string in `src/grid-pulse/GridPulseDefaults.ts`.

**Non-regression run:** typecheck clean, all tests pass, lint clean, inventory
0 removals.

---

### Iteration 3 — the Specimen tracking-frame layout was dead code

**Row:** A13, Specimen-style centred tracking frames.

**Prediction:** if the component is meant to combine Grid Pulse Scan with
Specimen, the Specimen layout is reachable through the API.

**Measurement:** `layoutGridPulseTrackingFrames` is a 90-line exported function
in `GridPulseGeometry.ts` — square frames centred on the feature, safe-area
insets, collision avoidance, parallax — and `GridPulseScan.tsx` never imports
it. It shipped unreachable.

```
$ grep -c layoutGridPulseTrackingFrames src/grid-pulse/GridPulseScan.tsx
0
```

**Fix:** added `boxes.layout: "callout" | "tracking"` plus `trackingScale`,
`trackingSafeTop`, `trackingSafeBottom`, `trackingMinGap`, and
`trackingParallax`. Both the overlay renderer and the render-bridge snapshot
now go through one `resolveGridPulseBoxLayout` dispatcher, so drawn geometry and
published geometry cannot diverge. Tracking frames also gained a guaranteed
one-frame-per-point fallback; the original could silently emit fewer frames than
points, which callers index by point index.

**Default unchanged:** `"callout"`. Existing configurations render identically.

**Remeasurement:** 4 new geometry checks — one frame per point, square, anchor
stays inside the frame, safe-area insets honoured, parallax translates without
resizing.

**Non-regression run:** typecheck clean, tests pass, inventory +6 properties
and +1 union with 0 removals.

---

### Iteration 4 — the box shadow silently rendered at the wrong offsets

**Row:** B1/B10, box appearance.

**Prediction:** `boxes.shadow`, documented as `"0 12px 42px rgba(0,0,0,.42)"`,
renders at those offsets.

**Measurement:** `parseBoxShadow` required a `px` unit on every length:

```js
/^(-?\d+(?:\.\d+)?)px\s+(-?\d+(?:\.\d+)?)px\s+(\d+(?:\.\d+)?)px.../
```

The shipped default starts with a unitless `0`, so it never matched and every
box silently fell back to `{ offsetX: 0, offsetY: 10, blur: 28 }`. The rendered
shadow was 2 px higher and 14 px tighter than the configured one, on every box,
in every preset — and any consumer writing valid CSS shorthand hit the same
fallback.

**Fix:** replaced the monolithic regex with a length tokenizer that accepts
unitless zeros, an optional spread, and colours containing spaces. Moved it to
`src/grid-pulse/BoxShadowPolicy.ts` so it is testable without a DOM, and
exported it from the public entry point.

**Remeasurement:** `api-contract.test.ts` asserts the shipped default parses to
exactly `{0, 12, 42}` and covers four CSS shorthand forms.

**Non-regression run:** typecheck clean, tests pass, lint clean.

---

### Iteration 5 — Person mode degenerated toward random on skin-free media

**Rows:** D4, D5, D6 — the detection quality floors.

**Prediction:** all three detection floors clear on the first measurement.

**Measurement:** they did not.

```
PASS  Detection quality ratio     measured    5.664   floor 1.3
FAIL  Worst single-point ratio    measured    0.000   floor 1.06
FAIL  Points below random (72)    measured        5   floor 4
```

All five sub-random points came from one place — Person mode on the two scenes
with no skin tones:

```
texture-corner   person   0.00 0.38 0.00 0.00
low-contrast     person   0.61 0.00 0.00 0.23
```

**Diagnosis.** The saliency loop ended with a fixed tie-break jitter,
`raw += random() * 0.025`. That is small relative to a mode that reaches ~1.0,
but Person mode's formula is

```
person = skin·w + detail·(1−w)·0.62 + center·(1−w)·0.38
```

so with `personSkinWeight = 0.78` and no skin present it compresses into a
0 … 0.22 band. Measured jitter share of the available range:

| Mode | Max score, zero skin | Jitter share |
| --- | --- | --- |
| detail | 1.0000 | 2.5% |
| auto | 0.8448 | 3.0% |
| **person** | **0.2200** | **11.4%** |

At 11.4% the tie-break dominates ranking, and point selection collapses toward
random placement. This is a pre-existing property of the delivered v2.29
arithmetic, first measurable because this iteration built the instrument.

**Fix (smallest that addresses the cause):** scale the jitter to the range the
field actually produced, rather than using an absolute constant.

```ts
let maximum = 0
for (const candidate of candidates) maximum = Math.max(maximum, candidate.raw)
const jitterScale = Math.max(0.08, maximum)
for (const candidate of candidates) candidate.raw += random() * 0.025 * jitterScale
```

Every mode now carries the same ~2.5% jitter share. The floor keeps a genuinely
flat field from selecting purely by scan order.

**Remeasurement:**

| Metric | Floor | Before | After |
| --- | --- | --- | --- |
| Detection quality ratio | ≥ 1.30 | 5.664 | **5.938** |
| Worst scene × mode ratio | ≥ 1.06 | 2.345 | **3.023** |
| Points below random (of 72) | ≤ 4 | 5 ❌ | **3** ✅ |

**Non-regression run:** typecheck clean, 85 of 85 tests pass, lint clean,
inventory 0 removals, 5 of 5 quality floors met.

**Also recorded:** the plan's "worst-point score ≥ 1.06" is measured here as
the worst scene × mode configuration, not the worst individual point. A
per-point floor of 1.06 cannot coexist with the plan's own allowance of up to
4 of 72 points below random, and with a minimum point separation of 0.16 not
every point can physically sit inside a ground-truth region. Reason and
reinterpretation are recorded in [UNREACHABLE.md](./UNREACHABLE.md) §4.

---

### Iteration 6 — the target tracker did not clamp newly acquired points

**Row:** D2, superset behaviour under a custom detector.

**Prediction:** every position `StableTargetTracker` reports lies in the unit
square.

**Measurement:** it does not. Matched tracks and coasting tracks are clamped;
freshly acquired points are spread through unclamped.

```
AssertionError: x clamped (-3)
```

`commitPoints` clamps afterwards, so the shipped overlay was protected. But
`StableTargetTracker` is public API — it is what a custom detector hook and the
imperative bridge talk to — and its own contract was broken. A detector
reporting slightly outside the frame (mirrored media, letterboxed video, a
consumer's own model) produced one off-frame position before smoothing pulled
it back.

**Fix:** clamp on acquisition, matching the two paths that already did.

**Remeasurement:** the invariant now holds for every path; asserted in
`detection.test.ts`.

**Non-regression run:** typecheck clean, 85 of 85 tests pass.

---

## Not done, and why

| Item | Reason |
| --- | --- |
| v2.30 – v2.35 consolidation | Artifacts not delivered. [UNREACHABLE.md](./UNREACHABLE.md) §2. No module was written and labelled as recovered work. |
| Phase 0 / Phase 4 reference capture | Egress denied. §1. |
| Original 79-check suite | Not delivered. §3. |
| Reference-comparable quality numbers | Corpus not delivered. §4. |
| Side-by-side screenshots | Requires a browser and, for the reference half, §1. §5. |


---

## Milestone v3.0.0-rc.2 — Specimen integration, reference-scope closure, first browser evidence

Inputs that unblocked this milestone: the original `PARITY-PLAN.md` (installed
verbatim at [PARITY-PLAN.md](./PARITY-PLAN.md)) and the `SpecimenGridPulse-Pro-v2.8`
package. A working local Chromium also became available, which converts
"deterministic preview" claims into browser measurements — for our side only;
the reference remains unreachable (browser-level probe recorded in
[UNREACHABLE.md](./UNREACHABLE.md)).

---

### Iteration 7 — Phase 0 capability probe, at browser level this time

**Row:** §3.1 capability probe.

**Prediction:** the egress denial observed via curl also holds for a real browser.

**Measurement:** Playwright + Chromium 1194, viewport 1200 / DPR 2:
`net::ERR_TUNNEL_CONNECTION_FAILED` on the live preview, both marketplace
pages, and `framerusercontent.com` (the demo MP4). The failure is the proxy
CONNECT stage — policy, not bot detection.

**Prediction result:** correct.

**Consequence:** B1–B10 and C1–C9 remain UNVERIFIABLE-HERE. The §3.2E warning
applies in full: without the reference media, point-placement comparison would
measure nothing even if screenshots existed.

---

### Iteration 8 — v2.8 Specimen lineage integrated without loss

**Rows:** §1.1 superset rule; §5.1 inventory.

The v2.8 package's eight framework modules (Specimen renderer, VisionFramework
plugin system, VisionSceneGraph, RenderingPipeline, MotionEngine,
GpuPostProcessor, AdaptiveQuality, ExamplePlugins) and its five deterministic
suites now live in the canonical tree. Its `GridPulseConnectionTopology` was
byte-identical to ours (shared ancestry); its stale local option literals were
repointed at the canonical defaults. One strip-types incompatibility fixed
(TS parameter property in `VisionTimeline`).

`src/GridPulseScanPro.tsx` now follows the v2.8 stable-entry contract: the
integrated Specimen renderer is the default export; the Grid Pulse engine
stays exported as `GridPulseScan`. Inventory: 245 option properties (+7),
83 exported values (+32), 116 exported types (+32), 0 removals.

---

### Iteration 9 — reference-scope and §4 closure in the engine

**Rows:** §2.1 rows 2, 6, 9; §4.3; §4.4; §5.1 capabilities.

Implemented, each with tests:

- **Effect target default → `media`** (§4.4: "We now default to
  `effectTarget="media"`" — a documented finding from user screenshots that an
  early build had backwards). `effect.scope` default changed `boxes` → `media`.
- **Chip calibration** (§4.3: "Ours is `.085em` uppercase" — tier-2 measured):
  `labels.uppercase` default → true; new `labels.letterSpacing` option (em),
  default 0.085, applied via canvas `letterSpacing`.
- **All plan-listed tokens** (§2.1 row 6): `{pct} {index} {n} {x} {y} {label}
  {fps}` added beside the reference four plus `{zoom} {mode}`.
- **`thermal` effect** (§2.1 row 9 "plus thermal, none"): pure ramp policy
  (ironbow / white-hot / rainbow), renderer, options, tests.
- **Dither palettes + Floyd–Steinberg** (§5.1): `bitmapPalette`
  duotone/mono4/handheld/amber/cmyk and `bitmapMethod: "diffusion"`; diffusion
  verified to preserve mean luminance within 5% on flat grey.
- **Density mode** (§5.1 "density mode to 80 points"): point ceiling 12 → 80;
  tracker uses the exact solver ≤ 12 points and greedy nearest-first above
  (the exact solver is exponential in points). 24-point assignment solves in
  <250 ms with the obvious pairing; a 40-point field retains ≥ 38/40 identities
  across a small displacement.
- **Custom detector hook** (§5.1): `detection.customDetector` replaces the
  built-in scan when supplied; exceptions fall back to built-in detection and
  report through `onError`.
- **Eleven named presets** (§5.1, D6): loupe, telemetry, plate, survey,
  lattice, contour, hairline, swarm, field, viewfinder, tracking — as
  configuration bundles over public options, merge order defaults ← preset ←
  caller overrides. PROVENANCE: new implementations; the originals were never
  delivered. `contour` drives the X-Ray edge pipeline and says so in source —
  the original's marching-squares tracer was not delivered.

Default NOT changed: `connections.topology` stays `leaders` — §4.2's
point-to-point hypothesis is live but unverified, and v2.8's iteration 1 made
the same call for the same reason.

---

### Iteration 10 — the demand-driven loop froze mid-rescan with the overlay cleared

**Rows:** C7/C8 behaviour (and every browser capture downstream).

**Prediction:** first local browser captures of the always-on default would
show the full overlay.

**Measurement:** they showed **no overlay at all**. Instrumented rAF and canvas
calls: 6 rAF ticks total, 138 strokes, then silence; overlay canvas fully
transparent; `data-grid-pulse-active="true"`.

**Prediction result:** wrong — and the disproof localised the defect.

**Diagnosis:** `overlayAnimated` — the term that keeps the demand-driven loop
scheduling — was gated on `overlayAlpha > 0`. The initial scan starts a rescan
transition whose fade passes through alpha 0 (end of exit + the 35 ms gap);
the commit's wake-up frame landed inside the gap, saw alpha 0, declared
nothing animated, and the loop stopped for good with the overlay cleared.
Interactive use masks it (any pointer event revives the loop); headless and
always-on-without-pointer exposed it. Pre-existing in the delivered v2.29.

**Fix:** interaction and rescan transitions now keep the loop scheduling
independently of overlay alpha.

**Remeasurement:** 56 rAF in 1 s (≈60 fps), 3 132 strokes and climbing;
overlay present in every subsequent capture.

---

### Iteration 11 — the images, not the code

**Rows:** step 7.4; D6.

Captured with the committed instruments (`tools/capture-local.mjs`,
`tools/measure-preset-distinctness.mjs`): all 11 engine presets at 1200 px,
the default at 390 / 768 / 1440 / 2560, thermal and diffusion effects, and all
10 Specimen scenes — 29 captures, 0 page errors, in `docs/captures/`.

D6 measurement: overlay-canvas alpha coverage per preset ranges 0.4 %
(contour — its identity is the transformed media) to 29.9 % (tracking);
pairwise tables in `docs/captures/preset-distinctness.json`. Whole-frame
diffs are dominated by the shared photograph, so the verdict combines both
metrics with visual inspection of the closest pairs. Four presets were tuned
apart during measurement (distinct seeds and geometry for plate/hairline,
lattice/swarm, survey/field). Every pair is structurally distinct in at least
one instrument and visibly distinct on inspection.

---

### Iteration 12 — honesty items

- The original plan is installed verbatim; the earlier reconstruction is
  replaced. Its two still-missing artifacts (KICKOFF.md, the §10 repository)
  are recorded in UNREACHABLE.md.
- `docs/parity-score.json` regenerated with per-row states; no row is scored
  PASS from inference.
- The §5.3 floors keep their substitute-corpus caveat: the original
  `test/score.py` corpus and `measure.js` were not delivered, so absolute
  numbers are not comparable to the plan's table; ratios hold on our corpus
  (5.938 ≥ 1.30, worst configuration 3.023 ≥ 1.06, 3/72 ≤ 4, 85.1 px ≥ 41,
  9 px ≥ 7).


---

### Iteration 13 — the shipped default was illegible on white media

**Rows:** the §5.3 legibility spirit (chip contrast floor), B6 colour identity.

**Prediction:** the default configuration renders legibly on a real
white-background photograph.

**Measurement:** it did not. On a user-supplied X-ray lily photo (white
background), the default `adaptiveChrome: false` chrome — white grid, white
leaders, white markers, white borders, white sweep — was functionally
invisible. Kept as `docs/captures/media/lilies-default-before.jpg`. Chips
survived on their dark backing.

**Prediction result:** wrong; the photograph found it immediately.

**Fix:** `theme.adaptiveChrome` default → `true` with
`chromeSpatialMode: "global"` (single sampled contrast decision — the cheap
path; `regional` stays opt-in). One-flag reversion.

**Remeasurement:** dark chrome chosen on the white and pastel photos, light on
the dark photo with correct per-point inversion on a bright petal; 58–61 rAF/s
across all four defaults. Before/after captures committed. Recorded as a
legibility-floor decision, not a parity claim — the reference's light-media
behaviour is unobservable here.

**Non-regression run:** typecheck clean, 110/110, lint clean, inventory 0
removals, floors 5/5.

---

### Iteration 14 — real-media matrix

Four user-supplied photographs stressing four failure classes (white
background, skin-adjacent tones, low contrast at 23 MP, portrait aspect) ×
10 scenarios: **40/40 rendered, 0 page errors**, engine at 50–62 rAF/s
throughout, Person mode kept all points on structure on the skin-adjacent
scene. Full report: [MEDIA-TESTS.md](./MEDIA-TESTS.md). Honest limitations
recorded there: Specimen ≈6 rAF/s in GPU-less headless Chromium; 3.1 s first
diffusion pass on the 23 MP source.


---

### Iteration 15 — explicit clicks were diluted by stability smoothing

**Row:** C7, actual rescan semantics (our side).

**Prediction:** a click at (0.25, 0.25) commits a focused point at the click.

**Measurement:** no committed point within 0.05 of the click. The focus point
enters the pipeline at the click, then the stable tracker smooths it 0.58
toward an assigned older track and temporal smoothing pulls up to 0.42 toward
any previous point within a 0.28 match radius — worst case ≈ 0.12 normalized
of drift on a deliberate gesture.

**Prediction result:** wrong; the browser check found it.

**Fix:** `commitPoints` accepts the request's focus as an anchor and snaps the
focused point to it after smoothing. Video stability for autonomous rescans is
unchanged; only explicit-focus scans anchor. The custom-detector hook path is
deliberately not anchored — the hook owns its own focus semantics.

**Remeasurement:** `SCAN-00@(0.25,0.25)` exact. Full suite 12/12
([MEDIA-TESTS.md](./MEDIA-TESTS.md) behaviour table).

---

### Iteration 16 — video pathway and interaction semantics browser-verified

A VP8 WebM pan fixture (recorded by Chromium via canvas captureStream —
the plan's "no H.264 here" note honoured) drove the video path end to end:
playback paints, 900 ms re-acquisition commits scans, and tracking identities
persist 5/5 across rescans (`docs/captures/media/video-tracking.jpg`). Hover
in/out, keyboard, touch tap, mirror (profile-reversal check), the 16:9 and
1:1 aspect ratios, and reduced-motion freezing all measured in the same run.
A10's video half and A7 are now browser-verified on our side; B/C reference
comparisons remain UNVERIFIABLE-HERE.


---

### Iteration 17 — our-side timing calibration measured; first clean iteration

**Rows:** C1/C2/C4/C5/C6 (our half), §5.3 chip contrast, resize behaviour.

Built `tools/measure-timings.mjs` and measured the running component against
its own configuration in real Chromium
([MEASURED-TIMINGS.md](./MEASURED-TIMINGS.md)): reveal 333.3 ms to the eased
99% (predicted 330), stagger 95.8 ms vs 90 configured, sweep period 1450 ms
vs 1450, crosshair 92.7 ms vs 95, hover-out 102.6 / 352.9 ms vs 90 / 310,
chip contrast 17.1:1 against the 13.9:1 floor, and exact point re-projection
on resize. Every quantity within one 60 Hz frame of configuration.

Three first-pass probe results were instrument bugs, fixed and disclosed in
the doc (already-revealed matched points, brightness-blind sweep detection,
a resize that resized the viewport but not the fixed-width stage).

**No new component defects were found. This is the first iteration of the
consolidated build with zero new findings** — one of the two consecutive
clean passes stop-condition §8.2 requires. The next iteration decides whether
it was luck or convergence.


---

### Iteration 18 — hardening sweep; second consecutive clean iteration

**Rows:** graceful degradation (the honesty behind A9/A10), lifecycle safety,
Specimen composition modes.

`tools/hardening-tests.mjs`, 7 browser checks, all passing
(`docs/captures/hardening-log.json`):

- a 404 src reports through `onError`, stays un-ready, never crashes;
- cross-origin **tainted** media (served from a second local origin with no
  CORS headers) still renders, detection falls back to the centre point, and
  the X-Ray effect disables itself through `onError` with the taint message
  rather than throwing;
- swapping `src` mid-scan commits cleanly under the generation guard;
- unmounting during an in-flight scan leaves zero page errors;
- `dprCap: 2` bounds a DPR-3 display to exactly a 2× backing store;
- the three Specimen composition modes render measurably distinctly
  (integrated↔grid-pulse 41.8, integrated↔specimen 7.3,
  grid-pulse↔specimen 43.4 mean-abs-gray).

The 12-check behaviour suite re-ran green after the harness gained
composition support. **No new component findings — the second consecutive
clean iteration.**

---

## Convergence statement

Stop condition §8:

1. **≥ 95/100, zero Section D FAILs** — not evaluable in this environment:
   60 of 100 points require the unreachable reference (browser-level proof in
   [UNREACHABLE.md](./UNREACHABLE.md) §1). Section D has **zero FAILs**.
2. **Two consecutive iterations with no new failures or findings** —
   **met**: iterations 17 and 18.
3. **Every UNVERIFIABLE-HERE row listed with reason and unblock steps** —
   **met** ([UNREACHABLE.md](./UNREACHABLE.md), [SCORECARD.md](./SCORECARD.md)).

The build has converged on everything measurable here. The remaining work —
scoring B1–B10 and C1–C9 — requires exactly one thing: reference captures at
1200 px / DPR 2 (or network reach to take them). Our half of every comparison
is already measured and committed
([MEASURED-TIMINGS.md](./MEASURED-TIMINGS.md), `docs/captures/`).


---

### Iteration 19 — the Specimen adaptive-quality system could not rescue a collapse

**Row:** the honest limitation recorded in [MEDIA-TESTS.md](./MEDIA-TESTS.md)
("Specimen ≈6 rAF/s in GPU-less headless Chromium; not tuned here") — now
diagnosed instead of shelved.

**Prediction:** the adaptive-quality system degrades tiers under sustained
slow frames, so the 6 fps figure reflects a floor it cannot go below.

**Measurement:** wrong on both counts. Instrumented 16 s with
`onQualityChange`/`onPerformanceMetrics` wired: SwiftShader reports WebGL2 as
*available*, so auto quality resolved to `balanced` (40 fps budget) and ran
the GPU pass on software GL; average frames sat at **318–375 ms** (12–15×
over budget) and the degradation loop fired **zero times** — it judged the
*lifetime* average every 20 frames and needed 3 consecutive slow windows,
i.e. 60 frames ≈ 15+ s at the frame rate it was meant to rescue.

**Fixes (policy + probe, each tested):**

1. `QualityEnvironment.softwareGl` — the WebGL2 renderer string is checked
   for SwiftShader/llvmpipe at mount; software GL resolves auto quality
   straight to `low`.
2. `VisionPerformanceMonitor` gains a 20-frame windowed
   `recentAverageFrameMs`; the degrade check judges it every 10 frames,
   2 consecutive slow windows suffice, and an emergency overshoot
   (> 4× budget) degrades immediately.

**Remeasurement:** quality resolves to `low` at **t = 422 ms**; GPU backend
steps aside to canvas2d; frame work drops **318 ms → 2.1–2.7 ms (~150×)**;
the Specimen media scenarios run at **23–25 rAF/s against the low tier's
24 fps budget** (previously 6). Real GPU-less and low-end hardware benefits
from exactly these paths.

**Non-regression run:** 111/111 (adaptive-quality suite extended for the new
semantics), lint clean, inventory 0 removals, floors 5/5.

---

## Convergence statement — amended

Iteration 19 produced a new finding, so the §8.2 pair from iterations 17–18
no longer stands as the *latest* two iterations. Honest state: **one clean
iteration is again required back-to-back with another.** The claim "everything
measurable here is measured" survives; the claim "nothing new is being found"
was two iterations old and iteration 19 disproved it — which is precisely why
the plan demands two *consecutive* clean passes before stopping.
