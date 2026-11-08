// sēne: Daiņa zvīņbeka rudens mežā; uz cepurītes viens dzīvs piliens.
// Piliens ir lēca: tajā otrādi redzams mežs un debesis, ass spīdums pret gaismu, tumšāka mala,
// maigs kaustikas plankums uz cepurītes un lēns "elpojošs" atspīdums, kas pārslīd pāri lāsei.
uniform float uRnd[32];
uniform sampler2D uTex0;
uniform float uBgAspect;
uniform vec2 uFocus;
uniform float uCapW;
uniform vec4 uDrop;      // kontakta punkts (x, y), rādiuss, drebēšana
uniform vec4 uDropN;     // virsmas normāle (x, y), izstiepums, augums 0..1
uniform vec4 uFall;      // krītošā lāse: centrs, rādiuss, izstiepums
uniform vec4 uSplash[8]; // šļakatas: x, y, rādiuss, redzamība
uniform vec4 uWet;       // slapjais plankums: x, y, vecums (s), stiprums
uniform vec4 uMist;      // migla: x, y, daudzums, sēklas fāze
uniform vec2 uSeat;      // vieta, kur aug piliens

vec3 photoP(vec2 p) {                                  // foto pēc p koordinātēm (y uz augšu, augstums 1)
  float asp = uRes.x / uRes.y;
  return photoCover(uTex0, clamp(vec2(p.x / asp + .5, p.y + .5), 0., 1.), uBgAspect, uFocus, false);
}

// lēcas ēnošana: q lāses iekšienē (-1..1), c lāses centrs, R rādiuss, g augums
vec3 lens(vec2 q, vec2 c, float R, float g, vec3 under, float ph) {
  float r2 = dot(q, q);
  float h = sqrt(max(0., 1. - r2));
  float curv = mix(1.35, .9, g);                        // lielāka lāse: izliektāka lēca, spēcīgāka laušana
  vec3 n = normalize(vec3(q, h * curv));
  // otrādi apgriezts mežs un debesis virs/aiz lāses (kā mazā lodveida lēcā)
  vec2 sp = c + vec2(0., R * 3.4) - q * R * (2.4 + 1.6 * g) - n.xy * R * .6;
  vec3 col = photoP(sp) * 1.2 + vec3(.014, .020, .026);
  // cauri spīd pati cepurīte (silti oranža), īpaši lāses lejasdaļā
  col = mix(col, under * 1.3, .3 + smoothstep(.15, -.75, q.y) * .45);
  col *= 1. - .62 * smoothstep(.5, 1., sqrt(r2));       // tumšāka mala (pilnā iekšējā atstarošana)
  col += vec3(1.) * pow(1. - h, 4.) * .22;               // šaura Freneļa mala
  vec3 L = normalize(vec3(-.5, .68, .55));               // gaisma no kreisās augšas (kā foto)
  float spec = pow(max(dot(reflect(-L, n), vec3(0, 0, 1)), 0.), mix(70., 190., g));
  col += vec3(1., .99, .95) * spec * mix(1.5, 2.6, g);
  // "elpojošs" atspīdums: lēni pārslīd pāri lāsei un pulsē
  float a = 1.95 + .85 * sin(uTime * .42 + ph);
  vec2 gc = vec2(cos(a), sin(a)) * .5;
  float breath = .55 + .45 * sin(uTime * .9 + ph * 1.7);
  col += vec3(1., .93, .8) * exp(-dot(q - gc, q - gc) * mix(10., 22., g)) * (.10 + .12 * g) * breath;
  // kaustikas atblāzma lāses lejasdaļā (gaisma, kas izgājusi cauri)
  col += vec3(1., .82, .5) * exp(-dot(q - vec2(.32, -.42), q - vec2(.32, -.42)) * 16.) * (.14 + .2 * g);
  return col;
}

