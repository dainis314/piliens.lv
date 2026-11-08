// piliens.lv valodas: visas 24 ES oficiālās valodas, bez ārējām bibliotēkām.
// Teksti ir lang/<kods>.json; ielādē tikai izvēlēto valodu (un latviešu kā rezervi), ar kešu.
// HTML elementi: data-i18n="atslēga" (teksts) un data-i18n-attr="aria-label:atslēga;alt:atslēga".
// JS teksti: t(), tp() (daudzskaitlis ar Intl.PluralRules), num()/temp()/pct() (Intl.NumberFormat), onLang().

export const LANGS = [
  ["lv", "Latviešu", "lv_LV"], ["en", "English", "en_GB"], ["de", "Deutsch", "de_DE"], ["fr", "Français", "fr_FR"],
  ["es", "Español", "es_ES"], ["it", "Italiano", "it_IT"], ["pl", "Polski", "pl_PL"], ["nl", "Nederlands", "nl_NL"],
  ["pt", "Português", "pt_PT"],
  // pārējās pēc pašnosaukuma alfabēta
  ["bg", "Български", "bg_BG"], ["cs", "Čeština", "cs_CZ"], ["da", "Dansk", "da_DK"], ["et", "Eesti", "et_EE"],
  ["el", "Ελληνικά", "el_GR"], ["ga", "Gaeilge", "ga_IE"], ["hr", "Hrvatski", "hr_HR"], ["lt", "Lietuvių", "lt_LT"],
  ["hu", "Magyar", "hu_HU"], ["mt", "Malti", "mt_MT"], ["ro", "Română", "ro_RO"], ["sk", "Slovenčina", "sk_SK"],
  ["sl", "Slovenščina", "sl_SI"], ["fi", "Suomi", "fi_FI"], ["sv", "Svenska", "sv_SE"]
].map(([code, name, locale]) => ({ code, name, locale }));
const CODES = new Set(LANGS.map(l => l.code));
const STORE = "piliens.lang";

let lang = "lv", dict = {}, base = {};
const cache = new Map(), subs = new Set();
const year = new Date().getFullYear();
const VARS = { year: year > 2026 ? `2026–${year}` : "2026" };

function load(code) {
  if (!cache.has(code)) cache.set(code, fetch(`lang/${code}.json`).then(r => {
    if (!r.ok) throw new Error(`lang/${code}.json: ${r.status}`);
    return r.json();
  }).catch(e => { cache.delete(code); throw e; }));
  return cache.get(code);
}
const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (m, k) => (vars && k in vars ? vars[k] : k in VARS ? VARS[k] : m));

export const getLang = () => lang;
export function t(key, vars) {
  let s = key in dict ? dict[key] : base[key];
  if (s == null) return "";
  if (typeof s === "object") s = s.other ?? "";
  return fill(s, vars);
}
export function tp(key, n, vars) {
  const forms = key in dict ? dict[key] : base[key];
  if (!forms) return "";
  if (typeof forms === "string") return fill(forms, vars);
  const cat = new Intl.PluralRules(lang).select(n);
  return fill(forms[cat] ?? forms.other ?? "", vars);
}
export const num = (n, o) => new Intl.NumberFormat(lang, o).format(n);
export const temp = n => num(n, { style: "unit", unit: "celsius", signDisplay: "always", maximumFractionDigits: 0 });
export const pct = f => num(f, { style: "percent" });
export function onLang(cb) { subs.add(cb); }

function setMeta(sel, val) { const m = document.querySelector(sel); if (m) m.setAttribute("content", val); }
function apply() {
  const L = LANGS.find(l => l.code === lang);
  document.documentElement.lang = lang;
  document.title = t("meta.title");
  setMeta('meta[name="description"]', t("meta.description"));
  setMeta('meta[property="og:description"]', t("meta.og"));
  setMeta('meta[name="twitter:description"]', t("meta.og"));
  setMeta('meta[property="og:title"]', t("meta.title"));
  setMeta('meta[name="twitter:title"]', t("meta.title"));
  setMeta('meta[property="og:locale"]', L.locale);
  for (const el of document.querySelectorAll("[data-i18n]")) {
    const v = t(el.dataset.i18n);
    el.textContent = v;
    if (el.hasAttribute("data-i18n-hide-empty")) el.hidden = !v;
  }
  for (const el of document.querySelectorAll("[data-i18n-attr]"))
    for (const pair of el.dataset.i18nAttr.split(";")) {
      const [attr, key] = pair.split(":").map(s => s.trim());
      if (attr && key) el.setAttribute(attr, t(key));
    }
  const code = document.getElementById("langCode"); if (code) code.textContent = lang.toUpperCase();
  for (const o of document.querySelectorAll("#langList [role=option]")) o.setAttribute("aria-selected", String(o.dataset.code === lang));
  for (const cb of subs) { try { cb(lang); } catch (e) { console.error(e); } }
}

