# Handoff: English with Dilara — Landing v2

## Overview
`englishwithdilara.com` ana sayfasının (landing) yeniden tasarımı. Hedef kitle: çocuğu için online İngilizce dersi arayan veliler (birincil) ve kendisi için ders arayan yetişkinler (ikincil). Sayfanın işi tek: **ücretsiz deneme dersi** talebi toplamak — ikincil dönüşüm WhatsApp'tan yazmak.

Bu paket, önceki handoff'un (v1) üzerine yapılan tüm değişiklikleri ve **iki yeni bölümü** (Dersten Kareler, Veli Yorumları) içerir. Bölüm bölüm ne değişti: `CHANGELOG.md`.

Bu turda kapsam **sadece landing**'dir. Admin paneli / öğrenci paneli bu pakette yok.

## About the Design Files
Bu paketteki `.dc.html` dosyaları **HTML ile üretilmiş tasarım referanslarıdır** — hedeflenen görünümü ve davranışı gösteren prototiplerdir, doğrudan production'a kopyalanacak kod değildir.

Yapılacak iş: bu HTML tasarımlarını **hedef codebase'in kendi ortamında yeniden kurmak** (React / Next.js / Vue / vb.), o projenin mevcut kalıpları, bileşen kütüphanesi ve stil yaklaşımıyla. Henüz bir ortam yoksa, proje için en uygun framework seçilip tasarımlar orada uygulanmalıdır.

