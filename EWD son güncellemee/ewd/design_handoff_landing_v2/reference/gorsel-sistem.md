# Handoff: English with Dilara — Görsel Sistem & Bileşen Kütüphanesi

## Genel bakış
`englishwithdilara.com` yeniden tasarımı için üretilen **görsel sistem**: marka renkleri, tipografi ölçeği,
kodlanmış bileşenler ve referans 3D render'lardan kesilmiş şeffaf PNG varlık seti.

Bu paket **tasarım yönünü ve yeniden kullanılabilir parçaları** taşır. Yeni sayfa/ekran kurgusu bu
parçalar üzerine inşa edilecek.

## Tasarım dosyaları hakkında
Bu pakettteki HTML dosyaları **HTML ile üretilmiş tasarım referanslarıdır** — hedeflenen görünümü ve
davranışı gösteren prototiplerdir, doğrudan kopyalanacak üretim kodu değildir.
Görev, bu tasarımları hedef kod tabanının mevcut ortamında (bu projede **React + Vite + TypeScript +
Tailwind + shadcn/ui**, repo: `Ddreamnet/ewd-revival-project`) o kod tabanının yerleşik desenleriyle
yeniden üretmektir.

Kaynak repodaki karşılıkları:
- Renk token'ları: `src/index.css` (`--landing-purple`, `--landing-pink`, `--landing-yellow`, `--book-a/b`)
- Tipografi: `tailwind.config.ts` (Poppins) + `Dancing Script` (vurgu)
- Landing bölümleri: `src/components/landing/*`
- Metinler: `src/lib/translations.ts` (TR/EN sözlük — arayüz dili **sadece Türkçe** olacak)

## Fidelity
**High-fidelity (hifi).** Renkler, tipografi, boşluk ve gölge değerleri nihaidir; birebir uygulanmalıdır.

