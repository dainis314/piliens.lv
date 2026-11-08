// piliens.lv v2: kopīgie palīgrīki (sēkla, matemātika, skaņa)

export const RM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
export const PERF = new URLSearchParams(location.search).has("perf");
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
export const START = performance.now();

// Sēkla: ?seed=123 atkļūdošanai un ekrānuzņēmumiem, citādi katram apmeklējumam sava
export const SEED = (() => {
  const q = new URLSearchParams(location.search).get("seed");
  if (q !== null && q !== "" && !isNaN(+q)) return (+q) >>> 0;
  return (Math.random() * 2 ** 31) >>> 0;
})();

// mulberry32
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const R = rng(SEED ^ 0x9E3779B9);
export const rand = (a, b) => a + R() * (b - a);
// ritmi nekad neatkārtojas precīzi: periods ar nelielu nejaušu novirzi
export const jitter = (base, frac = .15) => base * (1 + (R() * 2 - 1) * frac);

export function localPoint(el, ev) {
  const r = el.getBoundingClientRect();
  return { x: (ev.clientX - r.left) / r.width, y: (ev.clientY - r.top) / r.height };
}
export function onActivate(el, fn) {
  el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); } });
}

// ---------- skaņa: sintezēta, sākumā izslēgta ----------
let AC = null, soundOn = false, lastT = 0, echo = null;
export const sound = {
  get on() { return soundOn; },
  toggle() {
    if (!AC) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (C) {
        AC = new C();
        // atbalss akmens bļodai
        const d = AC.createDelay(1); d.delayTime.value = .11;
        const fb = AC.createGain(); fb.gain.value = .32;
        const lp = AC.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2400;
        d.connect(lp).connect(fb).connect(d); lp.connect(AC.destination);
        echo = d;
      }
    }
    if (AC && AC.state === "suspended") AC.resume();
    soundOn = !soundOn;
    return soundOn;
  }
};
// virsmas: "pelke" dziļāks, "udens" skaidrs, "akmens" skanīgs ar atbalsi, "stikls" sīks
export function plink(surface = "udens", vol = .2) {
  if (!soundOn || !AC) return;
  const now = AC.currentTime;
  if (now - lastT < .035) return;
  lastT = now;
  const P = { pelke: [300, 520, 2.0, .26], udens: [560, 900, 2.3, .2], akmens: [700, 1100, 2.6, .28], stikls: [1400, 2200, 1.6, .07] }[surface] || [560, 900, 2.3, .2];
  const o = AC.createOscillator(), g = AC.createGain();
  const f0 = rand(P[0], P[1]);
  o.type = "sine";
  o.frequency.setValueAtTime(f0, now);
  o.frequency.exponentialRampToValueAtTime(f0 * P[2], now + .055);
  g.gain.setValueAtTime(.0001, now);
  g.gain.exponentialRampToValueAtTime(vol, now + .004);
  g.gain.exponentialRampToValueAtTime(.0001, now + P[3]);
  o.connect(g).connect(AC.destination);
  if (surface === "akmens" && echo) g.connect(echo);
  o.start(now); o.stop(now + P[3] + .02);
}
