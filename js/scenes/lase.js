// lāse: sekla upe ar tējas brūnu ūdeni. Viļņu vienādojums uz GPU; gaisma lūzt un zīmē kaustikas uz grunts.
// Pa virsmu slīd ūdensmērītājs; reti garām aizpeld zivtiņas ēna, kas no klikšķa aizbēg.
import { SHADERS } from "../shaders.js";
import { GLScene, PingPong, renderToTexture, BUDGET } from "../glscene.js";
import { sandWords } from "./still.js";
import { RM, rand, jitter, plink, localPoint, onActivate, SEED } from "../util.js";

export function createLase(section) {
  const canvas = section.querySelector("canvas");
  let pp, simProg, bedProg, bedTex = null, bedAsp = 0, imps = [], next = 1, down = false, lastP = null, t = 0;
  const strider = { x: .2, y: .1, a: 0, vx: 0, vy: 0, next: 2 };
  const fish = { on: false, x: 0, y: 0, dir: 0, speed: .12, vis: 0, next: jitter(14, .4) };

  const scene = new GLScene({
    section, canvas, frag: "lase",
    async textures(s) {
      const r = canvas.getBoundingClientRect();
      const common = SHADERS.common, sim = SHADERS.lase_sim;
      simProg = s.compile("#version 300 es\n" + common + "\n" + sim);
      bedProg = s.compile("#version 300 es\n" + common + "\n" + SHADERS.lase_bed);
      const W = 256; pp = new PingPong(s.gl, W, Math.max(64, Math.round(W * r.height / r.width)));
      const words = await sandWords(r.width, r.height);
      const wordsTex = s.texture(words);
      const bed = bake(s, wordsTex, r.width, r.height);
      return [{ tex: wordsTex }, { tex: () => pp.read }, { tex: () => bedTex }];
    },
    uniforms(s) {
      const gl = s.gl;
      gl.uniform2f(s.U("uStrider"), strider.x, strider.y);
      gl.uniform1f(s.U("uStriderA"), strider.a);
      gl.uniform4f(s.U("uFish"), fish.x, fish.y, fish.dir, fish.vis);
    }
  });
  const asp = () => canvas.width / Math.max(1, canvas.height);

  // grunts (oļi, smiltis, vārdi, dziļums) ir statiska: to uzzīmē vienreiz, nevis katrā kadrā
  function bake(s, wordsTex, cw, ch) {
    const gl = s.gl, fit = Math.min(1, Math.sqrt(BUDGET / (cw * ch)));
    const w = Math.round(cw * fit), h = Math.round(ch * fit);
    if (bedTex) gl.deleteTexture(bedTex);
    bedTex = renderToTexture(gl, bedProg, w, h, () => {
      const U = n => gl.getUniformLocation(bedProg, n);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, wordsTex); gl.uniform1i(U("uTex0"), 0);
      gl.uniform2f(U("uRes"), w, h); gl.uniform1f(U("uSeed"), SEED % 9973); gl.uniform1f(U("uTime"), 0);
      gl.uniform1fv(U("uRnd"), s.rnd);
    });
    bedAsp = cw / ch;
    return bedTex;
  }

  function impulse(x, y, r, a) { if (imps.length < 8) imps.push([x, y, r, a]); }
  function drop(x, y, big = true) {
    impulse(x, y, big ? 3.2 : 1.6, big ? 2.6 : .6);
    if (big) plink("udens", .2);
    // zivtiņa aizbēg, ja lāse krīt tuvu
    if (fish.on) {
      const A = asp(), fx = (fish.x / A) + .5, fy = .5 - fish.y;
      if (Math.hypot((fx - x) * A, fy - y) < .25) { fish.speed = .9; fish.dir = Math.atan2(-(fy - y), (fx - x) * A) * -1; }
    }
  }

  scene.simulate = (time, dt) => {
    if (!pp || !dt) return;
    const gl = scene.gl;
    t += dt;
    if (!RM) { next -= dt; if (next <= 0) { drop(rand(.08, .92), rand(.1, .9)); next = rand(.9, 2.4); } }
    // ūdensmērītājs: īsi grūdieni, starp tiem slīd un palēninās
    const A = asp();
    strider.next -= dt;
    if (strider.next <= 0 && !RM) {
      const ang = rand(0, Math.PI * 2), sp = rand(.25, .5);
      strider.vx = Math.cos(ang) * sp; strider.vy = Math.sin(ang) * sp; strider.a = -ang + Math.PI / 2;
      strider.next = rand(1.2, 3.5);
      impulse(strider.x / A + .5, .5 - strider.y, 1.2, .25);
    }
    strider.x += strider.vx * dt; strider.y += strider.vy * dt;
    strider.vx *= Math.pow(.15, dt); strider.vy *= Math.pow(.15, dt);
    const lim = .5 * A - .1;
    if (Math.abs(strider.x) > lim) { strider.x = Math.sign(strider.x) * lim; strider.vx *= -1; }
    if (Math.abs(strider.y) > .4) { strider.y = Math.sign(strider.y) * .4; strider.vy *= -1; }
    // zivtiņa: reti, smalki
    if (!fish.on && !RM) { fish.next -= dt; if (fish.next <= 0) { fish.on = true; fish.x = -.5 * A - .1; fish.y = rand(-.3, .3); fish.dir = rand(-.4, .4); fish.speed = .12; } }
    if (fish.on) {
      fish.dir += Math.sin(t * 1.3) * .2 * dt;
      fish.x += Math.cos(fish.dir) * fish.speed * dt; fish.y += Math.sin(fish.dir) * fish.speed * dt;
      fish.speed += (.12 - fish.speed) * dt * .8;
      fish.vis = Math.min(1, fish.vis + dt * .5);
      if (Math.abs(fish.x) > .5 * A + .15 || Math.abs(fish.y) > .65) { fish.on = false; fish.vis = 0; fish.next = jitter(28, .4); }
    }
    const steps = Math.min(4, Math.max(1, Math.round(dt * 120)));
    for (let k = 0; k < steps; k++) {
      const list = k === 0 ? imps : [];
      const data = new Float32Array(32); list.forEach((m, i) => data.set(m, i * 4));
      pp.step(simProg, () => {
        const U = n => gl.getUniformLocation(simProg, n);
        gl.uniform1i(U("uTex0"), 0);
        gl.uniform2f(U("uRes"), pp.w, pp.h);
        gl.uniform1f(U("uSeed"), 3);
        gl.uniform4fv(U("uImp"), data);
        gl.uniform1i(U("uNI"), list.length);
        gl.uniform1f(U("uDamp"), .986);
      });
    }
    imps = [];
  };

  scene.onResize = async () => {
    const r = canvas.getBoundingClientRect(), a = r.width / r.height;
    if (!bedProg || Math.abs(a - bedAsp) / a < .03) return;
    const words = await sandWords(r.width, r.height);
    if (scene.ready) { scene.updateTexture(0, words); bake(scene, scene.textures[0].tex, r.width, r.height); }
  };

  canvas.addEventListener("pointerdown", e => { down = true; const p = localPoint(canvas, e); lastP = p; drop(p.x, 1 - p.y); });
  window.addEventListener("pointerup", () => { down = false; });
  canvas.addEventListener("pointermove", e => {
    const p = localPoint(canvas, e);
    if (lastP && Math.hypot(p.x - lastP.x, p.y - lastP.y) < .006) return;
    lastP = p;
    impulse(p.x, 1 - p.y, down ? 2 : 1.4, down ? .9 : .3);
  });
  canvas.addEventListener("pointerleave", () => { lastP = null; });
  onActivate(canvas, () => drop(rand(.2, .8), rand(.2, .8)));

  return { el: section, scene, step(time, dt) { scene.render(time, dt); } };
}
