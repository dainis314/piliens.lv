// piliens.lv v4: galvenais modulis. Ainas ielādējas, kad tuvojas ekrānam; animē tikai redzamās.
import { RM, START, sound, localPoint, SEED, rng, PERF } from "./util.js";
import { initCursor } from "./cursor.js";
import { initI18n, t } from "./i18n.js";
import { createLaiks } from "./scenes/laiks.js";
import { createTinte } from "./scenes/tinte.js";
import { createRasa } from "./scenes/rasa.js";
import { createLase } from "./scenes/lase.js";
import { createLietus } from "./scenes/lietus.js";
import { createPiliens } from "./scenes/piliens.js";
import { createSene } from "./scenes/sene.js";
import { createJura } from "./scenes/jura.js";

// valoda: tikai izvēlētās valodas JSON (dažus KB); WebGL ainas valodas maiņa neietekmē
await initI18n();

const FACTORIES = {
  piliens: s => createPiliens(s),
  lase: s => createLase(s),
  tinte: s => createTinte(s),
  lietus: s => createLietus(s),
  rasa: s => createRasa(s),
  laiks: s => createLaiks(s),
  sene: s => createSene(s),
  jura: s => createJura(s)
};

const scenes = new Map();   // sadaļas id -> { el, scene, step, visible, near }

function ensure(section) {
  if (scenes.has(section.id)) return scenes.get(section.id);
  const f = FACTORIES[section.id];
  if (!f) return null;
  const sc = f(section);
  sc.visible = false; sc.near = false;
  scenes.set(section.id, sc);
  // kursors vai pirksts kā gaismas avots / lēca
  section.addEventListener("pointermove", e => { const p = localPoint(sc.scene.canvas, e); sc.scene.mouse = [p.x, p.y]; });
  return sc;
}

const all = [...document.querySelectorAll(".scene")];
// Konteksta dzīves cikls: WebGL konteksts dzīvo tikai sadaļām ekrānā vai ~pusekrāna attālumā.
// Tālākām sadaļām konteksts tiek atbrīvots (WEBGL_lose_context) un atjaunots, kad tās atkal tuvojas.
const near = new IntersectionObserver(es => {
  for (const e of es) {
    const sec = e.target;
    if (e.isIntersecting) {
      sec.classList.add("near");                         // statiskais kadrs tiek ielādēts tikai tagad
      const sc = ensure(sec); if (!sc) continue;
      sc.near = true;
      sc.scene.acquire().then(() => { if (RM && sc.scene.ready) sc.step((performance.now() - START) / 1000, 0); });
    } else {
      const sc = scenes.get(sec.id);
      if (sc) { sc.near = false; sc.scene.release(); }
    }
  }
}, { rootMargin: "50% 0px" });
const vis = new IntersectionObserver(es => {
  for (const e of es) { const sc = ensure(e.target); if (sc) sc.visible = e.isIntersecting; }
}, { threshold: 0, rootMargin: "-2px 0px" }); // blakus sekcija, kas tikai pieskaras malai, nezīmē
all.forEach(s => { near.observe(s); vis.observe(s); });
all[0].classList.add("near");

let resizeT;
window.addEventListener("resize", () => { clearTimeout(resizeT); resizeT = setTimeout(() => {
  for (const sc of scenes.values()) { sc.scene.resize(); if (RM && sc.visible && sc.scene.ready) sc.step((performance.now() - START) / 1000, 0); }
}, 150); });

