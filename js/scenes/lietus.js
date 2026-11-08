// lietus: vecs logs, aiz tā sarmots rīts. Ārpusē lāses: lielās slīd, aprij mazās, atstāj sliedes.
// Iekšpusē stikls aprasojis; kursors vai pirksts noslauka sliedi, kas lēnām aizsvīst atpakaļ.
import { GLScene, loadImage } from "../glscene.js";
import { RM, rand, plink, localPoint, onActivate } from "../util.js";

function normalSprite(n = 64) {
  const c = document.createElement("canvas"); c.width = c.height = n;
  const x = c.getContext("2d", { willReadFrequently: true }), img = x.createImageData(n, n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const u = (i + .5) / n * 2 - 1, v = (j + .5) / n * 2 - 1, r = Math.hypot(u, v), o = (j * n + i) * 4;
    if (r > 1) continue;
    img.data[o] = (u * .5 + .5) * 255; img.data[o + 1] = (.5 - v * .5) * 255;
    img.data[o + 2] = 255; img.data[o + 3] = Math.min(1, (1 - r) * 8) * 255;
  }
  x.putImageData(img, 0, 0); return c;
}

export function createLietus(section) {
  const canvas = section.querySelector("canvas");
  const sprite = normalSprite();
  const dmap = document.createElement("canvas"), dctx = dmap.getContext("2d", { willReadFrequently: true });
  const fmap = document.createElement("canvas"), fctx = fmap.getContext("2d", { willReadFrequently: true });

  let w = 1, h = 1, drops = [], spawnT = 0, lastWipe = null;

  function setup() {
    const r = canvas.getBoundingClientRect(); w = r.width; h = r.height;
    dmap.width = 512; dmap.height = Math.round(512 * h / w);
    fmap.width = 256; fmap.height = Math.round(256 * h / w);
    fctx.fillStyle = "#fff"; fctx.fillRect(0, 0, fmap.width, fmap.height);
    drops = [];
    const N = Math.min(320, Math.round(w * h / 3600));
    for (let i = 0; i < N; i++) add(Math.random() * w, Math.random() * h, rand(1.6, 4.6));
    for (let i = 0; i < 8; i++) add(Math.random() * w, Math.random() * h * .8, rand(6, 8));
    // kāds jau ir noslaucījis stiklu: vienas plaukstas sliede, kas lēnām aizsvīst
    lastWipe = null;
    const y0 = rand(.35, .5), x0 = rand(.25, .4);
    for (let i = 0; i <= 24; i++) { const t = i / 24; wipe({ x: x0 + t * .4, y: y0 + Math.sin(t * 3.1) * .06 - t * .05 }); }
    lastWipe = null;
  }
  function add(x, y, r) { drops.push({ x, y, r, vy: 0, stall: rand(0, 1), trail: 0 }); }

  const scene = new GLScene({
    section, canvas, frag: "lietus",
    async textures(s) {
      const [a, b] = await Promise.all([loadImage("foto/sarma-rits.webp"), loadImage("foto/sarma-rits-izpludis.webp")]);
      s.bgAspect = a.naturalWidth / a.naturalHeight;
      setup(); paint();
      return [a, b, { tex: s.texture(dmap, { dynamic: true }) }, { tex: s.texture(fmap, { dynamic: true }) }];
    },
    uniforms(s) { s.gl.uniform1f(s.U("uBgAspect"), s.bgAspect); }
  });

  function physics(dt) {
    if (!RM) { spawnT -= dt; if (spawnT <= 0) { spawnT = rand(.03, .1); if (drops.length < 420) { const q = Math.random(); add(Math.random() * w, Math.random() * h * (q < .03 ? .5 : 1), q < .03 ? rand(8, 10.5) : q < .1 ? rand(5, 7.4) : rand(1.4, 4.4)); } } }
    for (const d of drops) {
      if (d.r < 7.6 || d.dead) continue;
      d.stall -= dt;
      if (d.stall > 0) { d.vy *= .8; continue; }
      d.vy = Math.min(d.vy + d.r * 22 * dt, 50 + d.r * 18);
      if (Math.random() < dt * .6) d.stall = rand(.05, .5);
      d.y += d.vy * dt; d.x += rand(-.4, .4); d.trail += d.vy * dt;
      if (d.trail > d.r * 1.4 && d.r > 8) { d.trail = 0; d.r -= .08; drops.push({ x: d.x + rand(-1.5, 1.5), y: d.y - d.r * 1.15, r: rand(1.3, 2.6), vy: 0, stall: 1, trail: 0 }); }
      for (const o of drops) {
        if (o === d || o.dead || o.r > d.r) continue;
        const dx = o.x - d.x, dy = o.y - d.y, rr = d.r + o.r * .6;
        if (dx * dx + dy * dy < rr * rr) { o.dead = true; d.r = Math.min(19, Math.sqrt(d.r * d.r + o.r * o.r * .5)); }
      }
    }
    drops = drops.filter(d => !d.dead && d.y - d.r < h + 4);
    // aprasojums atgriežas ~12 s laikā
    fctx.globalCompositeOperation = "source-over";
    fctx.fillStyle = `rgba(255,255,255,${Math.min(1, dt * .09)})`;
    fctx.fillRect(0, 0, fmap.width, fmap.height);
  }
  function paint() {
    const sx = dmap.width / w;
    dctx.fillStyle = "#000"; dctx.fillRect(0, 0, dmap.width, dmap.height);
    for (const d of drops) {
      const st = 1 + Math.min(.35, d.vy * .004), r = d.r * sx;
      dctx.drawImage(sprite, d.x * sx - r, d.y * sx - r * st, r * 2, r * 2 * st);
    }
  }
  function wipe(p) {
    const fx = p.x * fmap.width, fy = p.y * fmap.height, R = fmap.width * .045;
    const from = lastWipe || [fx, fy], n = Math.max(1, Math.ceil(Math.hypot(fx - from[0], fy - from[1]) / (R * .3)));
    fctx.globalCompositeOperation = "destination-out";
    for (let i = 1; i <= n; i++) {
      const x = from[0] + (fx - from[0]) * i / n, y = from[1] + (fy - from[1]) * i / n;
      const g = fctx.createRadialGradient(x, y, R * .3, x, y, R);
      g.addColorStop(0, "rgba(0,0,0,.55)"); g.addColorStop(1, "rgba(0,0,0,0)");
      fctx.fillStyle = g; fctx.beginPath(); fctx.arc(x, y, R, 0, 7); fctx.fill();
    }
    lastWipe = [fx, fy];
  }

  canvas.addEventListener("pointermove", e => wipe(localPoint(canvas, e)));
  canvas.addEventListener("pointerleave", () => { lastWipe = null; });
  canvas.addEventListener("pointerdown", e => { const p = localPoint(canvas, e); add(p.x * w, p.y * h, rand(10, 13)); plink("stikls", .08); });
  onActivate(canvas, () => { add(rand(.2, .8) * w, rand(.1, .4) * h, 11); for (let i = 0; i < 8; i++) wipe({ x: .3 + i * .05, y: .5 + Math.sin(i) * .05 }); lastWipe = null; });
  window.addEventListener("resize", () => { if (scene.ready) setup(); });

  return {
    el: section, scene,
    step(time, dt) {
      if (scene.ready) {
        physics(dt || 0); paint();
        scene.updateTexture(2, dmap); scene.updateTexture(3, fmap);
      }
      scene.render(time, dt);
    }
  };
}
