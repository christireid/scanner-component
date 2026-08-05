export type GridPulseTouchBehavior = "auto" | "tap-toggle" | "press-hold" | "always" | "rescan"

export interface GridPulseTouchPolicyInput {
    behavior: GridPulseTouchBehavior
    activation: "hover" | "always" | "tap"
    mobileAlwaysOn: boolean
    currentlyActive: boolean
    phase: "down" | "up" | "cancel"
}

export interface GridPulseTouchPolicyResult {
    resolvedBehavior: Exclude<GridPulseTouchBehavior, "auto">
    active: boolean
    rescan: boolean
    releaseAfterMs: boolean
}

export function resolveGridPulseTouchBehavior(
    input: GridPulseTouchPolicyInput
): GridPulseTouchPolicyResult {
    const resolved = input.behavior === "auto"
        ? input.mobileAlwaysOn || input.activation === "always"
            ? "always"
            : input.activation === "tap"
                ? "tap-toggle"
                : "rescan"
        : input.behavior

    if (input.phase === "down") {
        if (resolved === "tap-toggle") return { resolvedBehavior: resolved, active: !input.currentlyActive, rescan: false, releaseAfterMs: false }
        if (resolved === "press-hold") return { resolvedBehavior: resolved, active: true, rescan: false, releaseAfterMs: false }
        if (resolved === "always") return { resolvedBehavior: resolved, active: true, rescan: false, releaseAfterMs: false }
        return { resolvedBehavior: resolved, active: true, rescan: true, releaseAfterMs: false }
    }

    if (resolved === "press-hold") {
        return { resolvedBehavior: resolved, active: input.currentlyActive, rescan: false, releaseAfterMs: true }
    }
    return { resolvedBehavior: resolved, active: input.currentlyActive, rescan: false, releaseAfterMs: false }
}
