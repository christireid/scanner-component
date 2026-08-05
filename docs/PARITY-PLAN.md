# Parity plan

> **Provenance.** The original `PARITY-PLAN.md` was **not** in the delivered
> archive. This file is reconstructed from the programme description in the task
> brief. Where the original is ambiguous or self-contradictory, the
> reconstruction says so and records the interpretation used, rather than
> quietly choosing one. Replace this file if the original is recovered.

## Goal

One component that reaches feature and fidelity parity with two paid Framer
marketplace components — **Grid Pulse Scan** and **Specimen** — while keeping a
substantial superset of capability that must never shrink.

The programme is about visual and behavioural fidelity. Nominal feature
presence was already largely complete before it began; adding more features is
not progress.

## Rubric

| Section | Weight | Question |
| --- | --- | --- |
| A — Scope parity | 20 | Is every listed feature present and configurable? |
| B — Visual fidelity | 30 | At 1200 px / DPR 2 on identical media, does it look the same? |
| C — Behavioural fidelity | 30 | Do timings, easings, and interaction semantics match? |
| D — Non-regression | 20 | Does the quality contract still hold? |

**Any failure in Section D caps the total at 60.**

Every row is recorded as **PASS**, **PARTIAL**, **FAIL**, or
**UNVERIFIABLE-HERE**. There is no fifth state, and an inferred value is never
recorded as a pass.

## Phases

1. **Consolidate the canonical build.** One runnable source tree, one entry
   point at `src/GridPulseScanPro.tsx`, one policy directory, no missing local
   imports.
2. **Restore infrastructure.** Test suites, quality scripts, a Range-capable
   server, a harness builder, CSS-template lint, feature inventory,
   documentation, and parity files.
3. **Establish the baseline.** `npm ci`, `npm test`, `npm run lint:css`,
   `npm run typecheck`, regenerate the inventory, and run every Section 5.3
   measurement. **A regression outranks any parity improvement and is fixed
   first.**
4. **Capture the reference.** Operate the live reference at viewport width
   **1200** and device scale factor **2** on the same media. If it cannot be
   reached: record exactly what failed, maintain `UNREACHABLE.md`, mark every
   dependent row `UNVERIFIABLE-HERE`, and do not convert inferred values into
   passes.
5. **Score and iterate.** Sort failures by weighted gap. Address exactly one row
   per iteration: prediction → measurement → smallest targeted fix →
   remeasurement → full non-regression run → four viewport screenshots →
   rescore → parity-log entry.

> **Why 1200 px matters.** Phone screenshots of these sites are scaled by
> roughly 0.367. Reading pixel dimensions straight off a phone capture yields
> values about 2.7× too small. Only a 1200 px / DPR 2 capture is admissible
> evidence.

## Section 5.3 — quality floors

| Floor | Threshold |
| --- | --- |
| All 79 original checks green | 79 / 79 |
| Feature inventory | unchanged or grown, never shrunk |
| Detection quality ratio | ≥ 1.30 |
| Worst score | ≥ 1.06 |
| Points below random | ≤ 4 of 72 |
| Callout box size at a 390 px viewport | ≥ 41 px |
| Chip text size at a 390 px viewport | ≥ 7 px |
| CSS-template lint | clean |
| Typecheck | clean |
| Presets visibly distinct | all 11 |

> **Recorded ambiguity — "worst score".** As written, a per-point floor of 1.06
> cannot coexist with allowing up to 4 of 72 points below random: if some points
> may be below random, the worst point is below 1.0 by definition. This
> repository reads "worst score" as the worst **scene × mode configuration**
> ratio and keeps the per-point view as the separate "points below random"
> floor. Both are reported. If the original meant something else, the
> measurement in `tools/quality-floor.mjs` changes in one place.

> **Recorded ambiguity — the 41 px box.** The originating configuration for
> "41 px boxes at 390 px" is unknown. The shipped defaults produce 85.1 px at
> that width (112 px × 0.76 mobile scale), which clears the floor. If 41 px was
> a target rather than a floor, the intended configuration is needed.

## Superset that must not shrink

Tracking, video reacquisition, point meshes, multiple dither modes, contour
tracing, density modes, parallax, viewfinder telemetry, custom detector hooks,
and the imperative API.

`tools/feature-inventory.mjs` enforces this mechanically: it derives the
inventory from source and fails the build on any removal.

## Honesty gate

Deterministic previews prove that our policies behave consistently. **They
prove nothing about whether that behaviour matches the reference.** The two must
never be conflated in a report.

Concretely:

- No screenshot may be committed that a browser did not produce.
- No module may be labelled as recovered work from a version whose artifacts
  were not delivered.
- Every substitute measurement must name its substitution wherever it is quoted.
- A blocked measurement is `UNVERIFIABLE-HERE` with a reason, not an estimate.

## Completion criteria

All three must hold:

1. At least **95 / 100**, with zero failures in Section D.
2. Two consecutive iterations produce no new failures and no new findings.
3. Every remaining `UNVERIFIABLE-HERE` row is listed with its exact reason and
   the steps needed to verify it.

## Final package

- Full rubric scorecard → [SCORECARD.md](./SCORECARD.md)
- Before/after table for every quality-floor metric → [BASELINE.md](./BASELINE.md)
- Side-by-side images at 390, 768, 1440, and 2560 px → **not produced**, see [UNREACHABLE.md](./UNREACHABLE.md) §5
- Complete parity log → [PARITY-LOG.md](./PARITY-LOG.md)
- Plain-language list of everything still unknown → [UNREACHABLE.md](./UNREACHABLE.md)
