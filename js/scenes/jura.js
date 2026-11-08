// jūra (kājene): Daiņa foto no jūras krasta. Ūdens viļņojas uz krastu, putas uzplūst ap akmeņiem,
// dzintars šūpojas; virs jūras migla lēni ceļas augšup un sablīvējas sīkos pilienos.
// Aina ir lēta un mierīga, tāpēc tai pietiek ar 30 kadriem sekundē.
import { GLScene, loadImage } from "../glscene.js";

export function createJura(section) {
  const canvas = section.querySelector("canvas");
  const scene = new GLScene({
    section, canvas, frag: "kaje", fps: 30,
    async textures(s) {
      const [a, m] = await Promise.all([loadImage("foto/jura-akmeni.webp"), loadImage("foto/jura-udens.webp")]);
      s.bgAspect = a.naturalWidth / a.naturalHeight;
      return [a, m];
    },
    uniforms(s) { s.gl.uniform1f(s.U("uBgAspect"), s.bgAspect); }
  });
  return { el: section, scene, step(time, dt) { scene.render(time, dt); } };
}
