// tinte: glāze ūdens pret logu. Tintes lāse iekrīt, veido virpuļgredzenu, kas sadalās mazākos.
// Fizika: blīvuma lauks (GPU), ko nes punktvirpuļu pāri (CPU) un rotora troksnis.
import { SHADERS } from "../shaders.js";
import { GLScene, PingPong, loadImage } from "../glscene.js";
import { RM, rand, jitter, plink, localPoint, onActivate, clamp } from "../util.js";

export function createTinte(section) {
  const canvas = section.querySelector("canvas");
  let pp, simProg, asp = .77, vort = [], drops = [], next = 1.2, started = false, inject = null;
  const SW = 176;

  function glassGeom() {
    const r = canvas.getBoundingClientRect();
    const a = r.width / r.height, mobile = a < .9;
    const tableY = mobile ? -.22 : -.20, gw = mobile ? .36 * a : .23, gx = mobile ? .04 * a : .10 * a;
    const gBot = tableY - .11, waterY = mobile ? .26 : .29;
    return { a, gw, gx, gBot, waterY, asp: (2 * gw) / (waterY - gBot) };
  }

  const scene = new GLScene({
    section, canvas, frag: "tinte",
    async textures(s) {
      const bg = await loadImage("foto/mezs-izpludis2.webp");
      s.bgAspect = bg.naturalWidth / bg.naturalHeight;
      const common = SHADERS.common, sim = SHADERS.tinte_sim;
      simProg = s.compile("#version 300 es\n" + common + "\n" + sim);
      asp = glassGeom().asp;
      pp = new PingPong(s.gl, SW, Math.round(SW / asp));
      return [bg, { tex: () => pp.read }];
    },
    uniforms(s) {
      const gl = s.gl;
      gl.uniform1f(s.U("uBgAspect"), s.bgAspect);
      let amount = 0; for (const d of drops) amount += Math.exp(-d.age / 12);
      gl.uniform1f(s.U("uInkAmount"), clamp(amount, 0, 1.4));
    }
  });

  // tintes krāsa nāk no sēklas šeiderī (indigo, mellenes, ozolu riekstu tinte)
  function drop(x) {
    x = clamp(x ?? rand(.3, .7), .12, .88);
    inject = { x, y: .995, t: 0 };
    drops.push({ age: 0 });
    plink("udens", .14);
  }

  function spawnRing(x, y) {
    const R = .045, G = .07 * rand(.85, 1.15), core = .018;
    const id = Math.random();
    vort.push({ x: x - R, y, G: -G, core, age: 0, gen: 0, id });
    vort.push({ x: x + R, y, G: G, core, age: 0, gen: 0, id });
  }

  scene.simulate = (time, dt) => {
    if (!pp || !dt) return;
    const gl = scene.gl;
    // jauna lāse ik pēc 8–12 s; pirmā, kad sadaļa parādās
    if (!started) { started = true; drop(.5 + rand(-.08, .08)); next = jitter(10, .2); }
    if (!RM) { next -= dt; if (next <= 0) { drop(); next = jitter(10, .2); } }
    for (const d of drops) d.age += dt;
    drops = drops.filter(d => d.age < 40);

    // injekcija: lāse ieiet ūdenī un bremzējas
    let inj = [0, 0, .02, 0];
    if (inject) {
      inject.t += dt;
      const k = inject.t / .35;
      inject.y = .995 - .17 * (1 - Math.pow(1 - Math.min(k, 1), 2));
      inj = [inject.x, inject.y, .024, 18 * dt];
      if (k >= 1) { spawnRing(inject.x, inject.y - .01); inject = null; }
    }

    // virpuļu kustība: katrs virpulis pārvietojas ar pārējo radīto ātrumu
    const A = asp;
    for (const v of vort) {
      let vx = 0, vy = 0;
      for (const o of vort) {
        if (o === v) continue;
        const rx = (v.x - o.x) * A, ry = v.y - o.y;
        const r2 = rx * rx + ry * ry + o.core * o.core;
        vx += o.G * -ry / (6.2832 * r2) / A; vy += o.G * rx / (6.2832 * r2);
      }
      // gredzens lēnām izplešas un palēninās
      const side = Math.sign(v.G);
      v.x += (vx + side * .004) * dt; v.y += vy * dt;
      v.age += dt;
      v.G *= Math.exp(-dt * .09);
      v.core = Math.min(.05, v.core + dt * .002);
      // sadalīšanās: pirmās paaudzes virpulis pēc ~3 s sadalās divos, otrās pēc ~5 s vēlreiz
      const splitAt = v.gen === 0 ? 2.6 + (v.id * 7 % 1) * 1.2 : 5;
      if (v.gen < 2 && v.age > splitAt && vort.length < 22) {
        v.gen++; v.age = 0; v.G *= .5;
        const d = .028 / (v.gen);
        vort.push({ x: v.x + side * d * .6, y: v.y - d, G: v.G * rand(.8, 1.1), core: v.core * .8, age: 0, gen: v.gen, id: Math.random() });
        v.x -= side * d * .3;
      }
    }
    vort = vort.filter(v => Math.abs(v.G) > .004 && v.y > -.05);
    if (vort.length > 24) vort = vort.slice(vort.length - 24);

    const data = new Float32Array(96);
    vort.forEach((v, i) => { data.set([v.x, v.y, v.G, v.core], i * 4); });
    // divi apakšsoļi stabilitātei
    const sub = dt > 1 / 45 ? 2 : 1, sdt = dt / sub;
    for (let k = 0; k < sub; k++) {
      pp.step(simProg, () => {
        const U = n => gl.getUniformLocation(simProg, n);
        gl.uniform1i(U("uTex0"), 0);
        gl.uniform2f(U("uRes"), pp.w, pp.h);
        gl.uniform1f(U("uTime"), time);
        gl.uniform1f(U("uSeed"), 7);
        gl.uniform4fv(U("uVort"), data);
        gl.uniform1i(U("uNV"), vort.length);
        gl.uniform4f(U("uInject"), inj[0], inj[1], inj[2], k === 0 ? inj[3] : 0);
        gl.uniform1f(U("uDt"), sdt);
        gl.uniform1f(U("uAsp"), A);
        gl.uniform1f(U("uDecay"), Math.exp(-sdt / 16));
      });
    }
  };

  function pointToX(e) {
    const p = localPoint(canvas, e), g = glassGeom();
    const px = (p.x - .5) * g.a;
    return ((px - g.gx) / g.gw) * .5 + .5;
  }
  canvas.addEventListener("pointerdown", e => drop(pointToX(e)));
  onActivate(canvas, () => drop());

  return { el: section, scene, step(time, dt) { scene.render(time, dt); } };
}
