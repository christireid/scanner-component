export interface TrackingPointInput {
    x: number
    y: number
    score?: number
    id?: string
}

export interface TrackedPoint extends TrackingPointInput {
    id: string
    vx: number
    vy: number
    age: number
    missed: number
}

export interface TargetTrackingOptions {
    maxDistance: number
    maxLostFrames: number
    positionSmoothing: number
    velocitySmoothing: number
    prediction: boolean
    scoreWeight: number
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

const assignmentCost = (
    track: TrackedPoint,
    point: TrackingPointInput,
    options: TargetTrackingOptions
) => {
    const px = options.prediction ? track.x + track.vx : track.x
    const py = options.prediction ? track.y + track.vy : track.y
    const distance = Math.hypot(px - point.x, py - point.y)
    const scoreDelta = Math.abs((track.score ?? 0.5) - (point.score ?? 0.5))
    return distance + scoreDelta * options.scoreWeight
}

/**
 * Greedy nearest-first assignment used above the exact solver's size bound.
 * Pairs are taken in ascending cost order; each track and point is used once.
 */
const solveGreedyAssignment = (
    tracks: TrackedPoint[],
    points: TrackingPointInput[],
    options: TargetTrackingOptions
): Array<[number, number]> => {
    const candidates: Array<{ cost: number; track: number; point: number }> = []
    for (let trackIndex = 0; trackIndex < tracks.length; trackIndex += 1) {
        for (let pointIndex = 0; pointIndex < points.length; pointIndex += 1) {
            const cost = assignmentCost(tracks[trackIndex], points[pointIndex], options)
            if (cost <= options.maxDistance) candidates.push({ cost, track: trackIndex, point: pointIndex })
        }
    }
    candidates.sort((a, b) => a.cost - b.cost)
    const usedTracks = new Set<number>()
    const usedPoints = new Set<number>()
    const pairs: Array<[number, number]> = []
    for (const candidate of candidates) {
        if (usedTracks.has(candidate.track) || usedPoints.has(candidate.point)) continue
        usedTracks.add(candidate.track)
        usedPoints.add(candidate.point)
        pairs.push([candidate.track, candidate.point])
    }
    return pairs
}

/** Point sets past this size use greedy assignment; the exact solver is exponential in points. */
export const EXACT_ASSIGNMENT_LIMIT = 12

/**
 * Minimum-cost assignment. Exact (bitmask DP) up to EXACT_ASSIGNMENT_LIMIT
 * points and tracks; greedy nearest-first beyond it, which keeps density mode
 * (up to 80 points) tractable at the cost of occasional non-optimal pairing.
 */
export const solveTargetAssignment = (
    tracks: TrackedPoint[],
    points: TrackingPointInput[],
    options: TargetTrackingOptions
) => {
    if (points.length > EXACT_ASSIGNMENT_LIMIT || tracks.length > EXACT_ASSIGNMENT_LIMIT) {
        return solveGreedyAssignment(tracks, points, options)
    }
    const memo = new Map<string, { cost: number; pairs: Array<[number, number]> }>()
    const visit = (trackIndex: number, mask: number): { cost: number; pairs: Array<[number, number]> } => {
        if (trackIndex >= tracks.length) return { cost: 0, pairs: [] }
        const key = `${trackIndex}:${mask}`
        const cached = memo.get(key)
        if (cached) return cached
        let best = visit(trackIndex + 1, mask)
        best = { cost: best.cost + options.maxDistance * 0.92, pairs: best.pairs }
        for (let pointIndex = 0; pointIndex < points.length; pointIndex += 1) {
            if (mask & (1 << pointIndex)) continue
            const cost = assignmentCost(tracks[trackIndex], points[pointIndex], options)
            if (cost > options.maxDistance) continue
            const tail = visit(trackIndex + 1, mask | (1 << pointIndex))
            const candidate = {
                cost: cost + tail.cost,
                pairs: [[trackIndex, pointIndex] as [number, number], ...tail.pairs],
            }
            if (candidate.cost < best.cost) best = candidate
        }
        memo.set(key, best)
        return best
    }
    return visit(0, 0).pairs
}

export class StableTargetTracker {
    private tracks: TrackedPoint[] = []
    private nextId = 1

    reset() {
        this.tracks = []
        this.nextId = 1
    }

    update(points: TrackingPointInput[], options: TargetTrackingOptions): TrackedPoint[] {
        const pairs = solveTargetAssignment(this.tracks, points, options)
        const matchedTracks = new Set<number>()
        const matchedPoints = new Set<number>()
        const next: TrackedPoint[] = []
        for (const [trackIndex, pointIndex] of pairs) {
            const previous = this.tracks[trackIndex]
            const point = points[pointIndex]
            matchedTracks.add(trackIndex)
            matchedPoints.add(pointIndex)
            const rawVx = point.x - previous.x
            const rawVy = point.y - previous.y
            const velocitySmoothing = clamp(options.velocitySmoothing, 0, 0.98)
            const vx = previous.vx * velocitySmoothing + rawVx * (1 - velocitySmoothing)
            const vy = previous.vy * velocitySmoothing + rawVy * (1 - velocitySmoothing)
            const positionSmoothing = clamp(options.positionSmoothing, 0, 0.98)
            const predictedX = options.prediction ? previous.x + vx : previous.x
            const predictedY = options.prediction ? previous.y + vy : previous.y
            next.push({
                x: clamp(point.x * (1 - positionSmoothing) + predictedX * positionSmoothing, 0, 1),
                y: clamp(point.y * (1 - positionSmoothing) + predictedY * positionSmoothing, 0, 1),
                score: point.score ?? previous.score,
                id: point.id || previous.id,
                vx,
                vy,
                age: previous.age + 1,
                missed: 0,
            })
        }
        this.tracks.forEach((track, index) => {
            if (matchedTracks.has(index)) return
            const missed = track.missed + 1
            if (missed > options.maxLostFrames) return
            next.push({
                ...track,
                x: clamp(options.prediction ? track.x + track.vx : track.x, 0, 1),
                y: clamp(options.prediction ? track.y + track.vy : track.y, 0, 1),
                score: Math.max(0, (track.score ?? 0.5) * 0.92),
                missed,
            })
        })
        points.forEach((point, index) => {
            if (matchedPoints.has(index)) return
            // Newly acquired points are clamped like matched and coasting ones.
            // A detector that reports slightly outside the frame — mirrored
            // media, letterboxed video, a custom detector hook — otherwise
            // produces one off-frame position before smoothing pulls it back.
            next.push({
                ...point,
                x: clamp(point.x, 0, 1),
                y: clamp(point.y, 0, 1),
                id: point.id || `TRACK-${String(this.nextId++).padStart(3, "0")}`,
                vx: 0,
                vy: 0,
                age: 1,
                missed: 0,
            })
        })
        // Bounded by density mode (80 visible) plus coasting lost tracks.
        this.tracks = next.slice(0, 96)
        return this.tracks.filter(track => track.missed === 0)
    }
}
