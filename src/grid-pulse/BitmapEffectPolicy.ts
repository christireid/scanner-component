export type BitmapMethod = "threshold" | "ordered" | "halftone" | "diffusion"
export type BitmapMatrix = "bayer2" | "bayer4" | "bayer8"
export type BitmapAnchor = "image" | "center"
export type BitmapDotShape = "square" | "circle"

export interface BitmapGridInput {
    width: number
    height: number
    scale: number
    anchor: BitmapAnchor
}

export interface BitmapGrid {
    cellSize: number
    columns: number
    rows: number
    offsetX: number
    offsetY: number
}

export const resolveBitmapGrid = (input: BitmapGridInput): BitmapGrid => {
    const cellSize = Math.max(1, Math.round(input.scale))
    const columns = Math.max(1, Math.ceil(input.width / cellSize))
    const rows = Math.max(1, Math.ceil(input.height / cellSize))
    const offsetX = input.anchor === "center" ? Math.floor((input.width - columns * cellSize) / 2) : 0
    const offsetY = input.anchor === "center" ? Math.floor((input.height - rows * cellSize) / 2) : 0
    return { cellSize, columns, rows, offsetX, offsetY }
}

const MATRICES = {
    bayer2: [[0, 2], [3, 1]],
    bayer4: [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]],
    bayer8: [
        [0,32,8,40,2,34,10,42],[48,16,56,24,50,18,58,26],[12,44,4,36,14,46,6,38],[60,28,52,20,62,30,54,22],
        [3,35,11,43,1,33,9,41],[51,19,59,27,49,17,57,25],[15,47,7,39,13,45,5,37],[63,31,55,23,61,29,53,21],
    ],
} as const

export const bitmapThresholdAt = (
    matrix: BitmapMatrix,
    x: number,
    y: number,
    threshold: number,
    intensity: number
): number => {
    const values = MATRICES[matrix]
    const size = values.length
    const max = size * size - 1
    const normalized = values[((y % size) + size) % size][((x % size) + size) % size] / max
    return Math.max(0, Math.min(1, threshold + (normalized - 0.5) * 0.48 * intensity))
}

export const quantizeBitmapLevel = (value: number, levels: number): number => {
    const count = Math.max(2, Math.round(levels))
    return Math.round(Math.max(0, Math.min(1, value)) * (count - 1)) / (count - 1)
}
