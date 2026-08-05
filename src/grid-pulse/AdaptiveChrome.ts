export interface RgbColor {
    r: number
    g: number
    b: number
}

export interface AdaptiveChromeDecision {
    color: "light" | "dark"
    contrast: number
    lightContrast: number
    darkContrast: number
}

const clampChannel = (value: number) => Math.max(0, Math.min(255, value))

const linearChannel = (value: number) => {
    const channel = clampChannel(value) / 255
    return channel <= 0.04045
        ? channel / 12.92
        : Math.pow((channel + 0.055) / 1.055, 2.4)
}

export const relativeLuminance = (color: RgbColor) =>
    0.2126 * linearChannel(color.r) +
    0.7152 * linearChannel(color.g) +
    0.0722 * linearChannel(color.b)

export const contrastRatio = (a: RgbColor, b: RgbColor) => {
    const luminanceA = relativeLuminance(a)
    const luminanceB = relativeLuminance(b)
    const lighter = Math.max(luminanceA, luminanceB)
    const darker = Math.min(luminanceA, luminanceB)
    return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Selects whichever configured chrome color has the stronger contrast against
 * the sampled media. The requested minimum is reported rather than faked: if
 * custom light/dark colors cannot reach it, the stronger candidate still wins.
 */
export const chooseAdaptiveChrome = (
    background: RgbColor,
    light: RgbColor,
    dark: RgbColor,
    minimumContrast = 4.5
): AdaptiveChromeDecision => {
    const lightContrast = contrastRatio(background, light)
    const darkContrast = contrastRatio(background, dark)
    const lightMeetsMinimum = lightContrast >= minimumContrast
    const darkMeetsMinimum = darkContrast >= minimumContrast
    const useLight = lightMeetsMinimum !== darkMeetsMinimum
        ? lightMeetsMinimum
        : lightContrast >= darkContrast
    const contrast = useLight ? lightContrast : darkContrast

    return {
        color: useLight ? "light" : "dark",
        contrast,
        lightContrast,
        darkContrast,
    }
}



export const oppositeChromeKind = (kind: "light" | "dark") =>
    kind === "light" ? "dark" as const : "light" as const

/**
 * Reports the stronger contrast made available by a paired light/dark stroke.
 * This is a color-availability metric; rendered opacity is measured separately.
 */
export const dualToneVisibilityContrast = (
    background: RgbColor,
    light: RgbColor,
    dark: RgbColor
) => Math.max(contrastRatio(background, light), contrastRatio(background, dark))

export interface AdaptiveChromeZonePalette {
    columns: number
    rows: number
    decisions: AdaptiveChromeDecision[]
}

export const adaptiveChromeZoneIndex = (
    x: number,
    y: number,
    columns: number,
    rows: number
) => {
    const safeColumns = Math.max(1, Math.round(columns))
    const safeRows = Math.max(1, Math.round(rows))
    const column = Math.max(0, Math.min(safeColumns - 1, Math.floor(Math.max(0, Math.min(0.999999, x)) * safeColumns)))
    const row = Math.max(0, Math.min(safeRows - 1, Math.floor(Math.max(0, Math.min(0.999999, y)) * safeRows)))
    return row * safeColumns + column
}

export const buildAdaptiveChromeZonePalette = (
    backgrounds: RgbColor[],
    columns: number,
    rows: number,
    light: RgbColor,
    dark: RgbColor,
    minimumContrast = 4.5
): AdaptiveChromeZonePalette => {
    const safeColumns = Math.max(1, Math.round(columns))
    const safeRows = Math.max(1, Math.round(rows))
    const expected = safeColumns * safeRows
    const fallback = backgrounds[0] || { r: 127.5, g: 127.5, b: 127.5 }
    const decisions = Array.from({ length: expected }, (_, index) =>
        chooseAdaptiveChrome(backgrounds[index] || fallback, light, dark, minimumContrast)
    )
    return { columns: safeColumns, rows: safeRows, decisions }
}

export const averageRgba = (data: Uint8ClampedArray): RgbColor => {
    if (data.length < 4) return { r: 127.5, g: 127.5, b: 127.5 }
    let red = 0
    let green = 0
    let blue = 0
    let weight = 0

    for (let index = 0; index + 3 < data.length; index += 4) {
        const alpha = data[index + 3] / 255
        red += data[index] * alpha
        green += data[index + 1] * alpha
        blue += data[index + 2] * alpha
        weight += alpha
    }

    if (weight <= 0) return { r: 127.5, g: 127.5, b: 127.5 }
    return { r: red / weight, g: green / weight, b: blue / weight }
}

export const rgbaForChromeBackground = (chrome: "light" | "dark", opacity = 0.62) =>
    chrome === "light"
        ? `rgba(0,0,0,${Math.max(0, Math.min(1, opacity))})`
        : `rgba(255,255,255,${Math.max(0, Math.min(1, opacity + 0.1))})`
