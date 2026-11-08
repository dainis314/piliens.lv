// laiks: no lāstekas zem mitras klints pārkares pil bļodakmenī; apkārt sūnas un papardes; apmācies rīts mežā
uniform float uRnd[32];

const vec3 KEY = vec3(.86, .90, .92);
const vec3 AMB = vec3(.075, .10, .085);
vec3 Ld = normalize(vec3(-.45, .80, .40));

uniform sampler2D uTex0;
uniform sampler2D uTex1;
uniform sampler2D uTex2;   // ķērpji un sūnas (Daiņa tuvplāns)
// īstā sūna no Daiņa bildes (bildes apakšējā trešdaļa ir sūnu grīda)
vec3 realMoss(vec2 p) {
  vec2 w = p * 1.6 + .25 * vec2(fbm(p * 3., 3), fbm(p * 3. + 5., 3));
  vec2 tc = vec2(.08 + .84 * fract(w.x * .45), .03 + .22 * fract(w.y * .7));
  return pow(texture(uTex1, tc).rgb, vec3(2.2));
}
uniform float uBgAspect;
uniform float uLevel;    // ūdens līmenis iedobē 0..1
uniform float uPhase;    // pašreizējās sekundes fāze: lāse briest un krīt
uniform float uRipple;   // sekundes kopš pēdējā piliena
uniform float uGreen;    // sūnas zaļums 0..1 (aug ar pilieniem)
uniform float uIcicle;   // lāsteka īsinās 0..1
uniform float uOverflow; // pārplūšana 0..1
// fons: Daiņa fotogrāfija no sūnaina egļu meža, izplūdusi kā aiz objektīva
vec3 bgForest(vec2 uv, float blur) {
  vec3 c = photoCover(uTex0, clamp(uv, 0., 1.), uBgAspect, vec2(.5, .42), false);
  c *= vec3(.62, .66, .62);                       // nedaudz tumšāks, lai priekšplāns izceļas
  c = mix(c, vec3(luma(c)) * vec3(.9, 1., .95), .15);
  return c;
}

float boulderSDF(vec2 p, vec2 c, vec2 rad) {
  vec2 q = (p - c) / rad;
  float ang = atan(q.y, q.x);
  float n = .05 * fbm(vec2(ang * 2., 1.), 4) + .02 * gnoise(vec2(ang * 9., 2.));
  return (length(q) - 1. - n) * min(rad.x, rad.y);
}

// paparde: mugurkauls ar lancetiskām lapiņām; atgriež (attālums, lapiņas iekšējā koordināte)
vec2 fern(vec2 p, vec2 base, float ang, float len, float curl) {
  float d = 1., inner = 0.;
  vec2 dir = vec2(cos(ang), sin(ang)), nrm = vec2(-dir.y, dir.x);
  for (int i = 0; i < 26; i++) {
    float t = float(i) / 25.;
    vec2 sp = base + dir * len * t + nrm * curl * t * t * len;
    vec2 tang = normalize(dir + nrm * 2. * curl * t);
    vec2 tn = vec2(-tang.y, tang.x);
    float lw = len * .13 * pow(sin(PI * min(1., t * 1.08 + .04)), .8);
    for (int k = -1; k <= 1; k += 2) {
      vec2 ax = normalize(tn * float(k) + tang * .55);
      vec2 lc = sp + ax * lw * .5;
      vec2 q = p - lc;
      float u = dot(q, ax) / max(lw * .55, 1e-4), v = dot(q, vec2(-ax.y, ax.x)) / max(lw * .15, 1e-4);
      float dd = length(vec2(u, v * (1. + .6 * abs(u)))) - 1.;
      if (dd < d) { d = dd; inner = v; }
    }
    float sd = (length(p - sp) - len * .005) / (len * .02);
    if (sd < d) { d = sd; inner = 0.; }
  }
  return vec2(d, inner);
}

