// sēne: Daiņa foto ar dzeltenoranžu zvīņbeku rudens mežā. Uz cepurītes sēž viens piliens.
// Kursors (vai pirksts) virs sēnes atnes miglu, kas kondensējas uz piliena. Piliens aug,
// kļūst smagāks un sāk drebēt. Kad tas ir pietiekami liels, tas noripo pa cepurīti līdz malai,
// brīdi karājas, nokrīt uz skaidām ar sīkām šļakatām, un cepurītes virsotnē sāk augt jauns piliens.
// Ja neviens neko nedara, piliens aug pats, ļoti lēni. Klikšķis vai pieskāriens to noliek uzreiz.
import { GLScene, loadImage } from "../glscene.js";
import { RM, SEED, rng, plink, localPoint, clamp, lerp } from "../util.js";
import { t } from "../i18n.js";

// cepurītes augšējā kontūra (no foto, oriģināla normalizētās koordinātēs u, v; v no augšas) + mala, no kuras piliens nokrīt
const OUTLINE = [[.0471,.4826],[.0672,.4629],[.0874,.4458],[.1076,.4325],[.1277,.4227],[.1479,.4153],[.1681,.4094],[.1882,.4047],[.2084,.4007],[.2286,.3972],[.2487,.3938],[.2689,.3901],[.2891,.3864],[.3092,.3832],[.3294,.381],[.3496,.3801],[.3697,.38],[.3899,.3802],[.4101,.3803],[.4303,.3803],[.4504,.3804],[.4706,.381],[.4908,.382],[.5109,.3828],[.5311,.3834],[.5513,.3841],[.5714,.3854],[.5916,.3876],[.6118,.3906],[.6319,.3943],[.6521,.3985],[.6723,.4032],[.6924,.4086],[.7126,.4151],[.7328,.423],[.7529,.4325],[.7731,.4434],[.7933,.455],[.8017,.4775],[.8034,.4969]];
const GROUND = .615;    // skaidu zeme zem cepurītes malas (virs nākamās sadaļas viļņotās malas)
// attēli: dators (1920×1080, foto vidū, malas izplūdušas) un telefons (viss vertikālais foto)
const IMG = {
  plata: { src: "foto/sene-plata.webp", ox: .24323, sx: .68304, oy: -.83673, sy: 2.62857, focus: [.55, .47] },
  tuva: { src: "foto/sene-tuva.webp", ox: 0, sx: 1, oy: 0, sy: 1, focus: [.5, .5] }
};

