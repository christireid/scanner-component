import { test } from "node:test"
import { buildGridPulseConnectionPairs } from "../src/grid-pulse/GridPulseConnectionTopology.ts"

test("connection-topology suite (ported from SpecimenGridPulse-Pro-v2.8)", () => {

    const points = [
        { px: 0, py: 0, score: 0.9 },
        { px: 10, py: 0, score: 0.8 },
        { px: 30, py: 0, score: 0.7 },
        { px: 10, py: 20, score: 1 },
    ]

    const chain = buildGridPulseConnectionPairs(points, "chain")
    if (chain.length !== points.length - 1) throw new Error(`chain expected 3 edges, got ${chain.length}`)

    const hub = buildGridPulseConnectionPairs(points, "hub")
    if (hub.length !== points.length - 1) throw new Error(`hub expected 3 edges, got ${hub.length}`)
    if (!hub.every(pair => pair.includes(3))) throw new Error("hub topology must use highest-score point")

    const nearest = buildGridPulseConnectionPairs(points, "nearest")
    if (!nearest.length || nearest.length > points.length) throw new Error(`nearest edge count invalid: ${nearest.length}`)
    const keys = new Set(nearest.map(([a, b]) => `${Math.min(a,b)}:${Math.max(a,b)}`))
    if (keys.size !== nearest.length) throw new Error("nearest topology emitted duplicate edges")

    console.log(JSON.stringify({ status: "PASS", chain, hub, nearest }, null, 2))

})
