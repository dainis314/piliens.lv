// lietus: vecs koka logs vakarā; aiz stikla lauki, priedes, bērzi un tāls lauku mājas logs;
// stikls aprasojis, ar kursoru noslaucīta sliede, lāses kā lēcas
uniform float uRnd[32];

uniform sampler2D uTex0;   // sarmas rīts, ass
uniform sampler2D uTex1;   // sarmas rīts, izplūdis
uniform float uBgAspect;
uniform sampler2D uTex2;   // lāšu normāļu karte
uniform sampler2D uTex3;   // aprasojuma maska
// aiz loga: Daiņa fotogrāfija (sarmota pļava, egles, saule lec labajā pusē)
vec3 dusk(vec2 uv, float blur) {
  vec2 f = vec2(.5, .80);
  vec3 a = photoCover(uTex0, clamp(uv, 0., 1.), uBgAspect, f, false);
  vec3 b = photoCover(uTex1, clamp(uv, 0., 1.), uBgAspect, f, false);
  return mix(a, b, SAT(blur)) * .85;
}

void main() {
  vec2 fc = gl_FragCoord.xy;
  float asp = uRes.x / uRes.y;
  vec2 uv = fc / uRes;
  vec2 p = (fc - .5 * uRes) / uRes.y;
  bool mobile = asp < .9;

  // vecs stikls: viegls viļņainums
  vec2 wob = .004 * vec2(fbm(vec2(uv.y * 3., 1.), 2), fbm(vec2(uv.x * 2., 4.), 2));
  vec3 sharp = dusk(uv + wob, 0.);
  vec3 blurred = dusk(uv + wob, 1.);

  // aprasojums: uTex3 (r = 1 aprasojis, 0 noslaucīts), ko zīmē JS no kursora un slīdošajām lāsēm
  float fogA = texture(uTex3, uv).a;
  float fogN = .75 + .25 * fbm(p * 8., 3);
  vec3 fog = mix(blurred * 1.2, vec3(.62, .62, .64), .45) * fogN + vec3(.02);
  vec3 col = mix(sharp, fog, fogA);
  col += vec3(.04) * fogA * fbm(p * 220., 2);
  // noslaucītās vietas mala: kondensāta valnītis
  float fe = texture(uTex3, uv + vec2(1.5 / uRes.x, 0)).a - texture(uTex3, uv - vec2(1.5 / uRes.x, 0)).a;
  col += vec3(.10) * abs(fe) * 2.;

  // lāses uz stikla: uTex2 (rg = normāle, b = pārklājums), ko zīmē JS no lāšu fizikas
  vec4 dm = texture(uTex2, uv);
  if (dm.b > .02) {
    vec2 n = (dm.rg - .5) * 2.;
    float h = sqrt(max(0., 1. - dot(n, n)));
    vec2 suv = uv - n * vec2(.06 / asp, .06) * (1.2 + 2. * h);    // laušana: skats caur lāsi apgriezts un saspiests
    vec3 dc = dusk(suv, .2) * 1.15;
    dc *= 1. - .55 * smoothstep(.5, 1., length(n));
    float spec = exp(-dot(n - vec2(-.38, .45), n - vec2(-.38, .45)) * 22.);
    dc += vec3(1.) * spec * .85;
    dc = mix(dc, fog, fogA * .65);       // lāses ir ārpusē; caur aprasojumu tās redzamas izplūdušas
    col = mix(col, dc, smoothstep(.02, .35, dm.b));
  }

  // vecais koka rāmis: nobružāta balta krāsa, zem tās pelēks koks
  float fx = mobile ? .035 * asp : .025 * asp;
  float frameL = -.5 * asp + fx, frameR = .5 * asp - fx * 1.6;
  float sash = .5 * asp - (mobile ? .0 : .38 * asp);   // vertikālā šķērslīste
  float bars = min(min(p.x - frameL, frameR - p.x), mobile ? 1. : abs(p.x - (.18 * asp)) - .014);
  float bottom = p.y + .5 - (mobile ? .05 : .065);
  float fd = min(bars, bottom);
  if (fd < 0.) {
    vec2 wq = p * vec2(6., 60.);
    if (bottom < 0. && bars > 0.) wq = p * vec2(60., 6.);
    float grain = fbm(wq, 4);
    vec3 wood = mix(vec3(.24, .21, .17), vec3(.36, .32, .26), .5 + .5 * grain);
    float paint = smoothstep(-.2, .05, fbm(p * 22. + 3., 5) + .3);
    vec3 pc = vec3(.82, .80, .74) * (.85 + .15 * grain);
    vec3 fc2 = mix(wood, pc, paint);
    // iekštelpas gaisma: silta no istabas, rāmis ēnā
    fc2 *= vec3(.55, .48, .40) * (.6 + .4 * smoothstep(.0, -.02, fd));
    col = mix(col, fc2, smoothstep(.0, -.004, fd));
  }
  // ēna un aprasojuma kondensāts pie rāmja malas
  col *= 1. - .35 * smoothstep(.03, .0, abs(fd)) * step(0., fd);
  col *= .85 + .15 * smoothstep(1.2, .3, length((uv - .5) * vec2(asp * .7, 1.)));
  outColor = vec4(finish(col * 1.1, fc), 1.);
}