void main() {
  vec2 fc = gl_FragCoord.xy;
  float asp = uRes.x / uRes.y;
  vec2 uv = fc / uRes;
  vec2 p = (fc - .5 * uRes) / uRes.y;
  bool mobile = asp < .9;
  float cx = mobile ? .04 * asp : .16 * asp;

  vec3 col = bgForest(uv, 1.);

  vec2 bc = vec2(cx, mobile ? -.32 : -.34), br = mobile ? vec2(.40 * asp, .16) : vec2(.32, .18);
  // priekšplāns: izplūdusi sūna apakšmalā
  float fg = smoothstep(-.42, -.5, p.y + .03 * fbm(vec2(p.x * 3., 2.), 3));
  col = mix(col, vec3(.05, .09, .02) + vec3(.06, .09, .02) * fbm(p * 8., 3), fg * .9);
  // ēna zem akmens
  col *= 1. - .6 * smoothstep(.15, -.05, length((p - bc - vec2(.03, -.12)) / (br * vec2(1.2, .5))) - 1.);

  float bd = boulderSDF(p, bc, br);
  vec2 cc = bc + vec2(-.01, br.y * .45);
  vec2 cr = vec2(br.x * .40, br.y * .16);
  if (bd < 0.) {
    vec2 q = (p - bc) / br;
    vec3 n = normalize(vec3(q.x * .95, q.y * .8 + .4, sqrt(max(.05, 1. - dot(q, q) * .85))));
    n = normalize(n + .18 * vec3(fbm(p * 70., 3), fbm(p * 70. + 5., 3), 0));
    // granīts: smalks graudainums, pelēks ar sārtiem un tumšiem graudiem
    vec4 v = voronoi(p * 520., .9);
    float grain = hash12(v.zw);
    vec3 gr = mix(vec3(.20, .195, .19), vec3(.27, .21, .19), step(.65, grain));
    gr = mix(gr, vec3(.08, .08, .085), step(.88, grain) * .7);
    gr *= .78 + .35 * fbm(p * 24., 4);
    // ķērpji un sūnas
    float moss = smoothstep(.0, .35, n.y + .6 * fbm(p * 9. + 3., 5) + .05 - .2 * smoothstep(.1, -.9, q.y));
    float fuzz = fbm(p * 420., 3);
    vec3 mc = realMoss(p) * .6 * (.55 + .6 * max(dot(n, Ld), 0.));
    mc = mix(vec3(luma(mc)) * vec3(1.05, 1., .82), mc * vec3(.95, 1.12, .85), .45 + .55 * uGreen);
    float lichen = smoothstep(.55, .7, fbm(p * 26. + 9., 4)) * (1. - moss);
    vec3 alb = mix(gr, vec3(.42, .45, .36), lichen * .6);
    alb = mix(alb, mc, moss);
    // slapja svītra, pa kuru ūdens pārplūst uz strautiņu
    float wx = bc.x + br.x * .38 + .012 * gnoise(vec2(p.y * 18., 3.));
    float wet = smoothstep(.022, .0, abs(p.x - wx)) * step(p.y, cc.y) * (.25 + .75 * uOverflow);
    float flowHL = uOverflow * smoothstep(.012, .0, abs(p.x - wx)) * step(p.y, cc.y) * pow(SAT(gnoise(vec2(p.x * 60., p.y * 25. + uTime * 4.)) + .2), 3.);
    alb *= 1. - .45 * wet;
    float dif = max(dot(n, Ld), 0.);
    float ao = .45 + .55 * smoothstep(-1., .5, q.y);
    vec3 lit = alb * (KEY * dif + AMB * 2.2 * ao);
    lit += vec3(.8, .85, .85) * flowHL * .6;
    lit += vec3(.6, .65, .65) * wet * pow(max(dot(reflect(-Ld, n), vec3(0, 0, 1)), 0.), 24.) * .5;
    lit += vec3(.4, .45, .45) * (1. - moss) * pow(max(dot(reflect(-Ld, n), vec3(0, 0, 1)), 0.), 40.) * .08;
    // iedobe ar ūdeni
    vec2 cq = (p - cc) / cr;
    float cav = length(cq) - 1. - .06 * fbm(vec2(atan(cq.y, cq.x) * 3., 4.), 3);
    float lip = smoothstep(.25, .0, cav) * step(0., cav);
    lit *= 1. - .35 * lip * smoothstep(0., -1., cq.y);
    if (cav < 0.) {
      float rr = length(cq);
      float front = uRipple * 1.3;
      float ripple = sin((rr - front) * 34.) * exp(-pow((rr - front) * 3.2, 2.)) * exp(-uRipple * 1.6)
                   + .25 * sin((rr - front * .6) * 22.) * exp(-pow((rr - front * .6) * 2.5, 2.)) * exp(-uRipple * 2.2);
      vec2 rn = cq / max(rr, 1e-3) * ripple * .06;
      // atspulgs: gaišas debess sprauga un tumša pārkare
      vec2 ruv = vec2(uv.x + rn.x, 1. - (uv.y - .1) * .6 + rn.y);
      vec3 refl = bgForest(clamp(ruv, 0., 1.), 1.) * 1.4 + vec3(.10, .12, .12) * smoothstep(.6, -.4, cq.y + rn.y * 6.);
      float fres = .35 + .5 * pow(SAT(1. - (cq.y * .5 + .5)), 2.);
      vec3 inside = vec3(.03, .035, .025);
      vec3 water = mix(inside, refl, fres);
      water += vec3(.85, .9, .9) * smoothstep(.04, .0, abs(rr - .55 - .02 * ripple)) * .06;
      water += vec3(1.) * exp(-dot(cq - vec2(-.35, .3), cq - vec2(-.35, .3)) * 30.) * .35;
      // ūdens tikai līdz līmenim: virsmas elipse aug, iedobei pildoties
      float wl = mix(.30, 1.02, uLevel);
      float wMask = 1. - smoothstep(wl - .06, wl, rr + .03 * fbm(cq * 4., 2));
      vec3 dryBowl = mix(vec3(.05, .05, .045), vec3(.13, .12, .11), smoothstep(-1., .6, cq.y)) * (.8 + .3 * fbm(p * 90., 3));
      water = mix(dryBowl, water, wMask);
      water += vec3(.7, .75, .75) * smoothstep(.02, .0, abs(rr - wl + .01)) * wMask * .12;   // menisks
      lit = mix(water, lit, smoothstep(-.12, .0, cav) * .5);
    }
    col = mix(col, lit, 1. - smoothstep(-.003, .0, bd));
  }

  // papardes: aizmugurē tumšākas, priekšā gaišākas
  for (int f = 0; f < 3; f++) {
    float ff = float(f);
    float side = (f == 1) ? 1. : -1.;
    vec2 base = bc + vec2(side * br.x * (.72 + .3 * hash12(vec2(ff, 1.))), -br.y * (.1 + .3 * hash12(vec2(ff, 7.))));
    float ang = PI * .5 + side * (.30 + .55 * hash12(vec2(ff, 2.)));
    float len = (.36 + .14 * hash12(vec2(ff, 3.))) * (mobile ? .75 : 1.);
    float curl = -side * (.38 + .18 * hash12(vec2(ff, 4.)));
    vec2 fd = fern(p, base, ang, len, curl);
    float cov = (1. - smoothstep(-.35, .25, fd.x)) * .85;
    if (cov > 0.) {
      float tone = .55 + .45 * hash12(vec2(ff, 9.));
      vec3 fcol = mix(vec3(.02, .06, .01), vec3(.08, .18, .03), tone);
      fcol *= .65 + .55 * (1. - abs(fd.y)) * smoothstep(.0, -.35, fd.x);                        // vidusdzīsla gaišāka
      fcol *= KEY * .9 + AMB * 2.;
      fcol += vec3(.10, .16, .06) * pow(SAT(1. - abs(fd.y - .5)), 8.) * .3;
      col = mix(col, fcol, cov * .97);
    }
  }
  // jauna, vēl satīta paparde (gliemežvāks), kas atritināsies
  vec2 kc = bc + vec2(-br.x * .55, br.y * .55);
  vec2 kq = p - kc;
  float kr = length(kq), ka = atan(kq.y, kq.x);
  float spiral = abs(fract((log(max(kr, 1e-4)) * 3.2 - ka / (2. * PI)) ) - .5) * kr * 6.;
  float kS = 1. - .7 * uGreen;
  float koru = (kr < .028 * kS && kr > .004 * kS) ? spiral - .02 * kS : 1.;
  float stem = abs(p.x - kc.x - .006 - .01 * (kc.y - p.y) * 8.) - .0025;
  stem = (p.y < kc.y - .02 && p.y > bc.y + br.y * .3) ? stem : 1.;
  if (min(koru, stem) < 0.) col = mix(col, vec3(.18, .30, .07) * (KEY + AMB), .95);

  // klints pārkare: tumšs, slapjš akmens, sūnas tikai virspusē
  float topY = (mobile ? .26 : .30) + .05 * fbm(vec2(p.x * 2.6 + 2., 1.), 4) + .012 * gnoise(vec2(p.x * 30., 3.)) + .55 * max(0., (mobile ? -.05 : .2) * asp - p.x);
  float edgeL = -10.;
  float od = max(topY - p.y, edgeL - p.x);
  if (od < 0.) {
    float depthIn = SAT((p.y - topY) * 5.);
    vec3 rc = mix(vec3(.025, .025, .024), vec3(.10, .095, .085), .5 + .5 * fbm(p * 34., 5));
    float drip = pow(SAT(fbm(vec2(p.x * 40., p.y * 3.), 3) + .35), 5.);
    vec3 lit = rc * (.25 + .9 * depthIn) + vec3(.5, .55, .55) * drip * .12 * (1. - depthIn);
    vec2 kq = p * vec2(.55, 1.2) + vec2(.12, .1) + .08 * vec2(fbm(p * 4., 3), fbm(p * 4. + 7., 3));
    vec3 rm = pow(texture(uTex2, kq).rgb, vec3(2.2)) * .55 * (.35 + .65 * depthIn);
    float topMoss = smoothstep(.0, .35, fbm(p * 5. + 4., 4) + .35 + (p.y - topY) * 3.);
    vec3 mc = mix(vec3(.02, .045, .01), vec3(.08, .14, .025), .5 + .5 * fbm(p * 300., 3));
    lit = mix(lit, rm, SAT(topMoss));
    col = mix(col, lit, 1. - smoothstep(-.003, .0, od));
  }
  // nokarenas sūnu šķiedras gar apakšmalu
  for (int i = 0; i < 18; i++) {
    float fi = float(i);
    float x = (mobile ? -.05 : .2) * asp + hash12(vec2(fi, 21.)) * (.3 * asp);
    float ty = (mobile ? .26 : .30) + .05 * fbm(vec2(x * 2.6 + 2., 1.), 4) + .55 * max(0., (mobile ? -.05 : .2) * asp - x);
    float l = .01 + .045 * pow(hash12(vec2(fi, 22.)), 2.);
    float dx = abs(p.x - x - .003 * sin(p.y * 90. + fi));
    float m = (1. - smoothstep(.001, .003, dx)) * step(ty - l, p.y) * step(p.y, ty + .005);
    col = mix(col, vec3(.07, .12, .03), m * .85);
  }

  // lāsteka
  float ix = cc.x + .003;
  float iTop = (mobile ? .26 : .30) + .05 * fbm(vec2(ix * 2.6 + 2., 1.), 4) + .55 * max(0., (mobile ? -.05 : .2) * asp - ix);
  float iLen = (mobile ? .17 : .21) * (.8 + .3 * uRnd[0]) * (1. - .25 * uIcicle);
  float t = SAT((iTop - p.y) / iLen);
  float iw = .020 * pow(1. - t, 1.5) + .0012 + .002 * gnoise(vec2(p.y * 40., 2.)) * (1. - t);
  float icx = ix + .003 * gnoise(vec2(p.y * 25., 1.));
  float id = abs(p.x - icx) - iw;
  if (id < 0. && p.y < iTop + .01 && p.y > iTop - iLen) {
    float xn = (p.x - icx) / iw;
    vec3 refr = bgForest(uv + vec2(-xn * .03, .02), 1.);
    vec3 ice = refr * 1.6 + vec3(.10, .13, .14);
    ice = mix(ice, vec3(.70, .78, .80), .18 + .2 * fbm(vec2(p.x * 300., p.y * 40.), 3));  // duļķaini slāņi
    ice += vec3(.95) * pow(SAT(1. - abs(xn + .5) * 4.), 3.) * .65;
    ice += vec3(.5) * pow(SAT(1. - abs(xn - .7) * 6.), 3.) * .2;
    col = mix(col, ice, .95 * (1. - smoothstep(-.0015, .0, id)));
  }
  vec2 tip = vec2(ix, iTop - iLen);
  // lāse briest pie lāstekas gala (fāze 0..0.6), tad krīt līdz ūdenim (0.6..1)
  float grow = SAT(uPhase / .6);
  float r0 = .0068 * (grow * grow * (3. - 2. * grow));
  r0 = uPhase < .6 ? r0 : 0.;
  float d0 = r0 > .0004 ? sdDrop(p - (tip - vec2(0, r0 * 1.05)), r0, r0 * 1.9) : 1.;
  float ft = SAT((uPhase - .6) / .4);
  float surfY = cc.y + .004;
  vec2 fallC = vec2(ix, mix(tip.y - .006, surfY, ft * ft));
  float d1 = uPhase >= .6 ? sdDrop(p - fallC, .006, .016 + ft * .012) : 1.;
  float dd = min(d0, d1);
  if (dd < 0.) {
    vec3 refr = bgForest(vec2(uv.x, 1. - uv.y), 1.) * 1.5;
    col = mix(col, refr + vec3(.08, .1, .1), .9);
  }
  float hl = min(uPhase >= .6 ? length(p - fallC - vec2(-.0018, .0015)) : 1., r0 > .002 ? length(p - tip + vec2(.0018, r0 * .8)) : 1.);
  col += vec3(.9) * smoothstep(.0022, .0, hl);

  col *= .72 + .28 * smoothstep(1.2, .3, length((uv - vec2(.58, .48)) * vec2(asp * .7, 1.)));
  outColor = vec4(finish(col * 1.25, fc), 1.);
}
