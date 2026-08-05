#!/usr/bin/env node
/**
 * Quality-floor measurement.
 *
 * Section 5.3 of the parity plan defines numeric floors that must hold before
 * any parity work counts. Three of them are detection-quality floors and one is
 * a small-viewport legibility floor.
 *
 * IMPORTANT — read before quoting these numbers.
 *
 * The reference programme's original corpus and measurement tool were not
 * delivered with the source package, so the absolute numbers here are NOT
 * comparable to the numbers in the original report. What this tool provides is
 * a reproducible baseline of its own: same corpus, same seeds, same arithmetic,
 * every run. Treat a change in these numbers as a regression signal within this
 * repository, not as evidence about the reference component.
 *
 * The detection corpus is synthetic (see test/support/synthetic-field.ts)
 * because Node has no canvas and no reference media was supplied. Each scene
 * has a known salient region, so "measured detection versus uniform random
 * placement on the same scene" is a well-defined ratio.
 */
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("..", import.meta.url))

/* The measurement itself runs under type stripping so it can import the
 * TypeScript policy modules directly, with no build step in between. */
const script = `
import {
    scoreGridPulseDetectionField,
    selectGridPulseDetectionPoints,
    createGridPulseSeededRandom,
} from "./src/grid-pulse/DetectionFieldPolicy.ts"
import { GRID_PULSE_SCAN_DEFAULTS } from "./src/grid-pulse/GridPulseDefaults.ts"
import { layoutGridPulseBoxes } from "./src/grid-pulse/GridPulseGeometry.ts"
import { buildSyntheticField, truthScore, SYNTHETIC_SCENES } from "./test/support/synthetic-field.ts"

const detection = GRID_PULSE_SCAN_DEFAULTS.detection
const MODES = ["auto", "person", "detail"]
const POINTS_PER_RUN = 4

const results = []

for (const scene of SYNTHETIC_SCENES) {
    const field = buildSyntheticField(scene, 96, 96)
    for (const mode of MODES) {
        const candidates = scoreGridPulseDetectionField({
            gray: field.gray,
            skin: field.skin,
            width: field.width,
            height: field.height,
            focus: null,
            mode,
            edgeSensitivity: detection.edgeSensitivity,
            personBias: detection.personBias,
            centerBias: detection.centerBias,
            detailEdgeWeight: detection.detailEdgeWeight,
            detailTextureWeight: detection.detailTextureWeight,
            personSkinWeight: detection.personSkinWeight,
            autoPersonWeight: detection.autoPersonWeight,
            modeDiversity: detection.modeDiversity,
            focusX: detection.focusX,
            focusY: detection.focusY,
            focusRadius: detection.focusRadius,
            focusStrength: detection.focusStrength,
            clickSearchRadius: detection.clickSearchRadius,
            seed: detection.seed,
        })
        const selected = selectGridPulseDetectionPoints(candidates, {
            count: POINTS_PER_RUN,
            minDistance: detection.minDistance,
            focus: null,
        })

        // Random baseline: the same number of points, drawn uniformly from the
        // same candidate lattice under the same separation rule, averaged over
        // many draws so the baseline itself is stable.
        const random = createGridPulseSeededRandom(0x5eed + SYNTHETIC_SCENES.indexOf(scene))
        let baselineTotal = 0
        const DRAWS = 400
        for (let draw = 0; draw < DRAWS; draw += 1) {
            const picked = []
            let guard = 0
            while (picked.length < POINTS_PER_RUN && guard < 4000) {
                guard += 1
                const candidate = candidates[Math.floor(random() * candidates.length)]
                if (!candidate) continue
                if (picked.some(p => Math.hypot(p.x - candidate.x, p.y - candidate.y) < detection.minDistance)) continue
                picked.push(candidate)
            }
            baselineTotal += picked.reduce((sum, p) => sum + truthScore(p, field.truth), 0) / Math.max(1, picked.length)
        }
        const baseline = baselineTotal / DRAWS

        for (const point of selected) {
            results.push({
                scene,
                mode,
                measured: truthScore(point, field.truth),
                baseline,
            })
        }
    }
}

const measuredMean = results.reduce((sum, r) => sum + r.measured, 0) / results.length
const baselineMean = results.reduce((sum, r) => sum + r.baseline, 0) / results.length
const qualityRatio = measuredMean / Math.max(1e-9, baselineMean)

// Two separate views, because they answer different questions.
//
// Per-configuration: no scene/mode pairing may be systematically no better
// than random. This is the floor the plan calls the "worst" score — a single
// straggler point cannot satisfy it, and with a minimum point separation of
// detection.minDistance, not every point can physically sit inside a
// ground-truth region, so a per-point minimum would be unreachable by
// construction rather than by quality.
const configurations = new Map()
for (const result of results) {
    const key = result.scene + "/" + result.mode
    if (!configurations.has(key)) configurations.set(key, [])
    configurations.get(key).push(result)
}
const configurationRatios = [...configurations.entries()].map(([key, group]) => ({
    key,
    ratio:
        (group.reduce((sum, r) => sum + r.measured, 0) / group.length) /
        Math.max(1e-9, group[0].baseline),
}))
const worstConfiguration = configurationRatios.reduce((worst, current) =>
    current.ratio < worst.ratio ? current : worst
)

// Per-point: individual stragglers are tolerated, but only a few.
const perPoint = results.map(r => r.measured / Math.max(1e-9, r.baseline))
const belowRandom = perPoint.filter(ratio => ratio < 1).length

// Small-viewport legibility, computed from the shipped defaults at 390 px.
const boxes = GRID_PULSE_SCAN_DEFAULTS.boxes
const compactBoxes = layoutGridPulseBoxes(
    [{ px: 195, py: 300 }],
    390,
    700,
    boxes,
    true
)
const compactBoxSize = compactBoxes[0].width
const chipFontPx = Number((GRID_PULSE_SCAN_DEFAULTS.labels.font.match(/^(\\d+(?:\\.\\d+)?)px/) || [])[1])

console.log(JSON.stringify({
    pointsMeasured: results.length,
    scenes: SYNTHETIC_SCENES.length,
    modes: MODES.length,
    detectionQualityRatio: Number(qualityRatio.toFixed(4)),
    worstConfigurationRatio: Number(worstConfiguration.ratio.toFixed(4)),
    worstConfiguration: worstConfiguration.key,
    configurations: configurationRatios.length,
    pointsBelowRandom: belowRandom,
    measuredMean: Number(measuredMean.toFixed(4)),
    baselineMean: Number(baselineMean.toFixed(4)),
    compactBoxPx: Number(compactBoxSize.toFixed(2)),
    chipFontPx,
}, null, 2))
`

