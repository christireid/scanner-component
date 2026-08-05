#!/usr/bin/env node
/**
 * Static file server with HTTP Range support.
 *
 * Chromium refuses to seek — and in some builds refuses to play at all — when a
 * video is served without `Accept-Ranges` and 206 responses. The component's
 * video pathway and every screenshot comparison that uses video therefore need
 * a Range-capable origin, which `vite preview` does not guarantee for arbitrary
 * static directories.
 *
 *   node tools/serve.mjs [directory] [--port 4180]
 */
import { createReadStream, statSync, existsSync } from "node:fs"
import { createServer } from "node:http"
import { extname, join, normalize, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const argv = process.argv.slice(2)
const portFlag = argv.indexOf("--port")
const port = portFlag >= 0 ? Number(argv[portFlag + 1]) : 4180
const directoryArg = argv.find(argument => !argument.startsWith("--") && argument !== String(port))
const root = resolve(directoryArg || fileURLToPath(new URL("../dist", import.meta.url)))

const MIME = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".map": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".avif": "image/avif",
    ".gif": "image/gif",
    ".ico": "image/x-icon",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
    ".m4v": "video/x-m4v",
    ".ogv": "video/ogg",
    ".woff2": "font/woff2",
}

const send = (response, status, headers, body) => {
    response.writeHead(status, headers)
    if (body) response.end(body)
    else response.end()
}

const server = createServer((request, response) => {
    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`)
    // Normalize away `..` before joining so no request can escape the root.
    const requested = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "")
    let filePath = join(root, requested)
    if (!filePath.startsWith(root)) {
        return send(response, 403, { "content-type": "text/plain" }, "Forbidden")
    }
    if (existsSync(filePath) && statSync(filePath).isDirectory()) {
        filePath = join(filePath, "index.html")
    }
    if (!existsSync(filePath)) {
        return send(response, 404, { "content-type": "text/plain" }, `Not found: ${requested}`)
    }

    const stats = statSync(filePath)
    const type = MIME[extname(filePath).toLowerCase()] || "application/octet-stream"
    const baseHeaders = {
        "content-type": type,
        "accept-ranges": "bytes",
        "cache-control": "no-store",
        "last-modified": stats.mtime.toUTCString(),
    }

    if (request.method === "HEAD") {
        return send(response, 200, { ...baseHeaders, "content-length": stats.size })
    }

    const range = request.headers.range
    if (!range) {
        response.writeHead(200, { ...baseHeaders, "content-length": stats.size })
        return createReadStream(filePath).pipe(response)
    }

    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim())
    if (!match) {
        return send(
            response,
            416,
            { ...baseHeaders, "content-range": `bytes */${stats.size}` },
            "Malformed Range header"
        )
    }

    // `bytes=-500` is a suffix request for the final 500 bytes.
    const suffix = match[1] === ""
    const start = suffix ? Math.max(0, stats.size - Number(match[2])) : Number(match[1])
    const end = suffix || match[2] === "" ? stats.size - 1 : Number(match[2])

    if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= stats.size) {
        return send(
            response,
            416,
            { ...baseHeaders, "content-range": `bytes */${stats.size}` },
            "Range not satisfiable"
        )
    }

    const last = Math.min(end, stats.size - 1)
    response.writeHead(206, {
        ...baseHeaders,
        "content-range": `bytes ${start}-${last}/${stats.size}`,
        "content-length": last - start + 1,
    })
    createReadStream(filePath, { start, end: last }).pipe(response)
})

server.listen(port, () => {
    console.log(`Range-capable static server`)
    console.log(`  root  ${root}`)
    console.log(`  url   http://localhost:${port}/`)
    if (!existsSync(root)) {
        console.warn(`  note  ${root} does not exist yet — run \`npm run build\` first`)
    }
})
