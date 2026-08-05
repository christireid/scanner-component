export type BitmapPaletteName = "none" | "duotone" | "mono4" | "handheld" | "amber" | "cmyk"

export interface PaletteColor {
    r: number
    g: number
    b: number
}

/**
 * Named dither palettes. These are capabilities the parity plan's §5.1
 * inventory requires the component to retain: duotone, mono4, handheld,
 * amber, cmyk. "none" maps luminance onto the configured tint/background
 * pair, which is the pre-palette behaviour.
 */
export const BITMAP_PALETTES: Record<Exclude<BitmapPaletteName, "none">, readonly PaletteColor[]> = {
    duotone: [
        { r: 16, g: 24, b: 48 },
        { r: 240, g: 244, b: 236 },
    ],
    mono4: [
        { r: 8, g: 8, b: 8 },
        { r: 84, g: 84, b: 84 },
        { r: 168, g: 168, b: 168 },
        { r: 248, g: 248, b: 248 },
    ],
    // The four-tone green LCD look of early handheld consoles.
    handheld: [
        { r: 15, g: 56, b: 15 },
        { r: 48, g: 98, b: 48 },
        { r: 139, g: 172, b: 15 },
        { r: 155, g: 188, b: 15 },
    ],
    amber: [
        { r: 20, g: 10, b: 0 },
        { r: 120, g: 66, b: 0 },
        { r: 255, g: 176, b: 0 },
    ],
    cmyk: [
        { r: 0, g: 174, b: 239 },
        { r: 236, g: 0, b: 140 },
        { r: 255, g: 242, b: 0 },
        { r: 35, g: 31, b: 32 },
        { r: 255, g: 255, b: 255 },
    ],
}

export const resolveBitmapPalette = (
    name: BitmapPaletteName,
    tint: PaletteColor,
    background: PaletteColor
): readonly PaletteColor[] =>
    name === "none" ? [background, tint] : BITMAP_PALETTES[name]

/** Index of the palette colour nearest to the sample, by squared RGB distance. */
export const nearestPaletteIndex = (
    palette: readonly PaletteColor[],
    r: number,
    g: number,
    b: number
): number => {
    let best = 0
    let bestDistance = Number.POSITIVE_INFINITY
    for (let index = 0; index < palette.length; index += 1) {
        const candidate = palette[index]
        const dr = candidate.r - r
        const dg = candidate.g - g
        const db = candidate.b - b
        const distance = dr * dr + dg * dg + db * db
        if (distance < bestDistance) {
            bestDistance = distance
            best = index
        }
    }
    return best
}

/**
 * In-place Floyd–Steinberg error diffusion of an RGB buffer onto a palette.
 * Returns per-cell palette indices. `width * height * 3` layout, row-major.
 * Serpentine scanning is deliberately not used: the reference era of this
 * feature diffused left-to-right only, and determinism matters more here
 * than banding quality.
 */
export const diffuseToPalette = (
    rgb: Float32Array,
    width: number,
    height: number,
    palette: readonly PaletteColor[]
): Uint8Array => {
    const indices = new Uint8Array(width * height)
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const cell = y * width + x
            const offset = cell * 3
            const r = rgb[offset]
            const g = rgb[offset + 1]
            const b = rgb[offset + 2]
            const chosen = nearestPaletteIndex(palette, r, g, b)
            indices[cell] = chosen
            const errorR = r - palette[chosen].r
            const errorG = g - palette[chosen].g
            const errorB = b - palette[chosen].b
            const spread = (dx: number, dy: number, weight: number) => {
                const nx = x + dx
                const ny = y + dy
                if (nx < 0 || nx >= width || ny >= height) return
                const target = (ny * width + nx) * 3
                rgb[target] += errorR * weight
                rgb[target + 1] += errorG * weight
                rgb[target + 2] += errorB * weight
            }
            spread(1, 0, 7 / 16)
            spread(-1, 1, 3 / 16)
            spread(0, 1, 5 / 16)
            spread(1, 1, 1 / 16)
        }
    }
    return indices
}
