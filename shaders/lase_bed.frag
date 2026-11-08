// lāse: upes grunts statiskais slānis. Tiek uzzīmēts vienreiz tekstūrā (rgb = grunts, a = dziļums),
// lai galvenajam šeiderim katrā kadrā nav jārēķina oļi, smiltis un vārdi.
uniform float uRnd[32];
uniform sampler2D uTex0;   // vārdi smiltīs (maska)

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
  vec2 uv = fc / uRes;
  vec2 p = (fc - .5 * uRes) / uRes.y;
  float depth = .05 + .16 * smoothstep(-.35, .55, fbm(p * 1.1 + 2., 4));
  outColor = vec4(riverbed(p, uv), depth / .25);
}
