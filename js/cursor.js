// piliens.lv v2: lāses kursors (no 1. versijas, ar jaunām tēmām)
import { RM, rand, clamp } from "./util.js";

export function initCursor() {

  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  const el = document.getElementById("dcur");
  const swing = document.getElementById("dcSwing");
  const glass = document.getElementById("dcGlass");
  const body = document.getElementById("dcBody");
  const eyes = document.getElementById("dcEyes");
  const happy = document.getElementById("dcHappy");
  const mouth = document.getElementById("dcMouth");
  const rasaSec = document.getElementById("rasa");
  document.documentElement.classList.add("drop-cursor");

  let x = -100, y = -100, px = x, py = y, vx = 0, vy = 0;
  let ang = 0, angV = 0, sq = 0, sqV = 0, hover = 0, hoverT = 0, blinkT = rand(2, 4), blink = 0, happyT = 0, theme = "";
  let lookX = 0, lookY = 0, seen = false, lastT = performance.now(), idle = 0;

  function themeAt(cx, cy) {
    const hit = document.elementFromPoint(cx, cy);
    if (!hit) return theme;
    hoverT = hit.closest("a, button, canvas[tabindex], .thumbs button, #piliens") ? 1 : 0;
    const sec = hit.closest("section, footer");
    if (!sec) return theme;
    if (sec.tagName === "FOOTER") return "jura";
    if (sec.id === "rasa") { const i = +(rasaSec.dataset.slide || 0); return ["rasa", "rasa", "rasa", "sarma", "rudens", "sveki", "sarma", "audums"][i] || "rasa"; }
    return sec.id;
  }

  window.addEventListener("pointermove", e => {
    if (e.pointerType !== "mouse") return;
    x = e.clientX; y = e.clientY;
    if (!seen) { seen = true; px = x; py = y; el.classList.add("on"); }
  }, { passive: true });
  document.addEventListener("mouseleave", () => el.classList.remove("on"));
  document.addEventListener("mouseenter", () => { if (seen) el.classList.add("on"); });

  window.addEventListener("pointerdown", e => {
    if (e.pointerType !== "mouse") return;
    sqV += RM ? 0 : 9; happyT = .45;
    const col = getComputedStyle(el).getPropertyValue("--dc-rim");
    const mk = (cls, extra) => { const d = document.createElement("div"); d.className = cls; d.style.left = e.clientX + "px"; d.style.top = e.clientY + "px"; d.style.color = col; if (extra) extra(d); document.body.appendChild(d); setTimeout(() => d.remove(), 900); };
    mk("dring");
    if (!RM) {
      mk("dring thin");
      for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + rand(-1.3, 1.3), r = rand(14, 26); mk("dbit", d => { d.style.setProperty("--dx", Math.cos(a) * r + "px"); d.style.setProperty("--dy", Math.sin(a) * r + "px"); }); }
    }
  });

  function frame(now) {
    const dt = Math.min(.05, (now - lastT) / 1000); lastT = now;
    if (seen) {
      // ātrums ar izlīdzināšanu
      const nvx = (x - px) / Math.max(dt, .001), nvy = (y - py) / Math.max(dt, .001);
      vx += (nvx - vx) * .25; vy += (nvy - vy) * .25;
      px = x; py = y;
      const t = themeAt(x, y);
      if (t !== theme) { theme = t; el.dataset.t = t; }
      hover += (hoverT - hover) * Math.min(1, dt * 12);

      if (RM) { ang = 0; sq = 0; }
      else {
        // šūpošanās ap pirksta galu kā svārsts
        const target = clamp(vx * .02, -26, 26) + Math.sin(now / 900) * 2.5 * (1 - Math.min(1, Math.abs(vx) / 300));
        angV += (-(ang - target) * 90 - angV * 9) * dt; ang += angV * dt;
        // saspiešanās pēc klikšķa
        sqV += (-sq * 260 - sqV * 14) * dt; sq += sqV * dt;
      }
      const speed = Math.hypot(vx, vy);
      const stretch = RM ? 0 : clamp(speed / 2500, 0, .14);
      const breathe = RM ? 0 : Math.sin(now / 700) * .025;
      const sx = 1 + sq * .12 - stretch * .5 + breathe + hover * .06;
      const sy = 1 - sq * .12 + stretch - breathe + hover * .06;

      el.style.transform = `translate3d(${x - 6}px, ${y - 6}px, 0)`;
      swing.style.transform = `rotate(${ang.toFixed(2)}deg)`;
      const bt = `translate(38px,48px) scale(${sx.toFixed(3)},${sy.toFixed(3)}) translate(-38px,-48px)`;
      body.style.transform = bt; glass.style.transform = `scale(${sx.toFixed(3)},${sy.toFixed(3)})`;

      // acis skatās kustības virzienā, laiku pa laikam samirkšķina
      const lxT = clamp(vx / 600, -1.2, 1.2), lyT = clamp(vy / 600, -1, 1);
      lookX += (lxT - lookX) * .15; lookY += (lyT - lookY) * .15;
      if (!RM) { blinkT -= dt; if (blinkT <= 0) { blink = .14; blinkT = rand(2.5, 5.5); } }
      if (blink > 0) blink -= dt;
      happyT = Math.max(0, happyT - dt);
      const isHappy = happyT > 0;
      eyes.style.opacity = isHappy ? 0 : 1;
      happy.setAttribute("opacity", isHappy ? 1 : 0);
      eyes.setAttribute("transform", `translate(${lookX.toFixed(2)} ${lookY.toFixed(2)}) translate(38 45) scale(1 ${blink > 0 ? .12 : 1 + hover * .15}) translate(-38 -45)`);
      mouth.setAttribute("d", isHappy || hover > .5 ? "M34.5 50q3.5 4.5 7 0" : "M35 50.5q3 3 6 0");
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
