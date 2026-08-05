export type PixelSamplingMode = "average" | "nearest"
export type PixelAnchorMode = "image" | "center"
export type PixelShape = "square" | "rounded"

export interface PixelatedEffectPolicyOptions {
    width: number
    height: number
    cellSize: number
    gap: number
    anchor: PixelAnchorMode
}

export interface PixelatedGridGeometry {
    cellSize: number
    gap: number
    columns: number
    rows: number
    offsetX: number
    offsetY: number
}

const clamp = (value: number, minimum: number, maximum: number) =>
    Math.min(maximum, Math.max(minimum, value))

export const resolvePixelatedGrid = (
    options: PixelatedEffectPolicyOptions
): PixelatedGridGeometry => {
    const width = Math.max(1, Math.floor(options.width))
    const height = Math.max(1, Math.floor(options.height))
    const cellSize = Math.max(2, Math.round(options.cellSize))
    const gap = clamp(Math.round(options.gap), 0, Math.max(0, cellSize - 1))
    const columns = Math.max(1, Math.ceil(width / cellSize))
    const rows = Math.max(1, Math.ceil(height / cellSize))
    const occupiedWidth = columns * cellSize
    const occupiedHeight = rows * cellSize
    const offsetX = options.anchor === "center" ? Math.floor((width - occupiedWidth) / 2) : 0
    const offsetY = options.anchor === "center" ? Math.floor((height - occupiedHeight) / 2) : 0
    return { cellSize, gap, columns, rows, offsetX, offsetY }
}

export const quantizeChannel = (value: number, levels: number) => {
    const clamped = clamp(value, 0, 255)
    const normalizedLevels = Math.max(0, Math.round(levels))
    if (normalizedLevels <= 1) return Math.round(clamped)
    const steps = normalizedLevels - 1
    return Math.round((Math.round((clamped / 255) * steps) / steps) * 255)
}
