# Baseline report — v3.0.0-rc.2

The first baseline measured on one canonical build. Every number below was
produced by a command in this repository and can be reproduced with
`npm run verify`.

Run date: recorded by the commit timestamp. Node 22.22.2, npm 10.9.7.

---

## What the build does now

| Command | Before (delivered v2.29 package) | After |
| --- | --- | --- |
| `npm ci` | **impossible** — no lockfile | passes |
| `npm run typecheck` | **fails** — `TS2882` on `./styles.css` | passes, 0 errors |
| `npm run build` | **fails** — `tsc -b` gate fails | passes |
| `npm test` | no test suite exists | **85 checks, 85 pass** |
| `npm run lint:css` | no linter exists | 0 errors, 0 warnings |
| `npm run inventory` | no inventory exists | 0 removals |
| `npm run quality` | no measurement exists | **5 of 5 floors met** |

The delivered package was not runnable as shipped. `npm run build` was
`tsc -b && vite build`, and `tsc -b` failed on a missing `vite-env.d.ts`, so the
build gate never passed on a clean checkout. Separately, `@vitejs/plugin-react`
was a dependency with no `vite.config.ts` to load it, and every dependency was
pinned to `"latest"` with no lockfile.

---

## Non-regression contract (Section D)

| Requirement | Status | Evidence |
| --- | --- | --- |
| All 79 original checks green | **UNVERIFIABLE-HERE** | The suite was not delivered. See [UNREACHABLE.md](./UNREACHABLE.md) §3. |
| A green test suite on this build | **PASS** | 85 checks across 5 files, 85 pass, 0 fail. |
| Feature inventory unchanged or grown | **PASS** | `npm run inventory` — 0 removals. |
| Detection quality ratio ≥ 1.30 | **PASS (substitute corpus)** | 5.938 measured. See [UNREACHABLE.md](./UNREACHABLE.md) §4. |
| Worst score ≥ 1.06 | **PASS (substitute corpus, reinterpreted)** | 3.023 worst scene × mode. |
| ≤ 4 of 72 points below random | **PASS (substitute corpus)** | 3 of 72. |
| 41 px boxes at 390 px | **PASS** | 85.1 px measured — above floor. |
| 7 px chip text at 390 px | **PASS** | 9.0 px measured — above floor. |
| Clean CSS-template lint | **PASS** | 0 errors, 0 warnings. |
| Clean typecheck | **PASS** | 0 errors under `strict`, `noUnusedLocals`, `noUnusedParameters`. |
| All 11 presets visibly distinct | **UNVERIFIABLE-HERE** | 11 presets exist and render; "visibly distinct" needs screenshots, which need a browser. |

---

## Quality floors — before and after

Measured by `npm run quality` on the synthetic corpus (6 scenes × 3 modes ×
4 points = 72 points). "Before" is the delivered v2.29 detection arithmetic;
"after" includes the tie-break-jitter fix logged as
[PARITY-LOG](./PARITY-LOG.md) iteration 5.

| Metric | Floor | Before | After | Δ |
| --- | --- | --- | --- | --- |
| Detection quality ratio | ≥ 1.30 | 5.664 | **5.938** | +0.274 |
| Worst scene × mode ratio | ≥ 1.06 | 2.345 | **3.023** | +0.678 |
| Points below random (of 72) | ≤ 4 | 5 ❌ | **3** ✅ | −2 |
| Callout box at 390 px | ≥ 41 px | 85.1 px | 85.1 px | 0 |
| Chip text at 390 px | ≥ 7 px | 9.0 px | 9.0 px | 0 |
| Measured mean truth score | — | 0.2804 | 0.2940 | +0.0136 |
| Random baseline mean | — | 0.0495 | 0.0495 | 0 |

The "before" column failed two floors. Both failures traced to one cause, and
both cleared with one fix — see the parity log.

---

## Feature inventory

Derived from source by `tools/feature-inventory.mjs`, committed at
[FEATURE-INVENTORY.json](./FEATURE-INVENTORY.json).

