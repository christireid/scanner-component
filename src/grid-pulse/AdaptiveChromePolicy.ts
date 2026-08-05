export interface AdaptiveChromeRegionStats {
    luminance: number
    variance: number
    edgeDensity: number
    saturation: number
}

export interface AdaptiveChromeStyle {
    opacityMultiplier: number
    labelBackgroundOpacity: number
    glowStrength: number
    simplify: number
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))

export const analyzeAdaptiveChromeRegion = (
    data: Uint8ClampedArray,
    width: number,
    height: number
): AdaptiveChromeRegionStats => {
    if (data.length < 4 || width < 1 || height < 1) {
        return { luminance: 0.5, variance: 0, edgeDensity: 0, saturation: 0 }
    }
    const count = Math.max(1, width * height)
    const luminance = new Float32Array(count)
    let mean = 0
    let saturation = 0
    for (let index = 0; index < count; index += 1) {
        const offset = index * 4
        const r = data[offset] / 255
        const g = data[offset + 1] / 255
        const b = data[offset + 2] / 255
        const value = r * 0.2126 + g * 0.7152 + b * 0.0722
        luminance[index] = value
        mean += value
        const maximum = Math.max(r, g, b)
        const minimum = Math.min(r, g, b)
        saturation += maximum <= 0 ? 0 : (maximum - minimum) / maximum
    }
    mean /= count
    saturation /= count
    let variance = 0
    let edge = 0
    let edgeSamples = 0
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const index = y * width + x
            const delta = luminance[index] - mean
            variance += delta * delta
            if (x + 1 < width) {
                edge += Math.abs(luminance[index] - luminance[index + 1])
                edgeSamples += 1
            }
            if (y + 1 < height) {
                edge += Math.abs(luminance[index] - luminance[index + width])
                edgeSamples += 1
            }
        }
    }
    return {
        luminance: clamp01(mean),
        variance: clamp01(Math.sqrt(variance / count) * 3.2),
        edgeDensity: clamp01((edge / Math.max(1, edgeSamples)) * 5.5),
        saturation: clamp01(saturation),
    }
}

export const resolveAdaptiveChromeStyle = (
    stats: AdaptiveChromeRegionStats,
    contrast: number,
    minimumContrast: number,
    contrastCompensation = 0.78,
    busySimplification = 0.52,
    adaptiveGlow = true
): AdaptiveChromeStyle => {
    const deficit = clamp01((minimumContrast - contrast) / Math.max(1, minimumContrast))
    const busy = clamp01(stats.variance * 0.55 + stats.edgeDensity * 0.75)
    const simplify = clamp01(busy * busySimplification)
    const opacityMultiplier = Math.max(
        0.72,
        Math.min(1.42, 1 + deficit * contrastCompensation - simplify * 0.18)
    )
    const labelBackgroundOpacity = clamp01(0.58 + busy * 0.25 + deficit * 0.22)
    const glowStrength = adaptiveGlow
        ? clamp01(deficit * 0.85 + (1 - stats.edgeDensity) * 0.12)
        : 0
    return { opacityMultiplier, labelBackgroundOpacity, glowStrength, simplify }
}
