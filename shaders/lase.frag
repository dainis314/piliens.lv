// lāse: sekla Latvijas upe no augšas; granīta un dolomīta oļi, smilšu viļņojums, skujas, kaustiku tīkls, ūdensmērītājs
uniform float uRnd[32];
uniform sampler2D uTex2;   // iepriekš uzzīmētā grunts (rgb) un dziļums (a)

uniform sampler2D uTex1;   // viļņu simulācija
uniform vec2 uStrider;     // ūdensmērītāja vieta (p koordinātās)
uniform float uStriderA;   // pagrieziena leņķis
uniform vec4 uFish;        // zivtiņas ēna: x, y, virziens, redzamība

// ūdens virsmas augstums: simulētie viļņi + ūdensmērītāja kāju iedobītes (aprēķins tikai tā tuvumā)
float simH(vec2 p, float asp) {
  vec2 q = p * vec2(1. / asp, 1.) + .5;
  float h = texture(uTex1, q).r * .010;
  if (dot(p - uStrider, p - uStrider) < .016) {
    for (int k = 0; k < 6; k++) {
      float a = float(k) * 1.047 + .5 + uStriderA;
      vec2 lp = uStrider + vec2(cos(a) * .07, sin(a) * .045);
      h -= .006 * exp(-dot(p - lp, p - lp) / .00012);
    }
  }
  return h;
}
// straumes ņirbas (lēnas, zemfrekvences)
float ripH(vec2 p) { return .006 * fbm(p * 5. + vec2(uTime * .25, 0.), 2); }

void main() {
  vec2 fc = gl_FragCoord.xy;
  float asp = uRes.x / uRes.y;
  vec2 uv = fc / uRes;
  vec2 p = (fc - .5 * uRes) / uRes.y;

  // virsmas normāle: simulācijas daļai 5 tekstūras paraugi (tie paši der arī Laplasa operatoram),
  // ņirbām 3 lēti fbm(2) aprēķini
  float e = .0025;
  float h0 = simH(p, asp);
  float hxp = simH(p + vec2(e, 0), asp), hxm = simH(p - vec2(e, 0), asp);
  float hyp = simH(p + vec2(0, e), asp), hym = simH(p - vec2(0, e), asp);
  float r0 = ripH(p);
  vec2 gr = vec2(hxp - hxm, hyp - hym) / (2. * e) + vec2(ripH(p + vec2(e, 0)) - r0, ripH(p + vec2(0, e)) - r0) / e;
  vec3 n = normalize(vec3(-gr, 1.));

  // laušana: gultnes punkts nobīdās pēc slīpuma
  float depth = texture(uTex2, uv).a * .25;
  vec2 bp = p - gr * depth * .75;
  vec2 buv = bp * vec2(1. / asp, 1.) + .5;
  vec3 bed = texture(uTex2, buv).rgb;

  // kaustikas: gaisma koncentrējas tur, kur virsma ieliekta (Laplasa operators)
  float lap = (hxp + hxm + hyp + hym - 4. * h0) / (e * e);
  float caustic = SAT(-lap * .045);
  // smalks kaustiku tīkls no straumes ņirbām (šūnu malas)
  vec4 cv = voronoi(bp * 14. + uTime * .2 + .4 * vec2(gnoise(bp * 4.), gnoise(bp * 4. + 3.)), .9);
  float net = pow(SAT(1. - cv.y * 2.6), 4.) * (.5 + .5 * gnoise(bp * 3.));
  vec3 sun = vec3(1.0, .93, .78);
  vec3 col = bed * (.50 + .45 * net + caustic * .5) * sun;
  // ūdensmērītāja ēnas uz gultnes: tumši diski ar gaišām malām (kājiņu iedobju lēcas)
  vec2 st = uStrider + vec2(.05, -.06);
  if (dot(p - st, p - st) < .016) for (int k = 0; k < 6; k++) {
    float a = float(k) * 1.047 + .5 + uStriderA;
    vec2 lp = st + vec2(cos(a) * .07, sin(a) * .045);
    float d = length(p - lp);
    col *= 1. - .35 * smoothstep(.014, .006, d);
    col += sun * .07 * smoothstep(.004, .0, abs(d - .014));
  }
  // zivtiņas ēna uz grunts
  if (uFish.w > 0. && dot(bp - uFish.xy, bp - uFish.xy) < .01) {
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
  vec3 sky = mix(vec3(.42, .50, .46), vec3(.04, .07, .03), smoothstep(.1, .5, fbm(uv * 2.5 + n.xy * 2., 2)));
  col = mix(col, sky, SAT(fres * 1.6 + .03));
  float spec = pow(max(dot(reflect(-normalize(vec3(.3, .5, .8)), n), vec3(0, 0, 1)), 0.), 200.);
  col += sun * spec * 1.6;
  // ūdensmērītājs: tievs ķermenis un kājiņas uz virsmas
  vec2 sb = uStrider;
  vec2 bq = p - sb; bq = mat2(cos(uStriderA), sin(uStriderA), -sin(uStriderA), cos(uStriderA)) * bq;
  float body = length(bq * vec2(1., 3.5)) - .012;
  float legs = 1.;
  if (dot(p - sb, p - sb) < .012) for (int k = 0; k < 6; k++) {
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
  if (p.x < -.5 * asp + .55 && p.y < .05) for (int i = 0; i < 9; i++) {
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