export function createSene(section) {
  const canvas = section.querySelector("canvas");
  const R = rng(SEED ^ 0x5E4E);
  const seatF = .47 + .12 * (R() - .5);            // vieta cepurītes virsotnē (daļa no kontūras)
  const rMaxK = .062 * (.9 + .2 * R());              // maksimālais rādiuss (daļa no cepurītes platuma)
  const splashDir = Array.from({ length: 8 }, () => [R() * 2 - 1, .45 + .55 * R(), .55 + .45 * R()]);
  const glintPh = R() * 6.28;
  // skārienierīcē: cits padoms (nav kursora, ko turēt virs sēnes)
  if (!matchMedia("(hover: hover)").matches) {
    const hint = section.querySelector(".hint");
    if (hint) { hint.dataset.i18n = "sene.hintTouch"; hint.textContent = t("sene.hintTouch"); }
  }

  let img = IMG.plata, imgAsp = 16 / 9, asp = 16 / 9, tall = false;
  let pts = [], capW = .9, groundY = -.4;            // kontūra ekrāna p koordinātēs (y uz augšu, augstums = 1)
  // stāvoklis: 0 aug, 1 ripo, 2 karājas, 3 krīt, 4 pauze pēc šļakatām
  let state = 0, s = 0, sv = 0, r = 0, born = 1, tState = 0, fallP = [0, 0], fallV = 0;
  let mist = 0, mistP = [0, 0], ptr = null, wet = null, splash = [], quiet = 0;

  function toP(u, v) {
    const U = img.ox + u * img.sx, V = img.oy + v * img.sy;
    const sc = imgAsp > asp ? [asp / imgAsp, 1] : [1, imgAsp / asp];
    const o = [clamp(img.focus[0] - sc[0] / 2, 0, 1 - sc[0]), clamp(img.focus[1] - sc[1] / 2, 0, 1 - sc[1])];
    const ux = (U - o[0]) / sc[0], uy = (1 - V - o[1]) / sc[1];
    return [(ux - .5) * asp, uy - .5];
  }
  function layout() {
    const rc = canvas.getBoundingClientRect();
    asp = rc.width / Math.max(1, rc.height); tall = asp < .9;
    img = tall ? IMG.tuva : IMG.plata;
    pts = OUTLINE.map(([u, v]) => toP(u, v));
    capW = Math.hypot(pts[pts.length - 1][0] - pts[0][0], pts[pts.length - 1][1] - pts[0][1]);
    groundY = toP(OUTLINE[OUTLINE.length - 1][0], GROUND)[1];
  }
  const seat = () => (pts.length - 1) * seatF;
  // punkts un ārējā normāle uz kontūras pie parametra s (indeksi, ar interpolāciju)
  function at(sp) {
    const n = pts.length - 1, i = clamp(Math.floor(sp), 0, n - 1), f = clamp(sp - i, 0, 1);
    const a = pts[i], b = pts[i + 1];
    const tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1;
    return { x: lerp(a[0], b[0], f), y: lerp(a[1], b[1], f), nx: -ty / l, ny: tx / l, tx: tx / l, ty: ty / l };
  }
  const rMax = () => rMaxK * capW, r0 = () => .016 * capW;

  const scene = new GLScene({
    section, canvas, frag: "sene",
    async textures(sc) {
      layout();
      const im = await loadImage(img.src);
      sc.bgAspect = imgAsp = im.naturalWidth / im.naturalHeight;
      layout();
      if (!r) { s = seat(); r = rMax() * (RM ? .75 : .55); }
      return [im];
    },
    uniforms(sc) {
      const gl = sc.gl;
      gl.uniform1f(sc.U("uBgAspect"), imgAsp);
      gl.uniform2f(sc.U("uFocus"), img.focus[0], img.focus[1]);
      gl.uniform1f(sc.U("uCapW"), capW);
      const g = clamp((r - r0()) / (rMax() - r0()), 0, 1);
      if (state <= 2 && born > 0) {
        const p = at(s), wob = state === 0 ? (RM ? 0 : Math.max(0, (g - .72) / .28) * .07) : state === 2 ? .05 : 0;
        const stretch = state === 1 ? clamp(sv * .025, 0, .35) : 0;
        const hang = state === 2 ? clamp(tState / .35, 0, 1) : 0;
        gl.uniform4f(sc.U("uDrop"), p.x, p.y, r * Math.min(1, born), wob);
        gl.uniform4f(sc.U("uDropN"), lerp(p.nx, 0, hang), lerp(p.ny, -1, hang), stretch + hang * .25, g);
      } else gl.uniform4f(sc.U("uDrop"), 0, 0, 0, 0);
      gl.uniform4f(sc.U("uFall"), fallP[0], fallP[1], state === 3 ? r : 0, clamp(fallV * .12, 0, .8));
      const d = new Float32Array(32);
      splash.forEach((q, i) => d.set([q.x, q.y, q.r, clamp(1 - q.t / q.life, 0, 1)], i * 4));
      gl.uniform4fv(sc.U("uSplash"), d);
      gl.uniform4f(sc.U("uWet"), wet ? wet.x : 0, wet ? wet.y : 0, wet ? wet.t : 99, wet ? wet.k : 0);
      const sp = at(seat());
      gl.uniform4f(sc.U("uMist"), mistP[0], mistP[1], mist, glintPh);
      gl.uniform2f(sc.U("uSeat"), sp.x, sp.y);
    }
  });
  scene.onResize = () => { const k = r / Math.max(1e-6, rMax()); layout(); if (state <= 2) r = k * rMax(); };

  function drop() {
    if (RM || state !== 0) return;
    r = Math.max(r, rMax() * .6);
    state = 1; sv = .6; tState = 0; quiet = 0;
  }
  function pointerP(e) { const q = localPoint(canvas, e); return [(q.x - .5) * asp, .5 - q.y]; }
  canvas.addEventListener("pointermove", e => { ptr = pointerP(e); });
  canvas.addEventListener("pointerleave", () => { ptr = null; });
  canvas.addEventListener("pointerdown", e => { ptr = pointerP(e); drop(); });
  canvas.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); drop(); } });

  function physics(dt, time) {
    // migla: kursors virs sēnes (tuvāk par ~0,7 cepurītes platuma no piliena)
    const sp = at(seat());
    let target = 0;
    if (ptr) {
      const dd = Math.hypot(ptr[0] - sp.x, ptr[1] - sp.y) / capW;
      target = clamp(1.25 - dd * 1.4, 0, 1);
      mistP = [lerp(mistP[0], ptr[0], Math.min(1, dt * 6)), lerp(mistP[1], ptr[1], Math.min(1, dt * 6))];
    }
    mist += (target - mist) * Math.min(1, dt * (target > mist ? 1.6 : .8));
    if (!ptr && mist < .01) mistP = [sp.x + capW * .3, sp.y + capW * .25];

    if (state === 0) {
      born = Math.min(1, born + dt * 2);
      // tilpums aug: pats ~70 s līdz pilnam, ar pilnu miglu ~6 s
      const V0 = r0() ** 3, V1 = rMax() ** 3;
      const rate = (V1 - V0) * (1 / 70 + mist / 6);
      r = Math.cbrt(r ** 3 + rate * dt);
      if (r >= rMax()) drop();
    } else if (state === 1) {
      // ripo pa cepurītes nogāzi uz labo malu, paātrinoties
      const p = at(s), slope = Math.max(.15, -p.ty * 3 + .2);
      sv = Math.min(sv + dt * 9 * slope, 14);
      s += sv * dt;
      if (s >= pts.length - 1.001) { s = pts.length - 1.001; state = 2; tState = 0; }
    } else if (state === 2) {
      tState += dt;
      if (tState > .35) {
        const p = at(s);
        state = 3; fallP = [p.x + .2 * r, p.y - r * 1.2]; fallV = 0; tState = 0;
      }
    } else if (state === 3) {
      fallV += 6 * dt; fallP[1] -= fallV * dt;
      if (fallP[1] - r <= groundY) {
        const gx = fallP[0];
        splash = splashDir.map(([dx, up, sz]) => ({ x: gx, y: groundY, vx: dx * .35 * capW, vy: up * .9 * capW, r: r * .22 * sz, t: 0, life: .55 }));
        wet = { x: gx, y: groundY, t: 0, k: Math.min(1, r / rMax() + .2) };
        plink("pelke", .16);
        state = 4; tState = 0;
      }
    } else if (state === 4) {
      tState += dt;
      if (tState > .9) { state = 0; s = seat(); r = r0(); born = 0; }
    }
    for (const q of splash) { q.t += dt; q.vy -= 6 * capW * dt; q.x += q.vx * dt; q.y += q.vy * dt; if (q.y < groundY) { q.y = groundY; q.vy *= -.25; q.vx *= .5; } }
    splash = splash.filter(q => q.t < q.life);
    if (wet) { wet.t += dt; if (wet.t > 9) wet = null; }
  }

  return {
    el: section, scene,
    step(time, dt) {
      if (!RM && dt > 0) physics(Math.min(dt, .05), time);
      scene.render(time, dt);
    }
  };
}
