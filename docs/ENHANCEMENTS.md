# Enhancements history

## v3.0.0-rc.1 — Canonical Consolidation

The milestone's purpose was to rebuild **one** authoritative source tree and
establish a valid baseline, not to add features. Two capabilities were still
added: one that already existed but was unreachable, and one that was a defect
repair.

### Structure

- **One entry point.** `src/GridPulseScanPro.tsx` re-exports the component, the
  defaults, every option type, and every pure policy. `api-contract.test.ts`
  fails if the demo or any other consumer reaches into `src/grid-pulse/`.
- **One policy directory.** All 24 modules live under `src/grid-pulse/`.
- **Types and defaults split out.** `GridPulseOptionTypes.ts` and
  `GridPulseDefaults.ts` are pure, so the API surface and shipped values can be
  inspected, tested, and inventoried without loading React or a canvas.
- **Detection scoring extracted.** `DetectionFieldPolicy.ts` holds the saliency
  arithmetic that used to be inlined in the renderer. This is what makes the
  detection quality floors measurable headlessly.
- **Shadow parsing extracted.** `BoxShadowPolicy.ts`.
- **Demo moved** to `src/demo/`, and now exposes all 11 presets.

### Infrastructure restored

| Path | Purpose |
| --- | --- |
| `test/` | 5 suites, 85 checks, run by `node --test` with type stripping — no build step |
| `tools/lint-css-templates.mjs` | Stylesheet and CSS-valued-string lint |
| `tools/feature-inventory.mjs` | Derives the inventory from source; fails on any removal |
| `tools/quality-floor.mjs` | Section 5.3 floors against a deterministic corpus |
| `tools/serve.mjs` | Range-capable static server, needed for video |
| `tools/build-harness.mjs` | 55 fixed-viewport harness pages plus a manifest |
| `docs/` | Plan, log, scorecard, baseline, unreachable list, component reference |

`npm run verify` runs typecheck, tests, lint, inventory, and quality in one
command.

### Features

- **`boxes.layout: "tracking"`** — Specimen-style square frames centred on the
  feature, with `trackingScale`, `trackingSafeTop`, `trackingSafeBottom`,
  `trackingMinGap`, and `trackingParallax`. The layout function already existed
  in `GridPulseGeometry.ts` and was never imported. Default stays `"callout"`.

### Fixes

| Fix | Effect |
| --- | --- |
| Added `vite-env.d.ts` and `vite.config.ts`, pinned dependencies, committed a lockfile | `npm ci` and `npm run build` work; the delivered package's build gate failed |
| `parseBoxShadow` rewritten as a length tokenizer | The shipped `0 12px 42px` default silently rendered as `0 10px 28px` |
| Default label template `"{score} (zoom)"` → `"{score} ({zoom})"` | Chips rendered literal text `(zoom)` instead of the zoom value |
| Detection tie-break jitter scaled to the field's score range | Person mode on skin-free media had degenerated toward random placement |
| `StableTargetTracker` clamps newly acquired points | A custom detector reporting out of range produced one off-frame position |
| Tracking-frame layout guarantees one frame per point | Callers index by point index |

Full measurements for each are in [PARITY-LOG.md](./PARITY-LOG.md).

### Not included

v2.30 through v2.35 — temporal distortion, scanner cinematics, motion
calibration, adaptive render budget, HUD presentation, preset transitions — are
**not** in this build. Their artifacts were not in the delivered archive, and
nothing was written from their descriptions and labelled as recovered work. See
[UNREACHABLE.md](./UNREACHABLE.md) §2.

---

## v2.29 and earlier — as delivered

Reconstructed from the delivered source. There was no changelog in the archive,
so this describes the state of the code rather than the order it arrived in.

**Component:** `GridPulseScan.tsx`, 4 085 lines.

**Policy modules (21):** adaptive chrome (2), bitmap, code, pixelated and X-Ray
effects, connection animation and topology, crosshair motion, detection mode,
geometry, grid animation, interaction transition, label tokens, reduced motion,
rescan transition, scan-box animation, scan sweep, target tracking, touch
interaction.

**Capabilities present at v2.29:** all three detection modes; animated grid with
dash, drift, pulse, and scan channels; leader and point-to-point connections
with tick marks; box scan sweeps in four directions; crosshair with three
coordinate styles; six label tokens with four time formats; click-to-rescan;
always-on operation; four media effects; image and video pathways; eight aspect
ratios; mirroring; stable target tracking; temporal smoothing; adaptive chrome
with regional zones and halo; demand-driven rendering; the render bridge.

**Known state at v2.29:** did not build (missing `vite-env.d.ts`), no lockfile,
no tests, no tools, no docs, and the four defects listed above.
