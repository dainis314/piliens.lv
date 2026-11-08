# piliens.lv (4. versija)

Dabas lapa par vienu pilienu no gaisa līdz jūrai: septiņi veidi, kā izskatās piliens, un jūra kājenē. Statiska lapa bez servera un bez būvēšanas soļa:
`index.html`, `css/`, `js/` (ES moduļi), `shaders/` (WebGL2 avoti; pārlūks lieto to apkopojumu `js/shaders.js`), `foto/` (WebP), `assets/` (fonti, statiskie kadri, ikonas).

## Sadaļas

| Sadaļa | Kas notiek |
|---|---|
| piliens | Rasas punkts: silts, mitrs gaiss (labā augša, +22 °C, 53 %) satiek vēsumu (+4 °C). Uz aukstajiem šīfera burtiem kondensējas lāses, aug, saplūst, slīd un pil peļķē. Klikšķis: silta elpa. |
| lāse | Sekla upe ar tējas brūnu ūdeni. Viļņu vienādojums uz GPU, kaustiku tīkls, ūdensmērītājs, reta zivtiņas ēna, kas aizbēg no klikšķa. |
| tinte | Glāze pret logu. Tintes lāse veido virpuļgredzenu, kas sadalās mazākos (punktvirpuļu fizika + blīvuma lauks). Krāsa atkarīga no sēklas. |
| lietus | Vecs logs, aiz tā sarmots rīts. Lāses ārpusē slīd un aprij mazās; aprasojušo stiklu var noslaucīt, un tas lēnām aizsvīst. |
| rasa | 8 Daiņa fotogrāfijas. Lāse-lēca (1,9×) seko kursoram; sīktēli ir ūdens lāses (klikšķis: pāreja ar lāses triecienu). Bildes var pārvilkt ar pirkstu vai peli (pa kreisi: nākamā, pa labi: iepriekšējā, ciklā), pārslēgt ar bultiņām ← → vai horizontālo ritenīti. |
| laiks | Lāse sekundē no lāstekas bļodakmenī. Skaitītājs, ūdens līmenis, sūna zaļo, paparde atritinās, lāsteka īsinās; pēc 120 pilieniem ūdens pārplūst. |
| sēne | Daiņa foto: zvīņbeka rudens mežā, uz cepurītes viens piliens-lēca (tajā otrādi redzams mežs). Kursors virs sēnes atnes miglu, kas kondensējas uz piliena; piliens aug, drebē, noripo līdz malai un nokrīt uz skaidām ar sīkām šļakatām. Bez darbības piliens aug pats lēni; klikšķis to noliek uzreiz. |
| jūra (kājene) | Daiņa foto no jūras krasta. Viļņi perspektīvā nāk uz krastu, putas uzplūst ap akmeņiem, dzintars šūpojas. Virs jūras migla lēni ceļas un augstāk sablīvējas sīkos pilienos (atsauce uz pirmo lapu). 30 fps. |

Katram apmeklējumam ir sava sēkla, tāpēc aina katru reizi ir mazliet citāda. Atkļūdošanai: `?seed=123`.

## Publicēšana: GitHub Pages un NIC.lv

1. Izveido publisku GitHub repozitoriju (piem., `piliens.lv`) un augšupielādē **visu šīs mapes saturu** (ieskaitot `CNAME`, `.nojekyll`, mapes `css`, `js`, `shaders`, `foto`, `assets`).
2. **Settings → Pages**: *Deploy from a branch*, zars `main`, mape `/ (root)`.
3. Profila **Settings → Pages → Add a domain**: `piliens.lv`; GitHub dos TXT ierakstu verifikācijai.
4. **NIC.lv** → Mani domēna vārdi → piliens.lv → Domēna vārda tehniskie ieraksti → *Jauns tīkla ieraksts*:

| Tips | Nosaukums | Vērtība |
|---|---|---|
| A | piliens.lv | 185.199.108.153 |
| A | piliens.lv | 185.199.109.153 |
| A | piliens.lv | 185.199.110.153 |
| A | piliens.lv | 185.199.111.153 |
| CNAME | www | `<lietotājvārds>.github.io` |
| TXT | `_github-pages-challenge-<lietotājvārds>` | kods no GitHub |

