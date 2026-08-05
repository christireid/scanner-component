export type GridPulseCoordinateStyle = "latlon" | "percent" | "pixels"
export type GridPulseLabelCoordinateStyle = "inherit" | GridPulseCoordinateStyle
export type GridPulseLabelTimeFormat = "clock" | "locale" | "elapsed" | "timecode"

export interface GridPulseLabelTokenInput {
    template: string
    score: number
    id: string
    coords: string
    zoom: number
    mode: string
    wallClockMs: number
    scanStartedAtMs: number
    scorePrecision: number
    timeFormat: GridPulseLabelTimeFormat
    timecodeFps: number
    /** 1-based index of this point within the committed set. Feeds {index}. */
    index?: number
    /** Total committed points. Feeds {n}. */
    total?: number
    /** Normalized horizontal position, 0..1. Feeds {x}. */
    nx?: number
    /** Normalized vertical position, 0..1. Feeds {y}. */
    ny?: number
    /** Human-readable label. Defaults to the point id. Feeds {label}. */
    label?: string
    /** Estimated overlay frame rate. Feeds {fps}. */
    fps?: number
}

const clampInteger = (value: number, minimum: number, maximum: number) =>
    Math.min(maximum, Math.max(minimum, Math.round(Number.isFinite(value) ? value : minimum)))

const pad = (value: number, length = 2) => String(Math.max(0, Math.floor(value))).padStart(length, "0")

export const resolveGridPulseLabelCoordinateStyle = (
    labelStyle: GridPulseLabelCoordinateStyle,
    crosshairStyle: GridPulseCoordinateStyle
): GridPulseCoordinateStyle => labelStyle === "inherit" ? crosshairStyle : labelStyle

export const formatGridPulseLabelTime = ({
    wallClockMs,
    scanStartedAtMs,
    format,
    timecodeFps,
}: {
    wallClockMs: number
    scanStartedAtMs: number
    format: GridPulseLabelTimeFormat
    timecodeFps: number
}) => {
    const safeWallClock = Number.isFinite(wallClockMs) ? wallClockMs : 0
    if (format === "locale") {
        return new Date(safeWallClock).toLocaleTimeString([], { hour12: false })
    }
    if (format === "clock") {
        const date = new Date(safeWallClock)
        return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    }

    const elapsedMs = Math.max(
        0,
        safeWallClock - (Number.isFinite(scanStartedAtMs) ? scanStartedAtMs : safeWallClock)
    )
    const totalSeconds = Math.floor(elapsedMs / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    if (format === "timecode") {
        const fps = clampInteger(timecodeFps, 1, 120)
        const frame = Math.min(fps - 1, Math.floor(((elapsedMs % 1000) / 1000) * fps))
        return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}:${pad(frame)}`
    }

    const milliseconds = Math.floor(elapsedMs % 1000)
    return `+${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${pad(milliseconds, 3)}`
}

export const fillGridPulseLabelTemplate = (input: GridPulseLabelTokenInput) => {
    const precision = clampInteger(input.scorePrecision, 0, 6)
    const score = Math.min(1, Math.max(0, input.score))
    const values: Record<string, string> = {
        score: score.toFixed(precision),
        id: input.id,
        coords: input.coords,
        time: formatGridPulseLabelTime({
            wallClockMs: input.wallClockMs,
            scanStartedAtMs: input.scanStartedAtMs,
            format: input.timeFormat,
            timecodeFps: input.timecodeFps,
        }),
        zoom: `${input.zoom.toFixed(2)}×`,
        mode: input.mode,
        pct: `${Math.round(score * 100)}%`,
        index: String(clampInteger(input.index ?? 1, 1, 9999)),
        n: String(clampInteger(input.total ?? 1, 1, 9999)),
        x: (Number.isFinite(input.nx) ? Math.min(1, Math.max(0, input.nx as number)) : 0).toFixed(3),
        y: (Number.isFinite(input.ny) ? Math.min(1, Math.max(0, input.ny as number)) : 0).toFixed(3),
        label: input.label ?? input.id,
        fps: String(clampInteger(input.fps ?? 0, 0, 999)),
    }
    return input.template.replace(
        /\{(score|id|coords|time|zoom|mode|pct|index|n|x|y|label|fps)\}/g,
        (_, token: string) => values[token] ?? ""
    )
}
