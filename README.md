# Grid Pulse Scan Pro — v3.0.0-rc.1

A dependency-free React + Canvas tactical media scanner, aiming at parity with
two Framer marketplace components — Grid Pulse Scan and Specimen — while keeping
a superset of capability.

This is the **canonical consolidated source tree**. It replaces the scattered
versioned packages: one runnable tree, one entry point, one API.

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
| `test` | 85 checks across 5 suites, run directly from TypeScript |
| `lint:css` | Stylesheets and CSS-valued strings in TypeScript |
| `inventory` | Regenerate the feature inventory; fails on any removal |
| `quality` | Section 5.3 quality floors |
| `harness` | Generate 55 fixed-viewport screenshot-harness pages |
| `serve` | Range-capable static server (needed for video) |
| `verify` | All of the above checks in one command |

## Layout

```
src/
  GridPulseScanPro.tsx        the only public entry point
  grid-pulse/                 component + 24 pure policy, type, and defaults modules
  demo/App.tsx                preset demo
test/                         5 suites, 85 checks
tools/                        lint, inventory, quality, harness, server
docs/                         plan, log, scorecard, baseline, unreachable, reference
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

## Where the parity programme actually stands

**Read [docs/UNREACHABLE.md](./docs/UNREACHABLE.md) before quoting any number
from this repository.**

| | |
| --- | --- |
| Canonical build | **done** — builds, typechecks, tests, and measures on a clean checkout |
| Section D (non-regression) | **9 PASS, 2 UNVERIFIABLE-HERE, 0 FAIL** |
| Section A (scope) | **14 PASS, 1 UNVERIFIABLE-HERE** |
| Sections B and C (fidelity) | **19 rows, all UNVERIFIABLE-HERE** |
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
