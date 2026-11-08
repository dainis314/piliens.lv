// tintes simulācija: blīvuma lauks, ko nes virpuļgredzenu (punktvirpuļu pāru) ātrumu lauks + rotora troksnis.
// Režģa koordinātas: x 0..1 glāzes platumā, y 0 (dibens) .. 1 (ūdens virsma). uAsp = platums/augstums.
uniform sampler2D uTex0;      // iepriekšējais blīvums (r = tinte)
uniform vec4 uVort[24];       // x, y, cirkulācija, kodola rādiuss
uniform int uNV;
uniform vec4 uInject;         // x, y, rādiuss, daudzums šajā kadrā
uniform float uDt;
uniform float uAsp;
uniform float uDecay;

vec2 velocity(vec2 q) {
  vec2 v = vec2(0);
  for (int i = 0; i < 24; i++) {
    if (i >= uNV) break;
    vec4 V = uVort[i];
    vec2 r = (q - V.xy) * vec2(uAsp, 1.);
    float r2 = dot(r, r) + V.w * V.w;
    v += V.z * vec2(-r.y, r.x) / (6.2832 * r2) * vec2(1. / uAsp, 1.);
  }
  // lēna konvekcija un smalkas turbulences, kas aug, gredzeniem palēninoties
  vec2 p = q * vec2(uAsp, 1.) * 5. + vec2(0., uTime * .05);
  float e = .02;
  float n0 = fbm(p, 2);
  vec2 curl = vec2(fbm(p + vec2(0, e), 2) - n0, -(fbm(p + vec2(e, 0), 2) - n0)) / e;
  v += curl * .010 * vec2(1. / uAsp, 1.);
  v.y -= .004;                                  // tinte ir mazliet smagāka par ūdeni
  return v;
}

void main() {
  vec2 q = gl_FragCoord.xy / uRes;
  // pusslāņa (MacCormack) vietā vienkāršs atpakaļizsekojums divos soļos
  vec2 v1 = velocity(q);
  vec2 mid = q - v1 * uDt * .5;
  vec2 v2 = velocity(mid);
  vec2 src = q - v2 * uDt;
  float d = texture(uTex0, src).r;
  // neliela difūzija
  vec2 px = 1. / uRes;
  float blur = (texture(uTex0, src + vec2(px.x, 0)).r + texture(uTex0, src - vec2(px.x, 0)).r +
                texture(uTex0, src + vec2(0, px.y)).r + texture(uTex0, src - vec2(0, px.y)).r) * .25;
  d = mix(d, blur, clamp(uDt * 1.2, 0., .2));
  d *= uDecay;
  // injekcija: krītošā lāse
  vec2 ir = (q - uInject.xy) * vec2(uAsp, 1.);
  d += uInject.w * exp(-dot(ir, ir) / (uInject.z * uInject.z));
  // glāzes sienas un dibens: tinte nevar izkļūt
  d *= smoothstep(0., .01, q.x) * smoothstep(1., .99, q.x) * smoothstep(0., .01, q.y);
  outColor = vec4(min(d, 6.), 0, 0, 1);
}
