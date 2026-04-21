export interface ElementRenderData {
    x: number;
    y: number;
    width: number;
    height: number;
    imageSrc?: string;
    isTouching: boolean;
    color?: { r: number; g: number; b: number };
    touchColor?: { r: number; g: number; b: number };
}

export interface ElementRenderConfig {
    simWidth: number;
    simHeight: number;
    element: ElementRenderData;
}

const meshVertexShader = `
	attribute vec2 attrPosition;
	uniform vec2 domainSize;
	uniform vec3 color;
	uniform vec2 translation;
	uniform vec2 scale;
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

const texturedMeshVertexShader = `
	attribute vec2 attrPosition;
	attribute vec2 attrUv;
	uniform vec2 domainSize;
	uniform vec2 translation;
	uniform vec2 scale;
	varying vec2 fragUv;
	void main() {
		vec2 v = translation + attrPosition * scale;
		vec4 screenTransform = vec4(2.0 / domainSize.x, 2.0 / domainSize.y, -1.0, -1.0);
		gl_Position = vec4(v * screenTransform.xy + screenTransform.zw, 0.0, 1.0);
		fragUv = attrUv;
	}
`;

const texturedMeshFragmentShader = `
	precision mediump float;
	varying vec2 fragUv;
	uniform sampler2D elementTexture;
	uniform vec3 touchTint;
	uniform float touchMix;
	void main() {
		vec4 texel = texture2D(elementTexture, fragUv);
		vec3 tinted = mix(texel.rgb, touchTint, touchMix);
		gl_FragColor = vec4(tinted, texel.a);
	}
`;

export class ElementRenderer {
    private gl: WebGLRenderingContext;
    private meshShader: WebGLProgram;
    private texturedMeshShader: WebGLProgram;
    private meshVertexBuffer: WebGLBuffer;
    private meshUvBuffer: WebGLBuffer;
    private elementTexture: WebGLTexture | null = null;
    private elementTextureLoaded = false;
    private elementTextureSrc: string | null = null;

    constructor(gl: WebGLRenderingContext) {
        this.gl = gl;
        this.meshShader = this.createShader(meshVertexShader, meshFragmentShader);
        this.texturedMeshShader = this.createShader(texturedMeshVertexShader, texturedMeshFragmentShader);
        this.meshVertexBuffer = this.createBuffer();
        this.meshUvBuffer = this.createBuffer();
    }

    render(config: ElementRenderConfig): void {
        const gl = this.gl;
        const { element } = config;

        if (element.imageSrc && element.imageSrc !== this.elementTextureSrc) {
            this.loadElementImage(element.imageSrc);
        }

        const vertices = new Float32Array([
            -0.5, -0.5,
             0.5, -0.5,
            -0.5,  0.5,
             0.5,  0.5,
        ]);

        const uv = new Float32Array([
            0.0, 0.0,
            1.0, 0.0,
            0.0, 1.0,
            1.0, 1.0,
        ]);

        if (this.elementTextureLoaded && this.elementTexture) {
            gl.useProgram(this.texturedMeshShader);

            const posLoc = gl.getAttribLocation(this.texturedMeshShader, 'attrPosition');
            const uvLoc = gl.getAttribLocation(this.texturedMeshShader, 'attrUv');
            gl.enableVertexAttribArray(posLoc);
            gl.enableVertexAttribArray(uvLoc);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.meshVertexBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
            gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.meshUvBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, uv, gl.STATIC_DRAW);
            gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 0, 0);

            gl.uniform2f(gl.getUniformLocation(this.texturedMeshShader, 'domainSize'), config.simWidth, config.simHeight);
            gl.uniform2f(gl.getUniformLocation(this.texturedMeshShader, 'translation'), element.x, element.y);
            gl.uniform2f(gl.getUniformLocation(this.texturedMeshShader, 'scale'), element.width, element.height);
            gl.uniform3f(gl.getUniformLocation(this.texturedMeshShader, 'touchTint'), 1.0, 0.45, 0.2);
            gl.uniform1f(gl.getUniformLocation(this.texturedMeshShader, 'touchMix'), element.isTouching ? 0.25 : 0.0);

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.elementTexture);
            gl.uniform1i(gl.getUniformLocation(this.texturedMeshShader, 'elementTexture'), 0);

            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

            gl.disableVertexAttribArray(posLoc);
            gl.disableVertexAttribArray(uvLoc);
            gl.bindTexture(gl.TEXTURE_2D, null);
            gl.bindBuffer(gl.ARRAY_BUFFER, null);
            return;
        }

        const idleColor = element.color ?? { r: 0.85, g: 0.85, b: 0.9 };
        const hitColor = element.touchColor ?? { r: 1.0, g: 0.45, b: 0.2 };
        const color = element.isTouching ? hitColor : idleColor;

        gl.useProgram(this.meshShader);

        const posLoc = gl.getAttribLocation(this.meshShader, 'attrPosition');
        gl.enableVertexAttribArray(posLoc);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.meshVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

        gl.uniform2f(gl.getUniformLocation(this.meshShader, 'domainSize'), config.simWidth, config.simHeight);
        gl.uniform3f(gl.getUniformLocation(this.meshShader, 'color'), color.r, color.g, color.b);
        gl.uniform2f(gl.getUniformLocation(this.meshShader, 'translation'), element.x, element.y);
        gl.uniform2f(gl.getUniformLocation(this.meshShader, 'scale'), element.width, element.height);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        gl.disableVertexAttribArray(posLoc);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }

    private loadElementImage(src: string): void {
        const gl = this.gl;
        this.elementTextureLoaded = false;

        const img = new Image();
        img.onload = () => {
            const texture = gl.createTexture();
            if (!texture) return;

            if (this.elementTexture) {
                gl.deleteTexture(this.elementTexture);
            }

            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

            this.elementTexture = texture;
            this.elementTextureLoaded = true;
            this.elementTextureSrc = src;
            gl.bindTexture(gl.TEXTURE_2D, null);
        };

        img.src = src;
    }

    private createShader(vsSource: string, fsSource: string): WebGLProgram {
        const gl = this.gl;

        const vsShader = gl.createShader(gl.VERTEX_SHADER);
        if (!vsShader) throw new Error('Failed to create vertex shader');
        gl.shaderSource(vsShader, vsSource);
        gl.compileShader(vsShader);
        if (!gl.getShaderParameter(vsShader, gl.COMPILE_STATUS)) {
            console.error('Vertex shader compile error:', gl.getShaderInfoLog(vsShader));
            throw new Error('Vertex shader compilation failed');
        }

        const fsShader = gl.createShader(gl.FRAGMENT_SHADER);
        if (!fsShader) throw new Error('Failed to create fragment shader');
        gl.shaderSource(fsShader, fsSource);
        gl.compileShader(fsShader);
        if (!gl.getShaderParameter(fsShader, gl.COMPILE_STATUS)) {
            console.error('Fragment shader compile error:', gl.getShaderInfoLog(fsShader));
            throw new Error('Fragment shader compilation failed');
        }

        const shader = gl.createProgram();
        if (!shader) throw new Error('Failed to create shader program');
        gl.attachShader(shader, vsShader);
        gl.attachShader(shader, fsShader);
        gl.linkProgram(shader);

        if (!gl.getProgramParameter(shader, gl.LINK_STATUS)) {
            console.error('Shader link error:', gl.getProgramInfoLog(shader));
            throw new Error('Shader program linking failed');
        }

        return shader;
    }

    private createBuffer(): WebGLBuffer {
        const buffer = this.gl.createBuffer();
        if (!buffer) throw new Error('Failed to create buffer');
        return buffer;
    }
}
