import {
    resolveGridPulseDetectionModeScore,
    type GridPulseScoredDetectionMode,
} from "./DetectionModePolicy.ts"

/**
 * Pure saliency scoring and point selection.
 *
 * The canvas renderer decodes media into grayscale and skin fields; everything
 * after that is arithmetic. Keeping it here means the detection contract — mode
 * separation, minimum spacing, focus bias, confidence ranking — can be measured
 * headlessly by the quality-floor tool instead of only inside a browser.
 */

export interface GridPulseDetectionFieldWeights {
    mode: GridPulseScoredDetectionMode
    edgeSensitivity: number
    personBias: number
    centerBias: number
    detailEdgeWeight: number
    detailTextureWeight: number
    personSkinWeight: number
    autoPersonWeight: number
    modeDiversity: number
    focusX: number
    focusY: number
    focusRadius: number
    focusStrength: number
    clickSearchRadius: number
    seed: number
}

export interface GridPulseDetectionFieldInput extends GridPulseDetectionFieldWeights {
    /** Row-major luminance in 0..1, length `width * height`. */
    gray: Float32Array
    /** Row-major skin confidence in 0..1, length `width * height`. */
    skin: Float32Array
    width: number
    height: number
    /** Optional normalized attention point, e.g. the position that was clicked. */
    focus: { x: number; y: number } | null
}

export interface GridPulseDetectionCandidate {
    x: number
    y: number
    raw: number
}

export interface GridPulseDetectionSelectionOptions {
    count: number
    minDistance: number
    focus: { x: number; y: number } | null
}

export interface GridPulseSelectedDetectionPoint {
    x: number
    y: number
    score: number
    id: string
}

