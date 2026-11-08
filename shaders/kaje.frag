// kājene: Daiņa foto no Baltijas jūras krasta (aļģēm apauguši laukakmeņi).
// Ūdenī: maigi viļņi, kas nāk uz krastu (perspektīvā), atspīdumi, putas ap akmeņiem un dzintars, kas šūpojas.
// Virs jūras: migla lēni ceļas augšup un izzūd; augstāk tā sablīvējas sīkos pilienos (kā pirmajā lapā rasa),
// tā noslēdzot ciklu: jūra, migla, lietus.
uniform float uRnd[32];
uniform sampler2D uTex0;   // foto
uniform sampler2D uTex1;   // ūdens maska (1 = ūdens, 0 = akmeņi, debesis, tālais krasts)
uniform float uBgAspect;

vec2 coverTC(vec2 uv, vec2 focus) {
  float scrAsp = uRes.x / uRes.y;
  vec2 sc = uBgAspect > scrAsp ? vec2(scrAsp / uBgAspect, 1.) : vec2(1., uBgAspect / scrAsp);
  vec2 o = clamp(focus - sc * .5, vec2(0), vec2(1) - sc);
  return o + clamp(uv, 0., 1.) * sc;
}
vec3 photoTC(vec2 tc) { return pow(texture(uTex0, clamp(tc, 0., 1.)).rgb, vec3(2.2)); }

