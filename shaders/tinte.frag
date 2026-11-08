// tinte: glāze no sāniem pret logu; tinte krīt, veido virpuļgredzenu, kas sadalās mazākos; uz galda krāsaina ēna
uniform float uRnd[32];
uniform sampler2D uTex0;
uniform sampler2D uTex1;    // tintes blīvums no simulācijas
uniform float uInkAmount;    // cik tintes kopā (ēnas krāsai uz galda)
uniform float uRefr;
uniform float uBgAspect;

vec3 inkAbs;       // cik stipri tinte absorbē katru krāsu (indigo laiž cauri zilo)

vec3 windowLight(vec2 uv) {
  // aiz loga: Daiņa mežs, ļoti izplūdis un pārgaismots
  vec3 c = photoCover(uTex0, clamp(uv, 0., 1.), uBgAspect, vec2(.5, .6), false);
  c = mix(vec3(luma(c)), c, .8) * 1.9 + vec3(.10, .11, .10);
  return c;
}

// tintes blīvums: virpuļgredzens ar kāju un sīkākiem gredzeniem zem tā
float ringBlob(vec2 q, vec2 c, float R, float r) {
  // gredzens no sāniem izskatās kā divi blīvi kodoli ar plānu "cepuri" virs tiem
  vec2 d1 = q - (c + vec2(-R, 0)), d2 = q - (c + vec2(R, 0));
  float cores = exp(-dot(d1, d1) / (r * r)) + exp(-dot(d2, d2) / (r * r));
  vec2 dc = (q - c - vec2(0, r * .6)) / vec2(R * 1.25, r * 1.1);
  float cap = exp(-dot(dc, dc)) * .55;
  return cores + cap;
}

float inkDensity(vec2 q, float W) {
  // q: glāzes koordinātās (x: -1..1 platumā, y: 0 dibens .. 1 ūdens virsma)
  vec2 w = q + .045 * vec2(fbm(q * 7. + 3., 4), fbm(q * 7. + 11., 4));
  w += .015 * vec2(fbm(q * 26., 3), fbm(q * 26. + 4., 3));
  float d = 0.;
  float cx = -.08 + .16 * uRnd[0];
  float ry = .48 + .12 * uRnd[1];
  // kāja: plāns pavediens no virsmas līdz gredzenam
  float stemX = cx + .03 * gnoise(vec2(w.y * 5., 1.));
  d += .55 * exp(-pow((w.x - stemX) / (.018 + .02 * (1. - w.y)), 2.)) * smoothstep(ry, ry + .06, w.y) * smoothstep(1.0, .9, w.y);
  // galvenais gredzens
  d += 1.6 * ringBlob(w, vec2(cx, ry), .16, .055);
  // gredzens sadalās mazākos, kas krīt zemāk
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float a = (fi - 1.5) / 1.5;
    vec2 c = vec2(cx + a * (.20 + .05 * hash12(vec2(fi, 3.))), ry - .14 - .08 * hash12(vec2(fi, 5.)) - .05 * abs(a));
    d += 1.1 * ringBlob(w, c, .055, .025);
    // vēl mazāki zem tiem
    for (int j = 0; j < 2; j++) {
      float fj = float(j);
      vec2 c2 = c + vec2((fj - .5) * .07, -.09 - .04 * hash12(vec2(fi, fj + 7.)));
      d += .7 * ringBlob(w, c2, .022, .012);
      // tievi pavedieni, kas savieno
      float tx = mix(c.x, c2.x, SAT((c.y - w.y) / max(c.y - c2.y, .01)));
      d += .35 * exp(-pow((w.x - tx) / .006, 2.)) * step(c2.y, w.y) * step(w.y, c.y);
    }
  }
  // izkliedēts plīvurs ap visu
  d += .25 * smoothstep(.3, .8, fbm(w * 4. + 2., 4)) * exp(-pow((w.x - cx) / .35, 2.)) * smoothstep(.15, .5, w.y) * smoothstep(1.0, .7, w.y);
  return d;
}

