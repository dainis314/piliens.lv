// piliens.lv v3: WebGL2 aina vienai sadaļai.
// Veiktspējai:
//  - konteksts dzīvo tikai tad, kad sadaļa ir ekrānā vai tuvu tam (release/acquire);
//  - iekšējā izšķirtspēja ierobežota ar pikseļu budžetu (~1,4 MP), dpr nekad virs 1, CSS to palielina;
//  - adaptīvā kvalitāte: ja kadri lēni, mērogs krīt pa soļiem līdz 0,5;
//  - konteksta zudums tiek pārdzīvots (preventDefault + atjaunošana), rezerves kadrs tikai, ja WebGL2 nav vispār.
import { SEED, rng, RM, PERF } from "./util.js";
import { SHADERS } from "./shaders.js";

const VERT = `#version 300 es
in vec2 aPos; void main(){ gl_Position = vec4(aPos, 0., 1.); }`;
const GL_OPTS = { antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false,
  preserveDrawingBuffer: false, powerPreference: "high-performance" };
export const BUDGET = 1.4e6;           // maksimālais pikseļu skaits vienai ainai
let webgl2Available = null;
function hasWebGL2() {
  if (webgl2Available === null) { try { webgl2Available = !!document.createElement("canvas").getContext("webgl2"); } catch (e) { webgl2Available = false; } }
  return webgl2Available;
}

const imgCache = new Map();
export function loadImage(url) {
  if (!imgCache.has(url)) imgCache.set(url, new Promise((res, rej) => {
    const i = new Image(); i.decoding = "async"; i.onload = () => res(i); i.onerror = rej; i.src = url;
  }));
  return imgCache.get(url);
}

export class GLScene {
  constructor({ section, canvas, frag, textures = async () => [], uniforms = () => {}, fps = 60, budget = BUDGET }) {
    this.section = section; this.canvas = canvas; this.frag = frag;
    this.texFn = textures; this.uniFn = uniforms;
    this.fps = fps; this.budget = budget;
    this.q = .8;                        // konservatīvs sākums; adaptīvā kvalitāte to pieskaņo
    this.mouse = [.62, .45];
    this.ready = false; this.failed = false; this.wanted = false; this.busy = null;
    this.ft = []; this.slow = 0; this.gpuMs = 0; this.acc = 0;
    this.rnd = new Float32Array(32);
    const r = rng(SEED ^ (frag.length * 2654435761));
    for (let i = 0; i < 32; i++) this.rnd[i] = r();
    canvas.addEventListener("webglcontextlost", e => { e.preventDefault(); this.ready = false; this.section.classList.remove("gl-ready"); }, false);
    canvas.addEventListener("webglcontextrestored", () => { if (this.wanted) this.build(); }, false);
  }

  // pieprasa kontekstu (sadaļa tuvojas ekrānam)
  async acquire() {
    this.wanted = true; this.canvas.__rel = false;
    if (this.ready || this.failed) return;
    if (!hasWebGL2()) { this.fail(); return; }
    if (!this.gl) {
      const gl = this.canvas.getContext("webgl2", GL_OPTS);
      if (!gl) { this.fail(); return; }
      this.gl = gl; this.loseExt = gl.getExtension("WEBGL_lose_context");
    }
    if (this.gl.isContextLost()) { if (this.loseExt) this.loseExt.restoreContext(); return; } // turpinās "restored" notikumā
    await this.build();
  }
  // atbrīvo GPU resursus (sadaļa tālu no ekrāna)
  release() {
    this.wanted = false;
    if (!this.gl || this.gl.isContextLost()) return;
    this.ready = false;
    this.section.classList.remove("gl-ready");
    this.canvas.__rel = true; // apzināta atbrīvošana (nevis draivera zudums)
    if (this.loseExt) this.loseExt.loseContext();
  }

  async build() {
    if (this.busy) return this.busy;
    this.busy = (async () => {
      const gl = this.gl;
      try {
        this.prog = this.compile("#version 300 es\n" + SHADERS.common + "\n" + SHADERS[this.frag]);
        const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
        const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        this.locs = {}; this.size = null;
        const tex = await this.texFn(this);
        if (gl.isContextLost() || !this.wanted) return;
        this.textures = tex.map(t => t && t.tex ? t : { tex: this.texture(t) });
        this.resize();
        if (this.onBuild) this.onBuild();
        this.ready = true;
        this.section.classList.add("gl-ready");
        this.section.classList.remove("gl-fallback");
      } catch (e) {
        if (!gl.isContextLost()) { console.error(e); this.fail(); }
      } finally { this.busy = null; }
    })();
    return this.busy;
  }
  fail() { this.failed = true; this.section.classList.add("gl-fallback"); }