5. Repozitorijā **Settings → Pages → Custom domain**: `piliens.lv`; kad pārbaude zaļa, atzīmē **Enforce HTTPS**.

**Neaiztikt** esošos 7 Google MX ierakstus. Ieteicams pievienot e-pastam: TXT `v=spf1 include:_spf.google.com ~all`, DKIM `google._domainkey` no Google Admin (ja garā vērtība neder, 1024 bitu atslēga) un, pēc izvēles, `_dmarc`.

## Tehniski

- WebGL2 katrai ainai; ja WebGL2 nav, redzams statisks kadrs no `assets/kadri/`.
- Šeideru avoti ir `shaders/*.frag` un `shaders/common.glsl`. Pēc to labošanas palaid `python3 tools/bundle_shaders.py`, kas atjauno `js/shaders.js` (pārlūks ielādē tikai to).
- Samazinātā kustība: automātiskās animācijas apstājas, mijiedarbība un skaitītājs paliek.
- Fonti (Fraunces, Commissioner, SIL Open Font License) glabājas `assets/fonts/`; nav Google Fonts, izsekotāju un sīkdatņu.
- Lokāla pārbaude: `python -m http.server` šajā mapē un atver `http://localhost:8000` (ES moduļi un `fetch` nestrādā, atverot failu tieši).

## Veiktspēja (3. versija)

Mērķis ir 50–60 fps arī integrētajā grafikā (Intel UHD), nemainot izskatu.

- **Konteksta dzīves cikls.** WebGL konteksts ir tikai sadaļām ekrānā un ~pusekrāna attālumā (parasti 2–3). Tālākās tiek atbrīvotas ar `WEBGL_lose_context` un atjaunotas, kad tuvojas. Zīmē tikai redzamās ainas: parasti vienu, pārejā divas. Kaimiņsadaļa, kas ar organisko malu ielīdusi ekrānā, zīmē tikai savu redzamo joslu (`scissor`).
- **Pikseļu budžets.** Katras ainas iekšējais audekls ir ≤ 1,4 MP, `devicePixelRatio` netiek izmantots (≤ 1 pikselis uz CSS pikseli). CSS palielina līdz ekrāna izmēram.
- **Adaptīvā kvalitāte.** Sākuma mērogs ir 0,8. Ja vidējais kadrs ilgāk par 20 ms, mērogs samazinās (līdz 0,5). Ja ilgstoši zem 12–17 ms, tas lēni aug līdz 1.
- **Šeideri.** Dārgās daļas rēķina tikai tur, kur tās redzamas: papardes, sūnu šķiedras, lāsteka, putekļi, peļķe, migla. Ir mazāk `fbm` oktāvu. Lāses upes gultne tiek izcepta tekstūrā vienreiz (`lase_bed.frag`), nevis rēķināta katrā kadrā. „Laiks” zīmē ar 30 fps (laiks interpolēts), pārējās ainas ar 60 fps.
- **Konteksta zudums.** `webglcontextlost` tiek apstrādāts ar `preventDefault`, un aina pati atjaunojas. Statiskais kadrs (`gl-fallback`) ir tikai tad, ja WebGL2 tiešām nav. Konteksta iestatījumi: `powerPreference: "high-performance"`, bez antialias, depth, stencil un preserveDrawingBuffer.
- **Augšupielādes bez GPU apstāšanās.** Katrā kadrā mainīgās 2D kartes (lāses, stikla migla) ir CPU audekli (`willReadFrequently`), un tām netiek veidotas mipmap.
- **Attēli.** Visi ir WebP, garākā mala ≤ 1920 px. Sīktēli ir `foto/mazas/` (160 px). Bildes un statiskie kadri ielādējas tikai tad, kad sadaļa tuvojas. Pirmajam ekrānam vajag 3 attēlus (~0,8 MB kopā ar fontiem un kodu), nevis 15.
- **4. versija.** Jaunā „sēne” un kustīgā jūra izmanto to pašu dzīves ciklu (konteksts tikai tuvu ekrānam, adaptīvā kvalitāte, `?perf=1`). Jūra zīmē ar 30 fps. Ūdens vietas jūras foto nosaka gatava maska `foto/jura-udens.webp` (14 KB), nevis krāsu minējums šeiderī.
- **Kursors.** Tas ir tikai pelei (`hover: hover` un `pointer: fine`), skārienierīcēs nav. DOM tiek rakstīts tikai mainītām vērtībām, un `elementFromPoint` tiek saukts tikai pēc kustības vai ritināšanas. Ja fps < 40, stikla `backdrop-filter` izslēdzas (klase `low-fx`).

