> **Provenance note (repository copy).** This is the original programme brief,
> supplied 2026-08-05, replacing the earlier reconstruction. Two referenced
> artifacts were still not delivered: `docs/KICKOFF.md` and the repository the
> §10 map describes (six suites / 79 checks, `test/score.py`, `measure.js`,
> presets source, `docs/ENHANCEMENTS.md` backlog). The infrastructure in this
> repo re-implements those roles; equivalences and gaps are recorded in
> [UNREACHABLE.md](./UNREACHABLE.md) and [SCORECARD.md](./SCORECARD.md).

# Grid Pulse Scan — Exact-Parity Programme

**Deliverable 1 of 2.** This file is the whole brief. It is written to be handed
to a coding agent as a single self-directing prompt: it contains the goal, the
method, the loop, the rubric, and the stop condition. No clarifying round-trip
with a human should be necessary.

**Deliverable 2** is `KICKOFF.md`, the short message that starts the loop.

---

## 0. The one-sentence goal

`src/GridPulseScanPro.tsx` must do **everything** the paid Framer component
"Grid Pulse Scan" does, and look and behave indistinguishably from it under a
defined comparison protocol — **while keeping every capability this repo already
has**, of which there are many the reference does not.

The reference:

- Marketplace: https://www.framer.com/community/marketplace/components/grid-pulse-scan/
- Live preview: https://gridpulse-scan-poncedeleonstudio.framer.website/
- $20, Marco Ponce de León, published 2 July 2026, category Interactions.

---

## 1. Read this before you touch anything

### 1.1 The rule that overrides every other rule

**Nothing in this repo may be removed, weakened, or regressed in the name of
parity.** This component is a superset. Parity means *adding* whatever the
reference does that we don't, and *matching* its rendering where ours differs —
never deleting a capability because the reference lacks it.

The concrete guard is in §5: a feature inventory that may grow and must never
shrink, and 79 existing checks that must stay green.

### 1.2 What is already known, and how well

Three tiers of confidence. Treat them differently.

**Verified — from the marketplace listing, fetched directly.** The published
feature list, quoted in §2. Trust it as a specification of scope, not of
appearance.

**Measured — from four screenshots of the live preview at iPhone width**,
analysed earlier in this project. These produced the current calibration. One
non-obvious fact came out of them and is load-bearing: **the demo page declares
`<meta name="viewport" content="width=1200">`.** Phone screenshots of it are
therefore scaled by roughly 0.367, and any measurement taken off them without
dividing through by that factor is about 2.7× too small. An early version of
this component was mis-calibrated for exactly that reason.

**Unverified — the live preview's actual runtime behaviour.** It has never been
observed directly by anyone working on this repo. The environment used so far
had no outbound network from its browser, and the page is a client-rendered
Framer app with no server-rendered content, so fetching the HTML yields only
Framer's own marketing copy. Everything about timing, easing, exact colour,
hover latency, and the precise choreography of the reveal is currently
**inferred**.

**Your first job is to convert that third tier into the second.** §3 is the
protocol. If your environment also cannot reach the live preview, say so
explicitly in your report, run the loop against the marketplace list and the
screenshots alone, and mark every rubric row that depended on live observation
as `UNVERIFIABLE-HERE` rather than scoring it. Do not guess and then present the
guess as a match.

### 1.3 Provenance constraint

Build from observed behaviour and the published feature list. **Do not
decompile, extract, or copy the paid component's source.** This has been the
standing constraint for the whole project and it does not change. Matching an
observed appearance is legitimate; lifting an implementation is not.

---

## 2. The reference feature list, verbatim

From the marketplace page. This is the scope contract.

> - Real-time feature detection with Auto, Person, and Detail modes
> - Animated grid overlay with configurable opacity
> - Connection lines with tick marks between detection points
> - Scan sweep animation across hover boxes
> - Crosshair with coordinate readout
> - Label chips supporting template tokens: `{score}` `{id}` `{coords}` `{time}`
> - Click-to-rescan functionality
> - Always-on mode for continuous scanning
> - Four visual effects: Bitmap, Pixelated, Code, X-Ray
> - Image and video support
> - Aspect ratio options: free, 16:9, 3:2, 4:3, 1:1, 4:5, 9:16, 21:8
> - Mirror mode for horizontal flipping
> - Configurable grid, crosshair, connections, and labels

And from the description:

> "Grid Pulse Scan turns any image or video into an interactive tactical
> scanner. Hover over the media and detection points automatically appear,
> analyzing faces, details, or textures depending on the mode."
>
> …zoom boxes that magnify areas with "animated scan lines, corner brackets,
> and a running label chip."

### 2.1 Where we stand against it, on paper

Every row is nominally present already. **That is exactly why this programme is
about fidelity, not features.** The listing tells you *what* exists; it says
nothing about how any of it looks or moves, and that is the gap.

| # | Reference feature | Ours | Fidelity risk |
|---|---|---|---|
| 1 | Auto / Person / Detail modes | `mode` — plus `edges`, `uniform` | Detector *behaviour* differs; ours was written from scratch |
| 2 | Animated grid, configurable opacity | `gridStyle`, `gridOpacity` | **"Animated" is unconfirmed.** Ours is static. See §4.1 |
| 3 | Connection lines with tick marks **between detection points** | `showConnections`, `connectorStyle`, tick marks | **Ours draws marker→box.** "Between detection points" may mean point→point. See §4.2 |
| 4 | Scan sweep across hover boxes | `.gpsx-sw` sweep, `scanSpeed` | Period, easing, opacity ramp unverified |
| 5 | Crosshair + coordinate readout | `showCrosshair`, `.rd` readout | Readout format and follow latency unverified |
| 6 | Chip tokens `{score} {id} {coords} {time}` | All four, plus `{pct} {index} {n} {x} {y} {label} {mode} {fps}` | Token *formatting* must match exactly. See §4.3 |
| 7 | Click-to-rescan | `clickToRescan` | ✓ |
| 8 | Always-on | `trigger="always"` | ✓ |
| 9 | Bitmap, Pixelated, Code, X-Ray | All four, plus `thermal`, `none` | Per-effect rendering must match. See §4.4 |
| 10 | Image and video | ✓ | ✓ |
| 11 | 8 aspect ratios | Exactly those eight | ✓ |
| 12 | Mirror | `mirror` | ✓ |
| 13 | Configurable grid/crosshair/connections/labels | ✓ | ✓ |

---

## 3. Phase 0 — Acquire ground truth (do this first, every run)

Everything downstream depends on this. Budget real time for it.

### 3.1 Capability probe

Before anything else, establish what your environment can actually do, and
write the answer into your report:

```
[ ] Can a headless browser reach https://gridpulse-scan-poncedeleonstudio.framer.website/ ?
[ ] Can it execute the page's JavaScript (Framer sites are client-rendered)?
[ ] Can it capture screenshots and read computed styles from that page?
[ ] Can it record video / frame sequences from that page?
```

If the answer to the first is no, stop and re-read §1.2. Run the rest of the
loop honestly degraded rather than dishonestly complete.

### 3.2 The capture protocol

Load the live preview at **viewport width 1200**, `deviceScaleFactor: 2`. The
site declares `width=1200`; anything else changes the layout you are measuring.

Capture, for each of the demo's states:

**A. Geometry, from computed styles and bounding boxes**

| Quantity | How |
|---|---|
| Frame size | root element `getBoundingClientRect()` |
| Zoom-box size (px, and as % of frame width) | box element rect |
| Box aspect ratio — square or varied? | rect w/h per box |
| Marker size and style | marker rect + rendered form |
| Chip font-size, letter-spacing, padding, background | `getComputedStyle` |
| Grid cell size in px, and whether it is % or fixed | background-size |
| Connector stroke width | SVG attribute or computed |
| Corner-bracket arm length | rect |
| HUD position, inset, font-size | rect + computed |
| Number of points at default settings | count markers |

**B. Colour, by sampling rendered pixels** (not by reading CSS, which may be
overridden): accent, grid, chip background, chip text, connector, box border,
box background where a crop has not painted.

**C. Motion, from a frame sequence at a known interval**

Record 6–10 s at ≥20 fps for each of: reveal-on-hover, steady hover, hover
exit, click-to-rescan, always-on idle. From the frames, derive:

| Quantity | How |
|---|---|
| Reveal duration, first point to last | frame index of each point appearing |
| Stagger interval between points | delta between those indices |
| Easing shape | plot opacity/scale per frame; compare to cubic-bezier candidates |
| Sweep period and direction | frame indices of the sweep band position |
| Does anything move while idle? | pixel diff between steady-state frames |
| Grid: static or animated? | pixel diff restricted to grid rows |
| Crosshair follow latency | mouse position vs crosshair position per frame |
| Rescan behaviour on click | do points move, fade, re-stagger? |

