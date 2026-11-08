// piliens: rasas punkts. Silts, mitrs gaiss (labā augša) satiek vēsumu (kreisā apakša).
// Uz aukstajiem šīfera burtiem kondensējas lāses, aug, saplūst, slīd, pil peļķē; siltajā pusē iztvaiko.
import { GLScene, loadImage } from "../glscene.js";
import { RM, rand, plink, localPoint, clamp } from "../util.js";
import { wordMask } from "./still.js";

const DEW = .555; // rasas punkta līnija diagonālē (sakrīt ar šeideri)

// normāļu karte no augstuma lauka: rg = virsmas normāle, b = pārklājums.
// Koordinātas vienībās: x no -1 līdz 1 (platums), y no 0 (augša) uz leju; augstums tajās pašās vienībās.
function normalSprite(w, h, unitsH, height) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const x = c.getContext("2d"), img = x.createImageData(w, h);
  const H = new Float32Array(w * h), du = 2 / w, dv = unitsH / h;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) H[j * w + i] = height(-1 + (i + .5) * du, (j + .5) * dv);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const o = (j * w + i) * 4, v = H[j * w + i];
    if (v <= 0) { img.data[o + 3] = 0; continue; }
    const hx = (H[j * w + Math.min(w - 1, i + 1)] - H[j * w + Math.max(0, i - 1)]) / (2 * du);
    const hy = (H[Math.min(h - 1, j + 1) * w + i] - H[Math.max(0, j - 1) * w + i]) / (2 * dv);
    // ūdens lāse ir saplacināta pret virsmu (kontakta leņķis), tāpēc slīpumu mīkstina
    const nx = -hx * .8, ny = hy * .8, k = 1 / Math.hypot(nx, ny, 1);
    img.data[o] = (nx * k * .5 + .5) * 255; img.data[o + 1] = (ny * k * .5 + .5) * 255;
    img.data[o + 2] = 255; img.data[o + 3] = Math.min(1, v * 6) * 255;
  }
  x.putImageData(img, 0, 0); return c;
}
// rotācijas ķermenis: šķērsgriezuma augstums = sqrt(pusplatums² - x²)
const body = (x, hw) => Math.sqrt(Math.max(0, hw * hw - x * x));
// lāsīte: aplis, smagums to mazliet pavelk uz leju
const BEAD = normalSprite(64, 64, 2, (x, y) => { const yy = y - 1 - .06 * (1 - x * x); return body(x, Math.sqrt(Math.max(0, 1 - yy * yy))); });
// karājoša / krītoša lāse: apaļš dibens (rādiuss 1) un gluda smaile, kas pieskaras aplim bez šuves
const TIP = 2.4, TEAR_H = TIP + 1;
const TEAR = normalSprite(64, 112, TEAR_H, (x, y) => {
  let hw;
  if (y >= TIP) hw = Math.sqrt(Math.max(0, 1 - (y - TIP) ** 2));
  else { const s = y / TIP; hw = Math.pow(Math.sin(s * Math.PI / 2), 1.7); }
  return body(x, hw);
});

