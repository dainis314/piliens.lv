// rasa: Daiņa fotogrāfija; lāse-lēca ar laušanu, sīktēli kā īstas ūdens lāses, maiga migla aiz navigācijas un paraksta
uniform float uRnd[32];
uniform sampler2D uTex0;   // galvenā bilde
uniform sampler2D uTex1;   // 8 sīktēlu atlass
uniform float uImgAspect;
uniform vec2 uFocus;
uniform sampler2D uTex2;   // iepriekšējā bilde (pārejai)
uniform float uPrevAspect;
uniform vec2 uPrevFocus;
uniform float uTrans;      // 0..1 kopš pārslēgšanas; >=1 pāreja beigusies
uniform vec2 uImpact;      // lāses trieciena vieta (ekrāna 0..1)
uniform int uSel;
uniform float uLensR;
uniform int uMouseThumb;
uniform sampler2D uTex3;   // nākamā bilde (pārvilkšanai pa kreisi)
uniform sampler2D uTex4;   // iepriekšējā bilde (pārvilkšanai pa labi)
uniform vec4 uNextInfo;    // aspekts, fokuss (x, y), -
uniform vec4 uPrev2Info;
uniform float uSlide;      // pārvilkšana: bīde ekrāna platumos (−1..1; mīnus = nāk nākamā no labās)

vec3 photoRaw(vec2 uv) { return photoCover(uTex0, clamp(uv, 0., 1.), uImgAspect, uFocus, false); }
vec3 photoPrev(vec2 uv) { return photoCover(uTex2, clamp(uv, 0., 1.), uPrevAspect, uPrevFocus, false); }
// pārvilkšana: bilde seko pirkstam; šuvē starp bildēm maiga ūdens lēca (lāses trieciena klusais variants)
vec3 photoSlide(vec2 uv) {
  float asp = uRes.x / uRes.y;
  float seam = uSlide < 0. ? 1. + uSlide : uSlide;          // šuves vieta ekrānā (0..1)
  float d = (uv.x - seam) * asp;
  float k = exp(-d * d * 260.);
  float x = uv.x - uSlide - sign(d) * k * .018;              // laušana šuvē: abas puses viegli "palielinās"
  vec2 y = vec2(0., (uv.y - .5) * k * .03);
  vec3 c;
  if (x >= 0. && x <= 1.) c = photoRaw(vec2(x, uv.y) - y);
  else if (x > 1.) c = photoCover(uTex3, clamp(vec2(x - 1., uv.y) - y, 0., 1.), uNextInfo.x, uNextInfo.yz, false);
  else c = photoCover(uTex4, clamp(vec2(x + 1., uv.y) - y, 0., 1.), uPrev2Info.x, uPrev2Info.yz, false);
  float rip = sin(d * 70. - uTime * 5.) * k;
  return c * (1. - .06 * k) + vec3(1.) * (k * .07 + max(rip, 0.) * .05);
}
// pāreja: uz bildes uzkrīt lāse, un jaunā bilde izplešas no trieciena vietas kā vilnis ar laušanu malā
vec3 photo(vec2 uv) {
  if (abs(uSlide) > 1e-4) return photoSlide(uv);
  if (uTrans >= 1.) return photoRaw(uv);
  float asp = uRes.x / uRes.y;
  vec2 d = (uv - uImpact) * vec2(asp, 1.);
  float r = length(d);
  float front = uTrans * uTrans * 1.6 + .02;
  float edge = r - front - .025 * fbm(d * 6. + uTrans, 3);
  float wave = exp(-edge * edge * 900.) ;
  vec2 off = (r > 1e-4 ? d / r : vec2(0)) * wave * .025 * vec2(1. / asp, 1.);
  vec3 a = photoPrev(uv - off), b = photoRaw(uv - off);
  vec3 c = mix(b, a, smoothstep(-.01, .01, edge));
  return c + vec3(1.) * wave * .12;
}

