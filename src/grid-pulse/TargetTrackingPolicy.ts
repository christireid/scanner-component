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

/** Exact minimum-cost assignment for the component's bounded point sets (<=12). */
export const solveTargetAssignment = (
    tracks: TrackedPoint[],
    points: TrackingPointInput[],
    options: TargetTrackingOptions
) => {
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
        this.tracks = next.slice(0, 12)
        return this.tracks.filter(track => track.missed === 0)
    }
}