export function createPiliens(section) {
  const canvas = section.querySelector("canvas");
  const air = document.createElement("canvas");
  air.className = "air"; air.setAttribute("aria-hidden", "true");
  section.insertBefore(air, canvas.nextSibling);
  const actx = air.getContext("2d");
  
  const dmap = document.createElement("canvas"), dctx = dmap.getContext("2d");
  let w = 1, h = 1, S = 1, mask = null, MW = 0, MH = 0, mk = 1, inkPts = [], poolY = 0;
  let beads = [], drops = [], vapor = [], rips = [], quiet = 0, dpr = 1;

  // klimata uzraksti
  const lab = html => { const p = document.createElement("p"); p.className = "climate"; p.innerHTML = html; section.appendChild(p); return p; };
  const warm = lab("<b>+22 °C</b>silts, mitrs gaiss<br>mitrums 53 %"); warm.classList.add("warm");
  const cool = lab("<b>+4 °C</b>vēsums"); cool.classList.add("cool");
  const dewL = lab("rasas punkts, +12 °C"); dewL.classList.add("dew");

  const cold = (x, y) => clamp((DEW - (x / w + 1 - y / h) / 2) / DEW * 3, 0, 1);
  const ink = (x, y) => { if (!mask) return false; const mx = Math.round(x * mk), my = Math.round(y * mk); return mx >= 0 && my >= 0 && mx < MW && my < MH && mask[my * MW + mx] > 140; };

  const scene = new GLScene({
    section, canvas, frag: "piliens", maxScale: 1.25,
    async textures(s) {
      const r = canvas.getBoundingClientRect();
      const [a, b] = await Promise.all([loadImage("foto/sarma-rits.jpg"), loadImage("foto/sarma-rits-izpludis.jpg")]);
      s.bgAspect = a.naturalWidth / a.naturalHeight;
      const m = await wordMask(r.width, r.height);
      setup(m);
      return [m, a, b, dmap];
    },
    uniforms(s) {
      const gl = s.gl;
      gl.uniform1f(s.U("uBgAspect"), s.bgAspect);
      const d = new Float32Array(24);
      rips.slice(-6).forEach((q, i) => d.set([q.x / w, q.age, q.a, 0], i * 4));
      gl.uniform4fv(s.U("uRip"), d);
    }
  });

  function setup(m) {
    const r = canvas.getBoundingClientRect(); w = r.width; h = r.height;
    S = (w / 1200) * Math.max(1, .8 / (w / 1200));
    MW = m.width; MH = m.height; mk = MW / w;
    const data = m.getContext("2d").getImageData(0, 0, MW, MH).data;
    mask = new Uint8Array(MW * MH); inkPts = [];
    for (let i = 0; i < MW * MH; i++) { mask[i] = data[i * 4 + 3]; if (mask[i] > 220 && i % 7 === 0) inkPts.push([(i % MW) / mk, Math.floor(i / MW) / mk]); }
    dmap.width = 1024; dmap.height = Math.round(1024 * h / w);
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    air.width = Math.round(w * dpr); air.height = Math.round(h * dpr);
    poolY = h * .83;
    beads = []; drops = [];
    for (let k = 0; k < 1600 && beads.length < 170; k++) {
      const p = inkPts[(Math.random() * inkPts.length) | 0];
      if (Math.random() < cold(p[0], p[1]) * 1.6) addBead(p[0], p[1], rand(.9, RM ? 3.4 : 2.8) * S);
    }
    // uzraksti
    cool.style.bottom = (h - poolY) + 18 + "px";
    const ang = Math.atan2(h, w) * 180 / Math.PI, lx = w * .2, ly = h * (lx / w + 1 - 2 * DEW);
    Object.assign(dewL.style, { left: lx + "px", top: ly + "px", transform: `rotate(${ang}deg) translate(12px,-26px)` });
  }

  function addBead(x, y, r) {
    for (const b of beads) { const dx = b.x - x, dy = b.y - y; if (dx * dx + dy * dy < (b.r + r + 1) ** 2) { b.r = Math.sqrt(b.r * b.r + r * r); return; } }
    if (beads.length < 260) beads.push({ x, y, r, vy: 0, slide: false, stall: 0 });
  }
  function hang(x, y, r) {
    for (const d of drops) if (d.phase === 0 && Math.abs(d.x - x) < 10 * S) { d.rMax = Math.min(16 * S, Math.hypot(d.rMax, r)); return; }
    drops.push({ x, edge: y, r: Math.max(2 * S, r * .8), rMax: Math.max(7 * S, r * 1.35) + rand(0, 3) * S, phase: 0, t: 0, y, vy: 0, grow: rand(1.2, 2.2) });
    quiet = 0;
  }
  function addVapor(x, y, burst) {
    if (vapor.length > 340) return;
    const sp = rand(.6, 1.2);
    vapor.push({ x, y, vx: -62 * sp * S + (burst ? rand(-40, 40) : 0), vy: 34 * sp * S + (burst ? rand(-40, 40) : 0), r: rand(1.6, 3.4) * S, life: 0, mist: false, seed: rand(0, 99) });
  }

  function physics(dt, t) {
    quiet += dt;
    if (!RM) for (let i = 0; i < 2; i++) if (Math.random() < dt * 22) addVapor(rand(.42, 1.05) * w, rand(-.03, .45) * h);
    if (inkPts.length && Math.random() < dt * 30) { const p = inkPts[(Math.random() * inkPts.length) | 0]; if (Math.random() < cold(p[0], p[1]) * 1.8) addBead(p[0], p[1], rand(.9, 1.7) * S); }
    for (let i = vapor.length - 1; i >= 0; i--) {
      const v = vapor[i]; v.life += dt;
      const n = Math.sin(v.x * .01 + v.seed + t * .7) * 30 * S;
      v.x += (v.vx + n * .5) * dt; v.y += (v.vy + n) * dt;
      if (!v.mist && (v.x / w + 1 - v.y / h) / 2 < DEW) { v.mist = true; v.r = rand(.8, 1.5) * S; }
      if (v.mist) { v.vx *= Math.pow(.6, dt); v.vy = v.vy * Math.pow(.6, dt) + 14 * S * dt; if (ink(v.x, v.y)) { addBead(v.x, v.y, v.r * .9); vapor.splice(i, 1); continue; } }
      if (v.life > 14 || v.x < -20 || v.y > poolY) vapor.splice(i, 1);
    }
    for (let i = beads.length - 1; i >= 0; i--) {
      const b = beads[i], c = cold(b.x, b.y);
      if (c <= 0) { b.r -= dt * .6 * S; if (b.r < .4 * S) { beads.splice(i, 1); continue; } }
      else if (b.r < 3.8 * S) b.r += dt * .09 * c * S;
      if (!b.slide && b.r > 4.4 * S && !RM) b.slide = true;
      if (b.slide) {
        if (b.stall > 0) b.stall -= dt;
        else { b.vy = Math.min(b.vy + 120 * S * dt, (30 + b.r / S * 9) * S); b.y += b.vy * dt; b.x += rand(-.25, .25) * S; if (Math.random() < dt * .8) { b.stall = rand(.1, .5); b.vy = 0; } }
        if (!ink(b.x, b.y + b.r * .5 + 1.5 * S)) { hang(b.x, b.y + b.r * .3, b.r); beads.splice(i, 1); continue; }
      }
    }
    for (let i = 0; i < beads.length; i++) for (let j = i + 1; j < beads.length; j++) {
      const a = beads[i], b = beads[j], dx = a.x - b.x, dy = a.y - b.y, rr = (a.r + b.r) * .92;
      if (dx * dx + dy * dy < rr * rr) {
        const big = a.r >= b.r ? a : b, small = big === a ? b : a;
        big.r = Math.hypot(a.r, b.r); if (small.slide) { big.slide = true; big.vy = Math.max(big.vy, small.vy); }
        beads.splice(beads.indexOf(small), 1); j = i;
      }
    }
    if (!RM && quiet > 4 && beads.length) {
      let best = null; for (const b of beads) if (!b.slide && cold(b.x, b.y) > 0 && (!best || b.r > best.r)) best = b;
      if (best && best.r > 1.5 * S) { best.r = Math.max(best.r, 4.6 * S); quiet = 2; }
    }
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i]; d.t += dt;
      if (d.phase === 0) { d.r += (d.rMax - d.r) * Math.min(1, dt / d.grow * 2.2); if (d.r > d.rMax * .96 && !RM) { d.phase = 1; d.y = d.edge + d.r * 1.25; d.vy = 30; } }
      else {
        d.vy += 1600 * S * dt; d.y += d.vy * dt;
        if (d.y - d.edge > d.r * 2 + 6 && ink(d.x, d.y + d.r)) { addBead(d.x, d.y, d.r * .85); drops.splice(i, 1); continue; }
        if (d.y + d.r > poolY) { rips.push({ x: d.x, age: 0, a: Math.min(1, d.r / (10 * S)) }); plink("pelke", .2); drops.splice(i, 1); }
      }
    }
    for (const r of rips) r.age += dt;
    rips = rips.filter(r => r.age < 3);
  }

  function paint() {
    const k = dmap.width / w;
    dctx.globalCompositeOperation = "source-over";
    dctx.fillStyle = "#000"; dctx.fillRect(0, 0, dmap.width, dmap.height);
    for (const b of beads) { const r = b.r * k; dctx.drawImage(BEAD, b.x * k - r, b.y * k - r, 2 * r, 2 * r); }
    for (const d of drops) {
      // piliena forma: viens gluds profils (apaļš dibens, smaile augšā), izstiepjas krītot
      const r = d.r * k, stretch = d.phase ? Math.min(.55, d.vy / (1600 * S)) : 0;
      const cy = (d.phase ? d.y : d.edge + d.r * 1.25) * k;
      const wdt = 2 * r * (1 - stretch * .12), hgt = r * TEAR_H * (1 + stretch * .5);
      dctx.drawImage(TEAR, d.x * k - wdt / 2, cy + r - hgt, wdt, hgt);
    }
  }
  function drawAir() {
    actx.setTransform(dpr, 0, 0, dpr, 0, 0);
    actx.clearRect(0, 0, w, h);
    for (const v of vapor) {
      const fade = Math.min(1, v.life * 2) * Math.min(1, (14 - v.life) / 2);
      actx.globalAlpha = (v.mist ? .55 : .14) * fade;
      actx.fillStyle = v.mist ? "rgba(255,255,255,.9)" : "#FFF0DA";
      actx.beginPath(); actx.arc(v.x, v.y, v.mist ? v.r : v.r * 2.2, 0, 7); actx.fill();
    }
    actx.globalAlpha = 1;
  }

  // klikšķis: silta, mitra elpa
  section.addEventListener("pointerdown", e => {
    const p = localPoint(canvas, e), x = p.x * w, y = p.y * h;
    for (let i = 0; i < 40; i++) addVapor(x + rand(-20, 20), y + rand(-20, 20), true);
    if (ink(x, y)) for (let i = 0; i < 6; i++) addBead(x + rand(-10, 10) * S, y + rand(-10, 10) * S, rand(1, 2.2) * S);
  });
  window.addEventListener("resize", async () => { if (!scene.ready) return; const m = await wordMask(canvas.getBoundingClientRect().width, canvas.getBoundingClientRect().height); setup(m); scene.updateTexture(0, m); });

  return {
    el: section, scene,
    step(time, dt) {
      if (scene.ready) { physics(dt || 0, time); paint(); scene.updateTexture(3, dmap); drawAir(); }
      scene.render(time, dt);
    }
  };
}
