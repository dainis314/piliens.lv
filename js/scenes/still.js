// Kopīgie 2D audekli šeideriem: vārda "piliens" maska (pirmā lapa) un vārdi upes gultnē (lāse).
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