void main() {
  vec2 fc = gl_FragCoord.xy;
  float asp = uRes.x / uRes.y;
  vec2 uv = fc / uRes;
  vec2 p = (fc - .5 * uRes) / uRes.y;
  bool mobile = asp < .9;
  vec2 focus = mobile ? vec2(.45, .5) : vec2(.5, .5);
  vec2 tc = coverTC(uv, focus);
  float t = uTime;

  // ---------- ūdens: viļņi perspektīvā ----------
  float wm = texture(uTex1, tc).r;
  float hY = .765 - .036 * tc.x;                         // horizonts bildē (tc.y, augšā = 1)
  float dist = max(hY - tc.y, 0.);                       // attālums zem horizonta: tuvāk krastam = lielāks
  vec2 off = vec2(0.);
  float slope = 0., ph1 = 0., Z = 0., xw = 0.;
  if (wm > .01) {
    Z = 1. / (dist + .035);                              // dziļuma koordināta: viļņu virsotnes nāk uz krastu
    xw = tc.x * uBgAspect * Z;
    ph1 = Z * 1.9 + t * 1.15 + .9 * gnoise(vec2(xw * .22, Z * .12));
    float ph2 = Z * 3.1 + xw * .45 + t * 1.8;
    float wv = sin(ph1) * .7 + sin(ph2) * .3;
    slope = cos(ph1) * .7 + cos(ph2) * .3;
    float amp = .0042 * smoothstep(.0, .2, dist) * (.3 + dist * 1.5);
    off = vec2(.001 * gnoise(vec2(xw * .4, t * .35)) * (.3 + dist * 2.), wv * amp) * smoothstep(.2, .8, wm);
  }
  vec3 col = photoTC(tc + off);

  if (wm > .01) {
    // atspīdumi: viļņu nogāzes, kas vērstas pret gaišajām debesīm; tālumā sīki dzirkstoši punkti
    float glint = pow(SAT(slope), 5.) * smoothstep(.0, .05, dist) * (1. - smoothstep(.22, .55, dist));
    float spark = pow(SAT(gnoise(vec2(xw * 1.6, Z * 9. - t * 1.2)) * 1.3), 8.);
    col += vec3(.95, .96, .97) * (glint * .09 + spark * glint * .6) * wm;
    // putas ap akmeņiem: izplūdusī maska parāda akmeņu tuvumu; putas uzplūst ar katru vilni un izirst
    float nearRock = 1. - textureLod(uTex1, tc, 3.).r;
    float rim = wm * smoothstep(.08, .5, nearRock) * smoothstep(.05, .16, dist);
    if (rim > .01) {
      float surge = pow(SAT(.5 + .5 * sin(ph1 - 1.2)), 2.5);
      vec2 fp = vec2(tc.x * uBgAspect, tc.y) * 90. + vec2(t * .15, -t * .25);
      float holes = smoothstep(.35, .62, voronoi(fp, .9).y * 3.);
      float n = .5 + .5 * gnoise(fp * .15 + t * .2);
      col = mix(col, vec3(.88, .89, .87), rim * holes * (.25 + .5 * surge) * n * .75);
    }
  }

  // ---------- dzintars seklajā ūdenī: šūpojas līdzi viļņiem ----------
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    vec2 c = (vec2(.62 + .3 * hash12(vec2(fi, 3.)), .05 + .10 * hash12(vec2(fi, 5.))) - .5) * vec2(asp, 1.);
    c += vec2(.0035 * sin(t * .7 + fi * 1.7), .0025 * sin(t * 1.1 + fi * 2.3));
    float r = i == 0 ? .020 : .007 + .010 * pow(hash12(vec2(fi, 7.)), 2.);
    vec2 q = (p - c) / r;
    if (dot(q, q) > 4.) continue;
    float d = length(q * vec2(1., 1.25)) - 1. - .22 * gnoise(q * 1.7 + fi * 3.);
    if (d < .6) col *= 1. - .22 * smoothstep(.6, .0, d) * step(-.1, d);    // kontakta ēna
    if (d < 0.) {
      float h = SAT(-d * 1.4);
      vec3 am = mix(vec3(.42, .14, .02), vec3(.96, .58, .16), h * .85 + .15);
      vec2 hl = vec2(-.3 + .12 * sin(t * .9 + fi), .38);                    // atspīdums slīd līdzi ūdens kustībai
      am += vec3(1., .9, .75) * exp(-dot(q - hl, q - hl) * 7.) * (.55 + .25 * sin(t * 1.3 + fi * 2.));
      am = mix(am, am * .65 + vec3(.05, .07, .08), .45);                    // zem ūdens: vēsāks, blāvāks
      am += vec3(.9) * smoothstep(.06, .0, abs(gnoise(q * 3. + fi + vec2(0., t * .4)))) * .08;
      if (i == 0) am = mix(am, vec3(.30, .14, .04), smoothstep(.10, .0, abs(q.y - q.x * .45)) * step(abs(q.x), .55) * .75);
      col = mix(col, am, smoothstep(.0, -.12, d));
    }
  }

  // ---------- migla ceļas no jūras augšup, izklīst un sablīvējas sīkos pilienos ----------
  float above = tc.y - hY;                               // augstums virs horizonta (bildes vienībās)
  if (above > -.05 && above < .42) {
    vec2 mp = vec2(tc.x * uBgAspect, tc.y);
    float rise = t * .010;                               // lēna celšanās
    float n1 = fbm(vec2(mp.x * 2.2, (mp.y - rise) * 7.) + vec2(t * .012, 0.), 3);
    float n2 = fbm(vec2(mp.x * 4.5 + 7., (mp.y - rise * 1.6) * 12.), 2);
    float prof = above > 0. ? exp(-above / .11) : exp(above / .02);   // biezāka pie ūdens, augšup izzūd
    float mist = SAT(.55 + .9 * n1 + .35 * n2) * prof;
    col = mix(col, vec3(.97, .98, .99), mist * .42);       // migla, ko izgaismo debesis
    // augšup ceļoties migla sablīvējas: sīki pilieni, kas iemirdzas, lēni ceļas un izgaist
    if (above > .03 && above < .36) {
      vec2 gp = vec2(mp.x, mp.y - t * .006) * vec2(55., 55.);
      vec2 cell = floor(gp), f = fract(gp);
      vec2 rp = .2 + .6 * hash22(cell + 11.);
      float life = fract(t * .07 + hash12(cell + 3.));
      float on = smoothstep(.0, .25, life) * smoothstep(1., .6, life) * step(.55, hash12(cell + 9.));
      float dens = SAT(.5 + .9 * n1) * smoothstep(.03, .12, above) * smoothstep(.36, .2, above);
      if (on * dens > .01) {
        float rr = (.13 + .10 * hash12(cell + 5.)) * (.6 + .4 * life);   // ~2–4 px
        vec2 q = (f - rp) / rr;
        float r2 = dot(q, q);
        if (r2 < 1.) {
          // sīka lēca: apgriezta tumšākā jūra lejasdaļā, tumša mala, ass spīduma punkts augšā pa kreisi
          vec3 inv = photoTC(tc + vec2(0., -.03 - .02 * q.y)) * .9;
          vec3 dcol = mix(inv, col, .35) * (1. - .55 * smoothstep(.45, 1., r2));
          dcol += vec3(1.) * exp(-dot(q - vec2(-.35, .42), q - vec2(-.35, .42)) * 14.) * .7;
          col = mix(col, dcol, on * dens * (1. - smoothstep(.75, 1., r2)));
        }
      }
    }
  }

  // mīksta tumšāka migla apakšā aiz paraksta un labajā malā aiz navigācijas
  col = mix(col, col * .45, smoothstep(.55, .0, length(uv * vec2(asp * .9, 1.6))) * .8);
  col = mix(col, col * .55, smoothstep(.3, .0, length((uv - vec2(1., .5)) * vec2(asp * 1.4, .75))) * .7);
  col = pow(max(col, 0.), vec3(1. / 2.2));
  col += (hash12(fc) - .5) * (1.5 / 255.);
  outColor = vec4(col, 1.);
}
