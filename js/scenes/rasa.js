// rasa: Daiņa fotogrāfijas. Lāse-lēca (1,9×) seko kursoram, pieskārienam vai lēni klejo.
// Sīktēli ir ūdens lāses; uzklikšķinot uz tām, uz bildes uzkrīt lāse un jaunā bilde izplešas kā vilnis.
// Bildes var pārvilkt ar pirkstu vai peli (pa kreisi: nākamā, pa labi: iepriekšējā, ciklā), ar bultiņām
// vai horizontālo ritenīti. Pārvilkšana sākas tikai tad, ja kustība ir pārsvarā horizontāla (vertikālā ritināšana paliek).
// Blakus bildes (nākamā un iepriekšējā) tiek ielādētas iepriekš tajā pašā WebGL kontekstā (tekstūras 3 un 4).
import { GLScene, loadImage } from "../glscene.js";
import { RM, plink, localPoint, clamp, lerp } from "../util.js";
import { t, onLang } from "../i18n.js";

const SLIDES = [
  { wide: "lupina-plata", tall: "lupina-tuva", f: [.24, .54], tf: [.49, .39] },
  { wide: "rasaskreslins", f: [.37, .55] },
  { wide: "zvaigzne", f: [.42, .47] },
  { wide: "sarma", f: [.46, .45] },
  { wide: "rudens", f: [.45, .5] },
  { wide: "bite", f: [.5, .6] },
  { wide: "gailene", f: [.48, .5] },
  { wide: "audums", f: [.6, .5] }
];
const N = SLIDES.length;
const wrapI = i => (i % N + N) % N;
const SWIPED = "piliens.swiped";

