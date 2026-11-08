// laiks: ūdens pulkstenis dabā. Viena lāse sekundē no lāstekas bļodakmenī.
// Skaitītājs skaita no lapas atvēršanas (arī tad, kad sadaļa nav redzama).
import { GLScene, loadImage } from "../glscene.js";
import { START, RM, plink, clamp } from "../util.js";

const FULL = 120; // pēc 120 pilieniem bļoda pilna un ūdens pārplūst

function word(n) {
  if (n === 0) return "pilienu";
  return (n % 10 === 1 && n % 100 !== 11) ? "piliens" : "pilieni";
}

export function createLaiks(section) {
  const countEl = section.querySelector("#count");
  const textEl = section.querySelector("#countText");
  let shown = -1, level = 0, overflow = 0;

  const scene = new GLScene({
    section, canvas: section.querySelector("canvas"), frag: "laiks", fps: 30,
    async textures(s) {
      const [blur, sharp, lichen] = await Promise.all([
        loadImage("foto/mezs-izpludis.webp"), loadImage("foto/mezs-suna.webp"), loadImage("foto/kerpji-sunas.webp")
      ]);
      s.bgAspect = blur.naturalWidth / blur.naturalHeight;
      return [blur, sharp, { tex: s.texture(lichen, { repeat: true }) }];
    },
    uniforms(s, time) {
      const gl = s.gl;
      const sec = (performance.now() - START) / 1000;
      const count = Math.floor(sec);
      const phase = RM ? .3 : sec - count;
      const target = Math.min(1, count / FULL);
      level += (target - level) * .05;
      overflow += ((count >= FULL ? 1 : 0) - overflow) * .02;
      gl.uniform1f(s.U("uBgAspect"), s.bgAspect);
      gl.uniform1f(s.U("uLevel"), level);
      gl.uniform1f(s.U("uPhase"), phase);
      gl.uniform1f(s.U("uRipple"), count > 0 ? phase : 9);
      gl.uniform1f(s.U("uGreen"), clamp(count / 600, 0, 1));
      gl.uniform1f(s.U("uIcicle"), clamp(count / 3600, 0, 1));
      gl.uniform1f(s.U("uOverflow"), overflow);
    }
  });

  function updateCount(animate) {
    const count = Math.floor((performance.now() - START) / 1000);
    if (count !== shown) {
      if (shown >= 0 && animate) plink("akmens", .14);
      shown = count;
      countEl.textContent = count;
      textEl.textContent = `${word(count)}, kopš atvēri šo lapu. Viens katru sekundi, un sūna kļūst zaļāka.`;
    }
  }
  setInterval(() => updateCount(false), 1000);
  updateCount(false);

  return {
    el: section, scene,
    step(time, dt) { updateCount(true); scene.render(time, dt); }
  };
}