**D. Interaction semantics**

- What happens on touch? (emulate a touch device)
- Does hover-out dismiss immediately or with a delay?
- Is there a focused/hovered point state that dims the others?
- Does the crosshair readout show pixel coords, normalised coords, or something else?

**E. The demo media.** The page references
`EprNzB0Gw5uu5rBnN59cK4VsnQ.mp4` on `framerusercontent.com`. Getting the actual
demo asset matters more than it sounds: **detector output is a function of the
image**, so comparing our points against theirs on *different* media measures
nothing. If you can fetch it, put it in `public/` and use it as the parity
fixture. If you cannot, say so, and restrict geometric comparisons to
quantities that do not depend on where the points landed.

### 3.3 Write it down as data, not prose

Emit `test/reference/reference.json` with every measured value, and
`test/reference/frames/` with the captured sequences. Everything after this
phase reads from those files. A number in a JSON file can be diffed on the next
run; a number in a paragraph cannot.

---

## 4. Known-suspicious areas, in priority order

These are the places where "we have that feature" is most likely to be hiding a
visible difference. Each is a hypothesis to test in Phase 0, not a fact.

### 4.1 "Animated grid overlay"

The listing says *animated*. Ours is a static CSS background. If the reference's
grid pulses, drifts, or sweeps, that is a real gap and probably a conspicuous
one, since the grid covers the whole frame.

Test: pixel-diff consecutive steady-state frames, masked to grid lines only.
If the diff is non-zero, characterise the motion (period, amplitude, direction)
before implementing.

### 4.2 "Connection lines with tick marks **between detection points**"

Ours draws a leader from each marker to its own zoom box. The phrase "between
detection points" reads more like point-to-point. We already have that shape as
`meshMode` (`near` / `hub` / `chain`), so if the reference wires points to each
other, the fix may be a default change rather than new code — but check whether
they do *both*, and whether the tick marks sit on the leaders, the mesh, or
both.

### 4.3 Chip token formatting

We support all four tokens, but formatting is what shows. Capture the literal
rendered strings and match:

- `{score}` — `0.87`? `87`? `.87`? How many decimals?
- `{coords}` — degrees/minutes? Decimal pairs? Normalised or pixel?
- `{time}` — wall clock, elapsed, or timecode? What separator?
- `{id}` — `P-01`? `01`? Something else?

Also: is the chip uppercase? What is its tracking? Ours is `.085em` uppercase.

### 4.4 Effect rendering

Four named effects. Ours have the same names but were written independently.
For each of Bitmap, Pixelated, Code, X-Ray, capture a still of the reference and
compare:

- **Bitmap**: threshold or dither? If dithered, ordered or diffusion? Cell size?
- **Pixelated**: block size in px, and is it snapped to a grid?
- **Code**: which glyph set? Cell size? Is glyph choice luminance-mapped or random? Monochrome or source-coloured?
- **X-Ray**: inverted? Edge-detected? What colour ramp?

Also: does the reference apply effects to the **media**, the **boxes**, or
both? This exact question was got wrong once already in this project — an early
build applied effects to the boxes and left the media clean, which is backwards,
and it was only caught by looking at the user's screenshots. We now default to
`effectTarget="media"`. Re-verify.

### 4.5 Detection behaviour

Ours is an original detector (luminance-gradient energy + a YCbCr skin-tone gate
for `person` mode). Theirs is unknown. Exact point-for-point agreement is
**not** an achievable or sensible target — but these are:

- Does the reference find the same *kind* of place? (edges, faces, texture)
- Roughly how many points at default?
- How far apart do they sit, as a fraction of frame width?
- Do points ever land in flat, featureless areas? (Ours: 6% of points, measured — see `test/score.py`.)

---

## 5. The non-regression contract

### 5.1 Feature inventory — may grow, must never shrink

At the start of every loop iteration, regenerate the inventory:

```bash
grep -oE "^\s{4}[a-zA-Z]+\??:" src/GridPulseScanPro.tsx | sed 's/[ ?:]//g' | sort -u > /tmp/props.now
```

Compare against `docs/feature-inventory.txt` (committed). **Any prop that
disappears is a failure**, regardless of how much closer to the reference the
change got you. If a prop genuinely must change meaning, deprecate it: keep it
accepted, map it onto the new behaviour, and document the mapping.

The current inventory includes, and must retain:

**Presets (11):** loupe, telemetry, plate, survey, lattice, contour, hairline,
swarm, field, viewfinder, tracking

**Capabilities beyond the reference:** feature tracking on video with periodic
re-acquire; zoom and pan with a marker-position invariant; dither palettes
(duotone, mono4, handheld, amber, cmyk) with ordered and Floyd–Steinberg
methods; luminance contour tracing (marching squares); point mesh; parallax;
idle drift; turnover with a held-back detection reserve; size variance; outline
boxes; density mode to 80 points; long-reach connectors; a camera viewfinder
with real AF and exposure readouts; a visitor-facing preset switcher; a
before/after compare wipe; scroll-driven reveal; marker popovers; focus area;
grid snapping; a fluid chrome scale; an upscale-fidelity clamp; adaptive
density; a custom detector hook; an imperative handle.

### 5.2 The 79 existing checks

```bash
npm test
```

Runs six suites: tier1 (26), zoom (6), turnover (8), specimen (19), tier3 (20),
tracking (a measurement, not a pass/fail — expect 60–85%, it has ±15pp of
run-to-run spread in headless video and a single figure is over-precise).

**All must stay green.** A parity change that breaks one is not done.

### 5.3 The measured quality floor

These are current, measured, and must not get worse:

| Metric | Current | Tool |
|---|---|---|
| Detection quality ratio (1.00 = random) | **1.30** | `node test/detectdump.js d.json && python3 test/score.py d.json` |
| Worst point in a set | **1.06** | same |
| Points worse than random | **4 of 72** | same |
| Phone (390px) box size | **41px = 10.5% of frame** | `node test/measure.js 390 3` |
| Phone chip type size | **7.0px** | same |
| Chip text contrast | **13.9:1** | sample rendered pixels |
| CSS template integrity | clean | `npm run lint:css` |

---

## 6. THE LOOP

Run this until the stop condition in §8 is met. Do not stop early to report
progress; do not ask for direction. Each iteration is self-contained.

```
╔══════════════════════════════════════════════════════════════════════╗
║  ITERATION N                                                         ║
╚══════════════════════════════════════════════════════════════════════╝

STEP 1 — BASELINE
  1.1  npm ci  (first iteration only)
  1.2  npm test                      → record pass counts per suite
  1.3  npm run lint:css              → must be clean
  1.4  npm run typecheck             → must be clean
  1.5  Regenerate the feature inventory; diff against the committed one.
       Any shrink → STOP, revert the offending change, restart iteration.
  1.6  Run the quality floor tools in §5.3; record every number.

  If any of 1.2–1.6 is worse than §5.3, fix that FIRST. A regression
  outranks any parity gap.

STEP 2 — GROUND TRUTH
  2.1  If test/reference/reference.json does not exist, or is older than
       7 days, run the Phase 0 protocol (§3) and write it.
  2.2  If the live preview is unreachable, write
       test/reference/UNREACHABLE.md stating what you tried and what the
       error was, and continue with the marketplace list only. Mark the
       affected rubric rows UNVERIFIABLE-HERE.

STEP 3 — SCORE THE RUBRIC
  3.1  Score every row of §7 against the current build.
  3.2  Write the scores to docs/parity-score.json with a timestamp.
  3.3  Sort failing rows by (weight × gap), descending.

STEP 4 — PICK ONE
  4.1  Take the single highest-ranked failing row. One. Not three.
  4.2  Write down, before coding: what you predict is wrong, and what
       measurement will tell you whether you are right.

STEP 5 — DIAGNOSE BEFORE FIXING
  5.1  Build the measurement from 4.2 and run it.
  5.2  If it disproves your prediction, WRITE THAT DOWN in the iteration
       log and go back to 4.2 with what you actually learned.

       This is not ceremony. In this project, three separate confident
       explanations were disproved by a measurement built to test them —
       a glyph atlas that was 2.5x SLOWER than the naive path, a
       sub-pixel-refinement theory that changed nothing, and a whole
       README section blaming analysis-canvas aliasing for a detection
       problem that turned out to be points being placed at cell centres
       with a random offset. Each was plausible. Each was wrong.

STEP 6 — IMPLEMENT
  6.1  Smallest change that addresses the diagnosed cause.
  6.2  Comment the WHY, especially any non-obvious constraint you hit.
  6.3  npm run lint:css after ANY edit inside the CSS template literal.
       A backtick in a comment there silently terminates the string and
       breaks the file somewhere else entirely. It has happened three
       times in this project. The linter exists because of that.

STEP 7 — VERIFY
  7.1  Re-run the measurement from 5.1. Better, or revert.
  7.2  npm test — all green, or fix before continuing.
  7.3  Re-run §5.3 quality floor — no metric worse.
  7.4  Screenshot the affected case at 390 / 768 / 1440 / 2560 and LOOK
       at the images. Not the code. The images.
  7.5  Re-score the rubric row. If it did not move, say so and treat the
       row as still open.

STEP 8 — RECORD
  8.1  Append to docs/PARITY-LOG.md:
         - iteration number, rubric row attacked
         - prediction, measurement, result
         - whether the prediction was right (be honest; the wrong ones
           are the most useful entries in this file)
         - before/after numbers
  8.2  git commit with a message naming the rubric row and the measured
       delta. Push.

STEP 9 — LOOP
  9.1  Go to STEP 1.
```

