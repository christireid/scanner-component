export interface GridPulseGeometryPoint {
    px: number
    py: number
}

export interface GridPulseGeometryBox {
    x: number
    y: number
    width: number
    height: number
    anchorX: number
    anchorY: number
}

export interface GridPulseLayoutOptions {
    width: number
    height: number
    mobileScale: number
    gap: number
    padding: number
    avoidOverlap: boolean
    clampToBounds: boolean
}

export const clampNumber = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(max, value))

export const gridPulseOverlapArea = (
    first: GridPulseGeometryBox,
    second: GridPulseGeometryBox,
    padding = 0
) => {
    const overlapWidth = Math.max(
        0,
        Math.min(first.x + first.width + padding, second.x + second.width + padding) -
            Math.max(first.x - padding, second.x - padding)
    )
    const overlapHeight = Math.max(
        0,
        Math.min(first.y + first.height + padding, second.y + second.height + padding) -
            Math.max(first.y - padding, second.y - padding)
    )
    return overlapWidth * overlapHeight
}

export const nearestPointOnGridPulseBox = (
    x: number,
    y: number,
    box: GridPulseGeometryBox
) => {
    const candidates = [
        { x: clampNumber(x, box.x, box.x + box.width), y: box.y },
        { x: clampNumber(x, box.x, box.x + box.width), y: box.y + box.height },
        { x: box.x, y: clampNumber(y, box.y, box.y + box.height) },
        { x: box.x + box.width, y: clampNumber(y, box.y, box.y + box.height) },
    ]
    return candidates.reduce((nearest, candidate) => {
        const candidateDistance = Math.hypot(candidate.x - x, candidate.y - y)
        const nearestDistance = Math.hypot(nearest.x - x, nearest.y - y)
        return candidateDistance < nearestDistance ? candidate : nearest
    })
}

export function layoutGridPulseBoxes<TPoint extends GridPulseGeometryPoint>(
    points: readonly TPoint[],
    componentWidth: number,
    componentHeight: number,
    options: GridPulseLayoutOptions,
    compact: boolean
): GridPulseGeometryBox[] {
    const responsiveScale = compact ? options.mobileScale : 1
    const boxWidth = clampNumber(
        options.width * responsiveScale,
        48,
        Math.max(48, componentWidth - options.padding * 2)
    )
    const boxHeight = clampNumber(
        options.height * responsiveScale,
        48,
        Math.max(48, componentHeight - options.padding * 2)
    )
    const gap = options.gap * responsiveScale
    const placed: GridPulseGeometryBox[] = []

    for (const point of points) {
        const candidates = [
            { x: point.px + gap, y: point.py - boxHeight * 0.5 },
            { x: point.px - gap - boxWidth, y: point.py - boxHeight * 0.5 },
            { x: point.px + gap * 0.72, y: point.py - gap * 0.72 - boxHeight },
            { x: point.px - gap * 0.72 - boxWidth, y: point.py - gap * 0.72 - boxHeight },
            { x: point.px + gap * 0.72, y: point.py + gap * 0.72 },
            { x: point.px - gap * 0.72 - boxWidth, y: point.py + gap * 0.72 },
            { x: point.px - boxWidth * 0.5, y: point.py - gap - boxHeight },
            { x: point.px - boxWidth * 0.5, y: point.py + gap },
        ]

        let best: GridPulseGeometryBox | null = null
        let bestCost = Number.POSITIVE_INFINITY

        for (const candidate of candidates) {
            let x = candidate.x
            let y = candidate.y
            let clampDistance = 0
            if (options.clampToBounds) {
                const clampedX = clampNumber(
                    x,
                    options.padding,
                    componentWidth - boxWidth - options.padding
                )
                const clampedY = clampNumber(
                    y,
                    options.padding,
                    componentHeight - boxHeight - options.padding
                )
                clampDistance = Math.hypot(clampedX - x, clampedY - y)
                x = clampedX
                y = clampedY
            }

            const box: GridPulseGeometryBox = {
                x,
                y,
                width: boxWidth,
                height: boxHeight,
                anchorX: point.px,
                anchorY: point.py,
            }
            const overlap = options.avoidOverlap
                ? placed.reduce(
                      (total, other) => total + gridPulseOverlapArea(box, other, 8),
                      0
                  )
                : 0
            const hidesAnchor =
                point.px >= box.x - 10 &&
                point.px <= box.x + box.width + 10 &&
                point.py >= box.y - 10 &&
                point.py <= box.y + box.height + 10
                    ? boxWidth * boxHeight
                    : 0
            const distance = Math.hypot(
                box.x + box.width / 2 - point.px,
                box.y + box.height / 2 - point.py
            )
            const cost = overlap * 100 + hidesAnchor * 80 + clampDistance * 30 + distance
            if (cost < bestCost) {
                bestCost = cost
                best = box
            }
        }

        placed.push(
            best ?? {
                x: clampNumber(
                    point.px + gap,
                    options.padding,
                    componentWidth - boxWidth - options.padding
                ),
                y: clampNumber(
                    point.py - boxHeight / 2,
                    options.padding,
                    componentHeight - boxHeight - options.padding
                ),
                width: boxWidth,
                height: boxHeight,
                anchorX: point.px,
                anchorY: point.py,
            }
        )
    }

    return placed
}

