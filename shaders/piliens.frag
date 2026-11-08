// piliens: rasas punkts. Fons: Daiņa sarmas rīts (saule labajā augšā, sarma kreisajā apakšā), izplūdis.
// Burti: auksts, slapjš šīferis ar reljefu; uz aukstajiem burtiem kondensāts kā sīkas lēcas; apakšā peļķe ar atspulgu.
uniform float uRnd[32];
uniform sampler2D uTex0;   // vārda maska (izplūdusi, augstuma karte)
uniform sampler2D uTex1;   // sarmas rīts, ass
uniform sampler2D uTex2;   // sarmas rīts, izplūdis
uniform float uBgAspect;
uniform sampler2D uTex3;   // lāšu normāļu karte no fizikas (rg normāle, b pārklājums, a: 1 = krītoša lāse)
uniform vec4 uRip[6];      // peļķes viļņi: x (0..1), vecums (s), stiprums

vec3 bg(vec2 uv) {
  vec3 c = photoCover(uTex2, clamp(uv, 0., 1.), uBgAspect, vec2(.55, .62), false);
  return c;
}
float dpos(vec2 uv) { return (uv.x + uv.y) * .5; }          // 0 = kreisā apakša (auksts), 1 = labā augša (silts)

void main() {
  vec2 fc = gl_FragCoord.xy;
  float asp = uRes.x / uRes.y;
  vec2 uv = fc / uRes;
  vec2 p = (fc - .5 * uRes) / uRes.y;

  vec3 col = bg(uv);
  float d = dpos(uv);
  float DEW = .555;
  // siltā puse: saules dūmaka un putekļi; vēsā: zilgana migla
  col = mix(col, col * vec3(.78, .9, 1.08) + vec3(.02, .04, .07), smoothstep(DEW, .1, d) * .55);
  float warmK = smoothstep(.55, 1., d);
  vec2 sunP = (uv - vec2(1.02, 1.04)) * vec2(asp, 1.);
  float sunGlow = exp(-dot(sunP, sunP) * 2.2);
  col = mix(col, col * vec3(1.25, .98, .70) + vec3(.07, .025, 0.), warmK * .85);   // silts krāsu tonis
  col += vec3(1., .62, .28) * (.26 * warmK + .75 * sunGlow);                       // saules siltums stūrī
  col += vec3(1., .80, .55) * .18 * sunGlow * (.6 + .4 * fbm(sunP * 3. + uTime * .05, 3)); // virmojošs gaiss
  for (int i = 0; i < 26; i++) {
    float fi = float(i);
    vec2 dp = vec2(.5 + .5 * hash12(vec2(fi, 31.)), .45 + .55 * hash12(vec2(fi, 37.)));
    float rad = .0012 + .005 * pow(hash12(vec2(fi, 41.)), 4.);
    vec2 dd = (uv - dp) * vec2(asp, 1.);
    col += vec3(1., .85, .6) * exp(-dot(dd, dd) / (rad * rad)) * .45;
  }

  // ---------- burti ----------
  float m = texture(uTex0, uv).r;
  float e = 1.5 / uRes.y;
  float mx = texture(uTex0, uv + vec2(e, 0)).r - texture(uTex0, uv - vec2(e, 0)).r;
  float my = texture(uTex0, uv + vec2(0, e)).r - texture(uTex0, uv - vec2(0, e)).r;
  // ēna aiz burtiem (gaisma no labās augšas)
  float shadow = texture(uTex0, uv + vec2(.004, .006)).r;
  col *= 1. - .22 * shadow * (1. - m);
  if (m > .02) {
    vec3 n = normalize(vec3(-mx * 6., -my * 6., 1.));
    // šīfera reljefs: slāņaini, smalki graudi
    vec2 sp = p * vec2(1., 1.);
    float layers = fbm(vec2(sp.x * 9., sp.y * 22.) + 1.5 * fbm(sp * 5., 3), 4);
    float grain = fbm(sp * 260., 3);
    n = normalize(n + vec3(.10 * grain, .08 * layers + .06 * grain, 0.));
    vec3 slate = mix(vec3(.050, .070, .080), vec3(.10, .13, .14), .5 + .5 * layers) * (.85 + .2 * grain);
    float cold = smoothstep(DEW, .2, d);
    slate *= 1. - .25 * cold;                                          // mitrs = tumšāks
    vec3 L = normalize(vec3(.6, .7, .45));
    float dif = max(dot(n, L), 0.);
    vec3 lit = slate * (vec3(1., .82, .62) * 1.4 * dif + vec3(.35, .42, .50) * .7);
    float spec = pow(max(dot(reflect(-L, n), vec3(0, 0, 1)), 0.), mix(20., 70., cold));
    lit += vec3(1., .85, .65) * spec * mix(.15, .6, cold);              // slapjais šīferis spīd
    col = mix(col, lit, smoothstep(.35, .55, m));
  }

  // ūdens lāses no fizikas: caurspīdīgas lēcas. Zem lāses redzams tas pats šīferis (vai fons),
  // nedaudz palielināts; tumšāka mala (pilnā iekšējā atstarošana), ass spīduma punkts pret sauli,
  // kaustika pretējā pusē un maza, mīksta ēna prom no gaismas.
  vec4 dm = texture(uTex3, uv);
  float shA = texture(uTex3, uv + vec2(.0022, .0034)).b;
  col *= 1. - .22 * smoothstep(.1, .8, shA) * (1. - smoothstep(.02, .3, dm.b));
  if (dm.b > .02) {
    vec2 n = (dm.rg - .5) * 2.;
    float r = min(1., length(n));
    float hh = sqrt(max(0., 1. - r * r));
    float onLetter = smoothstep(.3, .6, m);
    // kas redzams caur lāsi: uz burta tas pats šīferis (lāse to tikai palielina un mazliet izgaismo),
    // ārpus burta apgriezts un saspiests fons
    vec3 behind = mix(bg(uv - n * vec2(.010 / asp, .010)) , col, onLetter);
    vec3 c = behind * (.88 + .18 * hh);                          // lēca savāc gaismu vidū
    c *= 1. - .72 * smoothstep(.5, 1., r);                      // tumšā mala
    vec2 L = vec2(.45, .55);                                     // gaisma no labās augšas
    c += vec3(1., .86, .64) * .28 * exp(-dot(n + L * .78, n + L * .78) * 22.);   // kaustika pretējā pusē
    float spec = exp(-dot(n - L * .6, n - L * .6) * 55.);
    c += vec3(1., .97, .92) * spec * 1.9;                        // ass atspīdums
    c += vec3(1., .9, .75) * exp(-dot(n - L * .45, n - L * .45) * 18.) * .10;
    c += bg(vec2(1.) - uv * .5) * pow(r, 5.) * .08;              // Freneļa atspulgs malā
    col = mix(col, c, smoothstep(.02, .25, dm.b));
  }

  // rasas punkta līnija: vienīgā apzināti taisnā līnija
  float lineD = ((uv.x + uv.y) - 2. * DEW) / 1.4142;            // ar zīmi: + siltāk, - vēsāk
  float wob = .012 * fbm(vec2((uv.x - uv.y) * 4., uTime * .06), 3);
  float band = exp(-pow((lineD + wob) / .045, 2.));                // plata, mīksta josla, bez malām
  float wisps = smoothstep(.15, .7, fbm(vec2((uv.x - uv.y) * 9., lineD * 30.) + vec2(uTime * .04, 0.), 4));
  float outside = 1. - smoothstep(.3, .6, m);
  col = mix(col, vec3(.86, .90, .92), band * (.10 + .14 * wisps) * outside);  // migla, kur tvaiks kondensējas

  // peļķe apakšā: neregulāra mala, sūna un oļi, vārda atspulgs
  float py = -.34 + .06 * fbm(vec2(p.x * 2.2, 1.), 4) + .015 * gnoise(vec2(p.x * 14., 2.));
  if (p.y < py) {
    float sy = py + .5;
    float rw = 0.;
    for (int k = 0; k < 6; k++) {
      if (uRip[k].z <= 0.) continue;
      vec2 rd = vec2((uv.x - uRip[k].x) * asp, (p.y - py) * 4.);
      float rr = length(rd), fr = uRip[k].y * .22;
      rw += sin((rr - fr) * 120.) * exp(-pow((rr - fr) * 18., 2.)) * exp(-uRip[k].y * 1.4) * uRip[k].z;
    }
    vec2 ruv = vec2(uv.x + .004 * sin(p.x * 50. + p.y * 260.) + rw * .004, sy + (sy - uv.y) * 3.2 + .006 * gnoise(p * 60.) + rw * .012);
    vec3 refl = bg(ruv);
    float rm = texture(uTex0, ruv).r;
    refl = mix(refl, vec3(.04, .06, .07), smoothstep(.35, .55, rm) * .85);
    vec3 water = mix(vec3(.03, .04, .035), refl * .9, .45 + .35 * smoothstep(py - .16, py, p.y));
    float edge = smoothstep(.0, .012, py - p.y);
    vec3 shore = mix(vec3(.10, .14, .05), vec3(.26, .30, .14), .5 + .5 * fbm(p * 120., 3));
    col = mix(shore, water, edge);
    vec4 pv = voronoi(p * 34., .9);
    if (hash12(pv.zw) > .8 && length(p - pv.zw / 34.) < .012 && py - p.y < .05) col = mix(vec3(.13, .12, .11), vec3(.24, .21, .18), .5 + .5 * fbm(p * 200., 2));
    col += vec3(.9, .8, .6) * smoothstep(.003, .0, abs(py - p.y - .012)) * .15;
  }
  // izplūdis priekšplāns: sarmota zāle kreisajā apakšā
  float blades = 0.;
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    float x0 = -.5 * asp + .02 + .2 * hash12(vec2(fi, 61.));
    float y = p.y + .5;
    float x = x0 + (.25 + .4 * hash12(vec2(fi, 62.))) * y * y;
    float w = .012 * (1. - y * 1.4);
    blades = max(blades, smoothstep(w + .025, w * .1, abs(p.x - x)) * smoothstep(.55, .3, y) * step(0., w));
  }
  col = mix(col, vec3(.10, .13, .14), blades * .5);
  col *= .85 + .15 * smoothstep(1.2, .3, length((uv - .5) * vec2(asp * .7, 1.)));
  outColor = vec4(finish(col * 1.05, fc), 1.);
}
