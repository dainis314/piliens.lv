// Ainas, kas vēl nav pilnībā atdzīvinātas: koncepcijas šeideris ar laiku un kursoru.
// Katra sadaļa tiks pārbūvēta ar savu fiziku (sk. darba gaitu README).
import { GLScene, loadImage } from "../glscene.js";
import { SEED, rng } from "../util.js";

export async function wordMask(w, h) {
  await document.fonts.load("640 100px Fraunces");
  const c = document.createElement("canvas"); c.width = 2048; c.height = Math.round(2048 * h / w);
  const x = c.getContext("2d", { willReadFrequently: true });
  const fs = (w < 700 ? 345 : 280) / 1200 * c.width;
  x.font = `640 ${fs}px Fraunces`;
  x.textAlign = "center"; x.textBaseline = "alphabetic"; x.fillStyle = "#fff";
  x.filter = "blur(" + (fs * .012) + "px)";
  x.fillText("piliens", c.width / 2, c.height * .44);
  return c;
}
export async function sandWords(w, h) {
  const R = rng(SEED ^ 0x51ED);
  await document.fonts.load("italic 300 100px Fraunces");
  const c = document.createElement("canvas"); c.width = 1600; c.height = Math.round(1600 * h / w);
  const x = c.getContext("2d", { willReadFrequently: true });
  x.fillStyle = "#000"; x.fillRect(0, 0, c.width, c.height); x.fillStyle = "#fff";
  const words = ["lāse", "rasa", "avots", "strauts", "upe", "ezers", "lietus", "vilnis", "jūra", "mākonis", "tvaiks", "ledus"];
  const placed = [];
  for (const word of words) for (let k = 0; k < 40; k++) {
    const fs = c.width * (.035 + .05 * R() * R());
    const px = c.width * (.06 + .88 * R()), py = c.height * (.08 + .84 * R());
    if (placed.some(p => Math.hypot(p[0] - px, p[1] - py) < (p[2] + fs) * 1.6)) continue;
    placed.push([px, py, fs]);
    x.save(); x.translate(px, py); x.rotate((R() - .5) * .9);
    x.font = `italic ${300 + Math.round(R() * 200)} ${fs}px Fraunces`;
    x.filter = "blur(" + (fs * .02) + "px)"; x.textAlign = "center"; x.fillText(word, 0, 0); x.restore();
    break;
  }
  return c;
}

const LOADERS = {
  async piliens(s, w, h) {
    const [a, b] = await Promise.all([loadImage("foto/sarma-rits.webp"), loadImage("foto/sarma-rits-izpludis.webp")]);
    s.bgAspect = a.naturalWidth / a.naturalHeight;
    return [await wordMask(w, h), a, b];
  },
  async lase(s, w, h) { return [await sandWords(w, h)]; },
  async tinte(s) { const a = await loadImage("foto/mezs-izpludis2.webp"); s.bgAspect = a.naturalWidth / a.naturalHeight; return [a]; },
  async lietus(s) {
    const [a, b] = await Promise.all([loadImage("foto/sarma-rits.webp"), loadImage("foto/sarma-rits-izpludis.webp")]);
    s.bgAspect = a.naturalWidth / a.naturalHeight; return [a, b];
  },
  async rasa(s, w, h) {
    const tall = w / h < .9;
    const img = await loadImage("foto/" + (tall ? "lupina-tuva.webp" : "lupina-plata.webp"));
    s.imgAspect = img.naturalWidth / img.naturalHeight; s.focus = tall ? [.49, .39] : [.24, .54];
    const names = ["lupina-plata", "rasaskreslins", "zvaigzne", "sarma", "rudens", "bite", "gailene", "audums"];
    const at = document.createElement("canvas"); at.width = 1280; at.height = 160;
    const ax = at.getContext("2d", { willReadFrequently: true });
    const th = await Promise.all(names.map(n => loadImage("foto/mazas/" + n + ".webp")));
    th.forEach((t, i) => ax.drawImage(t, i * 160, 0, 160, 160));
    return [img, at];
  },
  async kaje(s) { const a = await loadImage("foto/jura-akmeni.webp"); s.bgAspect = a.naturalWidth / a.naturalHeight; return [a]; }
};

export function createStill(section, frag) {
  const canvas = section.querySelector("canvas");
  const scene = new GLScene({
    section, canvas, frag,
    async textures(s) { const r = canvas.getBoundingClientRect(); return LOADERS[frag](s, r.width, r.height); },
    uniforms(s) {
      const gl = s.gl;
      if (s.bgAspect) gl.uniform1f(s.U("uBgAspect"), s.bgAspect);
      if (s.imgAspect) { gl.uniform1f(s.U("uImgAspect"), s.imgAspect); gl.uniform2f(s.U("uFocus"), s.focus[0], s.focus[1]); }
    }
  });
  return { el: section, scene, step(time, dt) { scene.render(time, dt); } };
}
