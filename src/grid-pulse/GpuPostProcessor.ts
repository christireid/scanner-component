export type GpuBackendPreference = "auto" | "webgl2" | "canvas2d"
export type ResolvedGpuBackend = "webgl2" | "canvas2d"

export interface GpuPostProcessOptions {
    enabled: boolean
    preference: GpuBackendPreference
    time: number
    distortion: number
    chromaticAberration: number
    bloom: number
    scanStrength: number
    noiseStrength: number
    vignette: number
}

export interface GpuCapability {
    backend: ResolvedGpuBackend
    available: boolean
    reason?: string
}

export const VERTEX_SHADER_SOURCE = `#version 300 es
precision highp float;
in vec2 a_position;
out vec2 v_uv;
void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
}`

export const FRAGMENT_SHADER_SOURCE = `#version 300 es
precision highp float;
uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_distortion;
uniform float u_chromatic;
uniform float u_bloom;
uniform float u_scan;
uniform float u_noise;
uniform float u_vignette;
in vec2 v_uv;
out vec4 outColor;

float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

vec2 distortUv(vec2 uv) {
    vec2 centered = uv * 2.0 - 1.0;
    float radius2 = dot(centered, centered);
    centered *= 1.0 + radius2 * u_distortion;
    float wave = sin((uv.y * 19.0) + u_time * 1.4) * 0.0018 * u_distortion;
    centered.x += wave;
    return centered * 0.5 + 0.5;
}

vec3 sampleChromatic(vec2 uv) {
    vec2 direction = normalize(uv - 0.5 + vec2(0.00001));
    vec2 offset = direction * u_chromatic / max(u_resolution, vec2(1.0));
    float r = texture(u_texture, uv + offset).r;
    float g = texture(u_texture, uv).g;
    float b = texture(u_texture, uv - offset).b;
    return vec3(r, g, b);
}

void main() {
    vec2 uv = distortUv(v_uv);
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        outColor = vec4(0.0);
        return;
    }

    vec3 color = sampleChromatic(uv);
    vec2 texel = 1.0 / max(u_resolution, vec2(1.0));
    vec3 blur = vec3(0.0);
    blur += texture(u_texture, uv + vec2(texel.x, 0.0) * 2.0).rgb;
    blur += texture(u_texture, uv - vec2(texel.x, 0.0) * 2.0).rgb;
    blur += texture(u_texture, uv + vec2(0.0, texel.y) * 2.0).rgb;
    blur += texture(u_texture, uv - vec2(0.0, texel.y) * 2.0).rgb;
    blur *= 0.25;
    color += max(blur - 0.68, 0.0) * u_bloom;

    float scanBand = exp(-pow(fract(uv.y * 1.15 - u_time * 0.16) - 0.5, 2.0) * 180.0);
    color += vec3(0.32, 0.9, 0.5) * scanBand * u_scan;

    float grain = hash21(gl_FragCoord.xy + u_time * 97.0) - 0.5;
    color += grain * u_noise;

    float distanceFromCenter = length(v_uv - 0.5) * 1.4142;
    color *= 1.0 - smoothstep(0.44, 1.0, distanceFromCenter) * u_vignette;

    outColor = vec4(color, texture(u_texture, uv).a);
}`

export function resolveGpuBackend(
    preference: GpuBackendPreference,
    webgl2Available: boolean
): ResolvedGpuBackend {
    if (preference === "canvas2d") return "canvas2d"
    if (preference === "webgl2") return webgl2Available ? "webgl2" : "canvas2d"
    return webgl2Available ? "webgl2" : "canvas2d"
}

function compileShader(
    gl: WebGL2RenderingContext,
    type: number,
    source: string
) {
    const shader = gl.createShader(type)
    if (!shader) throw new Error("Unable to allocate WebGL shader")
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const message = gl.getShaderInfoLog(shader) || "Unknown shader compile error"
        gl.deleteShader(shader)
        throw new Error(message)
    }
    return shader
}

