import type { VisionPlugin } from "./VisionFramework"

/**
 * Example plugin that adds confidence halos after the built-in overlay.
 * It uses the same scene graph and frame clock as the production renderer.
 */
export const confidenceHaloPlugin: VisionPlugin = {
    id: "confidence-halos",
    name: "Confidence Halos",
    phase: "after-overlay",
    render({ ctx, nodes, now, requestFrame, reducedMotion }) {
        ctx.save()
        for (const node of nodes) {
            const pulse = reducedMotion ? 0 : Math.sin(now * 0.002 + node.score * 4) * 2
            const radius = 8 + node.score * 12 + pulse
            ctx.globalAlpha = 0.08 + node.score * 0.12
            ctx.strokeStyle = "#b7ff46"
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.arc(node.px, node.py, radius, 0, Math.PI * 2)
            ctx.stroke()
        }
        ctx.restore()
        if (!reducedMotion) requestFrame()
    },
}

/** Post-process plugin demonstrating access to the composable effect stack. */
export const effectDiagnosticPlugin: VisionPlugin = {
    id: "effect-diagnostics",
    name: "Effect Diagnostics",
    phase: "post-process",
    render({ ctx, width, effects }) {
        const activeEffects = effects.list()
        if (!activeEffects.length) return
        ctx.save()
        ctx.font = "10px ui-monospace, monospace"
        ctx.textAlign = "right"
        ctx.fillStyle = "rgba(255,255,255,.58)"
        ctx.fillText(
            activeEffects.map(effect => effect.type).join(" · "),
            width - 16,
            20
        )
        ctx.restore()
    },
}