export interface GridPulseTrackingFrameOptions {
    compact: boolean
    scale: number
    safeTop: number
    safeBottom: number
    padding: number
    minGap: number
    parallaxX?: number
    parallaxY?: number
}

/**
 * Places Specimen-style tracking frames around feature anchors while preserving
 * the anchor inside each frame and minimizing frame-to-frame collisions.
 *
 * Unlike callout layout, these frames are intentionally centered around the
 * detected feature. Candidate anchor positions let the layout breathe without
 * detaching the frame from the feature it represents.
 */
export function layoutGridPulseTrackingFrames<TPoint extends GridPulseGeometryPoint>(
    points: readonly TPoint[],
    componentWidth: number,
    componentHeight: number,
    options: GridPulseTrackingFrameOptions
): GridPulseGeometryBox[] {
    const minDimension = Math.min(componentWidth, componentHeight)
    const maxSize = Math.max(
        48,
        Math.min(
            options.compact ? 196 : 318,
            componentWidth - options.padding * 2,
            componentHeight - options.safeTop - options.safeBottom
        )
    )
    const minSize = Math.min(options.compact ? 76 : 112, maxSize)
    const baseSize = clampNumber(
        minDimension * (options.compact ? 0.235 : 0.285) * options.scale,
        minSize,
        maxSize
    )
    const scales = [1, 0.82, 1.12, 0.94, 0.76, 1.04, 0.88]
    const preferredAnchors = [
        [0.58, 0.56],
        [0.42, 0.58],
        [0.48, 0.46],
        [0.56, 0.42],
        [0.4, 0.48],
        [0.52, 0.6],
        [0.44, 0.42],
    ] as const
    const candidateAnchorPositions = [
        [0.5, 0.5],
        [0.36, 0.42],
        [0.64, 0.42],
        [0.38, 0.64],
        [0.62, 0.64],
        [0.5, 0.34],
        [0.5, 0.68],
        [0.3, 0.5],
        [0.7, 0.5],
    ] as const
    const placed: GridPulseGeometryBox[] = []
    const parallaxX = options.parallaxX ?? 0
    const parallaxY = options.parallaxY ?? 0

    points.forEach((point, index) => {
        const size = Math.min(baseSize * scales[index % scales.length], maxSize)
        const preferred = preferredAnchors[index % preferredAnchors.length]
        const orderedCandidates = [preferred, ...candidateAnchorPositions]
        let best: GridPulseGeometryBox | null = null
        let bestCost = Number.POSITIVE_INFINITY

        orderedCandidates.forEach(([anchorRatioX, anchorRatioY], candidateIndex) => {
            const rawX = point.px - size * anchorRatioX + parallaxX
            const rawY = point.py - size * anchorRatioY + parallaxY
            const x = clampNumber(
                rawX,
                options.padding,
                componentWidth - size - options.padding
            )
            const y = clampNumber(
                rawY,
                options.safeTop,
                Math.max(options.safeTop, componentHeight - size - options.safeBottom)
            )
            const box: GridPulseGeometryBox = {
                x,
                y,
                width: size,
                height: size,
                anchorX: point.px,
                anchorY: point.py,
            }
            const overlap = placed.reduce(
                (total, other) => total + gridPulseOverlapArea(box, other, options.minGap),
                0
            )
            const preferredDistance = Math.hypot(
                anchorRatioX - preferred[0],
                anchorRatioY - preferred[1]
            )
            const clampDistance = Math.hypot(rawX - x, rawY - y)
            const edgeClearance = Math.min(
                point.px - x,
                x + size - point.px,
                point.py - y,
                y + size - point.py
            )
            const edgePenalty = edgeClearance < Math.min(18, size * 0.12)
                ? (Math.min(18, size * 0.12) - edgeClearance) * size
                : 0
            const cost =
                overlap * 140 +
                edgePenalty * 18 +
                clampDistance * 22 +
                preferredDistance * size * 8 +
                candidateIndex * 0.01
            if (cost < bestCost) {
                bestCost = cost
                best = box
            }
        })

        // Callers index this array by point index, so every point must yield a
        // frame even if every candidate somehow scored non-finite.
        placed.push(
            best ?? {
                x: clampNumber(
                    point.px - size / 2,
                    options.padding,
                    Math.max(options.padding, componentWidth - size - options.padding)
                ),
                y: clampNumber(
                    point.py - size / 2,
                    options.safeTop,
                    Math.max(options.safeTop, componentHeight - size - options.safeBottom)
                ),
                width: size,
                height: size,
                anchorX: point.px,
                anchorY: point.py,
            }
        )
    })

    return placed
}