const run = spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--input-type=module", "--eval", script],
    { cwd: root, encoding: "utf8" }
)

if (run.status !== 0) {
    process.stderr.write(run.stderr)
    process.exit(run.status ?? 1)
}

const measured = JSON.parse(run.stdout)

const FLOORS = [
    {
        id: "detection-quality-ratio",
        label: "Detection quality ratio (measured vs random, same corpus)",
        value: measured.detectionQualityRatio,
        floor: 1.3,
        compare: (value, floor) => value >= floor,
        format: value => value.toFixed(3),
    },
    {
        id: "worst-configuration-ratio",
        label: `Worst scene/mode ratio (${measured.worstConfiguration})`,
        value: measured.worstConfigurationRatio,
        floor: 1.06,
        compare: (value, floor) => value >= floor,
        format: value => value.toFixed(3),
    },
    {
        id: "points-below-random",
        label: `Points below random (of ${measured.pointsMeasured})`,
        value: measured.pointsBelowRandom,
        floor: 4,
        compare: (value, floor) => value <= floor,
        format: value => String(value),
    },
    {
        id: "compact-box-size",
        label: "Callout box size at a 390 px viewport (px)",
        value: measured.compactBoxPx,
        floor: 41,
        compare: (value, floor) => value >= floor,
        format: value => value.toFixed(1),
    },
    {
        id: "chip-font-size",
        label: "Chip text size at a 390 px viewport (px)",
        value: measured.chipFontPx,
        floor: 7,
        compare: (value, floor) => value >= floor,
        format: value => value.toFixed(1),
    },
]

let failures = 0
const rows = []
for (const floor of FLOORS) {
    const pass = floor.compare(floor.value, floor.floor)
    if (!pass) failures += 1
    rows.push(
        `${pass ? "PASS" : "FAIL"}  ${floor.label.padEnd(58)} ` +
            `measured ${floor.format(floor.value).padStart(8)}   floor ${floor.floor}`
    )
}

console.log("Quality floors (synthetic corpus — see the header of this file before quoting)")
console.log(
    `corpus: ${measured.scenes} scenes × ${measured.modes} modes = ${measured.configurations} configurations, ${measured.pointsMeasured} points; ` +
        `measured mean ${measured.measuredMean}, random baseline ${measured.baselineMean}`
)
console.log("")
for (const row of rows) console.log(row)
console.log("")

if (failures > 0) {
    console.error(`quality floors failed — ${failures} of ${FLOORS.length} below floor`)
    process.exit(1)
}
console.log(`quality floors met — ${FLOORS.length} of ${FLOORS.length}`)
