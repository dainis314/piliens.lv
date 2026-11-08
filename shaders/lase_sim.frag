// ūdens virsmas viļņu vienādojums: r = augstums tagad, g = augstums iepriekšējā solī
uniform sampler2D uTex0;
uniform vec4 uImp[8];   // x, y (0..1), rādiuss (pikseļos), stiprums
uniform int uNI;
uniform float uDamp;
void main() {
  vec2 px = 1. / uRes;
  vec2 q = gl_FragCoord.xy * px;
  vec2 c = texture(uTex0, q).rg;
  float sum = texture(uTex0, q + vec2(px.x, 0)).r + texture(uTex0, q - vec2(px.x, 0)).r
            + texture(uTex0, q + vec2(0, px.y)).r + texture(uTex0, q - vec2(0, px.y)).r;
  float h = (sum * .5 - c.g) * uDamp;
  for (int i = 0; i < 8; i++) {
    if (i >= uNI) break;
    vec2 d = (gl_FragCoord.xy - uImp[i].xy * uRes);
    h += uImp[i].w * exp(-dot(d, d) / (uImp[i].z * uImp[i].z));
  }
  // krasti: viļņi pie malām izdziest
  float edge = smoothstep(0., .02, q.x) * smoothstep(1., .98, q.x) * smoothstep(0., .02, q.y) * smoothstep(1., .98, q.y);
  outColor = vec4(h * edge, c.r, 0, 1);
}
