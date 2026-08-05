import {
    calculateGridPulseSkinScore,
    createGridPulseSeededRandom,
} from "../../src/grid-pulse/DetectionFieldPolicy.ts"

/**
 * Deterministic synthetic media used by the detection tests and by the
 * quality-floor tool.
 *
 * The reference component's own media set is not available here, and Node has
 * no canvas, so the corpus is generated arithmetically instead. Each scene has
 * a *known* ground-truth salient region, which is what makes a detection
 * quality ratio measurable at all: measured detection is compared against
 * uniform random placement on the same scene.
 */

export type SyntheticScene =
    | "edge-cluster"
    | "portrait"
    | "texture-corner"
    | "two-subjects"
    | "low-contrast"
    | "high-frequency"

export interface SyntheticField {
    gray: Float32Array
    skin: Float32Array
    width: number
    height: number
    /** Normalized ground-truth regions of interest, as centre plus radius. */
    truth: Array<{ x: number; y: number; radius: number }>
}

export const SYNTHETIC_SCENES: SyntheticScene[] = [
    "edge-cluster",
    "portrait",
    "texture-corner",
    "two-subjects",
    "low-contrast",
    "high-frequency",
]

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))

const disc = (nx: number, ny: number, cx: number, cy: number, radius: number) =>
    Math.hypot(nx - cx, ny - cy) <= radius

export function buildSyntheticField(
    scene: SyntheticScene,
    width = 96,
    height = 96
): SyntheticField {
    const gray = new Float32Array(width * height)
    const skin = new Float32Array(width * height)
    const random = createGridPulseSeededRandom(0xc0ffee + SYNTHETIC_SCENES.indexOf(scene) * 7919)
    const truth: SyntheticField["truth"] = []

    const rgb = new Uint8ClampedArray(width * height * 3)

    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const index = y * width + x
            const nx = x / (width - 1)
            const ny = y / (height - 1)
            let luminance = 0.5
            let r = 128
            let g = 128
            let b = 128

            switch (scene) {
                case "edge-cluster": {
                    // A hard checkerboard patch on a flat field: strong edges,
                    // strong texture, no skin.
                    const inside = disc(nx, ny, 0.68, 0.34, 0.16)
                    luminance = inside
                        ? (Math.floor(x / 3) + Math.floor(y / 3)) % 2 === 0
                            ? 0.05
                            : 0.95
                        : 0.46 + Math.sin(nx * 3) * 0.02
                    r = g = b = luminance * 255
                    break
                }
                case "portrait": {
                    // A warm skin-toned oval on a cool background.
                    const inside = disc(nx, ny, 0.42, 0.44, 0.19)
                    if (inside) {
                        r = 226
                        g = 176
                        b = 148
                    } else {
                        r = 62
                        g = 88
                        b = 132
                    }
                    luminance = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255
                    break
                }
                case "texture-corner": {
                    const inside = nx > 0.72 && ny > 0.7
                    luminance = inside ? clamp01(0.5 + (random() - 0.5) * 1.4) : 0.42
                    r = g = b = luminance * 255
                    break
                }
                case "two-subjects": {
                    const first = disc(nx, ny, 0.26, 0.3, 0.12)
                    const second = disc(nx, ny, 0.74, 0.68, 0.12)
                    if (first || second) {
                        r = 214
                        g = 168
                        b = 142
                    } else {
                        r = 40
                        g = 46
                        b = 54
                    }
                    luminance = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255
                    break
                }
                case "low-contrast": {
                    const inside = disc(nx, ny, 0.55, 0.6, 0.15)
                    luminance = inside ? 0.54 : 0.5
                    r = g = b = luminance * 255
                    break
                }
                case "high-frequency": {
                    const inside = disc(nx, ny, 0.34, 0.66, 0.17)
                    luminance = inside
                        ? clamp01(0.5 + Math.sin(x * 1.9) * Math.cos(y * 1.7) * 0.5)
                        : 0.48 + (random() - 0.5) * 0.02
                    r = g = b = luminance * 255
                    break
                }
            }

            gray[index] = clamp01(luminance)
            rgb[index * 3] = r
            rgb[index * 3 + 1] = g
            rgb[index * 3 + 2] = b
            skin[index] = calculateGridPulseSkinScore(r, g, b)
        }
    }

    switch (scene) {
        case "edge-cluster":
            truth.push({ x: 0.68, y: 0.34, radius: 0.2 })
            break
        case "portrait":
            truth.push({ x: 0.42, y: 0.44, radius: 0.23 })
            break
        case "texture-corner":
            truth.push({ x: 0.86, y: 0.85, radius: 0.2 })
            break
        case "two-subjects":
            truth.push({ x: 0.26, y: 0.3, radius: 0.17 }, { x: 0.74, y: 0.68, radius: 0.17 })
            break
        case "low-contrast":
            truth.push({ x: 0.55, y: 0.6, radius: 0.2 })
            break
        case "high-frequency":
            truth.push({ x: 0.34, y: 0.66, radius: 0.21 })
            break
    }

    return { gray, skin, width, height, truth }
}

/**
 * 1 when a point sits at the centre of a ground-truth region, falling linearly
 * to 0 at its edge. Points outside every region score 0.
 */
export function truthScore(
    point: { x: number; y: number },
    truth: SyntheticField["truth"]
): number {
    let best = 0
    for (const region of truth) {
        const distance = Math.hypot(point.x - region.x, point.y - region.y)
        best = Math.max(best, clamp01(1 - distance / region.radius))
    }
    return best
}