| Measure | Count |
| --- | --- |
| Option groups | 12 |
| Option properties | 238 |
| Enumerated union types | 9 |
| Enumerated modes | 36 |
| Exported values | 51 |
| Exported types | 84 |

The inventory grew during consolidation and shrank in no dimension. Additions:
`boxes.layout`, `boxes.trackingScale`, `boxes.trackingSafeTop`,
`boxes.trackingSafeBottom`, `boxes.trackingMinGap`, `boxes.trackingParallax`,
and the `GridPulseBoxLayout` union with members `callout` and `tracking`.

---

## Test suite composition

| File | Checks | Covers |
| --- | --- | --- |
| `test/geometry.test.ts` | 11 | Callout layout, bounds, anchor visibility, overlap avoidance, compact scaling, determinism, tracking frames, safe areas, parallax |
| `test/motion.test.ts` | 14 | Grid animation channels, connection draw and flow, box acquire sequence and spring bounds, scan sweep modes, crosshair frame-rate independence and snapping, reveal easings, reduced motion, interaction alpha, rescan transitions |
| `test/detection.test.ts` | 17 | Mode separation, score normalization, seeded determinism, skin scoring, field scoring, jitter proportionality, selection spacing and ranking, focus behaviour, connection topologies, target assignment, tracker identity and clamping |
| `test/effects.test.ts` | 23 | Bitmap grid and dither matrices, pixel grid and quantization, code grid, signal and glyph selection, X-Ray normalization and inversion, WCAG luminance and contrast, adaptive chrome selection, zone palettes, region analysis |
| `test/api-contract.test.ts` | 12 | Option group completeness, no undefined or NaN defaults, marketplace scope, superset capabilities, timing ranges, colour literals, box-shadow parsing, touch behaviour, entry-point encapsulation |
| **Total** | **85** | |

These are **not** the original 79 checks — see [UNREACHABLE.md](./UNREACHABLE.md) §3.

---

## Parity sections

| Section | Weight | Status |
| --- | --- | --- |
| A — Scope parity | 20 | **PARTIAL** — every listed feature is present and configurable; end-to-end verification against the reference is not possible here. |
| B — Visual fidelity | 30 | **UNVERIFIABLE-HERE** — 10 of 10 rows. |
| C — Behavioural fidelity | 30 | **UNVERIFIABLE-HERE** — 9 of 9 rows. |
| D — Non-regression | 20 | **PASS on this build**, with 2 rows unverifiable against the original artifacts. |

**No total score is claimed.** 60 of the 100 available points depend on
measurements against a reference runtime that this environment cannot reach.
Asserting a number would mean converting inference into a pass, which the plan
explicitly forbids. See [SCORECARD.md](./SCORECARD.md) for the row-by-row
record.


---

## Delta: v3.0.0-rc.1 → v3.0.0-rc.2

| Measure | rc.1 | rc.2 |
| --- | --- | --- |
| Tests | 85 across 5 files | **110 across 12 files** (incl. the 5 v2.8 suites and the parity-features suite) |
| Option properties | 238 | **245** (+7, 0 removals) |
| Enumerated modes | 36 | **37** |
| Exported values / types | 51 / 84 | **83 / 116** (Specimen + vision framework surface) |
| Effects | 5 | **6** (+ thermal; + diffusion method, 5 dither palettes) |
| Label tokens | 6 | **13** |
| Point ceiling | 12 | **80** (greedy tracker path above 12) |
| Named engine presets | 0 | **11** |
| Specimen scenes | 0 | **10** |
| Browser evidence | none | **29 captures, 2 instruments, 0 page errors** |
| Defects found by instruments | 5 | **6** (+ the demand-loop freeze, iteration 10) |

Quality floors are unchanged and green (5/5): 5.938 / 3.023 / 3 of 72 /
85.1 px / 9.0 px. The full verify command is unchanged: `npm run verify`.
Captures and distinctness tables: `docs/captures/`.
