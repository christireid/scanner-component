#!/usr/bin/env node
/**
 * Feature inventory.
 *
 * The parity programme's non-regression rule is that the feature set may grow
 * or hold steady but must never shrink. This derives the inventory from source
 * rather than from a hand-maintained list, writes it to docs/FEATURE-INVENTORY.json,
 * and — when a previous inventory exists — fails if anything disappeared.
 *
 *   node tools/feature-inventory.mjs            compare against the committed inventory
 *   node tools/feature-inventory.mjs --write    accept the current inventory as the baseline
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("..", import.meta.url))
const read = path => readFileSync(new URL(path, import.meta.url), "utf8")

const optionTypes = read("../src/grid-pulse/GridPulseOptionTypes.ts")
const defaults = read("../src/grid-pulse/GridPulseDefaults.ts")
const entry = read("../src/GridPulseScanPro.tsx")

/* Option groups and their properties, taken from the shipped interfaces. */
const optionGroups = {}
const interfaceBlock = /export interface (GridPulse\w+Options) \{([\s\S]*?)\n\}/g
for (const match of optionTypes.matchAll(interfaceBlock)) {
    const [, name, body] = match
    const properties = [...body.matchAll(/^\s{4}(\w+)\??:/gm)].map(property => property[1])
    optionGroups[name] = properties.sort()
}

/* String-union types are the component's enumerated capabilities. */
const unions = {}
for (const match of optionTypes.matchAll(/export type (\w+)\s*=\s*([^\n]*(?:\n\s*\|[^\n]*)*)/g)) {
    const [, name, body] = match
    const members = [...body.matchAll(/"([^"]+)"/g)].map(member => member[1])
    if (members.length > 0) unions[name] = members
}

/* Public exports, i.e. the API a consumer can actually reach. */
const exportedValues = new Set()
const exportedTypes = new Set()
for (const match of entry.matchAll(/export (type )?\{([\s\S]*?)\}/g)) {
    const isType = Boolean(match[1])
    for (const raw of match[2].split(",")) {
        const name = raw.trim().split(/\s+as\s+/).pop().trim()
        if (!name) continue
        ;(isType ? exportedTypes : exportedValues).add(name)
    }
}
for (const match of entry.matchAll(/export \{ (\w+) \}/g)) exportedValues.add(match[1])
if (/export default/.test(entry)) exportedValues.add("default")

/* Defaults, so a value change is visible in review even when the key set holds. */
const defaultValues = {}
for (const match of defaults.matchAll(/export const (DEFAULT_\w+)[^=]*= \{([\s\S]*?)\n\}/g)) {
    const [, name, body] = match
    const entries = {}
    for (const property of body.matchAll(/^\s{4}(\w+):\s*([^\n]+?),?$/gm)) {
        entries[property[1]] = property[2].replace(/,$/, "")
    }
    defaultValues[name] = entries
}

const inventory = {
    generatedBy: "tools/feature-inventory.mjs",
    optionGroups,
    unions,
    exports: {
        values: [...exportedValues].sort(),
        types: [...exportedTypes].sort(),
    },
    defaults: defaultValues,
    counts: {
        optionGroups: Object.keys(optionGroups).length,
        optionProperties: Object.values(optionGroups).reduce((sum, list) => sum + list.length, 0),
        unions: Object.keys(unions).length,
        unionMembers: Object.values(unions).reduce((sum, list) => sum + list.length, 0),
        exportedValues: exportedValues.size,
        exportedTypes: exportedTypes.size,
    },
}

const inventoryPath = new URL("../docs/FEATURE-INVENTORY.json", import.meta.url)
const write = process.argv.includes("--write")

if (write || !existsSync(inventoryPath)) {
    writeFileSync(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`)
    console.log(
        `feature inventory written — ${inventory.counts.optionProperties} option properties ` +
            `across ${inventory.counts.optionGroups} groups, ` +
            `${inventory.counts.unionMembers} enumerated modes, ` +
            `${inventory.counts.exportedValues} exported values, ` +
            `${inventory.counts.exportedTypes} exported types`
    )
    process.exit(0)
}

const previous = JSON.parse(readFileSync(inventoryPath, "utf8"))
const removals = []

for (const [group, properties] of Object.entries(previous.optionGroups)) {
    if (!optionGroups[group]) {
        removals.push(`option group removed: ${group}`)
        continue
    }
    for (const property of properties) {
        if (!optionGroups[group].includes(property)) {
            removals.push(`option removed: ${group}.${property}`)
        }
    }
}
for (const [union, members] of Object.entries(previous.unions)) {
    if (!unions[union]) {
        removals.push(`type removed: ${union}`)
        continue
    }
    for (const member of members) {
        if (!unions[union].includes(member)) removals.push(`mode removed: ${union} "${member}"`)
    }
}
for (const name of previous.exports.values) {
    if (!exportedValues.has(name)) removals.push(`export removed: ${name}`)
}
for (const name of previous.exports.types) {
    if (!exportedTypes.has(name)) removals.push(`type export removed: ${name}`)
}

const additions =
    inventory.counts.optionProperties - previous.counts.optionProperties +
    (inventory.counts.unionMembers - previous.counts.unionMembers)

if (removals.length > 0) {
    for (const removal of removals) console.error(`error    ${removal}`)
    console.error(`\nfeature inventory failed — ${removals.length} removal(s). The inventory may grow, never shrink.`)
    process.exit(1)
}

console.log(
    `feature inventory stable — 0 removals, net ${additions >= 0 ? "+" : ""}${additions} ` +
        `option/mode entries against the committed baseline`
)