function createProgram(gl: WebGL2RenderingContext) {
    const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE)
    const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE)
    const program = gl.createProgram()
    if (!program) throw new Error("Unable to allocate WebGL program")
    gl.attachShader(program, vertex)
    gl.attachShader(program, fragment)
    gl.linkProgram(program)
    gl.deleteShader(vertex)
    gl.deleteShader(fragment)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const message = gl.getProgramInfoLog(program) || "Unknown shader link error"
        gl.deleteProgram(program)
        throw new Error(message)
    }
    return program
}

export class GpuPostProcessor {
    private canvas: HTMLCanvasElement | null = null
    private gl: WebGL2RenderingContext | null = null
    private program: WebGLProgram | null = null
    private texture: WebGLTexture | null = null
    private vertexBuffer: WebGLBuffer | null = null
    private failedReason: string | undefined

    get capability(): GpuCapability {
        return {
            backend: this.gl && this.program ? "webgl2" : "canvas2d",
            available: Boolean(this.gl && this.program),
            reason: this.failedReason,
        }
    }

    private initialize() {
        if (this.gl && this.program && this.canvas) return true
        if (this.failedReason || typeof document === "undefined") return false
        try {
            const canvas = document.createElement("canvas")
            const gl = canvas.getContext("webgl2", {
                alpha: true,
                antialias: false,
                depth: false,
                stencil: false,
                premultipliedAlpha: true,
                preserveDrawingBuffer: true,
                powerPreference: "high-performance",
            })
            if (!gl) {
                this.failedReason = "WebGL2 is unavailable"
                return false
            }
            const program = createProgram(gl)
            const vertexBuffer = gl.createBuffer()
            const texture = gl.createTexture()
            if (!vertexBuffer || !texture) throw new Error("Unable to allocate WebGL resources")

            gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
            gl.bufferData(
                gl.ARRAY_BUFFER,
                new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
                gl.STATIC_DRAW
            )
            gl.bindTexture(gl.TEXTURE_2D, texture)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

            this.canvas = canvas
            this.gl = gl
            this.program = program
            this.texture = texture
            this.vertexBuffer = vertexBuffer
            return true
        } catch (error) {
            this.failedReason = error instanceof Error ? error.message : String(error)
            this.dispose()
            return false
        }
    }

    process(
        source: HTMLCanvasElement,
        options: GpuPostProcessOptions
    ): HTMLCanvasElement | null {
        if (!options.enabled || options.preference === "canvas2d") return null
        if (!this.initialize() || !this.canvas || !this.gl || !this.program || !this.texture || !this.vertexBuffer) {
            return null
        }
        const gl = this.gl
        if (this.canvas.width !== source.width || this.canvas.height !== source.height) {
            this.canvas.width = source.width
            this.canvas.height = source.height
        }
        gl.viewport(0, 0, source.width, source.height)
        gl.useProgram(this.program)
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer)
        const position = gl.getAttribLocation(this.program, "a_position")
        gl.enableVertexAttribArray(position)
        gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, this.texture)
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)

        const uniform1f = (name: string, value: number) => {
            const location = gl.getUniformLocation(this.program!, name)
            if (location) gl.uniform1f(location, value)
        }
        const resolution = gl.getUniformLocation(this.program, "u_resolution")
        const sampler = gl.getUniformLocation(this.program, "u_texture")
        if (resolution) gl.uniform2f(resolution, source.width, source.height)
        if (sampler) gl.uniform1i(sampler, 0)
        uniform1f("u_time", options.time * 0.001)
        uniform1f("u_distortion", options.distortion)
        uniform1f("u_chromatic", options.chromaticAberration)
        uniform1f("u_bloom", options.bloom)
        uniform1f("u_scan", options.scanStrength)
        uniform1f("u_noise", options.noiseStrength)
        uniform1f("u_vignette", options.vignette)

        gl.clearColor(0, 0, 0, 0)
        gl.clear(gl.COLOR_BUFFER_BIT)
        gl.drawArrays(gl.TRIANGLES, 0, 6)
        gl.flush()
        return this.canvas
    }

    dispose() {
        if (this.gl) {
            if (this.texture) this.gl.deleteTexture(this.texture)
            if (this.vertexBuffer) this.gl.deleteBuffer(this.vertexBuffer)
            if (this.program) this.gl.deleteProgram(this.program)
        }
        this.canvas = null
        this.gl = null
        this.program = null
        this.texture = null
        this.vertexBuffer = null
    }
}
