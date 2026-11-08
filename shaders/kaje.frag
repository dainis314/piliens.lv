// kājene: Daiņa foto no Baltijas jūras krasta (aļģēm apauguši laukakmeņi);
// virs tā: lēni viļņi un putas seklajā ūdenī, dzintara gabaliņi starp akmeņiem
uniform float uRnd[32];
uniform sampler2D uTex0;
uniform float uBgAspect;

void main() {
  vec2 fc = gl_FragCoord.xy;
  float asp = uRes.x / uRes.y;
  vec2 uv = fc / uRes;
  vec2 p = (fc - .5 * uRes) / uRes.y;
  bool mobile = asp < .9;
  vec2 focus = mobile ? vec2(.45, .5) : vec2(.5, .5);

  // seklā ūdens kustība: gaisma ņirb un bilde viegli izkropļojas tikai ūdens vietās
  vec3 base = photoCover(uTex0, uv, uBgAspect, focus, false);
  float waterish = smoothstep(.06, .0, abs(base.g - base.b - .0)) * smoothstep(.55, .25, uv.y) * smoothstep(.12, .3, luma(base));
  vec2 flow = .004 * vec2(gnoise(p * 9. + uTime * .3), gnoise(p * 9. + 4. + uTime * .3)) * waterish;
  vec3 col = photoCover(uTex0, uv + flow, uBgAspect, focus, false);

  // putu mežģīnes pēc viļņa: tikai ūdenī, sekojot krasta līnijai
  float lace = 0.;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float ly = .18 + .09 * fi + .03 * fbm(vec2(p.x * 2. + fi * 3., fi), 3);
    float band = smoothstep(.025, .0, abs(uv.y - ly));
    float holes = smoothstep(.40, .62, voronoi(p * 70. + fi * 5., .9).y * 3.);
    lace = max(lace, band * holes * (1. - fi * .25));
  }
  col = mix(col, vec3(.86, .87, .85), lace * waterish * .55);

  // dzintara gabaliņi seklajā ūdenī priekšplānā; lielākajā lāse ar skuju no sveķu sadaļas
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    vec2 c = vec2((mobile ? .55 : .66) + .28 * hash12(vec2(fi, 3.)) - .5, .04 + .11 * hash12(vec2(fi, 5.)));
    c = (c - .5) * vec2(asp, 1.) + vec2(0., 0.);
    c = vec2(c.x, c.y);
    c = (vec2(.62 + .3 * hash12(vec2(fi, 3.)), .05 + .10 * hash12(vec2(fi, 5.))) - .5) * vec2(asp, 1.);
    float r = i == 0 ? .020 : .007 + .010 * pow(hash12(vec2(fi, 7.)), 2.);
    vec2 q = (p - c) / r;
    float d = length(q * vec2(1., 1.25)) - 1. - .22 * gnoise(q * 1.7 + fi * 3.);
    if (d < .6) col *= 1. - .22 * smoothstep(.6, .0, d) * step(-.1, d);   // kontakta ēna
    if (d < 0.) {
      float h = SAT(-d * 1.4);
      vec3 am = mix(vec3(.42, .14, .02), vec3(.96, .58, .16), h * .85 + .15);
      am += vec3(1., .9, .75) * exp(-dot(q - vec2(-.3, .38), q - vec2(-.3, .38)) * 7.) * .7;
      am = mix(am, am * .65 + vec3(.05, .07, .08), .45);
      am += vec3(.9) * smoothstep(.06, .0, abs(gnoise(q * 3. + fi) )) * .08;                  // zem ūdens: vēsāks, blāvāks
      if (i == 0) am = mix(am, vec3(.30, .14, .04), smoothstep(.10, .0, abs(q.y - q.x * .45)) * step(abs(q.x), .55) * .75);
      col = mix(col, am, smoothstep(.0, -.12, d));
    }
  }
  // mīksta tumšāka migla apakšā aiz paraksta un labajā malā aiz navigācijas
  col = mix(col, col * .45, smoothstep(.55, .0, length((uv - vec2(0., 0.)) * vec2(asp * .9, 1.6))) * .8);
  col = mix(col, col * .55, smoothstep(.3, .0, length((uv - vec2(1., .5)) * vec2(asp * 1.4, .75))) * .7);
  col = pow(max(col, 0.), vec3(1. / 2.2));
  col += (hash12(fc) - .5) * (1.5 / 255.);
  outColor = vec4(col, 1.);
}
