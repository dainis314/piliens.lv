# piliens.lv (2. versija)

Dabas lapa par vienu pilienu no gaisa līdz jūrai. Statiska lapa bez servera un bez būvēšanas soļa:
`index.html`, `css/`, `js/` (ES moduļi), `shaders/` (WebGL2), `foto/`, `assets/` (fonti, statiskie kadri, ikonas).

## Sadaļas

| Sadaļa | Kas notiek |
|---|---|
| piliens | Rasas punkts: silts, mitrs gaiss (labā augša, +22 °C, 53 %) satiek vēsumu (+4 °C). Uz aukstajiem šīfera burtiem kondensējas lāses, aug, saplūst, slīd un pil peļķē. Klikšķis: silta elpa. |
| lāse | Sekla upe ar tējas brūnu ūdeni. Viļņu vienādojums uz GPU, kaustiku tīkls, ūdensmērītājs, reta zivtiņas ēna, kas aizbēg no klikšķa. |
| tinte | Glāze pret logu. Tintes lāse veido virpuļgredzenu, kas sadalās mazākos (punktvirpuļu fizika + blīvuma lauks). Krāsa atkarīga no sēklas. |
| lietus | Vecs logs, aiz tā sarmots rīts. Lāses ārpusē slīd un aprij mazās; aprasojušo stiklu var noslaucīt, un tas lēnām aizsvīst. |
| rasa | 8 Daiņa fotogrāfijas. Lāse-lēca (1,9×) seko kursoram; sīktēli ir ūdens lāses; pāreja ar lāses triecienu. |
| laiks | Lāse sekundē no lāstekas bļodakmenī. Skaitītājs, ūdens līmenis, sūna zaļo, paparde atritinās, lāsteka īsinās; pēc 120 pilieniem ūdens pārplūst. |
| jūra (kājene) | Daiņa foto no jūras krasta ar seklā ūdens kustību, putām un dzintaru. |

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
- Adaptīvā kvalitāte: ja kadri kļūst lēni, aina automātiski samazina izšķirtspēju. Neredzamās sadaļas un paslēpta cilne netiek zīmētas.
- Samazinātā kustība: automātiskās animācijas apstājas, mijiedarbība un skaitītājs paliek.
- Fonti (Fraunces, Commissioner, SIL Open Font License) glabājas `assets/fonts/`; nav Google Fonts, izsekotāju un sīkdatņu.
- Lokāla pārbaude: `python -m http.server` šajā mapē un atver `http://localhost:8000` (ES moduļi un `fetch` nestrādā, atverot failu tieši).
