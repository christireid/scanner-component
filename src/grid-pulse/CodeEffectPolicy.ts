export type CodeSamplingMode = "average" | "nearest"
export type CodeAnchorMode = "image" | "center"
export type CodeColorMode = "tint" | "source" | "luminance"

export interface CodeGridGeometry {
    cellSize: number
    columns: number
    rows: number
    offsetX: number
    offsetY: number
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))

export const resolveCodeGrid = (
    width: number,
    height: number,
    requestedCellSize: number,
    anchor: CodeAnchorMode
): CodeGridGeometry => {
    const cellSize = Math.max(4, Math.round(requestedCellSize))
    const columns = Math.max(1, Math.ceil(width / cellSize))
    const rows = Math.max(1, Math.ceil(height / cellSize))
    return {
        cellSize,
        columns,
        rows,
        offsetX: anchor === "center" ? (width - columns * cellSize) / 2 : 0,
        offsetY: anchor === "center" ? (height - rows * cellSize) / 2 : 0,
    }
}

export const resolveCodeSignal = (
    luminance: number,
    edge: number,
    edgeWeight: number,
    gamma: number
) => {
    const mixed = clamp01(luminance * (1 - clamp01(edgeWeight)) + edge * clamp01(edgeWeight))
    return Math.pow(mixed, Math.max(0.1, gamma))
}

export const resolveCodeGlyph = (
    signal: number,
    characters: string,
    threshold: number
) => {
    const glyphs = characters || "01"
    if (signal < clamp01(threshold)) return ""
    const index = Math.max(0, Math.min(glyphs.length - 1, Math.floor(signal * glyphs.length)))
    return glyphs[index]
}
