#!/usr/bin/env node
/**
 * CSS-template lint.
 *
 * The component renders to canvas and styles its host element with inline
 * objects, so there is very little stylesheet — which is exactly why the CSS
 * that does exist, and the CSS-valued strings baked into TypeScript, are easy
 * to break without anyone noticing. This checks both.
 *
 * Exit code 1 on any error. Warnings do not fail the run.
 */
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("..", import.meta.url))
const errors = []
const warnings = []

const fail = (file, line, message) =>
    errors.push(`${relative(root, file)}:${line}: ${message}`)
const warn = (file, line, message) =>
    warnings.push(`${relative(root, file)}:${line}: ${message}`)

function walk(directory, extensions, files = []) {
    for (const entry of readdirSync(directory)) {
        if (entry === "node_modules" || entry === "dist" || entry.startsWith(".")) continue
        const full = join(directory, entry)
        if (statSync(full).isDirectory()) walk(full, extensions, files)
        else if (extensions.some(extension => entry.endsWith(extension))) files.push(full)
    }
    return files
}

/* ---------------------------------------------------------------- *
 * 1. Stylesheets: balanced blocks, no unterminated declarations,
 *    no leftover template placeholders.
 * ---------------------------------------------------------------- */

for (const file of walk(join(root, "src"), [".css"])) {
    const source = readFileSync(file, "utf8")
    const lines = source.split("\n")

    let depth = 0
    lines.forEach((line, index) => {
        for (const character of line) {
            if (character === "{") depth += 1
            if (character === "}") depth -= 1
            if (depth < 0) fail(file, index + 1, "unbalanced `}` closes a block that never opened")
        }
        if (/\$\{|<%|\{\{/.test(line)) {
            fail(file, index + 1, "unresolved template placeholder in a shipped stylesheet")
        }
        const trimmed = line.trim()
        if (
            trimmed &&
            depth > 0 &&
            !trimmed.endsWith("{") &&
            !trimmed.endsWith("}") &&
            !trimmed.endsWith(";") &&
            !trimmed.endsWith(",") &&
            !trimmed.startsWith("/*") &&
            !trimmed.startsWith("*") &&
            !trimmed.startsWith("//")
        ) {
            fail(file, index + 1, `declaration is missing a terminating semicolon: \`${trimmed}\``)
        }
    })
    if (depth !== 0) fail(file, lines.length, `${depth} unclosed block(s) at end of file`)
}

/* ---------------------------------------------------------------- *
 * 2. CSS-valued strings inside TypeScript.
 *    Colours, fonts, shadows and dashes are configuration, and a
 *    malformed one degrades silently at runtime.
 * ---------------------------------------------------------------- */

const COLOUR_KEY = /(?:color|Color|background|Background|tint|borderColor|scanColor)\s*:\s*"([^"]*)"/g
const FONT_KEY = /\bfont\s*:\s*"([^"]*)"/g
const SHADOW_KEY = /\bshadow\s*:\s*"([^"]*)"/g

const isColourLiteral = value =>
    value === "" ||
    value === "transparent" ||
    value === "none" ||
    // A gradient in a `background:` key is a valid image value, not a colour.
    /^(repeating-)?(linear|radial|conic)-gradient\(/.test(value) ||
    /^#[0-9a-fA-F]{3,8}$/.test(value) ||
    /^rgba?\([^)]*\)$/.test(value) ||
    /^hsla?\([^)]*\)$/.test(value)

const lineOf = (source, index) => source.slice(0, index).split("\n").length

for (const file of walk(join(root, "src"), [".ts", ".tsx"])) {
    const source = readFileSync(file, "utf8")

    for (const match of source.matchAll(COLOUR_KEY)) {
        const value = match[1]
        if (isColourLiteral(value)) continue
        // Interpolated values are resolved at runtime; only flag literals.
        if (value.includes("${")) continue
        // A string-union type annotation (`color: "light" | "dark"`) is a type,
        // not a CSS value.
        if (/^\s*\|/.test(source.slice(match.index + match[0].length))) continue
        warn(file, lineOf(source, match.index), `\`${value}\` is not a recognised CSS colour`)
    }

    for (const match of source.matchAll(FONT_KEY)) {
        const value = match[1]
        if (!/^\s*(?:\d+(?:\.\d+)?)(?:px|rem|em)\s+\S/.test(value)) {
            fail(
                file,
                lineOf(source, match.index),
                `canvas font shorthand must start with a size then a family: \`${value}\``
            )
        }
    }

    for (const match of source.matchAll(SHADOW_KEY)) {
        const value = match[1]
        if (value === "none" || value === "") continue
        const lengths = value.match(/(-?(?:\d+(?:\.\d+)?|\.\d+))(?:px)?(?=\s)/g) || []
        if (lengths.length < 2) {
            fail(
                file,
                lineOf(source, match.index),
                `box shadow needs at least an x and y offset: \`${value}\``
            )
        }
        if (!/(#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\()/.test(value)) {
            fail(file, lineOf(source, match.index), `box shadow has no colour: \`${value}\``)
        }
    }
}

/* ---------------------------------------------------------------- *
 * 3. Report.
 * ---------------------------------------------------------------- */

for (const warning of warnings) console.warn(`warning  ${warning}`)
for (const error of errors) console.error(`error    ${error}`)

if (errors.length > 0) {
    console.error(`\nlint:css failed — ${errors.length} error(s), ${warnings.length} warning(s)`)
    process.exit(1)
}
console.log(`lint:css clean — 0 errors, ${warnings.length} warning(s)`)