## Dosyalar
| Dosya | İçerik |
| --- | --- |
| `EWD Bileşen Kütüphanesi.dc.html` | Renk + tipografi + kodlanmış bileşenler + 3D varlık galerisi |
| `EWD Redesign v1 (arşiv).dc.html` | Landing'in ilk yeniden üretimi (tüm bölümler) — referans |
| `support.js` | HTML dosyalarının çalışması için gerekli runtime (yalnızca önizleme amaçlı) |
| `assets/**` | Şeffaf PNG varlık seti |
| `public/uploads/**` | Logo, gingham desenleri, maskot, sosyal ikonlar (repo'dan) |
| `bar.md` | Referans kartların mekanik analizi (kart anatomisi) |
| `brief.md` | Redesign brief'i ve alınan kararlar |

Tarayıcıda açmak için: HTML dosyası ile `support.js`, `assets/`, `public/` aynı klasörde kalmalı.

## Design Tokens

### Renk
| Rol | Hex |
| --- | --- |
| Mor (birincil) | `#A253BE` |
| Mor koyu (vurgu/metin) | `#7C3AED` · `#6D28D9` · `#5B21B6` |
| Mor gölge tabanı | `#7E3D96` |
| Mor açık zeminler | `#F4EDFF` · `#EFE0FF` · `#E6D6FB` · `#E9D5FF` |
| Mor kenar | `#C9B6F5` · `#C6AEF0` · `#DDCCF7` |
| Pembe (ikincil) | `#EC4899` · `#DB2777` · `#BE185D` |
| Pembe gölge tabanı | `#BE185D` |
| Pembe açık zeminler | `#FDEFF5` · `#FCE7F3` · `#FBD5E4` |
| Pembe kenar | `#F8C8DC` · `#FAD3E4` |
| Sarı (vurgu) | `#FBD34F` · `#FBBF24` · gölge tabanı `#D9A21B` |
| WhatsApp yeşili | `#22C55E` · gölge tabanı `#15803D` |
| Metin koyu | `#2E1065` · `#2F2A3A` |
| Metin gövde | `#5B4A6E` · `#6B5B7B` · `#6B7280` |
| Metin soluk | `#8B7A9E` · `#9A87AC` |
| Sayfa zeminleri | `#FFF5FB` · `#FDF4FF` · `#F7ECFF` · `#FBF8FF` · `#FFFFFF` |
| Kitap gradyanı (hero) | `#C9A9F0` → `#B18AE4` (repo: `--book-a` / `--book-b`) |

### Tipografi
- Font: **Poppins** (400/500/600/700/800/900), vurgu: **Dancing Script** 700 (yalnızca "Dilara", "Neden")
- Bölüm başlığı: 46px / 900 / `letter-spacing: -0.02em`
- Kart başlığı: 42–46px / 900 / `line-height: 0.95` / `-0.02em`
- Alt başlık: 20–26px / 600–700
- Satır üst metni: 17–18px / 700
- Gövde: 15–17px / 500 / `line-height: 1.5–1.6`
- Satır alt metni: 13px / 500 / `line-height: 1.35` / `#6B7280`
- Etiket (uppercase): 12–13px / 800 / `letter-spacing: 0.06–0.20em`

### Boşluk & form
- Bölüm dolgusu: `96px 40px`; içerik genişliği: `1180px` (sayfa `1440px`)
- Köşe yarıçapı: pill `999px` · kart `38–42px` · iç kart `20–22px` · alan `14px`
- Kenar: kart `3–4px solid` (renkli) · alan `1.5px solid`
- Ayırıcı: `2px dashed` (kart içi) · `2px dotted` (satır içi sol ayırıcı)
- Gölgeler:
  - Kart: `0 26px 38px -18px rgba(46,16,101,0.18)`
  - İç pill: `0 2px 6px rgba(46,16,101,0.06)`
  - Buton (katı taban): `0 5px 0 <koyu ton>`
  - 3D ikon: `drop-shadow(0 6px 10px rgba(46,16,101,0.16))`

## Bileşenler

### Nav pill
Pembe (`#F8C8DC`) pill, `border-radius: 999px`, `padding: 7px 22px 7px 7px`, `gap: 10px`.
Sol tarafta 36×36 daire içinde 3D badge (`overflow: hidden`, `object-fit: cover`, `object-position: center`),
metin 16px/600 `#2F2A3A`. Hover: `#F5B6D0`.
Kaynak yapı: `src/components/landing/LandingHeader.tsx`.

### Buton
Katı gölge tabanı deseni: `box-shadow: 0 5px 0 <koyu ton>`, `border-radius: 999px`, `padding: 15px 26px`, 16px/800.
Varyantlar: mor (`#A253BE`/`#7E3D96`), pembe (`#EC4899`/`#BE185D`), sarı (`#FBD34F`/`#D9A21B`, metin `#2E2E38`),
çerçeve (2px `#DDD0F5`, metin `#7C3AED`), WhatsApp (`#22C55E`/`#15803D` + logo).

### Özellik barı (hero)
Pill (`999px`), zemin `#FBF8FF` / `#FFF7FB`, kenar 2px (`#DDCCF7` / `#F8C8DC`),
`padding: 20px 26px 20px 92px`. 3D ikon `position: absolute; left: -6px; top: 50%; translateY(-50%)`, 96px.
İkon ile metin arasında 3px dikey renk çubuğu. Metin 21px/900 uppercase, iki satır, `line-height: 1.05`.

### Liste satırı (taşan 3D rozet)
Beyaz-mor pill `#FBF8FF`, `border-radius: 20px`, `padding: 16px 22px 16px 76px`.
3D rozet `left: -8px`, 72px, kendi drop-shadow'u. Sarı 11px nokta + 18px/700 metin.
Kapsayıcı: `#E6D6FB` zemin, 3px `#C6AEF0` kenar, `28px` yarıçap.

### Paket kartı satırı (iki satırlı)
Beyaz pill, `padding: 13px 18px 13px 70px`, ikon `left: -4px` 66px.
Metin bloğu `border-left: 2px dotted` + `padding-left: 16px`; üst satır 17px/700 kart rengi,
alt satır 13px/500 `#6B7280`.

### Paket kartı (tam)
3px renkli kenar + açık zemin + `38px` yarıçap. Üstte sol köşeden taşan sarı şerit (`top: -18px`),
sağ üstte tek büyük 3D obje. Başlık: 48px daire madalyon (numara, beyaz 900) + 42px/900 iki satırlı başlık
(ilk satır koyu, ikinci açık ton). Altında yıldızlı slogan satırı (13px/800 uppercase) ve `2px dashed` ayırıcı.
En altta tam genişlik footer pill (kart renginin %20 tonu, 13px/800 uppercase).

### Sticker kart
Döndürülmüş (`rotate(6deg)`) kart: 3px `#F0C4DC` kenar, `#EFE1FB` zemin, `30px` yarıçap, 214px genişlik.
3D obje üstten taşar (`margin-top: -30px`). İçerik: 13px/800 üst etiket → 30px/900 başlık → mor CTA pill.

### Başlık lockup (tipografi)
`Neden` (Dancing Script 700) → `ENGLISH` (Poppins 900, `text-shadow: 0 3px 0 #E9D5FF, 0 6px 0 rgba(46,16,101,0.18)`)
→ `with` (600) → `DILARA?` (Dancing Script 700, `#A253BE`, aynı katmanlı gölge; `?` Poppins 900 `#EC4899`).

### SSS satırı
Kapalı: `#EFE0FF` zemin, `22px` yarıçap, 18px/600 metin, sağda 38px daire `+` (`#DCC6F5` / `#7E3D96`).
Açık: başlık `#E9D5FF`, gövde `#FCE7F3`, daire `#A253BE` / beyaz `−`.

### Form alanı
`#FDF4FF` zemin, 1.5px `#F0E1FA` kenar, `14px` yarıçap, `padding: 15px 18px`, placeholder `#9A87AC`.
Telefon alanı: `+90` ön eki ayrı kutu. Gönder: mor tam genişlik buton.

## Varlıklar

Tümü **şeffaf PNG**; kullanıcının yüklediği 3D render'lardan kesildi (tek bağlı bileşen, artık yok).

- `assets/ic/ic-*.png` — çocuk paket kartı satır ikonları (mor set + `-p` pembe set)
- `assets/ic/n-*.png` — "Neden EWD" liste ikonları (kişi, ikili, video, sohbet, pano, hediye)
- `assets/ic/y-*.png` — yetişkin paketi ikonları (+ `y-check` onay, `y-ampul`)
- `assets/ic/fi-*.png` — hero özellik barı ikonları (takvim, laptop, konuşma)
- `assets/ic/nav-*.png` — nav badge'leri (dersler, iletişim, blog) — üçü de 1:1 daire
- `assets/ic/gift.png` — sticker hediye kutusu
- `assets/icon-*.png` — iletişim ikon seti (12 adet: mail, call, at, pin, chat, globe, whatsapp …)
- `assets/art-*.png` — büyük objeler (kitap Aa, sırt çantası, mezuniyet, şeritler)
- `assets/star-*.png`, `assets/sparkle-*.png`, `assets/garland-*.png`, `assets/tab-yellow.png` — süslemeler
- `assets/card-temel.png`, `card-okul.png`, `card-yetiskin.png`, `feat-*.png`, `badge-neden.png`,
  `list-features.png`, `pill-*.png`, `sticker-deneme.png` — **kaynak referans render'lar** (uygulamada
  kullanılmaz, yalnızca karşılaştırma için)
- `public/uploads/` — `logo.webp`, `pinkgingham.webp`, `navygingham.webp`, `dilarateacher.png`,
  `whatsappLogo.png`, `instagramLogo.png` (repo'dan)

**Önemli:** metin içeren hiçbir görsel kullanılmaz — nav pill'leri, başlık lockup'ı ve sticker
tamamen kodla dizilir; yalnızca 3D objeler görsel olarak kalır.

## Uygulama notları
- Dil: **sadece Türkçe**. Metinler `src/lib/translations.ts`'in TR değerleridir.
- **Dark mode gerekli** — repo'da `ThemeToggleButton` ve `dark:` varyantları mevcut; açık moddaki
  zemin/kenar tonlarının koyu karşılıkları tanımlanmalı.
- Mobil: nav pill'leri ikon-only'ye düşer (`MobileNavPanel` mevcut); 3D rozetlerin taşma değerleri
  (`left: -8px` vb.) küçük ekranda yeniden ölçeklenmeli.
- Hit target'lar mobilde ≥44px.
- 3D ikonlar `<img>` olarak kalır; CSS ile 3D taklidi yapılmaz.