void main() {
  vec2 fc = gl_FragCoord.xy;
  float asp = uRes.x / uRes.y;
  vec2 uv = fc / uRes;
  vec2 p = (fc - .5 * uRes) / uRes.y;
  float W = uCapW;
  vec3 base = photoP(p);
  vec3 col = base;

  // slapjš plankums uz skaidām un mazs šļakatu viļņojums (gredzens)
  if (uWet.w > 0.) {
    vec2 e = (p - uWet.xy) / (vec2(1., .32) * W * (.055 + .012 * min(uWet.z, 3.)));
    float fade = (1. - smoothstep(2., 9., uWet.z)) * uWet.w;
    col *= 1. - .38 * exp(-dot(e, e) * 1.4) * fade;
    col += vec3(.9, .85, .75) * pow(SAT(1. - length(e - vec2(-.25, .3)) * 1.6), 6.) * .10 * fade;   // mitrs spīdums
    float rr = length((p - uWet.xy) / vec2(1., .3));
    float front = W * (.015 + .11 * uWet.z);
    col += vec3(1., .95, .85) * smoothstep(.006, .0, abs(rr - front)) * exp(-uWet.z * 3.5) * .45;
  }

  // migla: no kursora plūst pie piliena un tur kondensējas
  float ma = uMist.z;
  if (ma > .01) {
    vec2 a = uMist.xy, b = uSeat + vec2(0., W * .02);
    vec2 ab = b - a; float L2 = max(dot(ab, ab), 1e-5);
    float t = SAT(dot(p - a, ab) / L2);
    float d = length(p - a - ab * t);
    float wdt = W * (.16 - .11 * t);                     // plata pie kursora, šaura pie piliena
    if (d < wdt * 3.) {
      vec2 dir = ab / sqrt(L2);
      float n = fbm((p - dir * uTime * .07) * 9. / W + uMist.w, 3);
      float dens = exp(-d * d / (wdt * wdt)) * (.45 + .55 * SAT(n + .45)) * ma * (.4 + .6 * smoothstep(.0, .25, t));
      col = mix(col, vec3(.90, .92, .91), SAT(dens) * .42);
      // sīki miglas pilieniņi, kas lido pie lielā piliena un tajā pazūd
      for (int i = 0; i < 10; i++) {
        float fi = float(i);
        float f = fract(uTime * .32 + hash12(vec2(fi, 3.)) );
        vec2 perp = vec2(-dir.y, dir.x) * (hash12(vec2(fi, 5.)) - .5) * wdt * 1.6 * (1. - f);
        vec2 mp = a + ab * f + perp;
        float mr = W * .005 * (1. - f * .7);
        float md = length(p - mp);
        if (md < mr * 2.5) col += vec3(.95, .97, 1.) * smoothstep(mr, mr * .2, md) * ma * .5 * smoothstep(1., .8, f);
      }
    }
  }

  // piliens uz cepurītes
  float R = uDrop.z;
  if (R > 0.) {
    vec2 nn = normalize(uDropN.xy), tt = vec2(nn.y, -nn.x);
    vec2 cp = uDrop.xy;
    vec2 c = cp + nn * R * .48;                          // centrs virs virsmas (kontakta leņķis ~120°)
    vec2 q = p - c;
    if (dot(q, q) < R * R * 9.) {
      float g = uDropN.w;
      // ēna un kaustika uz cepurītes (gaisma no kreisās augšas: ēna pa labi lejā)
      vec2 so = (p - cp - (tt * .45 - nn * .05) * R) / (R * vec2(1.25, .55));
      col *= 1. - .30 * exp(-dot(so, so) * 1.6);
      vec2 co = (p - cp - (tt * .55 + nn * .02) * R) / (R * vec2(.55, .25));
      col += vec3(1., .78, .38) * exp(-dot(co, co) * 2.) * (.16 + .34 * g);
      // lāses forma: lode, ko nogriež cepurītes virsma; drebot viegli plok un stiepjas
      vec2 lq = vec2(dot(q, tt), dot(q, nn)) / R;
      lq.x /= 1. + uDropN.z;
      float wb = uDrop.w * sin(uTime * 23. + uMist.w);
      lq *= vec2(1. - wb, 1. + wb);
      float r2 = dot(lq, lq);
      float cut = smoothstep(-.48, -.40, lq.y);           // zem kontakta līnijas ir cepurīte
      float aa = (1. - smoothstep(.93, 1., sqrt(r2))) * cut;
      if (aa > 0.) {
        vec2 qs = vec2(lq.x * tt.x + lq.y * nn.x, lq.x * tt.y + lq.y * nn.y);   // atpakaļ ekrāna orientācijā
        vec3 L = lens(qs, c, R, g, base, uMist.w);
        col = mix(col, L, aa);
      }
    }
  }

  // krītošā lāse: piliena forma ar asu galu augšā, izstiepjas krītot
  if (uFall.z > 0.) {
    float Rf = uFall.z;
    vec2 q = p - uFall.xy;
    if (dot(q, q) < Rf * Rf * 16.) {
      float st = uFall.w;
      float d = sdDrop(q / vec2(1. - st * .25, 1.), Rf, Rf * (1.6 + st * 1.4));
      float aa = 1. - smoothstep(-.0015, .0, d);
      if (aa > 0.) {
        vec2 lq = q / Rf; lq.y = lq.y < 0. ? lq.y : lq.y / (1.6 + st * 1.4);
        vec3 L = lens(clamp(lq, -.99, .99) * .98, uFall.xy, Rf, 1., base, uMist.w);
        col = mix(col, L, aa);
      }
    }
  }

  // šļakatas: sīkas lāsītes ar spīduma punktu
  for (int i = 0; i < 8; i++) {
    vec4 s = uSplash[i];
    if (s.w <= 0.) continue;
    vec2 q = (p - s.xy) / s.z;
    float r2 = dot(q, q);
    if (r2 < 1.) {
      vec3 dcol = photoP(s.xy - q * s.z * 3. + vec2(0., s.z * 4.)) * (1. - .5 * r2) + vec3(1.) * exp(-dot(q - vec2(-.35, .4), q - vec2(-.35, .4)) * 10.) * .9;
      col = mix(col, dcol, s.w * (1. - smoothstep(.75, 1., r2)));
    }
  }

  // maiga, tumšāka migla aiz paraksta (kreisajā apakšā) un navigācijas (labajā malā)
  col = mix(col, col * .42, smoothstep(.55, .0, length(uv * vec2(asp * .9, 1.6))) * .75);
  col = mix(col, col * .6, smoothstep(.3, .0, length((uv - vec2(1., .5)) * vec2(asp * 1.4, .75))) * .6);
  col = pow(max(col, 0.), vec3(1. / 2.2));
  col += (hash12(fc) - .5) * (1.5 / 255.);
  outColor = vec4(col, 1.);
}
