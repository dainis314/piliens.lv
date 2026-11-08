// piliens.lv v2: WebGL2 aina vienai sadaļai, ar adaptīvo kvalitāti
import { SEED, rng, RM } from "./util.js";
import { SHADERS } from "./shaders.js";

const VERT = `#version 300 es
in vec2 aPos; void main(){ gl_Position = vec4(aPos, 0., 1.); }`;
export function loadImage(url) {
  return new Promise((res, rej) => { const i = new Image(); i.decoding = "async"; i.onload = () => res(i); i.onerror = rej; i.src = url; });
}

export class GLScene {
  constructor({ section, canvas, frag, textures = async () => [], uniforms = () => {}, maxScale = 1.5, minScale = .45 }) {
    this.section = section; this.canvas = canvas; this.frag = frag;
    this.texFn = textures; this.uniFn = uniforms;
    this.maxScale = Math.min(maxScale, window.devicePixelRatio || 1);
    this.minScale = minScale;
    this.scale = Math.min(1, this.maxScale);
    this.frameTimes = [];
    this.mouse = [.62, .45];
    this.ready = false; this.failed = false;
    this.rnd = new Float32Array(32);
    const r = rng(SEED ^ (frag.length * 2654435761));
    for (let i = 0; i < 32; i++) this.rnd[i] = r();
  }

  async init() {
    const gl = this.canvas.getContext("webgl2", { antialias: false, alpha: false, preserveDrawingBuffer: false, powerPreference: "high-performance" });
    if (!gl) { this.fail(); return; }
    this.gl = gl;
    try {
      const commonSrc = SHADERS.common, fragSrc = SHADERS[this.frag];
      this.prog = this.compile("#version 300 es\n" + commonSrc + "\n" + fragSrc);
      const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.useProgram(this.prog);
      this.locs = {};
      const tex = await this.texFn(this);
      this.textures = tex.map(t => t && t.tex ? t : { tex: this.texture(t) });
      this.resize();
      this.ready = true;
      this.section.classList.add("gl-ready");
    } catch (e) { console.error(e); this.fail(); }
  }
  fail() { this.failed = true; this.section.classList.add("gl-fallback"); }

  compile(src) {
    const gl = this.gl;
    const sh = (type, s) => { const o = gl.createShader(type); gl.shaderSource(o, s); gl.compileShader(o);
      if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, src));
    gl.bindAttribLocation(p, 0, "aPos"); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }
  texture(src, { repeat = false } = {}) {
    const gl = this.gl, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const w = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, w); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, w);
    return t;
  }
  updateTexture(i, src) {
    const gl = this.gl; gl.bindTexture(gl.TEXTURE_2D, this.textures[i].tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.generateMipmap(gl.TEXTURE_2D);
  }
  U(name) { if (!(name in this.locs)) this.locs[name] = this.gl.getUniformLocation(this.prog, name); return this.locs[name]; }

  resize() {
    if (!this.gl) return;
    const r = this.canvas.getBoundingClientRect();
    this.cssW = Math.max(1, r.width); this.cssH = Math.max(1, r.height);
    const w = Math.round(this.cssW * this.scale), h = Math.round(this.cssH * this.scale);
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    this.gl.viewport(0, 0, w, h);
  }

  // adaptīvā kvalitāte: ja kadri ir lēni, samazina izšķirtspēju; ja ātri, palielina
  adapt(dt) {
    if (RM) return;
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 40) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.frameTimes.length = 0;
    let s = this.scale;
    if (avg > 1 / 45) s = Math.max(this.minScale, s * .85);
    else if (avg < 1 / 58 && s < this.maxScale) s = Math.min(this.maxScale, s * 1.08);
    if (Math.abs(s - this.scale) > .01) { this.scale = s; this.resize(); }
  }

  render(time, dt) {
    if (!this.ready) return;
    const gl = this.gl;
    if (this.simulate) this.simulate(time, dt);
    gl.useProgram(this.prog);
    gl.uniform2f(this.U("uRes"), this.canvas.width, this.canvas.height);
    gl.uniform1f(this.U("uTime"), time);
    gl.uniform1f(this.U("uSeed"), SEED % 9973);
    gl.uniform2f(this.U("uMouse"), this.mouse[0] * this.canvas.width, (1 - this.mouse[1]) * this.canvas.height);
    gl.uniform1fv(this.U("uRnd"), this.rnd);
    this.textures.forEach((t, i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, typeof t.tex === "function" ? t.tex() : t.tex); gl.uniform1i(this.U("uTex" + i), i); });
    this.uniFn(this, time, dt);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (dt) this.adapt(dt);
  }
}

// Divu tekstūru "ping-pong" simulācijai (tinte, ūdens virsma)
export class PingPong {
  constructor(gl, w, h, { float = true, linear = true } = {}) {
    this.gl = gl; this.w = w; this.h = h;
    const half = float && gl.getExtension("EXT_color_buffer_float");
    this.tex = []; this.fbo = [];
    for (let i = 0; i < 2; i++) {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      if (half) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
      else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      const f = linear ? gl.LINEAR : gl.NEAREST;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      this.tex.push(t); this.fbo.push(fb);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.i = 0;
  }
  get read() { return this.tex[this.i]; }
  // palaiž programmu, kas lasa "read" un raksta otrā tekstūrā
  step(prog, setUniforms) {
    const gl = this.gl;
    gl.useProgram(prog);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo[1 - this.i]);
    gl.viewport(0, 0, this.w, this.h);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex[this.i]);
    setUniforms();
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.i = 1 - this.i;
  }
}