export async function setLang(code, save = true) {
  if (!CODES.has(code)) code = "lv";
  const [d, b] = await Promise.all([load(code), code === "lv" ? null : load("lv").catch(() => ({}))]);
  lang = code; dict = d; base = b || d;
  if (save) { try { localStorage.setItem(STORE, code); } catch (e) { /* privātais režīms */ } }
  apply();
}

function detect() {
  const q = (new URLSearchParams(location.search).get("lang") || "").toLowerCase();
  if (CODES.has(q)) return { code: q, save: true };
  try { const s = localStorage.getItem(STORE); if (CODES.has(s)) return { code: s, save: false }; } catch (e) { /* nav krātuves */ }
  for (const l of navigator.languages || [navigator.language || ""]) {
    const c = String(l).toLowerCase().split("-")[0];
    if (CODES.has(c)) return { code: c, save: false };
  }
  return { code: "lv", save: false };
}

export async function initI18n() {
  const { code, save } = detect();
  try { await setLang(code, save); }
  catch (e) { console.warn(e); try { await setLang("lv", false); } catch (e2) { /* paliek HTML latviešu teksts */ } }
  initMenu();
}

// valodas izvēlne: poga ar lāsi un kodu; saraksts ar pašnosaukumiem (listbox, tastatūra, aria)
function initMenu() {
  const btn = document.getElementById("langBtn"), list = document.getElementById("langList");
  if (!btn || !list) return;
  list.innerHTML = "";
  LANGS.forEach((l, i) => {
    const li = document.createElement("li");
    li.setAttribute("role", "option"); li.tabIndex = -1; li.dataset.code = l.code; li.lang = l.code;
    li.setAttribute("aria-selected", String(l.code === lang));
    li.innerHTML = `<span class="nm"></span><span class="cd">${l.code.toUpperCase()}</span>`;
    li.firstChild.textContent = l.name;
    if (i === 9) li.classList.add("sep");                    // atdala populārās no pārējām
    list.appendChild(li);
  });
  const opts = [...list.children];
  const open = () => {
    list.hidden = false; btn.setAttribute("aria-expanded", "true");
    (opts.find(o => o.dataset.code === lang) || opts[0]).focus();
    document.addEventListener("pointerdown", outside, true);
  };
  const close = (refocus = true) => {
    if (list.hidden) return;
    list.hidden = true; btn.setAttribute("aria-expanded", "false");
    document.removeEventListener("pointerdown", outside, true);
    if (refocus) btn.focus();
  };
  const outside = e => { if (!list.contains(e.target) && !btn.contains(e.target)) close(false); };
  const choose = o => { close(); if (o.dataset.code !== lang) setLang(o.dataset.code).catch(e => console.warn(e)); };
  btn.addEventListener("click", () => (list.hidden ? open() : close()));
  btn.addEventListener("keydown", e => { if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); open(); } });
  list.addEventListener("click", e => { const o = e.target.closest("[role=option]"); if (o) choose(o); });
  list.addEventListener("keydown", e => {
    const i = opts.indexOf(document.activeElement);
    const go = j => { e.preventDefault(); opts[(j + opts.length) % opts.length].focus(); };
    if (e.key === "ArrowDown") go(i + 1);
    else if (e.key === "ArrowUp") go(i - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(opts.length - 1);
    else if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "Tab") close(false);
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (i >= 0) choose(opts[i]); }
    else if (e.key.length === 1) {                            // pirmā burta meklēšana
      const k = e.key.toLowerCase(), from = Math.max(i, 0);
      for (let n = 1; n <= opts.length; n++) { const o = opts[(from + n) % opts.length]; if (o.textContent.toLowerCase().startsWith(k)) { o.focus(); break; } }
    }
  });
}
