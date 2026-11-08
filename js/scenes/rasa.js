// rasa: Daiņa fotogrāfijas. Lāse-lēca (1,9×) seko kursoram, pieskārienam vai lēni klejo.
// Sīktēli ir ūdens lāses; pārslēdzot bildi, uz tās uzkrīt lāse un jaunā bilde izplešas kā vilnis.
import { GLScene, loadImage } from "../glscene.js";
import { RM, plink, localPoint, clamp, lerp } from "../util.js";

const SLIDES = [
  { wide: "lupina-plata", tall: "lupina-tuva", f: [.24, .54], tf: [.49, .39], alt: "Lupīnas lapas", text: "Lupīnas lapas pēc lietus. Katras lapas vidū sakrājusies viena lāse, kas strādā kā lēca." },
  { wide: "rasaskreslins", f: [.37, .55], alt: "Rasaskrēsliņa lapa", text: "Rasaskrēsliņa lapa. Sīkās lāses gar zobaino malu augs naktī izspiež pats." },
  { wide: "zvaigzne", f: [.42, .47], alt: "Lāse lupīnas lapu zvaigznē", text: "Lāse lupīnas lapu zvaigznes centrā. Tajā atspīd visas lapiņas reizē." },
  { wide: "sarma", f: [.46, .45], alt: "Sarma uz lapām", text: "Sarma. Tas pats ūdens no gaisa, tikai sasalis adatās." },
  { wide: "rudens", f: [.45, .5], alt: "Rudens meža mala", text: "Rudens meža mala. Lāsi var vadīt arī pār krāsainajām lapām." },
  { wide: "bite", f: [.5, .6], alt: "Bite pie dzintarkrāsas lāses", text: "Bite pie dzintarkrāsas lāses. Arī saldums reizēm ir tikai viens piliens." },
  { wide: "gailene", f: [.48, .5], alt: "Gailene zem sarmotām lapām", text: "Gailene zem sarmotām lapām. Pie zāles stiebra vēl karājas lāse, kas nav paspējusi sasalt." },
  { wide: "audums", f: [.6, .5], alt: "Lāses uz auduma", text: "Lāses uz ūdensnecaurlaidīga auduma. Iesūkties tās nevar, tāpēc saraujas lodītēs." }
];

export function createRasa(section) {
  const canvas = section.querySelector("canvas");
  const textEl = section.querySelector("#rasaText");
  const cache = {};
  let cur = 0, prev = 0, trans = 1, impact = [.5, .5], ptr = null, lens = [.62, .45], t = 0, hoverThumb = -1;
  let curInfo = null, prevInfo = null;

  // sīktēlu pogas: neredzamas, novietotas tieši virs šeiderī zīmētajām lāsēm
  const wrap = document.createElement("div");
  wrap.className = "thumbs"; wrap.setAttribute("role", "group"); wrap.setAttribute("aria-label", "Fotogrāfijas");
  const buttons = SLIDES.map((S, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.setAttribute("aria-label", S.alt); b.setAttribute("aria-pressed", String(i === 0));
    b.addEventListener("click", e => { e.stopPropagation(); show(i, b); });
    b.addEventListener("pointerenter", () => { hoverThumb = i; });
    b.addEventListener("pointerleave", () => { hoverThumb = -1; });
    wrap.appendChild(b); return b;
  });
  section.appendChild(wrap);

  function layoutThumbs() {
    const r = canvas.getBoundingClientRect(), asp = r.width / r.height, mobile = asp < .9;
    const tr = mobile ? .022 : .028;
    buttons.forEach((b, i) => {
      const c = mobile ? [-.5 * asp + .05 + i * tr * 2.3, .5 - .09] : [.5 * asp - .06 - (7 - i) * tr * 2.35, -.5 + .12];
      const px = (c[0] / asp + .5) * r.width, py = (1 - (c[1] + .5)) * r.height, d = tr * 2.3 * r.height;
      Object.assign(b.style, { left: px - d / 2 + "px", top: py - d / 2 + "px", width: d + "px", height: d + "px" });
    });
  }

  function info(i) {
    const r = canvas.getBoundingClientRect(), tall = r.width / r.height < .9, S = SLIDES[i];
    const useTall = tall && S.tall;
    return { src: "foto/" + (useTall ? S.tall : S.wide) + ".jpg", focus: useTall ? S.tf : S.f };
  }
  async function image(src) { if (!cache[src]) cache[src] = loadImage(src); return cache[src]; }

  const scene = new GLScene({
    section, canvas, frag: "rasa", maxScale: 1.5,
    async textures(s) {
      curInfo = info(0); prevInfo = curInfo;
      const img = await image(curInfo.src);
      curInfo.aspect = prevInfo.aspect = img.naturalWidth / img.naturalHeight;
      const at = document.createElement("canvas"); at.width = 1280; at.height = 160;
      const ax = at.getContext("2d");
      const th = await Promise.all(SLIDES.map(S => loadImage("foto/mazas/" + S.wide + ".jpg")));
      th.forEach((m, i) => ax.drawImage(m, i * 160, 0, 160, 160));
      layoutThumbs();
      // pārējās bildes ielādē, kad sadaļa jau redzama
      setTimeout(() => SLIDES.forEach((_, i) => image(info(i).src)), 2000);
      return [img, at, img];
    },
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
    }
  });

  async function show(i, btn) {
    if (i === cur) return;
    const ni = info(i), img = await image(ni.src);
    ni.aspect = img.naturalWidth / img.naturalHeight;
    // iepriekšējo bildi pārvieto uz 3. tekstūru, jauno uz 1.
    const old = await image(curInfo.src);
    scene.updateTexture(2, old); scene.updateTexture(0, img);
    prevInfo = curInfo; curInfo = ni; prev = cur; cur = i;
    trans = RM ? 1 : 0;
    impact = ptr ? [ptr[0], ptr[1]] : [.5, .45];
    buttons.forEach((b, k) => b.setAttribute("aria-pressed", String(k === i)));
    textEl.textContent = SLIDES[i].text;
    section.dataset.slide = i;
    plink("udens", .14);
    if (RM) scene.render(0, 0);
  }

  canvas.addEventListener("pointermove", e => { const p = localPoint(canvas, e); ptr = [p.x, p.y]; });
  canvas.addEventListener("pointerdown", e => { const p = localPoint(canvas, e); ptr = [p.x, p.y]; plink("udens", .12); });
  canvas.addEventListener("pointerleave", () => { ptr = null; });
  canvas.addEventListener("keydown", e => {
    const d = .03, m = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] }[e.key];
    if (m) { e.preventDefault(); ptr = [clamp((ptr ? ptr[0] : lens[0]) + m[0], 0, 1), clamp((ptr ? ptr[1] : lens[1]) + m[1], 0, 1)]; }
  });
  window.addEventListener("resize", layoutThumbs);

  return {
    el: section, scene,
    step(time, dt) {
      t += dt;
      if (trans < 1) trans = Math.min(1, trans + dt / 1.1);
      const tx = ptr ? ptr[0] : (RM ? .55 : .5 + .22 * Math.sin(t * .23)),
            ty = ptr ? ptr[1] : (RM ? .45 : .5 - .18 * Math.sin(t * .31 + 1));
      const f = 1 - Math.pow(ptr ? .0005 : .2, dt || .016);
      lens = [lerp(lens[0], tx, f), lerp(lens[1], ty, f)];
      scene.mouse = lens;
      scene.render(time, dt);
    }
  };
}