---

## 7. THE RUBRIC

Score each row `PASS` / `PARTIAL` / `FAIL` / `UNVERIFIABLE-HERE`.
**Total possible: 100 points.** Stop condition in §8.

### A. Scope parity — every reference feature exists (20 pts)

| # | Criterion | Pts | How to verify |
|---|---|---|---|
| A1 | Auto, Person, Detail modes all present and visibly different from each other | 2 | Render all three on a photo with a face; the point sets must differ |
| A2 | Grid overlay with configurable opacity, **and animated if the reference's is** | 2 | §4.1 pixel-diff |
| A3 | Connection lines with tick marks, in whatever topology the reference uses | 2 | §4.2 |
| A4 | Scan sweep across the boxes | 2 | Frame sequence shows a travelling band |
| A5 | Crosshair with coordinate readout | 2 | Present, follows pointer, shows coords |
| A6 | All four chip tokens render | 2 | `{score} {id} {coords} {time}` each produce text |
| A7 | Click-to-rescan | 2 | Click changes the point set |
| A8 | Always-on mode | 2 | No pointer needed |
| A9 | Bitmap, Pixelated, Code, X-Ray all present | 2 | Four visibly distinct effects |
| A10 | Image + video, 8 aspect ratios, mirror | 2 | Each renders correctly |

### B. Visual fidelity — it looks the same (30 pts)

Compared at viewport 1200, DPR 2, on the same media, with our props set to
match the reference's defaults.

| # | Criterion | Pts | Tolerance |
|---|---|---|---|
| B1 | Zoom-box size as % of frame width | 4 | within **±5%** relative |
| B2 | Marker size and form | 3 | within ±10% and the same visual type |
| B3 | Chip: font-size, tracking, padding, case | 4 | font-size ±0.5px; tracking ±0.01em; case identical |
| B4 | Chip token formatting, character for character | 4 | string equality on a fixed input |
| B5 | Grid cell size and opacity | 3 | cell ±5%; opacity ±0.03 |
| B6 | Accent, grid, chip-bg, connector colours | 4 | ΔE < 4 per sampled colour |
| B7 | Connector stroke width and tick geometry | 3 | ±0.5px |
| B8 | Corner brackets: arm length, weight, inset | 2 | ±1px |
| B9 | HUD position, inset, content layout | 2 | inset ±3px |
| B10 | Overall frame at rest: structural similarity | 1 | SSIM ≥ 0.85 on chrome-only mask |

### C. Behavioural fidelity — it moves the same (30 pts)

| # | Criterion | Pts | Tolerance |
|---|---|---|---|
| C1 | Reveal: total duration first point → last | 5 | ±15% |
| C2 | Reveal: per-point stagger interval | 4 | ±20% |
| C3 | Reveal: easing shape | 3 | Visually indistinguishable at 20fps |
| C4 | Sweep: period and direction | 4 | period ±15% |
| C5 | Crosshair follow latency | 3 | ±1 frame at 60fps |
| C6 | Hover-out: dismiss timing and manner | 3 | ±20% |
| C7 | Click-to-rescan: what actually changes | 3 | Same observable behaviour |
| C8 | Idle: does anything move, and if so what | 3 | Match presence/absence, then character |
| C9 | Touch behaviour | 2 | Same model (tap-to-open vs always) |

### D. Non-regression — we kept everything (20 pts)

**Any FAIL here caps the total at 60 regardless of the other sections.**

