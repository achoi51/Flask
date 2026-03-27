import type { FlipFluid } from './FlipFluid';

const pointVertexShader = `
    attribute vec2 attrPosition;
    attribute vec3 attrColor;
    uniform vec2 domainSize;
    uniform float pointSize;
    uniform float drawDisk;
    varying vec3 fragColor;
    varying float fragDrawDisk;
    void main() {
        vec4 screenTransform = vec4(2.0 / domainSize.x, 2.0 / domainSize.y, -1.0, -1.0);
        gl_Position = vec4(attrPosition * screenTransform.xy + screenTransform.zw, 0.0, 1.0);
        gl_PointSize = pointSize;
        fragColor = attrColor;
        fragDrawDisk = drawDisk;
    }
`;

const pointFragmentShader = `
    precision mediump float;
    varying vec3 fragColor;
    varying float fragDrawDisk;
    void main() {
        if (fragDrawDisk == 1.0) {
            float r2 = dot(gl_PointCoord - 0.5, gl_PointCoord - 0.5);
            if (r2 > 0.25) discard;
            float alpha = 1.0 - smoothstep(0.15, 0.25, r2);
            gl_FragColor = vec4(fragColor, alpha);
        } else {
            gl_FragColor = vec4(fragColor, 1.0);
        }
    }
`;

const meshVertexShader = `
    attribute vec2 attrPosition;
    uniform vec2 domainSize;
    uniform vec3 color;
    uniform vec2 translation;
    uniform float scale;
    varying vec3 fragColor;
    void main() {
        vec2 v = translation + attrPosition * scale;
        vec4 screenTransform = vec4(2.0 / domainSize.x, 2.0 / domainSize.y, -1.0, -1.0);
        gl_Position = vec4(v * screenTransform.xy + screenTransform.zw, 0.0, 1.0);
        fragColor = color;
    }
`;

const meshFragmentShader = `
    precision mediump float;
    varying vec3 fragColor;
    void main() {
        gl_FragColor = vec4(fragColor, 1.0);
    }
`;

const accumVertexShader = `
    attribute vec2 attrPosition;
    attribute vec3 attrColor;
    uniform vec2 domainSize;
    uniform float radiusPx;
    varying vec3 vColor;
    void main() {
        vec4 st = vec4(2.0 / domainSize.x, 2.0 / domainSize.y, -1.0, -1.0);
        gl_Position = vec4(attrPosition * st.xy + st.zw, 0.0, 1.0);
        gl_PointSize = radiusPx * 2.0;
        vColor = attrColor;
    }
`;

const accumFragmentShader = `
    precision mediump float;
    varying vec3 vColor;
    uniform float accumScale;
    void main() {
        vec2 coord = gl_PointCoord - 0.5;
        float dist = length(coord) * 2.0;
        if (dist > 1.0) discard;
        float influence = 1.0 - dist;
        float weight = influence * influence * accumScale;
        gl_FragColor = vec4(vColor * weight, weight);
    }
`;

const compositeVertexShader = `
    attribute vec2 attrPosition;
    varying vec2 vTexCoord;
    void main() {
        gl_Position = vec4(attrPosition, 0.0, 1.0);
        vTexCoord = (attrPosition + 1.0) * 0.5;
    }
`;

// Soft volumetric edges instead of a hard fluid surface cutoff
const compositeFragmentShader = `
    precision mediump float;
    varying vec2 vTexCoord;
    uniform sampler2D accumTex;
    uniform float threshold;
    void main() {
        vec4 accum = texture2D(accumTex, vTexCoord);
        if (accum.a < threshold) discard;
        vec3 color = accum.rgb / accum.a;
        float alpha = smoothstep(threshold, threshold * 3.0, accum.a);
        gl_FragColor = vec4(color, alpha * 1.0);
    }
`;

export interface RenderConfig {
    showParticles: boolean;
    showGrid: boolean;
    showFluid: boolean;
    simWidth: number;
    simHeight: number;
}

export class FluidRenderer {
    private gl: WebGLRenderingContext;
    private pointShader: WebGLProgram;
    private meshShader: WebGLProgram;
    private accumShader: WebGLProgram;
    private compositeShader: WebGLProgram;
    private pointVertexBuffer: WebGLBuffer;
    private pointColorBuffer: WebGLBuffer;
    private gridVertBuffer: WebGLBuffer;
    private gridColorBuffer: WebGLBuffer;
    private quadBuffer: WebGLBuffer;
    private gridVertBufferInitialized = false;

