export type VisionGraphMode = "nearest" | "mst" | "mesh"
export type VisionNodeRole = "primary" | "secondary" | "context"

export interface VisionInputPoint {
    id: string
    x: number
    y: number
    px: number
    py: number
    score: number
    reveal: number
    phase: number
}

export interface VisionInputBox {
    x: number
    y: number
    width: number
    height: number
    anchorX: number
    anchorY: number
}

export interface VisionSceneNode extends VisionInputPoint {
    index: number
    role: VisionNodeRole
    weight: number
    radius: number
    lineWidth: number
    opacity: number
    motionScale: number
    box: VisionInputBox | null
    age: number
    ghost: boolean
}

export interface VisionSceneEdge {
    id: string
    source: number
    target: number
    distance: number
    strength: number
    kind: VisionGraphMode | "memory"
}

export interface VisionSceneGraph {
    now: number
    nodes: readonly VisionSceneNode[]
    edges: readonly VisionSceneEdge[]
    primaryIndex: number
    centroid: Readonly<{ x: number; y: number }>
}

export interface VisionSceneOptions {
    graphMode: VisionGraphMode
    nearestNeighbors: number
    temporalMemoryMs: number
    maxGhosts: number
    focusX: number
    focusY: number
    focusRadius: number
}

interface MemoryPoint {
    id: string
    px: number
    py: number
    score: number
    seenAt: number
}

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value))

function distance(a: Pick<VisionInputPoint, "px" | "py">, b: Pick<VisionInputPoint, "px" | "py">) {
    return Math.hypot(a.px - b.px, a.py - b.py)
}

function addEdge(
    edges: VisionSceneEdge[],
    seen: Set<string>,
    source: number,
    target: number,
    nodes: readonly VisionSceneNode[],
    kind: VisionSceneEdge["kind"]
) {
    if (source === target) return
    const low = Math.min(source, target)
    const high = Math.max(source, target)
    const key = `${low}:${high}`
    if (seen.has(key)) return
    seen.add(key)
    const d = distance(nodes[source], nodes[target])
    const scale = Math.max(1, Math.max(...nodes.map(node => Math.max(node.px, node.py))))
    edges.push({
        id: `${kind}-${key}`,
        source,
        target,
        distance: d,
        strength: clamp(1 - d / scale, 0.12, 1),
        kind,
    })
}

function nearestEdges(nodes: readonly VisionSceneNode[], neighbors: number) {
    const edges: VisionSceneEdge[] = []
    const seen = new Set<string>()
    nodes.forEach((node, index) => {
        nodes
            .map((candidate, candidateIndex) => ({ candidateIndex, d: distance(node, candidate) }))
            .filter(item => item.candidateIndex !== index)
            .sort((a, b) => a.d - b.d)
            .slice(0, Math.max(1, neighbors))
            .forEach(item => addEdge(edges, seen, index, item.candidateIndex, nodes, "nearest"))
    })
    return edges
}

function mstEdges(nodes: readonly VisionSceneNode[]) {
    if (nodes.length < 2) return []
    const edges: VisionSceneEdge[] = []
    const seen = new Set<string>()
    const connected = new Set<number>([0])
    while (connected.size < nodes.length) {
        let bestSource = -1
        let bestTarget = -1
        let bestDistance = Number.POSITIVE_INFINITY
        for (const source of connected) {
            for (let target = 0; target < nodes.length; target += 1) {
                if (connected.has(target)) continue
                const candidateDistance = distance(nodes[source], nodes[target])
                if (candidateDistance < bestDistance) {
                    bestSource = source
                    bestTarget = target
                    bestDistance = candidateDistance
                }
            }
        }
        if (bestSource < 0 || bestTarget < 0) break
        addEdge(edges, seen, bestSource, bestTarget, nodes, "mst")
        connected.add(bestTarget)
    }
    return edges
}

function meshEdges(nodes: readonly VisionSceneNode[], neighbors: number) {
    const edges = nearestEdges(nodes, Math.max(2, neighbors))
    const seen = new Set(edges.map(edge => `${Math.min(edge.source, edge.target)}:${Math.max(edge.source, edge.target)}`))
    if (nodes.length > 3) {
        const sorted = nodes
            .map((node, index) => ({ index, angle: Math.atan2(node.py, node.px) }))
            .sort((a, b) => a.angle - b.angle)
        sorted.forEach((item, index) => {
            const next = sorted[(index + 1) % sorted.length]
            addEdge(edges, seen, item.index, next.index, nodes, "mesh")
        })
    }
    return edges.map(edge => ({ ...edge, kind: "mesh" as const }))
}