// ūdens lāse uz virsmas: lauž to, kas zem tās (apgriež un saspiež), ar Freneļa malu, spīdumu un ēnu
vec3 dropLens(vec2 p, vec2 c, float R, vec3 base, vec2 uv, int thumb) {
  vec2 q = (p - c) / R;
  float r2 = dot(q, q);
  if (r2 > 1.) return base;
  float h = sqrt(1. - r2);
  vec3 n = normalize(vec3(q, h * 1.25));
  // laušana ar n=1.33: redzamais punkts nobīdās pretēji normālei; lielākā lāsē attēls apgriežas
  vec3 col;
  if (thumb < 0) {
    // 1,9× palielinājums ap lāses centru + laušana malās
    vec2 cuv = (c * uRes.y + .5 * uRes) / uRes;
    vec2 d = q * R / 1.9 * (1. + .35 * (1. - h)) * vec2(uRes.y / uRes.x, 1.);
    col = photo(cuv + d) * 1.04;
  } else {
    vec2 tq = -q * (.85 + .15 * h);                       // apgriezts attēls lāsē
    vec2 tuv = vec2((float(thumb) + .5 + tq.x * .5) / 8., .5 + tq.y * .5);
    col = pow(texture(uTex1, tuv).rgb, vec3(2.2)) * 1.05;
  }
  float fres = pow(1. - h, 3.);
  col = mix(col, col * .45, smoothstep(.6, 1., sqrt(r2)) * .6);       // tumšāka mala (pilnā iekšējā atstarošanās)
  col += vec3(1.) * fres * .18;
  vec3 L = normalize(vec3(-.45, .55, .7));
  float spec = pow(max(dot(reflect(-L, n), vec3(0, 0, 1)), 0.), 120.);
  col += vec3(1.) * spec * 1.6;
  col += vec3(1.) * exp(-dot(q - vec2(.38, -.45), q - vec2(.38, -.45)) * 30.) * .25;  // kaustikas atspīdums lāses lejasdaļā
  float aa = 1. - smoothstep(.96, 1., sqrt(r2));
  return mix(base, col, aa);
}

void main() {
  vec2 fc = gl_FragCoord.xy;
  float asp = uRes.x / uRes.y;
  vec2 uv = fc / uRes;
  vec2 p = (fc - .5 * uRes) / uRes.y;
  bool mobile = asp < .9;

  // 2,5D: viegla parallakse ar dziļumu (bez dziļuma kartes koncepcijā: centrs tuvāk)
  vec3 col = photo(uv);

  // migla aiz navigācijas labajā malā un aiz paraksta (nevis kaste)
  float navFog = smoothstep(.34, .0, length((uv - vec2(1.0, .5)) * vec2(asp * 1.4, .75)));
  float capFog = smoothstep(.55, .0, length((uv - vec2(.0, .0)) * vec2(asp * .9, 1.6)));
  vec3 fogC = vec3(.04, .08, .03);
  col = mix(col, fogC, SAT(navFog * .7 + capFog * .6));

  // lēca, kas seko kursoram
  vec2 m = (uMouse - .5 * uRes) / uRes.y;
  float R = uLensR;
  // ēna zem lēcas
  float sd = length((p - m - vec2(.02, -.03)) / vec2(1., .9)) / R;
  col *= 1. - .25 * smoothstep(1.2, .6, sd) * step(1., length((p - m) / R));
  col = dropLens(p, m, R, col, uv, -1);

  // sīktēli kā ūdens lāses
  float tr = mobile ? .022 : .028;
  float rowY = mobile ? .5 - .09 : -.5 + .12;
  if (abs(p.y - rowY) < tr * 1.6)                  // sīktēlu rinda: citur cilpa neko nemaina
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    vec2 c = mobile ? vec2(-.5 * asp + .05 + fi * (tr * 2.3), .5 - .09)
                    : vec2(.5 * asp - .06 - (7. - fi) * tr * 2.35, -.5 + .12);
    float wob = uMouseThumb == i ? .06 * sin(uTime * 9.) : 0.;
    float rr = tr * (i == uSel ? 1.12 : 1.) * (1. + .05 * (hash12(vec2(fi, 3.)) - .5) + wob);
    // mīksta kontakta ēna
    float sdd = length((p - c - vec2(.003, -.006)) / rr);
    col *= 1. - .35 * smoothstep(1.25, .8, sdd) * step(1., length((p - c) / rr));
    col = dropLens(p, c, rr, col, uv, i);
    if (i == uSel) col += vec3(.95, 1., .9) * smoothstep(.04, .0, abs(length((p - c) / rr) - 1.12)) * .5;
  }
  // fotogrāfijai bez ACES: īstās krāsas paliek kā kamerā
  col = pow(max(col, 0.), vec3(1. / 2.2));
  col += (hash12(fc) - .5) * (1.5 / 255.);
  outColor = vec4(col, 1.);
}
