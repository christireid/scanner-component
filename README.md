# Grid Pulse Scan Pro — v3.0.0-rc.2

A dependency-free React + Canvas tactical media scanner, aiming at parity with
two Framer marketplace components — Grid Pulse Scan and Specimen — while keeping
a superset of capability. The canonical tree now carries **both delivered
lineages**: the v2.29 Grid Pulse engine and the SpecimenGridPulse-Pro v2.8
integrated renderer, behind one entry point (`src/GridPulseScanPro.tsx` —
Specimen default export, engine as `GridPulseScan`).

## Quick start

```bash
npm ci
npm run dev       # http://localhost:5173
```

```bash
npm run verify    # typecheck + tests + lint + inventory + quality floors
npm run build     # typecheck, then production build
```

## Scripts

| Script | What it does |
| --- | --- |
| `dev` | Vite dev server with the preset demo |
| `build` | Typecheck, then production build |
| `typecheck` | `tsc -b`, strict, no unused locals or parameters |
| `test` | 110 checks across 12 suites, run directly from TypeScript |
| `lint:css` | Stylesheets and CSS-valued strings in TypeScript |
| `inventory` | Regenerate the feature inventory; fails on any removal |
| `quality` | Section 5.3 quality floors |
| `harness` | Generate 145 fixed-viewport screenshot-harness pages |
| `serve` | Range-capable static server (needed for video) |
| `verify` | All of the above checks in one command |

## Layout

```
src/
  GridPulseScanPro.tsx        the only public entry point (both renderers)
  grid-pulse/                 engine, Specimen renderer, vision framework,
                              35 policy/type/defaults modules
  demo/App.tsx                dual-renderer preset demo
test/                         12 suites, 110 checks
tools/                        lint, inventory, quality, harness, server,
                              browser capture + preset-distinctness instruments
docs/                         the original parity plan, log, scorecard, baseline,
                              unreachable record, reference, 29 browser captures
```

Nothing outside `src/GridPulseScanPro.tsx` imports from `src/grid-pulse/` — the
test suite enforces it.

## Usage

```tsx
import GridPulseScan from "./src/GridPulseScanPro"

<GridPulseScan
    src="/media/portrait.jpg"
    style={{ width: "100%", height: 560 }}
    detection={{ mode: "detail", pointCount: 6 }}
    effect={{ type: "xray", scope: "both" }}
    boxes={{ layout: "callout" }}
    interaction={{ activation: "always", clickToRescan: true }}
/>
```

Full reference: [docs/COMPONENT.md](./docs/COMPONENT.md).

## Reference feature coverage (marketplace list, §2 of the plan)

Every listed feature is implemented and exercised: Auto/Person/Detail modes ·
animated grid with configurable opacity · tick-marked connections (leaders,
point-to-point, or both) · box scan sweeps · crosshair with coordinate
readout · `{score} {id} {coords} {time}` chips (plus 9 more tokens) ·
click-to-rescan · always-on · Bitmap/Pixelated/Code/X-Ray (plus thermal and
none) · image and video · the 8 aspect ratios · mirror · configurable
grid/crosshair/connections/labels. Superset capabilities per the plan's §5.1
inventory: 11 named presets, dither palettes with Floyd–Steinberg, 80-point
density, custom detector hook, tracking frames with parallax, the Specimen
scene system, plugins, GPU post-processing, and an imperative bridge.

## Where the parity programme actually stands

**Read [docs/UNREACHABLE.md](./docs/UNREACHABLE.md) before quoting any number
from this repository.**

| | |
| --- | --- |
| Canonical build | **done** — builds, typechecks, tests, measures, and renders in a real browser |
| Section A (scope) | **10 of 10 rows PASS** (A2/A3 carry a reference-default caveat) |
| Section D (non-regression) | **5 PASS, 1 UNVERIFIABLE-HERE, 0 FAIL** |
| Sections B and C (fidelity) | **19 rows, all UNVERIFIABLE-HERE** — the reference runtime and its demo media are blocked at the egress proxy, verified with a real Chromium (`net::ERR_TUNNEL_CONNECTION_FAILED`) |
| Local browser evidence | **69 captures, 0 page errors**, in `docs/captures/` — presets, effects, Specimen scenes, and a 4-photo × 10-scenario real-media matrix ([MEDIA-TESTS.md](./docs/MEDIA-TESTS.md)) |
| Official parity score | **not established, and not estimated** |

The reference runtime was never observed: `framer.com` and `*.framer.website`
are denied by this environment's egress policy, returning HTTP 403 at CONNECT.
60 of the 100 rubric points depend on measuring that runtime, so no total score
is claimed. Producing one would mean recording inference as measurement.

Two further gaps are recorded rather than papered over: the **v2.30–v2.35**
artifacts were not in the delivered archive and were not re-implemented from
their descriptions, and the **original 79-check suite** was not delivered, so
the 85 checks here are a new suite, not that one.

## What consolidation found

Building the measurement infrastructure surfaced five defects that reading the
source did not. Each is logged with its measurement in
[docs/PARITY-LOG.md](./docs/PARITY-LOG.md).

1. The delivered package **did not build** — `tsc -b` failed on a missing
   `vite-env.d.ts`, and there was no lockfile or Vite config.
2. Every callout chip rendered the literal text `(zoom)` — a token written with
   parentheses instead of braces.
3. Every box shadow rendered at `0 10px 28px` instead of the configured
   `0 12px 42px`, because the parser required a `px` unit on the leading zero.
4. **Person mode degenerated toward random placement** on media without skin
   tones: a fixed tie-break jitter was 11.4% of that mode's compressed score
   range, against 2.5% for the others.
5. The public target tracker did not clamp newly acquired points.
6. **The shipped default was illegible on white media** — white chrome on a
   white photograph. Found by testing user-supplied photos; fixed by defaulting
   `adaptiveChrome` on (global mode), before/after captures committed.
7. **The demand-driven render loop froze permanently with a blank overlay** —
   the rescan fade passes through alpha 0 and the loop's keep-alive condition
   was gated on `overlayAlpha > 0`. Invisible in code review and interactive
   use; found by instrumenting rAF counts in the local browser (6 frames, then
   silence). Fixed; now holds ≈60 fps.

The Specimen-style tracking-frame layout was also found shipping as dead code —
90 lines, exported, never imported — and is now reachable via
`boxes.layout: "tracking"`.

## Docs

| File | Contents |
| --- | --- |
| [COMPONENT.md](./docs/COMPONENT.md) | API reference |
| [PARITY-PLAN.md](./docs/PARITY-PLAN.md) | The programme, with recorded ambiguities |
| [SCORECARD.md](./docs/SCORECARD.md) | Every rubric row and its state |
| [BASELINE.md](./docs/BASELINE.md) | Measured baseline, before/after tables |
| [PARITY-LOG.md](./docs/PARITY-LOG.md) | Iteration log |
| [UNREACHABLE.md](./docs/UNREACHABLE.md) | What cannot be done here, and why |
| [ENHANCEMENTS.md](./docs/ENHANCEMENTS.md) | Version history |
| [FEATURE-INVENTORY.json](./docs/FEATURE-INVENTORY.json) | Machine-checked inventory |
