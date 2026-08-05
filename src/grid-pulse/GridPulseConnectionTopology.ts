export type GridPulsePointTopology = "nearest" | "chain" | "hub"

export type GridPulseConnectionPoint = {
    px: number
    py: number
    score: number
}

export const buildGridPulseConnectionPairs = (
    points: ReadonlyArray<GridPulseConnectionPoint>,
    topology: GridPulsePointTopology
): Array<[number, number]> => {
    if (points.length < 2) return []

    const pairs: Array<[number, number]> = []
    const seen = new Set<string>()
    const addPair = (from: number, to: number) => {
        if (from === to) return
        const a = Math.min(from, to)
        const b = Math.max(from, to)
        const key = `${a}:${b}`
        if (seen.has(key)) return
        seen.add(key)
        pairs.push([a, b])
    }

    if (topology === "chain") {
        const ordered = points
            .map((point, index) => ({ point, index }))
            .sort((a, b) => a.point.px - b.point.px || a.point.py - b.point.py)
        for (let index = 1; index < ordered.length; index += 1) {
            addPair(ordered[index - 1].index, ordered[index].index)
        }
    } else if (topology === "hub") {
        const hubIndex = points.reduce((best, point, index) =>
            point.score > points[best].score ? index : best, 0)
        points.forEach((_, index) => addPair(hubIndex, index))
    } else {
        points.forEach((point, index) => {
            let nearest = -1
            let nearestDistance = Number.POSITIVE_INFINITY
            points.forEach((candidate, candidateIndex) => {
                if (candidateIndex === index) return
                const distance = Math.hypot(candidate.px - point.px, candidate.py - point.py)
                if (distance < nearestDistance) {
                    nearestDistance = distance
                    nearest = candidateIndex
                }
            })
            if (nearest >= 0) addPair(index, nearest)
        })
    }

    return pairs
}