// galvenais cikls: zīmē tikai redzamās ainas (parasti vienu, pārejā divas); paslēptā cilnē neko
let last = performance.now(), frameAvg = 16.7, fpsAvg = 60, lowFx = false;
function loop(now) {
  const frameMs = now - last;
  const dt = Math.min(.05, frameMs / 1000);
  last = now;
  frameAvg = frameAvg * .9 + frameMs * .1; fpsAvg = 1000 / frameAvg;
  if (!document.hidden && !RM) {
    const t = (now - START) / 1000;
    for (const sc of scenes.values()) {
      if (!sc.visible || !sc.scene.ready) continue;
      sc.scene.adapt(frameMs);              // pirms zīmēšanas: ja mainās izmērs, kadrs tiek uzzīmēts tajā pašā kadrā
      const d = sc.scene.due(dt);
      if (d) sc.step(t, d);
    }
    // vājā iekārtā izslēdz kursora stikla backdrop-filter (ar histerēzi, lai nemirgo)
    if (fpsAvg < 40 && !lowFx) { lowFx = true; document.documentElement.classList.add("low-fx"); }
    else if (fpsAvg > 52 && lowFx) { lowFx = false; document.documentElement.classList.remove("low-fx"); }
  }
  if (PERF) hud(now);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
// samazinātā kustībā: laiks tomēr skaita, bet aina tiek pārzīmēta tikai reizi sekundē
if (RM) setInterval(() => { const t = (performance.now() - START) / 1000; for (const sc of scenes.values()) if (sc.visible && sc.scene.ready) sc.step(t, 0); }, 1000);

// ?perf=1: diagnostikas panelis
let hudEl = null, hudT = 0;
function hud(now) {
  if (now - hudT < 250) return; hudT = now;
  if (!hudEl) { hudEl = document.createElement("pre"); hudEl.id = "perfhud"; document.body.appendChild(hudEl); }
  const rows = [...scenes.entries()].map(([id, sc]) => {
    const s = sc.scene, st = s.ready ? (sc.visible ? "zīmē" : "gaida") : (s.failed ? "rezerve" : "atbrīvots");
    return `${id.padEnd(8)} ${st.padEnd(9)} ${s.ready ? (s.canvas.width + "×" + s.canvas.height).padEnd(10) : "".padEnd(10)} q=${s.q.toFixed(2)} ${s.fps}fps ${s.ready && sc.visible ? s.gpuMs.toFixed(1) + "ms " + Math.round((s.drawn || 0) * 100) + "%" : ""}`;
  });
  const live = [...scenes.values()].filter(sc => sc.scene.ready).length;
  hudEl.textContent = `fps ${fpsAvg.toFixed(1)}  kadrs ${frameAvg.toFixed(1)} ms  konteksti ${live}\n` + rows.join("\n");
  window.__perf = { fps: fpsAvg, frame: frameAvg, live, scenes: [...scenes.entries()].map(([id, sc]) => ({ id, ready: sc.scene.ready, visible: sc.visible, w: sc.scene.canvas.width, h: sc.scene.canvas.height, q: sc.scene.q, gpu: +sc.scene.gpuMs.toFixed(1), drawn: +(sc.scene.drawn || 0).toFixed(2) })) };
}

// navigācija: aktīvā sadaļa un krāsas
const links = [...document.querySelectorAll(".index a")];
const active = new IntersectionObserver(es => {
  for (const e of es) if (e.isIntersecting) {
    document.body.dataset.sec = e.target.id;
    links.forEach(a => a.classList.toggle("on", a.getAttribute("href") === "#" + e.target.id));
  }
}, { threshold: .55 });
all.forEach(s => active.observe(s));
document.body.dataset.sec = "piliens";

// skaņa
const btn = document.getElementById("sound");
btn.addEventListener("click", () => {
  const on = sound.toggle();
  btn.setAttribute("aria-pressed", String(on));
  btn.dataset.i18n = on ? "ui.soundOff" : "ui.soundOn";
  btn.textContent = t(btn.dataset.i18n);
});

initCursor();

// Dabīgas robežas starp sadaļām: katras nākamās sadaļas augšmala ir neregulāra (peļķes virsma,
// ūdens līmenis, palodze, akmens mala, krasts), nevis taisna līnija. Forma nāk no sēklas.
(() => {
  const R = rng(SEED ^ 0xBEEF);
  const kinds = { lase: [.7, 3], tinte: [.45, 5], lietus: [.35, 2], rasa: [.8, 7], laiks: [.6, 4], sene: [.5, 3], jura: [.75, 2] };
  for (const sec of all.slice(1)) {
    const [amp, waves] = kinds[sec.id] || [.3, 3];
    const ph = [R() * 6.28, R() * 6.28, R() * 6.28];
    let d = "M0 100 L";
    const pts = [];
    for (let i = 0; i <= 60; i++) {
      const x = i / 60;
      const y = 50 + 50 * amp * (Math.sin(x * waves * 6.28 + ph[0]) * .6 + Math.sin(x * waves * 15.7 + ph[1]) * .25 + Math.sin(x * 47 + ph[2]) * .15);
      pts.push(`${(x * 1000).toFixed(1)} ${y.toFixed(1)}`);
    }
    d += pts.join(" L") + " L1000 100 Z";
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1000 100' preserveAspectRatio='none'><filter id='b'><feGaussianBlur stdDeviation='.9'/></filter><path d='${d}' fill='black' filter='url(#b)'/></svg>`;
    const url = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
    sec.style.setProperty("--edge", url);
    sec.classList.add("edged");
  }
})();