    private accumFramebuffer: WebGLFramebuffer | null = null;
    private accumTexture: WebGLTexture | null = null;
    private accumWidth = 0;
    private accumHeight = 0;

    private influenceRadius = 0.45;  // was 0.22 — larger blobs, wispy spread
    private accumScale = 0.15;       // was 0.35 — lower peak, requires clusters to show
    private threshold = 0.25;        // was 0.5  — puffier, more volumetric edges

    constructor(canvas: HTMLCanvasElement) {
        const gl = canvas.getContext('webgl');
        if (!gl) throw new Error('WebGL not supported');
        this.gl = gl;

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        this.pointShader = this.createShader(pointVertexShader, pointFragmentShader);
        this.meshShader = this.createShader(meshVertexShader, meshFragmentShader);
        this.accumShader = this.createShader(accumVertexShader, accumFragmentShader);
        this.compositeShader = this.createShader(compositeVertexShader, compositeFragmentShader);

        this.pointVertexBuffer = this.createBuffer();
        this.pointColorBuffer = this.createBuffer();
        this.gridVertBuffer = this.createBuffer();
        this.gridColorBuffer = this.createBuffer();

        this.quadBuffer = this.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            -1, -1,  1, -1,  -1,  1,
            -1,  1,  1, -1,   1,  1
        ]), gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }

    private createShader(vsSource: string, fsSource: string): WebGLProgram {
        const gl = this.gl;

        const vsShader = gl.createShader(gl.VERTEX_SHADER)!;
        gl.shaderSource(vsShader, vsSource);
        gl.compileShader(vsShader);
        if (!gl.getShaderParameter(vsShader, gl.COMPILE_STATUS)) {
            throw new Error('Vertex shader error: ' + gl.getShaderInfoLog(vsShader));
        }

        const fsShader = gl.createShader(gl.FRAGMENT_SHADER)!;
        gl.shaderSource(fsShader, fsSource);
        gl.compileShader(fsShader);
        if (!gl.getShaderParameter(fsShader, gl.COMPILE_STATUS)) {
            throw new Error('Fragment shader error: ' + gl.getShaderInfoLog(fsShader));
        }

        const program = gl.createProgram()!;
        gl.attachShader(program, vsShader);
        gl.attachShader(program, fsShader);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            throw new Error('Shader link error: ' + gl.getProgramInfoLog(program));
        }

        return program;
    }

    private createBuffer(): WebGLBuffer {
        const buffer = this.gl.createBuffer();
        if (!buffer) throw new Error('Failed to create buffer');
        return buffer;
    }

    render(fluid: FlipFluid, config: RenderConfig): void {
        if (config.showFluid) this.renderFluid(fluid, config);
        if (config.showParticles || config.showGrid) this.renderPoints(fluid, config);
    }

    private ensureAccumFramebuffer(width: number, height: number): void {
        const gl = this.gl;
        if (this.accumWidth === width && this.accumHeight === height) return;

        if (this.accumFramebuffer) gl.deleteFramebuffer(this.accumFramebuffer);
        if (this.accumTexture) gl.deleteTexture(this.accumTexture);

        const tex = gl.createTexture()!;
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);

        const fb = gl.createFramebuffer()!;
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        this.accumTexture = tex;
        this.accumFramebuffer = fb;
        this.accumWidth = width;
        this.accumHeight = height;
    }

    private renderFluid(fluid: FlipFluid, config: RenderConfig): void {
        const gl = this.gl;
        const w = gl.canvas.width;
        const h = gl.canvas.height;

        this.ensureAccumFramebuffer(w, h);

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.accumFramebuffer);
        gl.viewport(0, 0, w, h);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.blendFunc(gl.ONE, gl.ONE);

        gl.useProgram(this.accumShader);
        gl.uniform2f(gl.getUniformLocation(this.accumShader, 'domainSize'), config.simWidth, config.simHeight);
        gl.uniform1f(gl.getUniformLocation(this.accumShader, 'accumScale'), this.accumScale);

        const radiusPx = this.influenceRadius / config.simWidth * w;
        gl.uniform1f(gl.getUniformLocation(this.accumShader, 'radiusPx'), radiusPx);

        const posLoc = gl.getAttribLocation(this.accumShader, 'attrPosition');
        const colorLoc = gl.getAttribLocation(this.accumShader, 'attrColor');
        gl.enableVertexAttribArray(posLoc);
        gl.enableVertexAttribArray(colorLoc);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.pointVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, fluid.particlePos.subarray(0, 2 * fluid.numParticles), gl.DYNAMIC_DRAW);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.pointColorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, fluid.particleColor.subarray(0, 3 * fluid.numParticles), gl.DYNAMIC_DRAW);
        gl.vertexAttribPointer(colorLoc, 3, gl.FLOAT, false, 0, 0);

        gl.drawArrays(gl.POINTS, 0, fluid.numParticles);
        gl.disableVertexAttribArray(posLoc);
        gl.disableVertexAttribArray(colorLoc);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, w, h);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        gl.useProgram(this.compositeShader);
        gl.uniform1i(gl.getUniformLocation(this.compositeShader, 'accumTex'), 0);
        gl.uniform1f(gl.getUniformLocation(this.compositeShader, 'threshold'), this.threshold);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.accumTexture);

        const qPosLoc = gl.getAttribLocation(this.compositeShader, 'attrPosition');
        gl.enableVertexAttribArray(qPosLoc);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        gl.vertexAttribPointer(qPosLoc, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        gl.disableVertexAttribArray(qPosLoc);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }

    private renderPoints(fluid: FlipFluid, config: RenderConfig): void {
        const gl = this.gl;
        gl.useProgram(this.pointShader);
        gl.uniform2f(gl.getUniformLocation(this.pointShader, 'domainSize'), config.simWidth, config.simHeight);

        const posLoc = gl.getAttribLocation(this.pointShader, 'attrPosition');
        gl.enableVertexAttribArray(posLoc);
        const colorLoc = gl.getAttribLocation(this.pointShader, 'attrColor');
        gl.enableVertexAttribArray(colorLoc);

        if (config.showGrid) {
            const pointSize = 0.9 * fluid.h / config.simWidth * gl.canvas.width;
            gl.uniform1f(gl.getUniformLocation(this.pointShader, 'pointSize'), pointSize);
            gl.uniform1f(gl.getUniformLocation(this.pointShader, 'drawDisk'), 0.0);

            if (!this.gridVertBufferInitialized) {
                const cellCenters = new Float32Array(2 * fluid.fNumCells);
                let p = 0;
                for (let i = 0; i < fluid.fNumX; i++) {
                    for (let j = 0; j < fluid.fNumY; j++) {
                        cellCenters[p++] = (i + 0.5) * fluid.h;
                        cellCenters[p++] = (j + 0.5) * fluid.h;
                    }
                }
                gl.bindBuffer(gl.ARRAY_BUFFER, this.gridVertBuffer);
                gl.bufferData(gl.ARRAY_BUFFER, cellCenters, gl.STATIC_DRAW);
                this.gridVertBufferInitialized = true;
            }

            gl.bindBuffer(gl.ARRAY_BUFFER, this.gridVertBuffer);
            gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.gridColorBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, fluid.cellColor, gl.DYNAMIC_DRAW);
            gl.vertexAttribPointer(colorLoc, 3, gl.FLOAT, false, 0, 0);

            gl.drawArrays(gl.POINTS, 0, fluid.fNumCells);
        }

        if (config.showParticles) {
            const pointSize = 2.0 * fluid.particleRadius / config.simWidth * gl.canvas.width;
            gl.uniform1f(gl.getUniformLocation(this.pointShader, 'pointSize'), pointSize);
            gl.uniform1f(gl.getUniformLocation(this.pointShader, 'drawDisk'), 1.0);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.pointVertexBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, fluid.particlePos.subarray(0, 2 * fluid.numParticles), gl.DYNAMIC_DRAW);
            gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.pointColorBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, fluid.particleColor.subarray(0, 3 * fluid.numParticles), gl.DYNAMIC_DRAW);
            gl.vertexAttribPointer(colorLoc, 3, gl.FLOAT, false, 0, 0);

            gl.drawArrays(gl.POINTS, 0, fluid.numParticles);
        }

        gl.disableVertexAttribArray(posLoc);
        gl.disableVertexAttribArray(colorLoc);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }

    resize(width: number, height: number): void {
        const canvas = this.gl.canvas as HTMLCanvasElement;
        canvas.width = width;
        canvas.height = height;
        this.gl.viewport(0, 0, width, height);
        this.accumWidth = 0;
        this.accumHeight = 0;
    }
}