# Parity scorecard — v3.0.0-rc.2

Rubric: the original [PARITY-PLAN.md](./PARITY-PLAN.md) §7. Every row carries
exactly one of PASS / PARTIAL / FAIL / UNVERIFIABLE-HERE. A machine-readable
copy is [parity-score.json](./parity-score.json).

**No total is computed.** Sections B and C (60 of 100 points) require
comparison against a reference runtime this environment cannot reach
([UNREACHABLE.md](./UNREACHABLE.md) §1 — verified at browser level). Scoring
them would convert inference into measurement, which §E forbids.

Evidence tiers used below: **[browser]** = measured on our build in local
Chromium (`docs/captures/`, instruments in `tools/`); **[test]** = deterministic
suite; **[source]** = present and configurable in source.

---

## Section A — Scope parity (20 pts)

| # | Criterion | State | Evidence |
| --- | --- | --- | --- |
| A1 | Auto, Person, Detail present and visibly different | **PASS** | [test] modes produce measurably different point sets on the same field; [browser] captures per mode. |
| A2 | Grid overlay, configurable opacity, animated | **PASS (presence)** | [browser] drift/dash/pulse/scan channels render and animate; whether the reference's grid animates the same way is UNVERIFIABLE-HERE (§4.1 hypothesis untestable). |
| A3 | Connection lines with tick marks, reference topology | **PASS (presence)** | [browser] leaders, point-to-point, and both render with ticks; the reference's default topology is UNVERIFIABLE-HERE (§4.2). Default stays `leaders`, deliberately. |
| A4 | Scan sweep across boxes | **PASS** | [browser] travelling band visible in captures; 4 directions, 3 modes [test]. |
| A5 | Crosshair with coordinate readout | **PASS** | [browser] visible top-left readout in captures; follows pointer [test policy]. |
| A6 | All four chip tokens render | **PASS** | [test] `{score} {id} {coords} {time}` plus `{zoom} {mode} {pct} {index} {n} {x} {y} {label} {fps}` — string-for-string assertions. |
| A7 | Click-to-rescan | **PASS** | [browser] click commits a new scan focused exactly at the click (`SCAN-00@(0.25,0.25)`); smoothing-dilution defect found and fixed (log iteration 15). |
| A8 | Always-on mode | **PASS** | [browser] all captures run activation="always" with no pointer. |
| A9 | Bitmap, Pixelated, Code, X-Ray all present | **PASS** | [browser] captures per effect; plus `thermal` and `none` (§2.1 row 9). |
| A10 | Image + video, 8 aspect ratios, mirror | **PASS** | [browser] video plays/paints with 900 ms re-acquisition and 5/5 identity persistence on a VP8 fixture; mirror verified by luminance-profile reversal; 16:9 and 1:1 render exactly. |

**Section A: 10 rows PASS at presence level; A2/A3 carry an explicit
reference-default caveat.**

## Section B — Visual fidelity (30 pts)

All ten rows **UNVERIFIABLE-HERE** — they are defined as comparisons at 1200 px
/ DPR 2 against the live reference on identical media. Neither the runtime nor
the demo media is reachable (both proven at browser level). Our side of every
quantity is measured and recorded in captures and defaults; the reference side
does not exist here.

| Rows | State |
| --- | --- |
| B1–B10 | UNVERIFIABLE-HERE ([UNREACHABLE.md](./UNREACHABLE.md) §1) |

## Section C — Behavioural fidelity (30 pts)

Same instrument gap as Section B. Our side of these behaviours is now
browser-verified to *work* — hover in/out with leave delay, click-to-rescan
with exact focus, keyboard, touch tap, reduced motion, ≈60 fps loop, video
re-acquisition — and our half of every timing row is **measured** and matches
configuration within one frame ([MEASURED-TIMINGS.md](./MEASURED-TIMINGS.md):
reveal 333 ms, stagger 96 ms, sweep 1450 ms, crosshair 93 ms, hover-out
103/353 ms). "The same as the reference" remains unmeasurable here.

| Rows | State |
| --- | --- |
| C1–C9 | UNVERIFIABLE-HERE ([UNREACHABLE.md](./UNREACHABLE.md) §1) |

## Section D — Non-regression (20 pts)

| # | Criterion | State | Evidence |
| --- | --- | --- | --- |
| D1 | Feature inventory has not shrunk | **PASS** | `npm run inventory`: 0 removals; 245 properties / 37 modes / 83 values / 116 types (grew every milestone). |
| D2 | All 79 checks green | **UNVERIFIABLE-HERE** for the original suite (never delivered, §3); the replacement — 110 checks incl. the five v2.8 suites — is green. |
| D3 | Detection quality ≥ 1.30 / worst ≥ 1.06 / dead ≤ 4 of 72 | **PASS (substitute corpus)** | 5.938 / 3.023 (worst scene×mode; reinterpretation recorded §4) / 3 of 72. |
| D4 | Phone scale: 41 px box, 7 px type at 390 | **PASS** | 85.1 px / 9.0 px measured; [browser] 390 px capture committed. |
| D5 | lint:css and typecheck clean | **PASS** | 0 errors each, strict + noUnusedLocals. |
| D6 | All 11 presets render distinctly | **PASS** | [browser] 11/11 captured at 1200 px, 0 page errors; overlay-alpha coverage 0.4–29.9%; pairwise tables in `docs/captures/preset-distinctness.json`; closest pairs verified distinct by inspection. Presets are new implementations (originals undelivered) — provenance in source. |

**Section D: 5 PASS, 1 UNVERIFIABLE-HERE (D2, original-suite half), 0 FAIL.**

## Section E — honesty gate

| Check | State |
| --- | --- |
| No row scored PASS from inference | PASS — B and C hold at 19 UNVERIFIABLE-HERE. |
| Every number in docs produced by a tool | PASS — instruments named per row; captures carry `capture-log.json`. |
| No capability removed unflagged | PASS — inventory tool enforces mechanically. |
| Unreachable preview stated plainly | PASS — twice, with verbatim errors, both instruments. |
| Documentation corrected where measurement disproved it | PASS — iteration 10's wrong prediction and the D5-floor reinterpretation are both recorded. |

## Stop condition (§8)

1. ≥ 95/100 with zero D FAILs — **not evaluable**: 60 points structurally
   unverifiable here; Section D has zero FAILs.
2. Two consecutive clean iterations — **not met**: this milestone found and
   fixed one defect (iteration 10).
3. Every UNVERIFIABLE-HERE row listed with reason and unblock steps — **met**
   ([UNREACHABLE.md](./UNREACHABLE.md)).