### Diagnostika: `?perf=1`

Kreisajā augšējā stūrī redzams panelis ar šādu informāciju:
- fps, vidējais kadra laiks un dzīvo kontekstu skaits;
- katrai ainai: stāvoklis (zīmē, gaida, atbrīvots), iekšējā izšķirtspēja, kvalitātes mērogs `q`, mērķa fps, ainas laiks ms un uzzīmētā daļa %.

Tie paši dati ir `window.__perf`. Šajā režīmā ainas laiks tiek mērīts ar sinhronu 1 pikseļa nolasīšanu, tāpēc pats panelis lapu mazliet palēnina.

Var kombinēt: `?seed=2&perf=1`.

## Attēlu avoti (4. versija)

- `foto/sene-plata.webp`: datoram (1920×1080). Daiņa vertikālais foto ir novietots pa labi no centra, malas paplašinātas ar izplūdušu fonu, lai kreisajā pusē paliek vieta parakstam.
- `foto/sene-tuva.webp`: telefonam (720 px plats, viss vertikālais foto).
- `assets/kadri/sene.webp`, `sene-m.webp`: statiskie kadri rezerves režīmam.
- Cepurītes augšējā kontūra (pa kuru ripo piliens) ir izmērīta no foto un ierakstīta `js/scenes/sene.js`.

## Valodas (4. versija)

- **24 ES oficiālās valodas.** Noklusējums ir latviešu. Pirmajā apmeklējumā valoda tiek izvēlēta pēc `navigator.language`, ja tā ir sarakstā; izvēle saglabājas `localStorage` (`piliens.lang`). Valodu var norādīt arī saitē: `?lang=de`.
- **Izvēlne.** Augšējā labajā stūrī ir poga ar lāsi un valodas kodu. Saraksts ir `role="listbox"`: darbojas ar bultiņām, Home/End, Enter, Esc un pirmā burta meklēšanu. Vispirms ir populārākās valodas, pēc tam pārējās pēc pašnosaukuma.
- **Faili.** `js/i18n.js` (bez bibliotēkām) un `lang/<kods>.json`, katrs ~8 KB. Tiek ielādēta tikai izvēlētā valoda un latviešu valoda kā rezerve. Latviešu teksts ir arī pašā HTML.
- **Atslēgas.** HTML elementos: `data-i18n="atslēga"` un `data-i18n-attr="aria-label:atslēga"`. JS: `t()`; skaitītājs ar `tp()` (Intl.PluralRules); temperatūra un mitrums ar Intl.NumberFormat.
- **Jauns teksts.** Pievieno atslēgu `lang/lv.json` un visos pārējos `lang/*.json`.
- **Fonti.** Kirilicai (bg) un grieķu valodai (el) ir pašhostētas OFL apakškopas: Literata virsrakstiem (Fraunces aizstājējs) un Commissioner tekstam. Pārlūks tās lejuplādē tikai tad, ja lapā parādās šīs rakstzīmes (`unicode-range`).
- **Vienādi deskriptori.** Visiem viena fonta `@font-face` ierakstiem jābūt ar vienādu `font-weight` diapazonu. Citādi Chrome pārstāj lietot Fraunces latīņu burtiem.
- **Ko netulko.** WebGL ainās iezīmētie vārdi netiek tulkoti: zīmols „piliens” pirmajā lapā un upes gultnes vārdi sadaļā „lāse”.
- **Autortiesību rinda.** Kājenē tā ir visās valodās. Juridiski saistošs ir latviešu teksts; tulkojumiem pievienota piezīme, ka tie ir informatīvi.

## Pārbaude

Lokāli: `python -m http.server` un `http://localhost:8000/?perf=1&lang=en`.
