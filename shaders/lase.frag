// lāse: sekla Latvijas upe no augšas; granīta un dolomīta oļi, smilšu viļņojums, skujas, kaustiku tīkls, ūdensmērītājs
uniform float uRnd[32];
uniform sampler2D uTex0;   // vārdi smiltīs (maska)

uniform sampler2D uTex1;   // viļņu simulācija
uniform vec2 uStrider;     // ūdensmērītāja vieta (p koordinātās)
uniform float uStriderA;   // pagrieziena leņķis
uniform vec4 uFish;        // zivtiņas ēna: x, y, virziens, redzamība

// ūdens virsmas augstums: simulētie viļņi + straumes ņirbas + ūdensmērītāja kāju iedobītes
float surfaceH(vec2 p) {
  float asp = uRes.x / uRes.y;
  vec2 q = p * vec2(1. / asp, 1.) + .5;
  float h = texture(uTex1, q).r * .010;
  h += .006 * fbm(p * 5. + vec2(uTime * .25, 0.), 4);
  for (int k = 0; k < 6; k++) {
    float a = float(k) * 1.047 + .5 + uStriderA;
    vec2 lp = uStrider + vec2(cos(a) * .07, sin(a) * .045);
    h -= .006 * exp(-dot(p - lp, p - lp) / .00012);
  }
  return h;
}

vec3 riverbed(vec2 p, vec2 uv) {
  // smiltis ar viļņojumu (ripple marks), kas iet šķērsām straumei
  float ripple = sin((p.y + .06 * fbm(p * 3., 3)) * 90. + 3. * fbm(p * 6., 3));
  vec3 sand = mix(vec3(.42, .27, .16), vec3(.62, .44, .28), .5 + .5 * fbm(p * 30., 4));
  sand *= .88 + .12 * ripple;
  vec3 c = sand;
  float hgt = .3 * ripple;
  // oļi: dažāda izmēra (log-normāli), dažāds iezis
  for (int layer = 0; layer < 3; layer++) {
    float sc = layer == 0 ? 3.2 : (layer == 1 ? 8. : 24.);
    vec4 v = voronoi(p * sc + float(layer) * 7.1, .85);
    float rnd = hash12(v.zw + float(layer) * 3.);
    float keep = layer == 0 ? .45 : (layer == 1 ? .2 : .05);
    if (rnd < keep) continue;
    float rad = (.18 + .22 * hash12(v.zw + 9.)) * (layer == 0 ? 1.2 : 1.);
    vec2 cc = v.zw / sc;
    vec2 d = p - cc + .03 / sc * vec2(fbm(p * 20., 2), fbm(p * 20. + 4., 2));
    float ang = hash12(v.zw + 5.) * PI;
    d = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * d;
    float e = length(d * vec2(1., 1.25 + .5 * hash12(v.zw + 2.)) * sc) / rad;
    if (e < 1.) {
      float kind = hash12(v.zw + 11.);
      vec3 rock = kind < .4 ? vec3(.36, .34, .33) : (kind < .62 ? vec3(.50, .30, .24) : (kind < .85 ? vec3(.66, .60, .48) : vec3(.18, .19, .18)));
      vec4 g = voronoi(p * 300., .9);
      rock *= .8 + .35 * hash12(g.zw) * (kind < .62 ? 1. : .4) + .15 * fbm(p * 60., 3);
      float dome = sqrt(1. - e * e);
      rock *= .55 + .45 * dome;
      // aļģu apsūbējums oļu augšpusē
      rock = mix(rock, vec3(.20, .26, .10), .35 * smoothstep(.2, .8, fbm(p * 40. + 3., 3)) * dome);
      c = mix(c, rock, smoothstep(1., .9, e));
      hgt = max(hgt, dome);
    } else {
      c *= 1. - .3 * smoothstep(1.35, 1., e);    // kontakta ēna smiltīs
    }
  }
  // vārdi, iespiesti smiltīs
  float word = texture(uTex0, uv).r;
  c = mix(c, c * .62, word * (1. - step(.5, hgt)) * .9);
  c += vec3(.08) * smoothstep(.0, .4, texture(uTex0, uv + vec2(-.0015, .002)).r - word) * (1. - step(.5, hgt));
  // nogrimušas skujas un bērza lapa
  for (int i = 0; i < 9; i++) {
    float fi = float(i);
    vec2 a = vec2(-.7 + 1.4 * hash12(vec2(fi, 1.)), -.45 + .9 * hash12(vec2(fi, 2.)));
    float an = hash12(vec2(fi, 3.)) * PI;
    vec2 dir = vec2(cos(an), sin(an));
    float t = clamp(dot(p - a, dir), 0., .045);
    float d = length(p - a - dir * t);
    c = mix(c, vec3(.32, .18, .07), smoothstep(.0028, .0012, d) * .9);
  }
  vec2 lq = p - vec2(-.25 + .2 * uRnd[16], -.2 + .15 * uRnd[17]);
  float la = uRnd[18] * PI; lq = mat2(cos(la), -sin(la), sin(la), cos(la)) * lq;
  float leaf = length(lq * vec2(1., 1.5)) - .035 - .006 * sin(atan(lq.y, lq.x) * 14.);
  c = mix(c, vec3(.55, .40, .12) * (.8 + .2 * fbm(p * 80., 2)), smoothstep(.002, -.002, leaf) * .9);
  return c;
}