Dikkat: dosyalar "Design Component" formatındadır. Pratik anlamı:
- Tüm stiller **inline `style`** olarak yazılmıştır. Production'da bunlar kendi CSS/Tailwind/CSS-module yaklaşımınıza çevrilmelidir.
- `{{ değişken }}` ifadeleri **runtime değerleridir** (state'e bağlı: opacity, z-index, nokta genişliği, ref'ler). Dosyanın sonundaki `class Component extends DCLogic { … }` bloğu bu değerleri üreten mantıktır — React class component'ine çok yakındır, birebir okunabilir.
- `<sc-if>` = koşullu render, `ref="{{ … }}"` = DOM ref, `style-hover="…"` = `:hover` durumu.
- Tarayıcıda açmak için: `design/EWD Landing v2.dc.html` dosyasını doğrudan açın (yanındaki `support.js` runtime'ı yükler, internet bağlantısı gerekir — Google Fonts).

## Fidelity
**High-fidelity (hifi).** Renkler, tipografi, ölçüler, gölgeler, hover durumları ve etkileşimler nihaidir; birebir uygulanmalıdır. Metinler de nihai Türkçe kopyadır (istisnalar "Copy / İçerik notları" bölümünde işaretlenmiştir).

Ölçüler **1440px genişlikte masaüstü** için verilmiştir. Sayfanın kökü `width: 1440px; margin: 0 auto` sabit bir tuvaldir — production'da bu **akışkan** olmalı: bölüm içi `max-width: 1180px; margin: 0 auto` + yan padding 44px korunarak.

---

## Design Tokens

### Renkler
| Token | Hex | Kullanım |
|---|---|---|
| cream | `#FFF8EF` | Ana sayfa zemini, koyu bloklarda metin |
| cream-card | `#FFFDF8` | Kart zemini (kremin bir ton üstü) |
| purple | `#A253BE` | Birincil marka moru: butonlar, badge, oklar |
| purple-deep | `#6D28D9` | Bölüm zemini (Neden EWD, Dersten Kareler), başlık vurgusu |
| purple-ink | `#2E1065` | Başlık metni, en koyu bölüm zemini, footer |
| purple-shadow | `#7E3D96` | Mor butonun 5px alt gölgesi |
| purple-500 | `#8B5CF6` | İkincil mor vurgu (yetişkin bloğu) |
| lilac-bg | `#EFDFF9` | Açık mor panel / blog kartı |
| lilac-border | `#DDC8F2` / `#C9B6F5` | Açık mor kenarlıklar |
| lilac-tint | `#F5ECFF` / `#EFE0FF` | Etiket zemini |
| pink | `#EC4899` | CTA pembesi, el yazısı vurgusu |
| pink-shadow | `#BE185D` | Pembe butonun alt gölgesi + koyu pembe metin |
| pink-soft | `#F8C8DC` / `#FBD5E4` | Nav pill, SSS bölüm zemini |
| pink-tint | `#FFF1F7` / `#FFE9F2` | Etiket zemini |
| pink-border | `#F0DCE4` / `#F3DAE5` | Kart kenarlığı (hero sol panel, yorum kartı) |
| pink-dot | `#E7B4C8` | Hero sol panelin puantiye noktası |
| dot-blog | `#F0DCE4` | Blog bölümünün puantiye noktası |
| yellow | `#FBD34F` | Sarı CTA, şerit, vurgu |
| yellow-shadow | `#D9A21B` | Sarı butonun alt gölgesi |
| yellow-tint | `#FEF3C7` / `#FDECC0` | İletişim paneli / blog kartı zemini |
| yellow-ink | `#6B4A00` | Sarı üzerine metin |
| green | `#22C55E` + gölge `#15803D` | WhatsApp butonu |
| body | `#5B4A6E` | Gövde metni |
| body-soft | `#6B5B7B` | İkincil metin |
| body-quote | `#3F3350` | Yorum metni |
| muted | `#A98CBF` | Üst etiket / tarih |
| on-purple | `#E4D3F5` / `#EFE0FF` / `#D7C3EF` | Mor zemin üzerine gövde metni |

Kural: deck başına en fazla 2 zemin rengi mantığı burada da geçerli — sayfa **krem** ve **mor** blokların ritmiyle kuruludur; pembe (SSS) ve açık mor kareli (Yetişkin) birer aksandır.

### Tipografi
- **Poppins** (400/500/600/700/800/900) — tüm arayüz.
- **Dancing Script** (700) — sadece el yazısı vurguları ("Dilara", "ne diyor?", "çok eğlenceli!", imzalar).
- Ölçek: hero başlık 62px/900, bölüm başlığı 50–58px/900, el yazısı 54–84px, kart başlığı 17–21px/700-800, gövde 16–18px/500, etiket 11–13px/800-900 + `letter-spacing: 0.06–0.14em` + uppercase.
- Başlıklarda `letter-spacing: -0.025em` ile -0.03em arası negatif tracking; `line-height` 0.92–1.05.
- Gövde paragraflarında `line-height: 1.6` ve `text-wrap: pretty`.

### Spacing / şekil
- Bölüm padding: `92–96px` üst, `96–104px` alt, `44px` yan.
- İçerik genişliği: `max-width: 1180px` (Yetişkin bloğu 1080px).
- Radius: buton/pill `999px`, kart `26–46px`, küçük etiket `18–24px`.
- Gölge sistemi:
  - Buton: `0 5px 0 <koyu ton>` (düz, ofsetsiz — "basılabilir" his).
  - Kart: `0 18px 30px -22px rgba(46,16,101,0.4)` … `0 30px 44px -22px rgba(46,16,101,0.45)`.
  - Koyu zeminde kart: `0 20px 32px -20px rgba(0,0,0,0.7)`.
- Kenarlık kalınlığı `3px` (yetişkin kartı ve tuval çerçeveleri `4px`).

### Tekrar eden dekor kalıpları (bunlar tasarımın imzası — mutlaka uygulanmalı)
1. **Scallop (tarak) kenar** — koyu bölümlerin üst/alt kenarında yarım daire dizisi:
   `background-image: radial-gradient(circle at 18px 0, <üst bölümün rengi> 15px, transparent 15.5px); background-size: 36px 18px; background-repeat: repeat-x;` (18px yükseklikte absolute bir şerit).
2. **Puantiye zemin** — `radial-gradient(<nokta rengi> 2px, transparent 2.1px)` + `background-size: 30px 30px` (hero sol panel) / `34px 34px` (blog).
3. **Kareli defter zemini** — iki `repeating-linear-gradient` 1px çizgi, 34px aralık (Yetişkin paketi).
4. **Yıldız desenli zemin** — `pat/tile-star-*.png` tile, `background-size: 280–300px`, `opacity: 0.14–0.55`.
5. **Damalı (checker) footer kenarı** — `repeating-conic-gradient(#2E1065 0% 25%, #FFF8EF 0% 50%)`, `26px`.
6. **Bant (tape) şeritleri** — Değerlerimiz alıntı kartında `rotate(-32deg)` sarı ve pembe dikdörtgenler.
7. **3D obje taşması** — ikonlar/objeler kartın kenarından dışa taşacak şekilde `position: absolute` + `drop-shadow`.

---

## Screens / Views

Sayfa akışı (yukarıdan aşağı): **Header → Hero → Şerit → Neden EWD → Çocuk Paketleri → Yetişkin Paketi → Dersten Kareler → Veli Yorumları → SSS → Blog → Değerlerimiz → İletişim → Footer**. Ayrıca dosyanın en altında ayrı bir **Mobil Hero (390px)** artboard'u vardır (production'da hero'nun mobil hali).

Her bölüm kaynakta `data-screen-label="…"` ile etiketlidir; aramak için bunu kullanın.

### 1. Header
Krem zemin, alt kenar `3px solid #F2E2DA`, padding `16px 40px`, `z-index: 50`.
- Sol: logo `height: 76px` (`public/uploads/logo.webp`).
- Orta: 3 nav pill — `background: #F8C8DC`, `border-radius: 999px`, `padding: 7px 22px 7px 7px`, 16px/700 metin, solda 36px yuvarlak ikon (`assets/ic/nav-*.png`, `object-position: left center`). Hover: `#F5B6D0`.
- Sağ: `TR` ve `☾` (42px yuvarlak, `2px solid #EFDCD2`, hover kenarlık `#C9B6F5`) + **Giriş yap** butonu (`#A253BE`, `0 5px 0 #7E3D96`, hover `#B061CC`).

### 2. Hero (mozaik, 3 panel)
`padding: 18px 20px 26px`, grid `566px 1fr 306px`, `gap: 16px`, `height: 636px`.

**Sol panel** — krem `#FFFDF6` + toz pembe puantiye (`#E7B4C8`, 30px), kenarlık `3px solid #F3DAE5`, radius 42px, padding `44px 42px`, dikey ortalı:
- İki pill: dolu mor **ÇOCUKLAR İÇİN** + çerçeveli **YETİŞKİNLER** (12px/800, `letter-spacing: 0.14em`).
- Lockup: `ENGLISH` 62px/900 `#2E1065` → `with` 22px/600 → `Dilara` Dancing Script 80px `#A253BE`.
- Paragraf 17px/500, `max-width: 430px`.
- CTA'lar: **Ücretsiz deneme dersi** (pembe, 16px/800, `padding: 17px 28px`) + **WhatsApp** (yeşil, solda 28px logo).

**Orta panel** — `3px solid #F8C8DC`, radius 42px, zemin `pat/b.png` (pembe çizgi deseni, `object-fit: cover`), altta ortalı öğretmen görseli `height: 588px` + `drop-shadow(0 18px 24px rgba(46,16,101,0.22))`.

**Sağ kolon** — grid `1.42fr 1fr`, `gap: 16px`, iki tıklanabilir kart:
- **Çocuk dersleri** — düz `#A253BE`, sağ üstte taşan `art-book-aa.png` (132px), başlık 26px/900 krem, alt satır "30 dk · oyunla öğrenme", krem pill "Paketleri gör →". Hover `#AC60C6`.
- **Yetişkin dersleri** — düz `#FBD34F`, taşan `art-graduation.png` (150px), başlık 24px/900 `#2E1065`, "60 dk · A1–C1 seviyeleri". Hover `#FCDD74`.

### 3. Şerit (dalgalı kurdele)
`height: 236px`, krem zemin, tek `<svg viewBox="0 0 1440 236">`:
- Sarı yol: `M-60 168 C 300 66, 560 62, 770 138 C 990 216, 1200 196, 1500 108`, `stroke #FBD34F`, `stroke-width 44`; üzerinde `textPath` (15px/900, `letter-spacing 2`, `#6B4A00`, `startOffset 215`): "SEVİYE TESPİT SINAVI · 30 DK ÇOCUK DERSİ".
- Mor yol: `M-60 96 C 300 194, 560 200, 770 122 C 990 44, 1200 62, 1500 158`, `stroke #6D28D9`, `stroke-width 54`; `textPath` 19px/900 krem, `startOffset 118`: "ÜCRETSİZ DENEME DERSİ · KONUŞMA ODAKLI EĞİTİM · BİREBİR & GRUP".
- İki yol birbirini keser; uçlar tuvalin dışına taşar (kesintisiz his).
- `showMarquee` prop'u ile tamamen kapatılabilir.

### 4. Neden EWD
Zemin `#6D28D9` + `pat/tile-star-purple.png` (280px, `opacity: 0.32`), üstte ve altta krem scallop. Grid `452px 1fr`, `gap: 60px`.
- Sol: `Neden` (Dancing 68px `#FBD34F`) / `ENGLISH` (60px/900 krem, `text-shadow: 0 4px 0 #4C1D95`) / `with` / `Dilara?` (Dancing 82px `#F8C8DC`, `?` sarı Poppins 62px) + paragraf + sarı CTA "Ücretsiz deneme dersi al".
- Sağ: 6 krem çip (`border-radius: 22px`, `padding: 17px 24px 17px 82px`), her birinde sola taşan 76px 3D rozet (`assets/ic/n-*.png`) ve 11px sarı nokta. Metinler: Kişiye özel program / Birebir & küçük gruplar / Canlı Zoom dersleri / Konuşma odaklı eğitim / Düzenli takip & geri bildirim / Ücretsiz deneme dersi.

### 5. Çocuk Paketleri
Krem zemin. Başlık bloğu: solda "Çocuk Ders Paketleri" 58px/900, sağda kesikli sol kenarlı açıklama.
İki kart, grid `1fr 1fr`, `gap: 34px`, radius 44px:
- **1. TEMEL İNGİLİZCE** — düz `#A253BE`; sol üstte `art-ribbon-purple.png` bookmark, sağ üstte `art-book-aa.png` (152px); krem madalyon "1."; içte krem panel (`radius: 30px`) ve 7 beyaz satır — her satırda sola taşan 66px ikon + kesikli dikey ayırıcı + 17px/700 mor başlık + 13px açıklama. Altta yarı saydam pill: "Temelden güçlü bir başlangıç".
- **2. OKUL İNGİLİZCESİ** — düz `#EC4899`, aynı iskelet, pembe tonlu ikonlar; 6 satır + kesikli çerçeveli not. Altta "Okulda başarı, İngilizce ile kolay".
Altta ortada sarı CTA "Paketleri karşılaştır →".

### 6. Yetişkin Paketi
Zemin `#FBF5FF` + 34px kareli defter çizgileri. Krem kart (`4px solid #C9B6F5`, radius 46px), sağ üstte `art-graduation.png` (296px), sol üstte sarı bant.
- Madalyon "3." + `YETİŞKİN İNGİLİZCESİ` 46px/900.
- Mor pill: "Seviyeler: A1 · A2 · B1 · B2 · C1".
- "PAKET İÇERİĞİ" ayırıcısı (pill + kesikli çizgi).
- 6 madde, grid `1fr 1fr`: solda 54px ikon, ortada 15px/600 metin, sağda 28px check.
- Alt bar: `#EFE0FF` pill içinde "Esnek program · Pratik odaklı · Hedefe yönelik eğitim" + mor "Seviye tespiti al" butonu.

### 7. Dersten Kareler — YENİ
Zemin `#6D28D9` + yıldız tile (300px, `opacity: 0.3`), üstte scallop (`#FBF5FF` tonunda).
**Başlık bloğu:** sarı pill "DERSTEN KARELER"; tek satırda `Oyunla öğrenmek` (48px/900 krem) + `çok eğlenceli!` (Dancing 54px sarı), `gap: 8px`, `white-space: nowrap`; altında paragraf. Sağda **gizlilik notu kutusu** (`rgba(255,248,239,0.14)` zemin, `2px` yarı saydam kenarlık, `max-width: 262px`): 46px EWD logosu + "Gizlilik gereği öğrenci ve öğretmen görüntüleri ile isimler kapatılmıştır."

**İki eşit panel**, grid `1fr 1fr`, `gap: 76px` (aradaki iki okun çakışmaması için bu boşluk gerekli):

Her panelin üstünde krem etiket pill'i: soldakinde pembe nokta + **FOTOĞRAFLAR**, sağdakinde sarı nokta + **VİDEOLAR**; yanında `2px dashed rgba(255,248,239,0.35)` çizgi.

- **Fotoğraf karuseli (9 kare):** `overflow: hidden` maske + `width: 900%` flex track, her slayt `flex: 0 0 11.1111%`, `padding: 0 9px`. Kare: `height: 336px`, radius 26px, `3px solid #FFF8EF`, zemin `#2E1065`, görsel `object-fit: cover; object-position: center top`. Sol üstte sarı kategori pill'i (11px/900), altta `rgba(46,16,101,0.9)` zeminli 15px/700 açıklama şeridi.
  Sıra ve içerik: OYUN "Baamboozle: doğum günü kelimeleri yarışması" / KONUŞMA "“Name 3…” konuşma oyunu" / QUİZ "Vücut bölümleri quizi — skorda öğrenci önde" / ETKİNLİK "Sevdiklerimizi tabağa çiziyoruz" / OYUN "Kelime bilgisi basket turnuvası" / YARATICI "Kendi gezegenini tasarla" / İNTERAKTİF "Ev işleri: işaretle, söyle, tekrarla" / YAZMA "Meslekler ünitesi — ekrana birlikte yazıyoruz" / KONU "Saat söyleme çalışması".
- **Video karuseli (2 video):** aynı iskelet, `width: 200%`, slayt `flex: 0 0 50%`. `<video>` sessiz + döngülü + `controls` açık, `object-fit: cover`. Açıklama şeridi `bottom: 46px` (kontrol barının üstünde kalsın). Etiket pill'i "DERS VİDEOSU"; şerit ve pill `pointer-events: none` (video kontrolünü engellemesin).
- **Oklar:** her panelde `left/right: -18px`, `top: 226px` (`margin-top: -30px`), 60px yuvarlak, krem zemin + `0 5px 0 #C9B6F5`, `#6D28D9` chevron. Hover `#fff`.
- **Noktalar:** altta ortada, aktif `34px #FBD34F`, pasif `10px rgba(255,248,239,0.4)`, `transition: width .4s, background .4s`.

> **Gizlilik (kritik):** Fotoğraflardaki Zoom kamera kutucukları ve isim etiketleri, **görsel dosyasının içine yakılmış** mor (`#A253BE`) yamalarla kapatılmıştır (krem kenarlık + yıldız + "GİZLİLİK" yazısı). Videoda da maske **kare kare videoya render edilmiştir**; ses tamamen kaldırılmıştır. CSS ile üstüne konan bir örtü kullanılmamalıdır — tam ekranda veya dosya adresine doğrudan gidildiğinde açığa çıkar. Bu pakette maskesiz orijinal medya **yoktur**; yeni medya eklenirken aynı boru hattı uygulanmalıdır (bkz. `PRIVACY.md`).

### 8. Veli Yorumları — YENİ
Zemin krem + `pat/b.png` (pembe çizgi, `background-size: cover`, `opacity: 0.42`), üstte scallop. Grid `396px 1fr`, `gap: 56px`, dikey ortalı, `max-width: 1180px` + `padding: 0 44px`.

**Sol kolon:** mor pill "VELİ YORUMLARI" → `Veliler` (66px/900 `#2E1065`) + `ne diyor?` (Dancing 84px `#EC4899`) → 17px/600 paragraf "Sizlerden gelen gerçek mesajlar. Kaydırdıkça yeni bir velimiz anlatıyor." → 4 nokta (aktif `34px #EC4899`, pasif `12px #E3CFE0`) → krem pill kutu (`3px solid #F0DCE4`, radius 999px): 54px EWD logosu + "Kayıt öncesi / ücretsiz deneme dersi" (17px/800, iki satır).

**Sağ kolon — deste karuseli:** `height: 396px` konteyner, 4 kart üst üste `position: absolute; left: 50%; margin-left: -286px; width: 572px`. Kart: krem `#FFFDF8`, `3px solid #EFDFF9`, radius 36px, padding `34px 36px 28px`, gölge `0 26px 44px -26px rgba(46,16,101,0.5)`.
İçerik: 58px açık mor `“` işareti → alıntı 18px/500 `line-height 1.62` `#3F3350` → altta iki tema etiketi (pembe `#FFF1F7`/`#BE185D` ve mor `#F5ECFF`/`#6D28D9`, 12px/800, radius 999px).
Konum mantığı (aktif karta göre `d = (i - aktif + 4) % 4`):
| d | transform | opacity | z-index |
|---|---|---|---|
| 0 (aktif) | `translateX(0) scale(1) rotate(-1deg)` | 1 | 40 |
| 1 (sağ arka) | `translateX(232px) scale(0.86) rotate(4deg)` | 0.72 | 30 |
| 3 (sol arka) | `translateX(-232px) scale(0.86) rotate(-4deg)` | 0.72 | 30 |
| 2 (gizli) | `translateX(0) scale(0.78)` | 0 | 10 |
`transition: transform .55s cubic-bezier(.22,1,.36,1), opacity .4s ease`.
**Oklar:** `left/right: -26px`, `top: 50%`, 60px yuvarlak mor (`#A253BE`, `0 5px 0 #7E3D96`), hover `#B061CC`.

Dört yorumun tam metni ve etiketleri: `content/veli-yorumlari.md`.

### 9. SSS
Zemin `#FBD5E4` + `pat/tile-star-pink.png` (300px, `opacity: 0.55`), üstte scallop. Ortalı başlık 52px/900 + alt satır. Krem kart (`3px solid #F7B9D3`, radius 36px) içinde 5 akordeon satırı (`#FFF1F7`, radius 24px, padding `20px 24px`): solda 18px/700 soru, sağda 38px pembe yuvarlak `+` / `−`. Açık olan satırın cevabı 16px/500, `padding-right: 58px`. Varsayılan: ilk satır açık; ikinci kez tıklanınca kapanır (tek seferde bir satır).

### 10. Blog
Zemin krem + puantiye (`#F0DCE4`, 34px). Başlık: pembe pill "BLOG" + "Okuma köşesi" 54px/900 + alt satır; sağda mor "Tüm yazılar →".
3 kart, grid `1fr 1fr 1fr`, `gap: 44px`. Kart zemini sırayla `#EFDFF9` / `#FBD5E4` / `#FDECC0`, radius 26px, padding `30px 30px 34px`, içerik ortalı: 104px 3D ikon → 12px/800 tarih → 19px/800 başlık → çerçeveli "Devamını oku" pill'i (kart rengine göre mor / pembe / sarı kenarlık).
**Tarak kenar:** her kartın 4 kenarında, kart rengiyle aynı renkte yarım daire dizisi (`14px` şerit, `28px` adım, kenarlardan `26px` içeride başlar) — kartlar "bilet" gibi görünür.

### 11. Değerlerimiz
Zemin `#2E1065` + yıldız tile (`opacity: 0.14`), üstte scallop. Ortalı: "DEĞERLERİMİZ" + "Öğretmenlik bir emanettir" 50px/900.
**Polaroid duvarı:** ortada eğik alıntı kartı (`452px`, krem, radius 24px, `rotate(1deg)`, `z-index: 6`) — 62px `“`, 24px/700 alıntı, sağ altta Dancing 31px imza; sol üstte sarı, sağ altta pembe `rotate(-32deg)` bant. İki yanında polaroid çerçeveler (`268px`, krem, `padding: 14px 14px 0`, `rotate(∓6deg)`, `translateX(±46px)`, `filter: grayscale(1)`) — içinde `240×246px` fotoğraf alanı ve altında Dancing 23px alt yazı ("Atatürk ve çocuklar", "Başöğretmen").
> Fotoğraf alanları **boş placeholder**dır (prototipte `<image-slot>`). Production'da Atatürk fotoğrafları buraya konur; siyah-beyaz filtre korunmalı.

### 12. İletişim
Krem zemin. Ortalı başlık 52px/900 + paragraf + iki buton (yeşil WhatsApp, pembe Instagram — 30px logolar).
Altta grid `366px 1fr 292px`, `gap: 32px`, `align-items: end`:
- Sol: sarı panel (`#FEF3C7`, `3px solid #FBD34F`, radius 32px) + `pat/tile-dot-yellow.png` (104px, `opacity: 0.45`) — telefon `0530 679 3131`, `english@englishwithdilara.com`, `admin@englishwithdilara.com` (42px ikonlar); altında açık mor panel "NEDEN ENGLISH WITH DILARA?" + 4 maddeli nokta listesi.
- Orta: krem form kartı (`3px solid #F8C8DC`, radius 34px) — Ad Soyad, "Öğrenci yaşı / Kendim" (select), `+90` + telefon, Mesajınız (textarea), mor **Gönder** butonu, altında 12px not. *(Prototipte alanlar statik div'dir; production'da gerçek `input`/`select`/`textarea` + doğrulama.)*
- Sağ: öğretmen görseli `height: 420px`.

### 13. Footer
`#2E1065`, `padding: 52px 44px 30px`, üst kenarda 26px damalı şerit. Grid `1fr auto 1fr`: solda 56px logo + "Online İngilizce dersleri", ortada 3 link (Bizimle Çalışın! / Gizlilik Politikası / SSS — hover `#FBD34F`), sağda 38px sosyal ikonlar + iki "Yakında" mağaza etiketi. Altta 12px telif satırı.

### 14. Mobil Hero (390px)
Poster düzeni: küçük pill'ler → `ENGLISH` 40px + `Dilara` Dancing 54px → 14px paragraf → tam genişlik pembe CTA + 54px yuvarlak WhatsApp → alt kenarda `340×188px` kemer (`border-radius: 170px 170px 0 0`) içinde `pat/b.png` ve `height: 218px` öğretmen görseli. Toplam ~620px: mobilde hero tek ekranı aşmaz.
Header mobilde: 50px logo + "Giriş" + hamburger (46px, 3 çizgi).

---

## Interactions & Behavior

| Öğe | Davranış |
|---|---|
| Fotoğraf karuseli | Oklar `±1` (döngüsel, 9 slayt), noktalar doğrudan atlar, **5 saniyede bir otomatik ilerler**. Track `transform: translateX(-index * (100/9)%)`, `transition .6s cubic-bezier(.22,1,.36,1)` |
| Video karuseli | Oklar `±1` (döngüsel, 2 slayt) + noktalar. Otomatik ilerleme **yok** (video izlenirken kaymamalı) |
| Videolar | `muted` + `loop` + `controls`, mount'ta `play()` denenir (autoplay reddedilirse sessizce yutulur), `disablePictureInPicture`, `controlsList="nodownload"` |
| Yorum karuseli | Oklar `±1` (döngüsel, 4 kart) + noktalar. Kart konumları yukarıdaki tabloya göre |
| SSS | Tek açık satır; açık satıra tekrar tıklamak kapatır (`open = -1`) |
| Butonlar / pill'ler | `style-hover` ile renk geçişi; `0 5px 0` gölge sabit (basılı efekt yok) |
| Nav pill'ler, kartlar | `cursor: pointer` — production'da gerçek link/route |
| Nokta göstergeleri | Aktif olan genişler (`10/12px → 34px`), `transition: width .4s ease, background .4s ease` |

Prototipte gerçeklenmemiş, production'da gereken davranışlar:
- Nav / CTA yönlendirmeleri, dil (TR/EN) ve tema (☾) anahtarları.
- İletişim formu: alanlar, doğrulama, gönderim ve başarı/hata durumları.
- "Tüm yazılar", "Devamını oku", "Paketleri karşılaştır" hedef sayfaları.
- Karuseller için klavye (`←/→`) ve dokunmatik kaydırma (swipe) desteği; `prefers-reduced-motion` altında otomatik ilerlemenin kapatılması.
- Responsive: 1440px altında bölümlerin sıkışması — özellikle hero'nun 3 panelinin ve Dersten Kareler'in iki panelinin tek kolona düşmesi (mobil hero için 14. maddedeki artboard).

## State Management
Tek bileşende 4 state alanı yeterlidir:

```js
state = {
  open:   0,  // SSS: açık satır indeksi, -1 = tümü kapalı
  tIndex: 0,  // Veli yorumları: aktif kart (0-3)
  gIndex: 0,  // Fotoğraf karuseli: aktif slayt (0-8)
  vIndex: 0   // Video karuseli: aktif slayt (0-1)
}
```
- Karusel geçişleri modulo ile döngüseldir: `(index + n + COUNT) % COUNT`.
- Fotoğraf karuseli için `setInterval(…, 5000)`; unmount'ta temizlenir.
- Prototipte track/kart `transform` değerleri **ref üzerinden doğrudan DOM'a** yazılır (mount ve her güncellemede). React/Vue'da bunları normal `style` prop'u olarak bağlamak yeterlidir — ekstra ref gerekmez.
- Veri gereksinimi yok; tüm içerik statiktir. Blog yazıları ve veli yorumları ileride CMS'ten gelecekse `content/` altındaki dosyalar şema için başlangıç noktası olabilir.

`showMarquee` (boolean, varsayılan `true`) tasarımda bir tweak prop'udur — şerit bölümünü tamamen kaldırır. Production'da gerekli değilse atlanabilir.

## Assets
Tümü `design/` altında, HTML'in beklediği göreli yollarla:
- `assets/*.png` — 3D objeler (`art-*`), yıldız/parıltı (`star-*`, `sparkle-*`), iletişim ve sosyal ikonlar (`icon-*`), sarmaşık (`garland-*`). *(v1'den gelen bileşen kütüphanesi; kullanılmayan birkaç dosya da referans olarak bırakıldı.)*
- `assets/ic/*.png` — satır ve madde ikonları: `nav-*` (header), `n-*` (Neden EWD rozetleri), `ic-*` (çocuk paket satırları, `-p` soneki pembe varyant), `y-*` (yetişkin paketi).
- `pat/*.png` — desen tile'ları: `b.png` (pembe çizgi — hero + veli yorumları zemini), `tile-star-purple/pink/blue.png`, `tile-dot-yellow.png`. `a,c,d,e,f,g,montage,check` kullanılmıyor, referans.
- `public/uploads/` — `logo.webp`, `dilarateacher.png` (öğretmen, arka planı silinmiş PNG), `whatsappLogo.png`, `instagramLogo.png`, `pinkgingham.webp`, `navygingham.webp` (son ikisi kullanılmıyor).
- `public/ders/` — **maskelenmiş** ders kareleri `ders-01…10.png` (galeride 9'u kullanılıyor; `ders-07` çıkarıldı) ve `ders-video-safe.mp4`, `ders-video-safe-2.mp4`.

Fontlar: Google Fonts — Poppins (400–900) + Dancing Script (700). Production'da self-host edilmesi önerilir.

## Copy / İçerik notları (doğrulanması gerekenler)
- **SSS cevapları** ve Okul İngilizcesi kartındaki kesikli çerçeveli not, mevcut site bilgilerinden yazıldı — Dilara'nın onayı gerekir.
- **Veli yorumları** WhatsApp mesajlarından **kısaltılarak** alındı; isim, saat ve sınıf bilgisi gizlilik gereği çıkarıldı. Tam/orijinal metinler kullanılacaksa kart yüksekliği (`396px`) artmalıdır.
- **Blog yazı başlıkları ve tarihleri** örnektir; gerçek yazılarla değiştirilecek.
- **Ders karesi açıklamaları** (Baamboozle, "Name 3…" vb.) görsellerden okunarak yazıldı; ders içeriğine göre düzeltilebilir.
- Telefon ve e-posta adresleri mevcut siteden alındı.

## Files
```
design_handoff_landing_v2/
├─ README.md                       ← bu dosya
├─ CHANGELOG.md                    ← v1 handoff'undan bu yana tüm değişiklikler
├─ PRIVACY.md                      ← medya maskeleme kuralları ve boru hattı
├─ content/
│  └─ veli-yorumlari.md            ← 4 yorumun tam metni + etiketleri
├─ design/
│  ├─ EWD Landing v2.dc.html       ← ANA TASARIM (tarayıcıda açılır)
│  ├─ support.js, image-slot.js    ← prototip runtime'ı (production'a taşınmaz)
│  ├─ assets/ , assets/ic/ , pat/
│  └─ public/uploads/ , public/ders/
└─ reference/
   ├─ gorsel-sistem.md             ← v1 görsel sistem / bileşen notları
   ├─ brief.md                     ← proje brief'i (karar özeti)
   ├─ EWD Hero Varyasyonları.dc.html
   ├─ EWD Şerit Varyasyonları.dc.html
   └─ EWD Blog + Değerlerimiz Varyasyonları.dc.html
```
`reference/` altındaki varyasyon dosyaları **uygulanmayan alternatiflerdir** — sadece yönü anlamak için; production'da ana tasarım geçerlidir. (Şerit için `3a`/`3b` seçimi hâlâ açık; şu an landing'de bu paketteki dalgalı kurdele var.)
