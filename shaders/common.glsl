// piliens.lv v2: kopīgā GLSL bibliotēka (troksnis, šūnas, krāsas)
// Visas funkcijas atkarīgas no uSeed, lai katra apmeklējuma aina būtu cita.
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uSeed;
uniform vec2 uMouse;
out vec4 outColor;

#define PI 3.14159265
#define SAT(x) clamp(x, 0.0, 1.0)

vec2 seedOff() { return vec2(fract(uSeed * 0.1031) * 913.0, fract(uSeed * 0.0973) * 677.0); }

float hash12(vec2 p) {
  p += seedOff();
  vec3 p3 = fract(vec3(p.xyx) * .1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 hash22(vec2 p) {
  p += seedOff();
  vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
vec3 hash32(vec2 p) {
  p += seedOff();
  vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yzz) * p3.zyx);
}

// gradienta troksnis ar gludu atvasinājumu
float gnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * f * (f * (f * 6. - 15.) + 10.);
  vec2 ga = hash22(i) * 2. - 1., gb = hash22(i + vec2(1, 0)) * 2. - 1.;
  vec2 gc = hash22(i + vec2(0, 1)) * 2. - 1., gd = hash22(i + vec2(1, 1)) * 2. - 1.;
  float a = dot(ga, f), b = dot(gb, f - vec2(1, 0)), c = dot(gc, f - vec2(0, 1)), d = dot(gd, f - vec2(1, 1));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y) * 1.4142;
}
float fbm(vec2 p, int oct) {
  float s = 0., a = .5;
  mat2 r = mat2(.8, .6, -.6, .8);
  for (int i = 0; i < 8; i++) { if (i >= oct) break; s += a * gnoise(p); p = r * p * 2.03 + 17.1; a *= .5; }
  return s;
}
float ridged(vec2 p, int oct) {
  float s = 0., a = .5;
  mat2 r = mat2(.8, .6, -.6, .8);
  for (int i = 0; i < 8; i++) { if (i >= oct) break; s += a * (1. - abs(gnoise(p))); p = r * p * 2.01 + 9.3; a *= .5; }
  return s;
}
vec2 warp(vec2 p, float k) { return p + k * vec2(fbm(p + 3.1, 4), fbm(p + 7.7, 4)); }

// Voronoja šūnas: x = attālums līdz tuvākajam, y = F2-F1 (mala), zw = šūnas centrs
vec4 voronoi(vec2 x, float jitter) {
  vec2 n = floor(x), f = fract(x);
  float d1 = 8., d2 = 8.; vec2 c1 = vec2(0);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(i, j);
    vec2 o = hash22(n + g) * jitter + (1. - jitter) * .5;
    vec2 r = g + o - f;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; c1 = n + g + o; } else if (d < d2) d2 = d;
  }
  return vec4(sqrt(d1), sqrt(d2) - sqrt(d1), c1);
}

// krāsu korekcija: ACES tuvinājums, gamma, smalks grauds
vec3 aces(vec3 x) { return SAT((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14)); }
vec3 finish(vec3 c, vec2 fragCoord) {
  c = aces(c);
  c = pow(c, vec3(1. / 2.2));
  c += (hash12(fragCoord + fract(uTime) * 91.) - .5) * (1.6 / 255.);
  return c;
}
float luma(vec3 c) { return dot(c, vec3(.2126, .7152, .0722)); }

// piliena forma (SDF): smaile augšā, apaļš dibens; p relatīvi pret dibena centru, r rādiuss, h smailes augstums virs centra
float sdDrop(vec2 p, float r, float h) {
  p.x = abs(p.x);
  if (p.y < 0.) return length(p) - r;              // apakšējā puse: aplis
  float t = SAT(p.y / h);
  float w = r * sqrt(max(0., 1. - t)) * (1. - .15 * t); // sašaurinās uz augšu
  return max(p.x - w, p.y - h) * .9;
}

// fotogrāfija ar "cover" izgriezumu ap fokusa punktu; atgriež lineāru krāsu
vec3 photoCover(sampler2D t, vec2 uv, float imgAsp, vec2 focus, bool flipX) {
  float scrAsp = uRes.x / uRes.y;
  vec2 sc = imgAsp > scrAsp ? vec2(scrAsp / imgAsp, 1.) : vec2(1., imgAsp / scrAsp);
  vec2 o = clamp(focus - sc * .5, vec2(0), vec2(1) - sc);
  vec2 tc = o + uv * sc;
  if (flipX) tc.x = 1. - tc.x;
  return pow(texture(t, tc).rgb, vec3(2.2));
}
