export interface GridPulseBoxShadow {
    offsetX: number
    offsetY: number
    blur: number
    color: string
}

/** One CSS length at the head of the remaining shadow string. The `px` unit is optional so unitless zeros parse. */
const BOX_SHADOW_LENGTH = /^\s*(-?(?:\d+(?:\.\d+)?|\.\d+))(?:px)?(?=\s|$)/

/**
 * Parses the `boxes.shadow` property into canvas shadow parameters.
 *
 * Written to accept the shorthand forms authors actually type — unitless zeros,
 * an optional spread, and colours containing spaces — because a shadow that
 * silently falls back to different offsets is invisible to review but visible
 * on screen.
 */
export const parseBoxShadow = (shadow: string): GridPulseBoxShadow | null => {
    const fallback: GridPulseBoxShadow = { offsetX: 0, offsetY: 10, blur: 28, color: "rgba(0,0,0,.42)" }
    const trimmed = (shadow || "").trim()
    if (!trimmed || trimmed === "none") return null
    let rest = trimmed
    const lengths: number[] = []
    while (lengths.length < 4) {
        const match = BOX_SHADOW_LENGTH.exec(rest)
        if (!match) break
        lengths.push(Number(match[1]))
        rest = rest.slice(match[0].length)
    }
    const color = rest.trim()
    if (lengths.length < 2 || !color) return fallback
    return {
        offsetX: lengths[0],
        offsetY: lengths[1],
        blur: lengths[2] ?? 0,
        color,
    }
}
