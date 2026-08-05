# UNREACHABLE

Things the parity programme requires that **cannot be done in this environment**,
with the exact failure and what would be needed to resolve it.

Nothing in this file is an estimate. Every entry is a recorded failure.

---

## 1. The paid reference runtime cannot be reached

**Required by:** Phase 0 and Phase 4 — operate the live reference at viewport
width 1200, device scale factor 2, with the same media, and measure it.

**Status:** BLOCKED — network egress denied.

**Hosts attempted, both instruments:**

| Host | curl | Chromium (Playwright, 1200 px / DPR 2) |
| --- | --- | --- |
| `gridpulse-scan-poncedeleonstudio.framer.website` | 403 at CONNECT | `net::ERR_TUNNEL_CONNECTION_FAILED` |
| `www.framer.com/...grid-pulse-scan/` | 403 at CONNECT | `net::ERR_TUNNEL_CONNECTION_FAILED` |
| `specimen.framer.website` | 403 at CONNECT | `net::ERR_TUNNEL_CONNECTION_FAILED` |
| `www.framer.com/...specimen/` | 403 at CONNECT | not retried |
| `framerusercontent.com/assets/EprNzB0Gw5uu5rBnN59cK4VsnQ.mp4` (the demo media, §3.2E) | 403 at CONNECT | not retried |

The full §3.1 checklist with verbatim output is in
[`test/reference/UNREACHABLE.md`](../test/reference/UNREACHABLE.md). The failure
is the egress proxy refusing the CONNECT tunnel — an organisation policy
denial, not bot detection, TLS, or a client limitation. The proxy documentation
states policy denials must be reported, not retried or circumvented.

A working local Chromium **is** available and is used to capture and measure
our own build (`docs/captures/`, `tools/capture-local.mjs`); it simply cannot
reach the reference.

**Consequences:**

- No reference screenshot exists at 1200 px / DPR 2.
- No reference runtime timing was captured.
- Every rubric row in **Section B (visual fidelity)** and **Section C
  (behavioural fidelity)** that requires comparison against the reference is
  recorded as `UNVERIFIABLE-HERE` in [SCORECARD.md](./SCORECARD.md).
- No numeric parity score is claimed. Producing one would require converting
  inference into measurement, which the plan forbids.

**To resolve:** run the capture from an environment whose egress policy permits
`framer.com` and `*.framer.website`, or supply reference screenshots and screen
recordings captured at 1200 px / DPR 2 with the media file identified.

> Note on measurement width: phone screenshots of these sites are scaled by
> roughly 0.367. Reading pixel dimensions off a phone capture yields values
> about 2.7× too small. Only a 1200 px / DPR 2 capture is admissible.

---

## 2. v2.30 – v2.35 could not be consolidated

**Required by:** Phase 1 — integrate temporal distortion (v2.30), scanner
cinematics (v2.31), motion calibration (v2.32), adaptive render budget (v2.33),
HUD presentation (v2.34), and preset transitions (v2.35) into the canonical
tree.

**Status:** BLOCKED — the source artifacts were not delivered.

**What the delivered archive actually contained:**

`GridPulseScanProRunnableSource.zip` — 30 files, 5 883 lines:

```
GridPulseScanPro-Runnable/
  index.html  package.json  tsconfig.json  tsconfig.app.json  README.md
  public/demo-flower.jpeg
  src/main.tsx  src/App.tsx  src/styles.css
  src/grid-pulse/GridPulseScan.tsx            (4 085 lines, v2.29)
  src/grid-pulse/*.ts                          (21 policy modules)
```

There is no `v2.30`–`v2.35` directory, patch, diff, or artifact of any kind in
the archive, and no module in it references temporal distortion, cinematics,
motion calibration, render budgeting, a HUD, or preset transitions. The
archive's own `README.md` states the same thing:

> "Later versions v2.30–v2.35 were generated as partial iteration artifacts,
> not as complete cumulative source trees. They are therefore not merged into
> this runnable package."

**What was NOT done:** those six feature sets were not re-implemented from
their descriptions. Writing new modules and labelling them "v2.30–v2.35" would
misrepresent authored-from-scratch code as recovered work, and would make the
consolidation claim untrue.