  compile(src) {
    const gl = this.gl;
    const sh = (type, s) => { const o = gl.createShader(type); gl.shaderSource(o, s); gl.compileShader(o);
      if (!gl.getShaderParameter(o, gl.COMPILE_STATUS) && !gl.isContextLost()) throw new Error(gl.getShaderInfoLog(o)); return o; };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, src));
    gl.bindAttribLocation(p, 0, "aPos"); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS) && !gl.isContextLost()) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }
  // dynamic: tekstūra tiek atjaunota katrā kadrā (bez mipmap)
  texture(src, { repeat = false, dynamic = false } = {}) {
    const gl = this.gl, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    if (!dynamic) gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, dynamic ? gl.LINEAR : gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const w = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, w); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, w);
    t.dynamic = dynamic;
    return t;
  }
  updateTexture(i, src) {
    if (!this.ready) return;
    const gl = this.gl, t = this.textures[i].tex;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    if (!t.dynamic) gl.generateMipmap(gl.TEXTURE_2D);
  }
  U(name) { if (!(name in this.locs)) this.locs[name] = this.gl.getUniformLocation(this.prog, name); return this.locs[name]; }

  // iekšējais mērogs: pikseļu budžets × adaptīvā kvalitāte; dpr netiek izmantots (vienmēr ≤ 1 CSS pikselim)
  resize() {
    if (!this.gl || this.gl.isContextLost()) return;
    const r = this.canvas.getBoundingClientRect();
    this.cssW = Math.max(1, r.width); this.cssH = Math.max(1, r.height);
    const fit = Math.min(1, Math.sqrt(this.budget / (this.cssW * this.cssH)));
    const s = fit * this.q;
    const w = Math.max(2, Math.round(this.cssW * s)), h = Math.max(2, Math.round(this.cssH * s));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w; this.canvas.height = h;   // izmēra maiņa notīra kadru: nākamajā kadrā jāzīmē obligāti
      this.mustDraw = true;
      if (this.onResize) this.onResize(w, h);
    }
    this.gl.viewport(0, 0, w, h);
  }

  // adaptīvā kvalitāte pēc kopējā kadra laika (ms)
  adapt(frameMs) {
    if (RM || !this.ready) return;
    this.ft.push(frameMs);
    if (this.ft.length < 24) return;
    const avg = this.ft.reduce((a, b) => a + b, 0) / this.ft.length, worst = Math.max(...this.ft);
    this.ft.length = 0;
    let q = this.q;
    if (avg > 20) { q = Math.max(.5, q * .85); this.slow = 0; }
    else if (avg < 12 || (avg < 17.6 && worst < 21)) { if (++this.slow >= 4) { q = Math.min(1, q * 1.06); this.slow = 0; } }
    else this.slow = 0;
    if (Math.abs(q - this.q) > .005) { this.q = q; this.resize(); }
  }

  // vai šim kadram jāzīmē (dažas ainas pietiek ar 30 fps)
  // atgriež laiku, kas jāsimulē šajā kadrā (0 = šo kadru izlaist)
  due(dt) {
    if (this.fps >= 60) return dt;
    this.acc += dt;
    if (this.mustDraw) { const d = Math.min(this.acc, .1); this.acc = 0; return d || dt; }
    if (this.acc + .004 < 1 / this.fps) return 0;
    const d = this.acc; this.acc = 0; return Math.min(d, .1);
  }

  render(time, dt) {
    if (!this.ready) return;
    const gl = this.gl;
    const t0 = PERF ? performance.now() : 0;
    if (this.simulate) this.simulate(time, dt);
    this.mustDraw = false;
    gl.useProgram(this.prog);
    gl.uniform2f(this.U("uRes"), this.canvas.width, this.canvas.height);
    gl.uniform1f(this.U("uTime"), time);
    gl.uniform1f(this.U("uSeed"), SEED % 9973);
    gl.uniform2f(this.U("uMouse"), this.mouse[0] * this.canvas.width, (1 - this.mouse[1]) * this.canvas.height);
    gl.uniform1fv(this.U("uRnd"), this.rnd);
    this.textures.forEach((t, i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, typeof t.tex === "function" ? t.tex() : t.tex); gl.uniform1i(this.U("uTex" + i), i); });
    this.uniFn(this, time, dt);
    const W = this.canvas.width, H = this.canvas.height;
    gl.viewport(0, 0, W, H);
    // zīmē tikai redzamo joslu (+ rezerve ritināšanai): blakus sekcija, kas ielīdusi ekrānā ar
    // organisko malu, maksā tikai par savu redzamo daļu, nevis par visu pilnekrāna kadru
    const r = this.canvas.getBoundingClientRect(), pad = innerHeight * .12;
    const top = Math.max(0, -r.top - pad), bot = Math.min(r.height, innerHeight - r.top + pad);
    const k = H / Math.max(1, r.height), y0 = Math.max(0, Math.floor((r.height - bot) * k)), y1 = Math.min(H, Math.ceil((r.height - top) * k));
    this.drawn = Math.max(0, y1 - y0) / H;
    if (y1 > y0) {
      const part = y0 > 0 || y1 < H;
      if (part) { gl.enable(gl.SCISSOR_TEST); gl.scissor(0, y0, W, y1 - y0); }
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (part) gl.disable(gl.SCISSOR_TEST);
    }
    if (PERF) { // tikai ?perf=1: 1 pikseļa nolasīšana sinhronizē GPU, lai laiks būtu īsts
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, this.px1 || (this.px1 = new Uint8Array(4)));
      this.gpuMs = this.gpuMs * .85 + (performance.now() - t0) * .15;
    }
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

// Vienreizējs zīmējums tekstūrā (statiskiem slāņiem, piem., upes gruntij)
export function renderToTexture(gl, prog, w, h, setUniforms) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
  gl.viewport(0, 0, w, h);
  gl.useProgram(prog);
  setUniforms();
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.deleteFramebuffer(fb);
  return t;
}
