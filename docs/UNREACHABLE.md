# UNREACHABLE

Things the parity programme requires that **cannot be done in this environment**,
with the exact failure and what would be needed to resolve it.

Nothing in this file is an estimate. Every entry is a recorded failure.

---

## 1. The paid reference runtime cannot be reached

**Required by:** Phase 0 and Phase 4 — operate the live reference at viewport
width 1200, device scale factor 2, with the same media, and measure it.

**Status:** BLOCKED — network egress denied.

**Hosts attempted:**

| Host | Result |
| --- | --- |
| `www.framer.com` (marketplace listing for Grid Pulse Scan) | HTTP 403 at CONNECT |
| `www.framer.com` (marketplace listing for Specimen) | HTTP 403 at CONNECT |
| `gridpulse-scan-poncedeleonstudio.framer.website` | HTTP 403 at CONNECT |
| `specimen.framer.website` | HTTP 403 at CONNECT |

**Exact failure:**

```
$ curl -sS -o /dev/null -w "%{http_code}\n" https://gridpulse-scan-poncedeleonstudio.framer.website/
curl: (56) CONNECT tunnel failed, response 403
```

This is not a transient network error, a TLS problem, or a bot-detection
challenge that a different user agent would clear. Outbound HTTPS in this
session runs through a policy-enforcing egress proxy, and a 403 at the CONNECT
stage means the destination host is not on this session's allowlist. The
proxy's own documentation states that such denials must be reported rather than
retried or routed around, so no attempt was made to circumvent it.

Web search reaches the open web through a different path and returned no
indexed description of either component, so it is not a usable substitute
either.

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

## 3. The original 79-check test suite could not be run

**Required by:** Section D — "all 79 checks green".

**Status:** BLOCKED — the suite was not delivered.

The archive contains no `test/` directory and no test file of any kind. The 79
checks cannot be run, and their pass/fail state on this build is unknown.

A new suite was written in its place: 85 checks across 5 files, all passing
(see [BASELINE.md](./BASELINE.md)). **These are not the 79 checks.** They were
authored against this source and cannot be assumed to cover the same
behaviours. The count being larger means nothing about coverage overlap.

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

## 5. No screenshots exist in this repository

**Required by:** the final package — side-by-side images at 390, 768, 1440,
and 2560 px.

**Status:** BLOCKED for the reference side; NOT DONE for our side.

`tools/build-harness.mjs` generates 55 harness pages (11 presets × 5 viewports,
including the 1200 px measurement width) with fixed viewport, fixed device
scale factor, and interaction disabled. It deliberately does not capture
anything: capture requires a browser, and any image committed here without one
would be fabricated.

**To resolve:** run the harness pages through a browser capture step. The
reference half of each pair additionally requires item 1 to be resolved first.