**To resolve:** supply the v2.30–v2.35 artifacts in any form — archives,
diffs, or even the individual modified files. The consolidated tree has a
single policy directory and a single entry point specifically so they can be
merged one at a time.

---

## 2a. Plan artifacts still missing after the original plan arrived

The original `PARITY-PLAN.md` was delivered on 2026-08-05 and is installed
verbatim. Two things it references remain undelivered:

- **`docs/KICKOFF.md`** (deliverable 2 of 2).
- **The §10 repository** it maps: `src/GridPulseScanPro.tsx` at ~5 000 lines
  with zero deps, six suites / 79 checks, `test/score.py`, `test/measure.js`,
  `test/lintcss.js`, `tools/serve.js`, the presets source, and the
  `docs/ENHANCEMENTS.md` backlog of rejected approaches. What WAS delivered is
  `SpecimenGridPulse-Pro-v2.8` — a different, older lineage (its own log says
  the same: "the local package is not the full repository described by
  PARITY-PLAN.md"). Its eight framework modules and five suites are now
  integrated; the §10 repository's roles are re-implemented here
  (`tools/quality-floor.mjs` for `score.py`, `tools/lint-css-templates.mjs`
  for `lintcss.js`, `tools/serve.mjs` for `serve.js`, and new implementations
  of the eleven named presets, labelled as such in source).

## 3. The original 79-check test suite could not be run

**Required by:** Section D — "all 79 checks green".

**Status:** BLOCKED — the suite was not delivered.

The archive contains no `test/` directory and no test file of any kind. The 79
checks cannot be run, and their pass/fail state on this build is unknown.

A new suite was written in its place — now 110 checks across 12 files, all
passing, including the five deterministic suites ported from the
`SpecimenGridPulse-Pro-v2.8` package (see [BASELINE.md](./BASELINE.md)).
**These are not the 79 checks.** They were authored against this source and
cannot be assumed to cover the same behaviours. The count being larger means
nothing about coverage overlap.

**To resolve:** supply the original suite. It can be added alongside the new
one without conflict.

---

## 4. The original quality-floor corpus could not be reproduced

**Required by:** Section 5.3 — detection quality ratio ≥ 1.30, worst score
≥ 1.06, no more than 4 of 72 points below random.

**Status:** PARTIAL — the floors are measured, but against a substitute corpus.

The original measurement tool and its media corpus were not delivered, and Node
has no canvas, so no image decoding is available headlessly. `tools/quality-floor.mjs`
therefore measures against a deterministic synthetic corpus
(`test/support/synthetic-field.ts`): six scenes with known ground-truth salient
regions, scored in three detection modes, four points each — 72 points, which
matches the plan's point count by construction rather than by coincidence of
methodology.

**The absolute numbers are not comparable to the original report.** They are a
reproducible baseline *for this repository*: a change in them is a regression
signal here, and evidence about nothing else.

One further deviation is recorded honestly: the plan's "worst-point score at
least 1.06" is measured here as the worst *scene × mode configuration* ratio,
not the worst individual point. A per-point floor of 1.06 cannot coexist with
the plan's own allowance of up to 4 of 72 points below random, and with a
minimum point separation of 0.16 not every point can physically sit inside a
ground-truth region — so a per-point minimum would be unreachable by
construction rather than by quality. The per-point view is still reported, as
the "points below random" floor.

**To resolve:** supply the original corpus and measurement definition.

---

## 5. Side-by-side comparison images cannot include the reference half

**Required by:** the final package — side-by-side images at 390, 768, 1440,
and 2560 px.

**Status:** OUR side DONE; the reference side remains BLOCKED by item 1.

`tools/build-harness.mjs` generates 145 fixed-viewport harness pages (29
presets × 5 viewports including the 1200 px measurement width), and
`tools/capture-local.mjs` drives them through the local Chromium:
`docs/captures/` holds 29 real screenshots — the default at all four plan
widths, all 11 named presets, thermal and diffusion effects, and all 10
Specimen scenes — plus `capture-log.json` and `preset-distinctness.json`.
Every committed image was produced by a browser; none is fabricated.

**To resolve fully:** capture the reference under item 1's conditions and pair
the images.