void main() {
  vec2 fc = gl_FragCoord.xy;
  float asp = uRes.x / uRes.y;
  vec2 uv = fc / uRes;
  vec2 p = (fc - .5 * uRes) / uRes.y;
  bool mobile = asp < .9;

  // tintes krāsa pēc sēklas: indigo, mellenes vai ozolu riekstu tinte
  float pick = uRnd[9];
  inkAbs = pick < .6 ? vec3(2.6, 2.2, .55) : (pick < .85 ? vec3(1.6, 2.6, 1.0) : vec3(1.4, 1.7, 2.3));

  // telpa: logs aiz glāzes, galds apakšā
  float tableY = mobile ? -.22 : -.20;
  vec3 col = windowLight(uv);
  // loga rāmja ēna kreisajā pusē un iekštelpas krēsla
  col *= mix(.25, 1., smoothstep(-.6 * asp, -.2 * asp, p.x + .03 * gnoise(vec2(p.y * 3., 2.))));

  // galds: mitra, gaiša koka virsma perspektīvā
  if (p.y < tableY) {
    float z = 1. / max(.02, tableY - p.y + .08);
    vec2 tq = vec2(p.x * z * .2, z * .5);
    float grain = fbm(vec2(tq.x * 2., tq.y * 18.), 4);
    vec3 wood = mix(vec3(.38, .28, .19), vec3(.56, .44, .32), .5 + .5 * grain);
    col = wood * (.7 + .3 * smoothstep(-.5, tableY, p.y));
    col += windowLight(vec2(uv.x, 1. - uv.y)) * .10 * smoothstep(tableY - .12, tableY, p.y);
  }

  // glāze
  float gx = mobile ? .04 * asp : .10 * asp;
  float gw = mobile ? .36 * asp : .23;
  float gBot = tableY - .11, gTop = mobile ? .36 : .40, waterY = mobile ? .26 : .29;
  float xn = (p.x - gx) / gw;
  float yn = (p.y - gBot) / (waterY - gBot);

  // ēna un kaustika uz galda: gaisma nāk no loga aizmugurē, tāpēc ēna krīt uz priekšu (lejup ekrānā)
  if (p.y < tableY) {
    float fwd = SAT((gBot - p.y) / .30);
    float hw2 = gw * (1. + .35 * fwd);
    float shx = (p.x - gx - .04 * fwd) / hw2;
    float sh = smoothstep(1.05, .55, abs(shx)) * smoothstep(-.02, .02, gBot + .005 - p.y) * (1. - fwd * .65);
    vec3 tint = exp(-inkAbs * .7 * uInkAmount);
    col *= mix(vec3(1.), mix(vec3(.35), tint * .8 + .1, .8), sh * .75);
    // cilindriskās lēcas fokuss: spoža josla ēnas vidū
    float caustic = exp(-pow(shx / (.18 + .2 * fwd), 2.)) * sh * (1. - .4 * fwd);
    col += vec3(1., .96, .88) * caustic * .55 * (.6 + .4 * fbm(vec2(shx * 4., p.y * 30.), 3));
    col += tint * caustic * .35 * uInkAmount;
  }

  if (abs(xn) < 1. && p.y > gBot && p.y < gTop) {
    // cilindriska lēca: fons glāzē palielināts un apgriezts
    float lens = xn * (1. - .55 * (1. - xn * xn));
    vec2 buv = vec2((gx + lens * gw * -.85) / asp + .5, uv.y);
    bool inWater = p.y < waterY + .012 * (pow(abs(xn), 8.));   // menisks pie sienām
    vec3 inside;
    if (inWater) {
      inside = windowLight(buv) * vec3(.93, .97, .98);
      vec2 q = vec2(xn, yn);
      vec2 sq = vec2(lens * .5 + .5, yn);   // laušana: tinte redzama caur cilindrisko lēcu
      float dens = texture(uTex1, clamp(sq, 0., 1.)).r;
      dens += .25 * (texture(uTex1, sq + vec2(.006, 0)).r - texture(uTex1, sq - vec2(.006, 0)).r) * 0.;
      inside *= exp(-inkAbs * dens * .9);
      // gaisma, kas izkliedējas tintes malās
      inside += exp(-inkAbs * .4) * .06 * smoothstep(.1, .6, dens) * (1. - smoothstep(.6, 2.2, dens));
    } else {
      inside = windowLight(vec2((gx + xn * gw * 1.02) / asp + .5, uv.y)) * .97;
    }
    // ūdens virsma no sāniem: plāna gaiša līnija ar meniska izliekumu
    float surf = smoothstep(.006, .0, abs(p.y - waterY - .012 * pow(abs(xn), 8.)));
    inside = mix(inside, vec3(1.15), surf * .5);
    inside *= .95 - .2 * smoothstep(.0, -.05, p.y - waterY) * (1. - step(p.y, waterY));
    // sienas: tumšāka mala ar atspīdumiem
    float wall = smoothstep(.86, 1., abs(xn));
    inside = mix(inside, inside * .55 + vec3(.05), wall);
    inside += vec3(1.) * smoothstep(.035, .0, abs(xn + .80)) * .45;
    inside += vec3(1.) * smoothstep(.02, .0, abs(xn - .9)) * .25;
    // glāzes dibens: biezs stikls
    float base = smoothstep(.03, .0, p.y - gBot - .025);
    inside = mix(inside, inside * .7 + vec3(.12, .13, .13), base);
    float aa = 1. - smoothstep(.985, 1., abs(xn));
    col = mix(col, inside, aa);
  }
  // malas augšā: glāzes mala
  float rimY = gTop;
  col += vec3(.9) * smoothstep(.004, .0, abs(p.y - rimY)) * step(abs(xn), 1.) * .5;

  col *= .82 + .18 * smoothstep(1.2, .3, length((uv - vec2(.55, .5)) * vec2(asp * .7, 1.)));
  outColor = vec4(finish(col * .95, fc), 1.);
}