| # | Criterion | Pts |
|---|---|---|
| D1 | Feature inventory has not shrunk | 5 |
| D2 | All 79 checks green | 5 |
| D3 | Detection quality ≥ 1.30 / worst ≥ 1.06 / dead ≤ 4 of 72 | 4 |
| D4 | Phone scale intact: 41px box, 7px type at 390 | 3 |
| D5 | `lint:css` and `typecheck` clean | 2 |
| D6 | All 11 presets still render distinctly | 1 |

### E. Honesty gate — pass/fail, not scored

The run is **invalid**, whatever the score, if any of these is true:

- A rubric row is scored PASS on the basis of inference rather than measurement.
- A number appears in the log or docs that was not produced by a tool.
- A capability was removed and the removal was not flagged.
- The live preview was unreachable and the report does not say so plainly.
- A measurement disproved a documented claim and the documentation was not
  corrected. (Precedent: the README's detection-degradation section was wrong
  and was rewritten to say so, including the disproof. Do the same.)

---

## 8. Stop condition

Stop when **all three** hold:

1. Rubric total ≥ **95 / 100**, with **zero** FAIL rows in section D.
2. **Two consecutive iterations** produce no new failing rows and no new
   findings. One clean pass is luck; two is convergence.
3. Every `UNVERIFIABLE-HERE` row is listed in the final report with the exact
   reason and what would be needed to verify it.

Then produce a final report containing: the rubric scorecard, the before/after
table for every metric in §5.3, a side-by-side image set at all four widths, the
complete `PARITY-LOG.md`, and a plainly-worded list of everything still unknown.

---

## 9. Working notes carried forward

Hard-won, and each one cost real time. Read them before you start.

**The viewport trap.** The demo page is `width=1200`. Measurements from phone
screenshots are scaled ~0.367×. Divide through or you will build a component
2.7× too small — which happened.

**Backticks in the CSS template.** A backtick inside a comment inside the
styles template literal terminates the string and produces a syntax error far
from the cause. Three occurrences so far. `npm run lint:css` after every edit
to that block.

**IntersectionObserver gating in tests.** Every case is gated on visibility. A
test that does not scroll a case into view measures an empty component and
reports zeros that look exactly like a real failure. This has produced two
false alarms.

**Playwright cannot hover a drifting marker.** `idleMotion` means
`elementHandle.hover()` never satisfies wait-for-stable. Read the bounding box
and use `page.mouse.move()`.

**`elementHandle.screenshot()` scrolls its target into view.** For anything
scroll-driven that silently captures at full progress. Capture the viewport
instead.

**The static server must support HTTP Range.** `python -m http.server` does
not, and `<video>` then fails with a media error that looks nothing like the
real cause. Use `tools/serve.js`.

**Chromium here has no H.264.** Video fixtures are VP9/WebM.

**Sub-pixel and film grain.** Measuring per-pixel gradient on a large native
source measures grain, not structure. Resample crops to the presented size
before measuring anything about image content.

**When a test fails, decide whether the test or the code is wrong — and be
willing to conclude it is the test.** Two of the failures in this project were
bad assertions: an LCP check on an element below the fold that had correctly
not painted, and a marker-count check that hard-coded 4 when adaptive density
had legitimately reduced it to 3. In the second case the *curve* was still
tuned rather than the test relaxed, because the curve was also slightly wrong.
Both possibilities are live. Argue it from evidence.

---

## 10. Repository map

```
src/GridPulseScanPro.tsx        the component (~5,000 lines, zero deps)
src/GridPulseScan.tsx           the faithful base build
src/*.framer.tsx                Framer wrappers with property controls
src/playground.tsx              the offline playground UI
src/harnesses/dev*.tsx          one harness per test suite
test/*.test.js                  the six suites
test/score.py, diag.js          detection-quality measurement
test/measure.js                 DOM geometry measurement
test/lintcss.js                 the backtick guard
tools/serve.js                  Range-capable static server
tools/build-harnesses.js        builds every harness page
tools/run-tests.js              npm test
docs/COMPONENT.md               full component documentation
docs/ENHANCEMENTS.md            the backlog, including what was tried and rejected
docs/PARITY-PLAN.md             this file
docs/KICKOFF.md                 the prompt that starts the loop
```

`docs/ENHANCEMENTS.md` is worth reading in full before iteration 1. It records
several things that were tried and **did not work**, with numbers — a glyph
atlas 2.5× slower than `fillText`, a WebGL path that could not be honestly
benchmarked without a GPU, and the detection diagnosis that was wrong. Knowing
what has already been ruled out is worth more than another good idea.