void main() {
  vec2 fc = gl_FragCoord.xy;
  float asp = uRes.x / uRes.y;
  vec2 uv = fc / uRes;
  vec2 p = (fc - .5 * uRes) / uRes.y;

  // virsmas normāle
  float e = .0025;
  float h0 = surfaceH(p);
  vec2 gr = vec2(surfaceH(p + vec2(e, 0)) - h0, surfaceH(p + vec2(0, e)) - h0) / e;
  vec3 n = normalize(vec3(-gr, 1.));

  // laušana: gultnes punkts nobīdās pēc slīpuma (ūdens dziļums ~ .12)
  float depth = .05 + .16 * smoothstep(-.35, .55, fbm(p * 1.1 + 2., 4));
  vec2 bp = p - gr * depth * .75;
  vec2 buv = bp * vec2(1. / asp, 1.) + .5;
  vec3 bed = riverbed(bp, buv);

  // kaustikas: gaisma koncentrējas tur, kur virsma ieliekta (Laplasa operators)
  float lap = (surfaceH(p + vec2(e, 0)) + surfaceH(p - vec2(e, 0)) + surfaceH(p + vec2(0, e)) + surfaceH(p - vec2(0, e)) - 4. * h0) / (e * e);
  float caustic = SAT(-lap * .045);
  // smalks kaustiku tīkls no straumes ņirbām (šūnu malas)
  vec4 cv = voronoi(bp * 14. + uTime * .2 + .4 * vec2(fbm(bp * 4., 2), fbm(bp * 4. + 3., 2)), .9);
  float net = pow(SAT(1. - cv.y * 2.6), 4.) * (.5 + .5 * fbm(bp * 3., 3));
  vec3 sun = vec3(1.0, .93, .78);
  vec3 col = bed * (.50 + .45 * net + caustic * .5) * sun;
  // ūdensmērītāja ēnas uz gultnes: tumši diski ar gaišām malām (kājiņu iedobju lēcas)
  vec2 st = uStrider + vec2(.05, -.06);
  for (int k = 0; k < 6; k++) {
    float a = float(k) * 1.047 + .5 + uStriderA;
    vec2 lp = st + vec2(cos(a) * .07, sin(a) * .045);
    float d = length(p - lp);
    col *= 1. - .35 * smoothstep(.014, .006, d);
    col += sun * .07 * smoothstep(.004, .0, abs(d - .014));
  }
  // zivtiņas ēna uz grunts
  if (uFish.w > 0.) {
    vec2 fq = bp - uFish.xy;
    float fa = uFish.z;
    fq = mat2(cos(fa), sin(fa), -sin(fa), cos(fa)) * fq;
    float bodyF = length(fq * vec2(1., 3.2)) - .035;
    float tail = length((fq + vec2(.045 + .006 * sin(uTime * 14.), 0.)) * vec2(1.6, 1.4)) - .014;
    float fish = 1. - smoothstep(-.004, .012, min(bodyF, tail));
    col *= 1. - .45 * fish * uFish.w;
  }
  // dziļums: ūdens krāsa un absorbcija
  col *= mix(vec3(1.), vec3(.58, .34, .13), SAT(depth * 7.));
  col = mix(col, vec3(.05, .025, .008), SAT((depth - .07) * 3.5));
  // virsmas atspīdums: debess un koku lapotņu atspulgs + Freneļa
  float fres = .02 + .98 * pow(1. - n.z, 5.);
  vec3 sky = mix(vec3(.42, .50, .46), vec3(.04, .07, .03), smoothstep(.1, .5, fbm(uv * 2.5 + n.xy * 2., 4)));
  col = mix(col, sky, SAT(fres * 1.6 + .03));
  float spec = pow(max(dot(reflect(-normalize(vec3(.3, .5, .8)), n), vec3(0, 0, 1)), 0.), 200.);
  col += sun * spec * 1.6;
  // ūdensmērītājs: tievs ķermenis un kājiņas uz virsmas
  vec2 sb = uStrider;
  vec2 bq = p - sb; bq = mat2(cos(uStriderA), sin(uStriderA), -sin(uStriderA), cos(uStriderA)) * bq;
  float body = length(bq * vec2(1., 3.5)) - .012;
  float legs = 1.;
  for (int k = 0; k < 6; k++) {
    float a = float(k) * 1.047 + .5 + uStriderA;
    vec2 lp = sb + vec2(cos(a) * .07, sin(a) * .045);
    vec2 dir = lp - sb;
    float t = SAT(dot(p - sb, dir) / dot(dir, dir));
    legs = min(legs, length(p - sb - dir * t) - .0009);
  }
  col = mix(col, vec3(.05, .04, .03), smoothstep(.001, -.001, min(body, legs)) * .9);
  // virspusē peldošas skujas un lapa
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    vec2 a = vec2(-.6 + 1.2 * hash12(vec2(fi, 21.)), -.4 + .8 * hash12(vec2(fi, 22.)));
    float an = hash12(vec2(fi, 23.)) * PI;
    vec2 dir = vec2(cos(an), sin(an));
    float t = clamp(dot(p - a, dir), 0., .05);
    float d = length(p - a - dir * t);
    col = mix(col, vec3(.40, .26, .10), smoothstep(.003, .0015, d));
  }
  // izplūdis priekšplāns: krasta zāles stiebri apakšējā kreisajā stūrī
  float blades = 0.;
  for (int i = 0; i < 9; i++) {
    float fi = float(i);
    float x0 = -.5 * asp + .03 + .25 * hash12(vec2(fi, 31.));
    float bend = .3 + .4 * hash12(vec2(fi, 32.));
    float y = p.y + .5;
    float x = x0 + bend * y * y;
    float w = .010 * (1. - y * 1.6);
    blades = max(blades, smoothstep(w + .02, w * .2, abs(p.x - x)) * smoothstep(.5, .3, y) * step(.0, w));
  }
  col = mix(col, vec3(.04, .07, .02), blades * .85);
  col *= .82 + .18 * smoothstep(1.2, .3, length((uv - .5) * vec2(asp * .7, 1.)));
  col = mix(col, col * vec3(.7, .8, .65), .25);
  outColor = vec4(finish(col * 1.05, fc), 1.);
}