export class VisionSceneGraphStore {
    private memory = new Map<string, MemoryPoint>()

    clear() {
        this.memory.clear()
    }

    build(
        now: number,
        points: readonly VisionInputPoint[],
        boxes: readonly VisionInputBox[],
        options: VisionSceneOptions
    ): VisionSceneGraph {
        points.forEach(point => {
            this.memory.set(point.id, {
                id: point.id,
                px: point.px,
                py: point.py,
                score: point.score,
                seenAt: now,
            })
        })

        const liveIds = new Set(points.map(point => point.id))
        const ghosts = [...this.memory.values()]
            .filter(point => !liveIds.has(point.id) && now - point.seenAt <= options.temporalMemoryMs)
            .sort((a, b) => b.seenAt - a.seenAt)
            .slice(0, options.maxGhosts)

        for (const [id, point] of this.memory) {
            if (now - point.seenAt > options.temporalMemoryMs) this.memory.delete(id)
        }

        const liveNodes: VisionSceneNode[] = points.map((point, index) => {
            const focusDistance = Math.hypot(point.x - options.focusX, point.y - options.focusY)
            const focus = clamp(1 - focusDistance / Math.max(0.001, options.focusRadius))
            const weight = clamp(point.score * 0.68 + focus * 0.24 + point.reveal * 0.08)
            const role: VisionNodeRole = index === 0 || weight >= 0.82
                ? "primary"
                : weight >= 0.58
                  ? "secondary"
                  : "context"
            return {
                ...point,
                index,
                role,
                weight,
                radius: 2.5 + weight * 6.5,
                lineWidth: 0.75 + weight * 1.35,
                opacity: 0.28 + weight * 0.72,
                motionScale: 0.35 + weight * 0.9,
                box: boxes[index] ?? null,
                age: 0,
                ghost: false,
            }
        })

        const ghostNodes: VisionSceneNode[] = ghosts.map((point, ghostIndex) => {
            const age = clamp((now - point.seenAt) / Math.max(1, options.temporalMemoryMs))
            return {
                id: point.id,
                x: 0,
                y: 0,
                px: point.px,
                py: point.py,
                score: point.score,
                reveal: 1 - age,
                phase: 0,
                index: liveNodes.length + ghostIndex,
                role: "context",
                weight: (1 - age) * 0.38,
                radius: 3 + (1 - age) * 2,
                lineWidth: 0.75,
                opacity: (1 - age) * 0.3,
                motionScale: 0.2,
                box: null,
                age,
                ghost: true,
            }
        })

        const nodes = [...liveNodes, ...ghostNodes]
        const graphNodes = liveNodes
        const edges = options.graphMode === "mst"
            ? mstEdges(graphNodes)
            : options.graphMode === "mesh"
              ? meshEdges(graphNodes, options.nearestNeighbors)
              : nearestEdges(graphNodes, options.nearestNeighbors)

        if (ghostNodes.length && liveNodes.length) {
            const seen = new Set(edges.map(edge => `${Math.min(edge.source, edge.target)}:${Math.max(edge.source, edge.target)}`))
            ghostNodes.forEach(ghost => {
                let target = 0
                let best = Number.POSITIVE_INFINITY
                liveNodes.forEach(node => {
                    const d = distance(ghost, node)
                    if (d < best) {
                        best = d
                        target = node.index
                    }
                })
                addEdge(edges, seen, ghost.index, target, nodes, "memory")
            })
        }

        const totalWeight = Math.max(0.001, liveNodes.reduce((sum, node) => sum + node.weight, 0))
        const centroid = liveNodes.length
            ? {
                  x: liveNodes.reduce((sum, node) => sum + node.px * node.weight, 0) / totalWeight,
                  y: liveNodes.reduce((sum, node) => sum + node.py * node.weight, 0) / totalWeight,
              }
            : { x: 0, y: 0 }
        const primaryIndex = liveNodes.length
            ? liveNodes.reduce((best, node, index) => node.weight > liveNodes[best].weight ? index : best, 0)
            : -1

        return { now, nodes, edges, primaryIndex, centroid }
    }
}