const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value))

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** Deterministic PRNG. Identical seeds must always produce identical scans. */
export const createGridPulseSeededRandom = (seed: number) => {
    let state = (seed >>> 0) || 1
    return () => {
        state += 0x6d2b79f5
        let t = state
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

/** Sample stride. Bounded so very large and very small fields cost the same. */
export const gridPulseDetectionStep = (width: number, height: number) =>
    Math.max(2, Math.round(Math.min(width, height) / 44))

export function scoreGridPulseDetectionField(
    input: GridPulseDetectionFieldInput
): GridPulseDetectionCandidate[] {
    const { gray, skin, width: w, height: h, focus } = input
    const random = createGridPulseSeededRandom(
        input.seed +
            Math.round((focus?.x || 0) * 997) +
            Math.round((focus?.y || 0) * 1597)
    )
    const candidates: GridPulseDetectionCandidate[] = []
    const step = gridPulseDetectionStep(w, h)

    for (let y = 2; y < h - 2; y += step) {
        for (let x = 2; x < w - 2; x += step) {
            const index = y * w + x
            const gx =
                -gray[index - w - 1] - 2 * gray[index - 1] - gray[index + w - 1] +
                gray[index - w + 1] + 2 * gray[index + 1] + gray[index + w + 1]
            const gy =
                -gray[index - w - 1] - 2 * gray[index - w] - gray[index - w + 1] +
                gray[index + w - 1] + 2 * gray[index + w] + gray[index + w + 1]
            const edge = clamp(Math.hypot(gx, gy) / 2.2, 0, 1)
            const localMean =
                (gray[index] + gray[index - 2] + gray[index + 2] + gray[index - 2 * w] + gray[index + 2 * w]) / 5
            const variance = clamp(
                (Math.abs(gray[index] - localMean) +
                    Math.abs(gray[index - 1] - localMean) +
                    Math.abs(gray[index + 1] - localMean)) *
                    1.8,
                0,
                1
            )
            const nx = x / (w - 1)
            const ny = y / (h - 1)
            const centerDistance = Math.hypot(nx - 0.5, ny - 0.5) / 0.707
            const centerScore = 1 - clamp(centerDistance, 0, 1)
            const modeScore = resolveGridPulseDetectionModeScore(
                input.mode,
                {
                    edge: edge * input.edgeSensitivity,
                    texture: variance,
                    skin: skin[index] * input.personBias,
                    center: centerScore,
                },
                {
                    detailEdgeWeight: input.detailEdgeWeight,
                    detailTextureWeight: input.detailTextureWeight,
                    personSkinWeight: input.personSkinWeight,
                    autoPersonWeight: input.autoPersonWeight,
                    modeDiversity: input.modeDiversity,
                }
            )
            let raw = modeScore.score + centerScore * input.centerBias
            if (input.focusStrength > 0) {
                const focusDistance = Math.hypot(
                    nx - clamp(input.focusX, 0, 1),
                    ny - clamp(input.focusY, 0, 1)
                )
                const focusRadius = Math.max(0.04, input.focusRadius)
                const focusWeight = Math.exp(
                    -(focusDistance * focusDistance) / (2 * focusRadius * focusRadius)
                )
                const focusMultiplier = lerp(
                    1,
                    0.28 + focusWeight * 1.22,
                    clamp(input.focusStrength, 0, 1)
                )
                raw *= focusMultiplier
            }
            if (focus) {
                const d = Math.hypot(nx - focus.x, ny - focus.y)
                const radius = Math.max(0.03, input.clickSearchRadius)
                const focusWeight = Math.exp(-(d * d) / (2 * radius * radius))
                raw = raw * (0.25 + focusWeight * 1.5)
            }
            candidates.push({ x: nx, y: ny, raw })
        }
    }

    // Tie-break jitter, scaled to the range this field actually produced.
    //
    // A fixed absolute jitter is only small relative to a mode that reaches
    // ~1.0. Person mode on media with no skin compresses into roughly a 0..0.22
    // band, where the same absolute jitter is ~11% of the range and dominates
    // ranking — the detector degenerates toward random placement. Scaling by the
    // observed maximum keeps the jitter at a constant ~2.5% of range for every
    // mode and every scene. The floor keeps a genuinely flat field from
    // selecting purely by scan order.
    let maximum = 0
    for (const candidate of candidates) maximum = Math.max(maximum, candidate.raw)
    const jitterScale = Math.max(0.08, maximum)
    for (const candidate of candidates) {
        candidate.raw += random() * 0.025 * jitterScale
    }

    return candidates
}

/**
 * Greedy highest-first selection under a minimum-separation constraint.
 * A supplied focus point is always accepted first and always scores 1.
 */
export function selectGridPulseDetectionPoints(
    candidates: readonly GridPulseDetectionCandidate[],
    options: GridPulseDetectionSelectionOptions
): GridPulseSelectedDetectionPoint[] {
    const ordered = [...candidates].sort((a, b) => b.raw - a.raw)
    const count = Math.max(0, Math.round(options.count))
    const selected: GridPulseSelectedDetectionPoint[] = []
    if (options.focus) {
        selected.push({ x: options.focus.x, y: options.focus.y, score: 1, id: "SCAN-00" })
    }
    for (const candidate of ordered) {
        if (selected.length >= count) break
        if (
            selected.some(
                point =>
                    Math.hypot(point.x - candidate.x, point.y - candidate.y) < options.minDistance
            )
        ) {
            continue
        }
        const rank = selected.length
        selected.push({
            x: candidate.x,
            y: candidate.y,
            score: clamp(1 - (rank / Math.max(2, count + 1)) * 0.72, 0.2, 1),
            id: `SCAN-${String(rank + 1).padStart(2, "0")}`,
        })
    }
    return selected.slice(0, count)
}

/**
 * Skin-likelihood in 0..1 for one RGB sample. Shared by the canvas decoder and
 * by synthetic corpora used for measurement.
 */
export const calculateGridPulseSkinScore = (r: number, g: number, b: number) => {
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const classic =
        r > 70 &&
        g > 30 &&
        b > 15 &&
        max - min > 10 &&
        Math.abs(r - g) > 8 &&
        r > g &&
        r > b
    const y = 0.299 * r + 0.587 * g + 0.114 * b
    const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b
    const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b
    const ycbcr = y > 45 && cb > 77 && cb < 135 && cr > 132 && cr < 180
    if (!classic && !ycbcr) return 0
    const redDominance = clamp((r - Math.max(g, b)) / 80, 0, 1)
    const chroma = clamp((max - min) / 110, 0, 1)
    return clamp(0.45 + redDominance * 0.3 + chroma * 0.25, 0, 1)
}
