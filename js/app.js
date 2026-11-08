// piliens.lv v2: galvenais modulis. Ainas ielādējas, kad tuvojas ekrānam; animē tikai redzamās.
import { RM, START, sound, localPoint, SEED, rng } from "./util.js";
import { initCursor } from "./cursor.js";
import { createLaiks } from "./scenes/laiks.js";
import { createStill } from "./scenes/still.js";
import { createTinte } from "./scenes/tinte.js";
import { createRasa } from "./scenes/rasa.js";
import { createLase } from "./scenes/lase.js";
import { createLietus } from "./scenes/lietus.js";
import { createPiliens } from "./scenes/piliens.js";

const FACTORIES = {
  piliens: s => createPiliens(s),
  lase: s => createLase(s),
  tinte: s => createTinte(s),
  lietus: s => createLietus(s),
  rasa: s => createRasa(s),
  laiks: s => createLaiks(s),
  jura: s => createStill(s, "kaje")
};

const scenes = new Map();   // sadaļas id -> { el, scene, step, visible }

function ensure(section) {
  if (scenes.has(section.id)) return scenes.get(section.id);
  const f = FACTORIES[section.id];
  if (!f) return null;
  const sc = f(section);
  sc.visible = false;
  scenes.set(section.id, sc);
  sc.scene.init().then(() => { if (RM) sc.step((performance.now() - START) / 1000, 0); });
  // kursors vai pirksts kā gaismas avots / lēca
  section.addEventListener("pointermove", e => { const p = localPoint(sc.scene.canvas, e); sc.scene.mouse = [p.x, p.y]; });
  return sc;
}

const all = [...document.querySelectorAll(".scene")];
// ielāde: kad sadaļa ir viena ekrāna attālumā
const near = new IntersectionObserver(es => { for (const e of es) if (e.isIntersecting) ensure(e.target); }, { rootMargin: "100% 0px" });
const vis = new IntersectionObserver(es => {
  for (const e of es) { const sc = ensure(e.target); if (sc) sc.visible = e.isIntersecting; }
}, { threshold: .01 });
all.forEach(s => { near.observe(s); vis.observe(s); });

window.addEventListener("resize", () => { for (const sc of scenes.values()) sc.scene.resize(); });

// galvenais cikls; paslēptā cilnē nekas netiek zīmēts
let last = performance.now();
function loop(now) {
  const dt = Math.min(.05, (now - last) / 1000);
  last = now;
  if (!document.hidden) {
    const t = (now - START) / 1000;
    for (const sc of scenes.values()) if (sc.visible && (!RM || sc.alwaysStep)) sc.step(t, dt);
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
// samazinātā kustībā: laiks tomēr skaita, bet aina tiek pārzīmēta tikai reizi sekundē
if (RM) setInterval(() => { const t = (performance.now() - START) / 1000; for (const sc of scenes.values()) if (sc.visible) sc.step(t, 0); }, 1000);

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
  btn.textContent = on ? "Izslēgt skaņu" : "Ieslēgt skaņu";
});

initCursor();

// Dabīgas robežas starp sadaļām: katras nākamās sadaļas augšmala ir neregulāra (peļķes virsma,
// ūdens līmenis, palodze, akmens mala, krasts), nevis taisna līnija. Forma nāk no sēklas.
(() => {
  const R = rng(SEED ^ 0xBEEF);
  const kinds = { lase: [.7, 3], tinte: [.45, 5], lietus: [.35, 2], rasa: [.8, 7], laiks: [.6, 4], jura: [.75, 2] };
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
