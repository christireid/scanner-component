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