export function createRasa(section) {
  const canvas = section.querySelector("canvas");
  const textEl = section.querySelector("#rasaText");
  let cur = 0, trans = 1, impact = [.5, .5], ptr = null, lens = [.62, .45], t0 = 0, hoverThumb = -1;
  let curInfo = null, prevInfo = null;
  // pārvilkšana
  let slide = 0, slideV = 0, target = 0, mode = "idle", goal = 0, drag = null, wheelAcc = 0, wheelT = 0, cooldown = 0;
  const slot = { 3: { idx: -1, info: null }, 4: { idx: -1, info: null } };   // 3 = nākamā, 4 = iepriekšējā

  // sīktēlu pogas: neredzamas, novietotas tieši virs šeiderī zīmētajām lāsēm
  const wrap = document.createElement("div");
  wrap.className = "thumbs"; wrap.setAttribute("role", "group");
  const buttons = SLIDES.map((S, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.setAttribute("aria-pressed", String(i === 0));
    b.addEventListener("click", e => { e.stopPropagation(); show(i); });
    b.addEventListener("pointerenter", () => { hoverThumb = i; loadImage(info(i).src); });   // bildi ielādē tikai, kad tai pietuvojas
    b.addEventListener("pointerleave", () => { hoverThumb = -1; });
    wrap.appendChild(b); return b;
  });
  section.appendChild(wrap);
  // diskrēta norāde, ka bildes var vilkt; pazūd pēc pirmās izmantošanas
  const hint = document.createElement("p");
  hint.className = "swipe-hint"; hint.setAttribute("aria-hidden", "true");
  hint.innerHTML = '<span class="arr l">‹</span><span class="w" data-i18n="rasa.swipe"></span><span class="arr r">›</span>';
  hint.querySelector(".w").textContent = t("rasa.swipe") || "velc";
  section.appendChild(hint);
  try { if (localStorage.getItem(SWIPED)) section.classList.add("swiped"); } catch (e) { /* nav krātuves */ }
  const used = () => { if (section.classList.contains("swiped")) return; section.classList.add("swiped"); try { localStorage.setItem(SWIPED, "1"); } catch (e) { /* */ } };

  function texts() {
    textEl.textContent = t(`rasa.s${cur}.text`);
    buttons.forEach((b, i) => b.setAttribute("aria-label", t(`rasa.s${i}.alt`)));
    wrap.setAttribute("aria-label", t("rasa.thumbs"));
  }
  onLang(texts); texts();

  function layoutThumbs() {
    const r = canvas.getBoundingClientRect(), asp = r.width / r.height, mobile = asp < .9;
    const tr = mobile ? .022 : .028;
    let minX = 1e9, maxX = -1e9, cy = 0, d = 0;
    buttons.forEach((b, i) => {
      const c = mobile ? [-.5 * asp + .05 + i * tr * 2.3, .5 - .09] : [.5 * asp - .06 - (7 - i) * tr * 2.35, -.5 + .12];
      const px = (c[0] / asp + .5) * r.width, py = (1 - (c[1] + .5)) * r.height; d = tr * 2.3 * r.height;
      Object.assign(b.style, { left: px - d / 2 + "px", top: py - d / 2 + "px", width: d + "px", height: d + "px" });
      minX = Math.min(minX, px); maxX = Math.max(maxX, px); cy = py;
    });
    // norāde: virs sīktēlu rindas (datorā) vai zem tās (telefonā), centrā
    Object.assign(hint.style, { left: (minX + maxX) / 2 + "px", top: (mobile ? cy + d * .95 : cy - d * 1.35) + "px" });
  }

  function info(i) {
    const r = canvas.getBoundingClientRect(), tall = r.width / r.height < .9, S = SLIDES[i];
    const useTall = tall && S.tall;
    return { idx: i, src: "foto/" + (useTall ? S.tall : S.wide) + ".webp", focus: useTall ? S.tf : S.f };
  }
  const withAspect = async inf => { const img = await loadImage(inf.src); inf.aspect = img.naturalWidth / img.naturalHeight; return img; };

  // blakus bildi augšupielādē tekstūrā 3 (nākamā) vai 4 (iepriekšējā), ja tur jau nav tā pati
  async function ensureSlot(k, i) {
    if (slot[k].idx === i && slot[k].info) return;
    const inf = info(i), img = await withAspect(inf);
    if (!scene.ready) return;
    const want = k === 3 ? wrapI(cur + 1) : wrapI(cur - 1);
    if (want !== i) return;                                    // kamēr lādējās, aktīvā bilde jau mainījusies
    scene.updateTexture(k, img); slot[k] = { idx: i, info: inf };
  }
  let preT = 0;
  function preload() {
    clearTimeout(preT);
    preT = setTimeout(() => { ensureSlot(3, wrapI(cur + 1)).then(() => ensureSlot(4, wrapI(cur - 1))).catch(() => {}); }, 350);
  }

  const placeholder = (() => { const c = document.createElement("canvas"); c.width = c.height = 2; const x = c.getContext("2d"); x.fillStyle = "#1c2a18"; x.fillRect(0, 0, 2, 2); return c; })();
  const scene = new GLScene({
    section, canvas, frag: "rasa",
    async textures(s) {
      curInfo = info(cur); prevInfo = curInfo;
      const img = await withAspect(curInfo);
      prevInfo.aspect = curInfo.aspect;
      const at = document.createElement("canvas"); at.width = 1280; at.height = 160;
      const ax = at.getContext("2d", { willReadFrequently: true });
      const th = await Promise.all(SLIDES.map(S => loadImage("foto/mazas/" + S.wide + ".webp")));
      th.forEach((m, i) => ax.drawImage(m, i * 160, 0, 160, 160));
      layoutThumbs();
      slot[3] = { idx: -1, info: null }; slot[4] = { idx: -1, info: null };
      return [img, at, img, placeholder, placeholder];
    },
    onBuild() { preload(); },
    uniforms(s) {
      const gl = s.gl;
      const r = canvas.getBoundingClientRect(), mobile = r.width / r.height < .9;
      gl.uniform1f(s.U("uImgAspect"), curInfo.aspect); gl.uniform2f(s.U("uFocus"), ...curInfo.focus);
      gl.uniform1f(s.U("uPrevAspect"), prevInfo.aspect); gl.uniform2f(s.U("uPrevFocus"), ...prevInfo.focus);
      gl.uniform1f(s.U("uTrans"), trans);
      gl.uniform2f(s.U("uImpact"), impact[0], 1 - impact[1]);
      gl.uniform1i(s.U("uSel"), cur);
      gl.uniform1i(s.U("uMouseThumb"), hoverThumb);
      gl.uniform1f(s.U("uLensR"), mobile ? .11 : .13);
      const ni = slot[3].info || curInfo, pi = slot[4].info || curInfo;
      gl.uniform4f(s.U("uNextInfo"), ni.aspect || 1, ni.focus[0], ni.focus[1], 0);
      gl.uniform4f(s.U("uPrev2Info"), pi.aspect || 1, pi.focus[0], pi.focus[1], 0);
      gl.uniform1f(s.U("uSlide"), slide);
    }
  });

  function setCurrent(i) {
    cur = i;
    buttons.forEach((b, k) => b.setAttribute("aria-pressed", String(k === i)));
    textEl.textContent = t(`rasa.s${i}.text`);
    section.dataset.slide = i;
  }

  // sīktēls: lāses trieciena pāreja (kā līdz šim)
  async function show(i) {
    if (i === cur || mode !== "idle") return;
    const ni = info(i), img = await withAspect(ni);
    const old = await loadImage(curInfo.src);
    scene.updateTexture(2, old); scene.updateTexture(0, img);
    prevInfo = curInfo; curInfo = ni;
    setCurrent(i);
    trans = RM ? 1 : 0;
    impact = ptr ? [ptr[0], ptr[1]] : [.5, .45];
    plink("udens", .14);
    slot[3] = { idx: -1, info: null }; slot[4] = { idx: -1, info: null };
    preload();
    if (RM) scene.render(0, 0);
  }

  // pārvilkšanas noslēgums: tekstūru objektus samaina vietām (bez jaunas augšupielādes)
  const ready = dir => { const k = dir > 0 ? 3 : 4; return slot[k].idx === wrapI(cur + dir) && !!slot[k].info; };
  function finish(dir) {
    const T = scene.textures, old = { idx: cur, info: curInfo }, i = wrapI(cur + dir);
    if (dir > 0) { const a = T[0].tex; T[0].tex = T[3].tex; T[3].tex = T[4].tex; T[4].tex = a; curInfo = slot[3].info; slot[4] = old; slot[3] = { idx: -1, info: null }; }
    else { const a = T[0].tex; T[0].tex = T[4].tex; T[4].tex = T[3].tex; T[3].tex = a; curInfo = slot[4].info; slot[3] = old; slot[4] = { idx: -1, info: null }; }
    prevInfo = curInfo; trans = 1;
    setCurrent(i);
    slide = 0; slideV = 0; target = 0; mode = "idle"; cooldown = .35;
    plink("udens", .1);
    preload();
    if (RM) scene.render(0, 0);
  }

  function settle(g, v = 0) { mode = "settle"; goal = g; slideV = v; }
  async function go(dir) {                                     // +1 nākamā, −1 iepriekšējā (bultiņas, ritenītis)
    if (mode !== "idle" || !scene.ready || cooldown > 0) return;
    used();
    const k = dir > 0 ? 3 : 4;
    try { await ensureSlot(k, wrapI(cur + dir)); } catch (e) { return; }
    if (mode !== "idle" || !ready(dir)) return;
    trans = 1;
    if (RM) { finish(dir); return; }
    settle(-dir, 0);
  }

  // ---- pele un pirksts ----
  canvas.addEventListener("pointermove", e => {
    const p = localPoint(canvas, e); ptr = [p.x, p.y];
    if (!drag) return;
    const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (!drag.on) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { drag = null; return; }      // vertikāli: ritināšana
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.3) {
        drag.on = true; drag.x0 = e.clientX - Math.sign(dx) * 2;
        try { canvas.setPointerCapture(e.pointerId); } catch (er) { /* */ }
        mode = "drag"; trans = 1; used();
        ensureSlot(3, wrapI(cur + 1)).catch(() => {}); ensureSlot(4, wrapI(cur - 1)).catch(() => {});
      } else return;
    }
    const w = canvas.getBoundingClientRect().width || 1;
    target = clamp((e.clientX - drag.x0) / w, -1, 1);
    drag.hist.push([e.timeStamp, target]); if (drag.hist.length > 6) drag.hist.shift();
    if (RM) { slide = target; scene.render(0, 0); }
  });
  canvas.addEventListener("pointerdown", e => {
    const p = localPoint(canvas, e); ptr = [p.x, p.y]; plink("udens", .12);
    if (e.button !== 0 || mode !== "idle" || cooldown > 0) return;
    drag = { x0: e.clientX, y0: e.clientY, on: false, hist: [] };
  });
  const release = () => {
    if (!drag) return;
    const d = drag; drag = null;
    if (!d.on) return;
    let v = 0;
    if (d.hist.length > 1) { const a = d.hist[0], b = d.hist[d.hist.length - 1]; v = (b[1] - a[1]) / Math.max(.016, (b[0] - a[0]) / 1000); }
    let dir = Math.abs(target) > .2 || (Math.abs(v) > .6 && Math.sign(v) === Math.sign(target)) ? -Math.sign(target) : 0;
    if (dir && !ready(dir)) dir = 0;                           // blakus bilde vēl nav ielādēta: atgriežas
    if (RM) { if (dir) finish(dir); else { slide = 0; mode = "idle"; scene.render(0, 0); } return; }
    settle(dir ? -dir : 0, v);
  };
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", () => { if (drag && drag.on) { target = 0; } release(); });
  canvas.addEventListener("pointerleave", () => { ptr = null; });

  // ---- horizontālais ritenītis / skārienpaliktnis ----
  canvas.addEventListener("wheel", e => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) * 1.2 || Math.abs(e.deltaX) < 1) return;   // vertikāli: lapas ritināšana
    e.preventDefault();
    if (cooldown > 0 || (mode !== "idle" && mode !== "wheel")) return;
    if (mode === "idle") { mode = "wheel"; wheelAcc = 0; trans = 1; used(); ensureSlot(3, wrapI(cur + 1)).catch(() => {}); ensureSlot(4, wrapI(cur - 1)).catch(() => {}); }
    const w = canvas.getBoundingClientRect().width || 1;
    wheelAcc += e.deltaX * (e.deltaMode === 1 ? 16 : 1);
    target = clamp(-wheelAcc / w * 1.6, -1, 1);
    wheelT = performance.now();                                // atlaišana pēc ~180 ms klusuma (reālais laiks, ne kadri)
  }, { passive: false });

  // ---- tastatūra: ← → pārslēdz bildes, ↑ ↓ vada lāsi-lēcu ----
  section.addEventListener("keydown", e => {
    if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
  });
  canvas.addEventListener("keydown", e => {
    const d = .03, m = { ArrowUp: [0, -d], ArrowDown: [0, d] }[e.key];
    if (m) { e.preventDefault(); ptr = [clamp(ptr ? ptr[0] : lens[0], 0, 1), clamp((ptr ? ptr[1] : lens[1]) + m[1], 0, 1)]; }
  });
  window.addEventListener("resize", layoutThumbs);

  return {
    el: section, scene,
    step(time, dt) {
      t0 += dt;
      if (cooldown > 0) cooldown -= dt;
      if (trans < 1) trans = Math.min(1, trans + dt / 1.1);
      // pārvilkšana: seko pirkstam ar nelielu inerci; atlaižot atspere aizved līdz galam vai atpakaļ
      if (mode === "drag") slide = lerp(slide, target, Math.min(1, dt * 22));
      else if (mode === "wheel") {
        slide = lerp(slide, target, Math.min(1, dt * 18));
        if (performance.now() - wheelT > 180) { let dir = Math.abs(target) > .15 ? -Math.sign(target) : 0; if (dir && !ready(dir)) dir = 0; settle(dir ? -dir : 0, 0); }
      } else if (mode === "settle") {
        const k = 70, c = 2 * Math.sqrt(k) * .95;
        slideV += (k * (goal - slide) - c * slideV) * dt; slide += slideV * dt;
        if (Math.abs(goal - slide) < .003 && Math.abs(slideV) < .05) {
          if (goal === 0) { slide = 0; slideV = 0; mode = "idle"; }
          else finish(-goal);
        }
      }
      const tx = ptr ? ptr[0] : (RM ? .55 : .5 + .22 * Math.sin(t0 * .23)),
            ty = ptr ? ptr[1] : (RM ? .45 : .5 - .18 * Math.sin(t0 * .31 + 1));
      const f = 1 - Math.pow(ptr ? .0005 : .2, dt || .016);
      lens = [lerp(lens[0], tx, f), lerp(lens[1], ty, f)];
      scene.mouse = lens;
      scene.render(time, dt);
    }
  };
}
