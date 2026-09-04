# Öğretmen Paneli — Uygulama Paketi (varyasyon 1a + mobil)

Bu paket **öğretmen panelinin** onaylanmış tasarımını (`1a — Ders Günü`) ve mobil (Capacitor) halini içerir. Hedef: `Ddreamnet/ewd-revival-project` içindeki mevcut öğretmen paneli ekranlarını bu tasarımla değiştirmek.

Landing v2 tasarımı ayrı bir pakette teslim edildi; buradaki `reference/landing-handoff-README.md` onun token/dekor bölümünü içerir — **panelin görsel dili landing ile birebir aynıdır**, o dosya sözlük olarak kullanılmalıdır.

## Paket içeriği
```
handoff_panel/
├─ README.md                                   ← bu dosya (spesifikasyon)
├─ CLAUDE_PROMPT.md                            ← Claude Code'a verilecek görev metni
├─ design/
│  ├─ EWD Öğretmen Paneli.dc.html              ← MASAÜSTÜ tasarım (tarayıcıda açılır)
│  ├─ EWD Panel Mobil.dc.html                  ← MOBİL tasarım (4 ekran, telefon çerçeveli)
│  ├─ support.js, ios-frame.jsx, android-frame.jsx  ← sadece prototip önizlemesi için
│  ├─ assets/ic/*.png                          ← nav ve konu ikonları
│  ├─ pat/tile-star-purple.png                 ← mor blok deseni
│  └─ public/uploads/logo.webp
└─ reference/
   ├─ EWD Panel Varyasyonları.dc.html          ← 1a + 1b (1b UYGULANMAYACAK)
   └─ landing-handoff-README.md                ← ortak token/dekor sözlüğü
```

`.dc.html` dosyaları **tasarım referansıdır**, production kodu değildir: tüm stiller inline, `{{ … }}` ifadeleri runtime değerleri. Bunları repo'nun kendi React yapısına (bileşen + CSS yaklaşımı) çevirin; `support.js`, `ios-frame.jsx`, `android-frame.jsx` production'a **taşınmaz** (sadece önizleme çerçeveleri).

---

## Neden iOS ve Android ayrı çizildi?
**Tasarım aynı, iki platformun sistem davranışı farklı.** Aynı React bileşenleri kullanılır — ayrı ekran yok, ayrı kod yolu yok. Fark eden dört şey:

| Konu | iOS | Android |
|---|---|---|
| Alt güvenli alan | Home indicator ~34px | Gesture bar ~24px |
| Geri hareketi | Sistem geri yok → **ekranda ‹ butonu zorunlu** | Donanım/gesture geri var → ekranda buton opsiyonel; `@capacitor/app` `backButton` dinlenmeli |
| Dokunma hedefi | ≥ 44pt | ≥ 48dp |
| Birincil eylem | Alt çubuğun üstünde tam genişlikte buton | Material'da FAB beklenir |

Kararımız: **tek bileşen seti**, farklar CSS `env(safe-area-inset-*)` ve tek bir `platform` bayrağıyla çözülür (`Capacitor.getPlatform()`):
- Tüm dokunma hedefleri **48px** (her iki kuralın da üstünde).
- FAB yerine iki platformda da tam genişlikte birincil buton (Ödev gönder) — tek bileşen, tek davranış.
- Geri butonu (`‹`) iki platformda da gösterilir; Android'de ek olarak sistem geri aynı route'a bağlanır.

Yani paketteki iki telefon çerçevesi **aynı tasarımın iki cihazda nasıl oturduğunu** gösterir; iki ayrı arayüz değildir.

---

## Tasarım token'ları (panelde kullanılanlar)
Landing ile aynı palet. Panelde ek olarak durum renkleri var:

| Token | Hex | Kullanım |
|---|---|---|
| cream | `#FFF8EF` | Sayfa zemini |
| cream-card | `#FFFDF8` | Kart / header zemini |
| purple | `#A253BE` | Birincil buton, aktif öğrenci kartı kenarlığı, avatar |
| purple-deep | `#6D28D9` | "Sıradaki ders" bloğu, vurgu metni |
| purple-ink | `#2E1065` | Başlıklar |
| purple-shadow | `#7E3D96` | Mor butonun `0 5px 0` gölgesi |
| lilac-bg / tint | `#EFDFF9` / `#F4EDFF` / `#F7EDFF` / `#EFE0FF` | Panel kartı, etiket, ders rayı zemini |
| lilac-border | `#DDCCF7` / `#DDC8F2` / `#E4D3F5` | Kart kenarlıkları |
| pink | `#EC4899` (+ `#BE185D`, `#F8C8DC`, `#F5B6D0`, `#FFF1F7`, `#FBD5E4`) | Nav pill, bildirim, Feyza rengi |
| yellow | `#FBD34F` (+ `#D9A21B`, `#FEF3C7`, `#8A6410`, `#6B4A00`) | Zoom butonu, bakiye, "BU DERSTE", Hakkında |
| green | `#22C55E` / `#DCFCE7` / `#15803D` | Tamamlanan konu, "BUGÜN" pill'i, bugünkü ders |
| neutral-chip | `#F4F1F7` / `#A79BB2` | Geçmiş ders çipleri (pasif) |
| muted | `#9A87AC` / `#B6A6C6` / `#C3B4CF` | Üst etiket, pasif tarih, chevron |
| dot | `#E7B4C8` | Puantiye zemin noktası |

**Tipografi:** Poppins 400–900; el yazısı vurgu **Dancing Script 700** (panelde yalnızca gerekiyorsa). Başlık 22–34px/900 `letter-spacing: -0.02em`, kart başlığı 18–19px/800, gövde 13–14px/500, etiket 10–12px/800-900 + `letter-spacing 0.1–0.16em` + uppercase.

**Şekil:** buton/pill `999px`, kart `22–32px`, küçük kutu `12–18px`. Kenarlık `2–3px`. Buton gölgesi düz `0 5px 0 <koyu ton>` (basılı efekt yok). Kart gölgesi `0 14px 24px -18px rgba(46,16,101,0.45)`.

**Dekor:**
- Header üstünde 7px üç renkli şerit (mor 3 / pembe 2 / sarı 1 oranında flex).
- Sıradaki ders bandı: krem zemin + `radial-gradient(#E7B4C8 2px, transparent 2.1px)` / `30px 30px` puantiye.
- Mor blok içinde `pat/tile-star-purple.png` tile, `background-size: 240px`, `opacity: 0.3`.
- Ünite başlıkları: uppercase etiket + `2px dashed #E4D3F5` çizgi + sayaç.

---

## Masaüstü ekran (1440px) — `EWD Öğretmen Paneli.dc.html`

### 1. Header (`#FFFDF8`, alt kenar `3px solid #F2E2DA`)
- 7px üç renkli şerit.
- Sol: 58px logo + "Öğretmen Paneli" (22px/900) + `ÖĞRETMEN` etiketi + "Hoş geldin, Fatih Teacher".
- Sağ: bildirim `✎` (42px yuvarlak, sağ üstte pembe sayaç), tema `☾`, çerçeveli **Çıkış**.
- Alt satır — nav pill'leri (landing'in nav dili): **Öğrencilerim** (aktif: `#F5B6D0` + `inset 0 0 0 2px #EC4899`), **Konular**, **Derslerim** (pasif: `#F8C8DC`, hover `#F5B6D0`), her birinde 32px yuvarlak ikon; sağda sarı **Bakiye ₺4.800** pill'i.

### 2. Sıradaki ders bandı (puantiye zemin, alt kenarlık)
Grid `1fr 214px 214px`, gap 16px:
- **Mor blok** (`#6D28D9`, radius 28px, yıldız tile): `SIRADAKİ DERS · 42 DK SONRA` (11px/900, sarı) → `Hira · 18:40–19:10` (28px/900, `nowrap`) → sağda sarı **Zoom'u aç** butonu (tek eylem).
- **Bugünkü ders** sayacı (`3`, mor kenarlık) ve **Bu hafta** sayacı (`8`, sarı kenarlık): 34px/900 sayı + 11px etiket.

### 3. Gövde — grid `372px 1fr`, gap 24px

**Sol: öğrenci rayı**
- Başlık "Öğrencilerim" + "2 öğrenci kayıtlı" + 40px yuvarlak `+` butonu.
- Arama alanı (pill).
- **Aktif öğrenci kartı** (Hira): `3px solid #A253BE`, solda 6px mor dikey işaret, 46px avatar, ad + yeşil `BUGÜN` etiketi, e-posta, sağda `☰` menü; altında ders çipleri (yeşil "Perşembe 18:40" = sıradaki, gri "Salı ✓ / Pazartesi ✓" = geçmiş) ve paket ilerleme çubuğu + "3 / 12 ders".
- **Pasif öğrenci kartı** (Feyza): aynı iskelet, `3px solid #EFDFF9`, pembe avatar, pembe sıradaki çipi, pembe ilerleme çubuğu.

**Sağ: seçili öğrencinin çalışma alanı**
- **Öğrenci başlık kartı** (`3px solid #EFDFF9`, radius 32px): 96px conic-gradient ilerleme halkası (`%3`) + **Hira** (32px/900) + sağda eylemler: mor **Ödev yükle**, çerçeveli **Ödevler (2)**, sarı **Hakkında**, 42px `☰`.
- **HİRA HAKKINDA** kutusu (sarı, okunur — düzenleme admin panelinde).
- **Ders rayı** (`#F7EDFF`, radius 24px): 12 ders kutusu; işlenen dersler dolu mor, **sıradaki ders** krem + `3px solid #A253BE` + `0 0 0 4px rgba(162,83,190,0.16)` halka + üstünde sarı `SIRADAKİ` etiketi, gelecek dersler krem + açık kenarlık; her kutunun altında tarih.
- **Konu arama** alanı (sağa hizalı, min 300px).
- **Konu listesi**: ünite başlığı → satırlar. Satır: 26px durum dairesi (yeşil ✓ / boş çerçeve), başlık + açıklama, sağda "N kaynak" çipi (`nowrap`) + `›`. Sol kenarda 6px durum şeridi: yeşil = işlendi, sarı = bu derste, açık mor = bekliyor. Sonda "Kalan 69 konuyu göster ↓" (kesikli çerçeve).

---

## Mobil ekranlar — `EWD Panel Mobil.dc.html`
Tasarım genişlikleri: iOS **402×874**, Android **412×892**. Dört ekran çizildi: iOS Bugün, iOS Öğrenci/Konular, Android Bugün, Android Ödevler. Aynı içerik tek kolona iner.

**Bugün ekranı:** logo + gün + öğretmen adı, bildirim/tema (48px yuvarlak) → mor **sıradaki ders** kartı (etiket / ad+saat iki satır / tam genişlikte sarı **Zoom'u aç**, min 52px) → iki sayaç yan yana → "Öğrencilerim" + ekleme butonu → öğrenci kartları (masaüstündeki kartın tek kolon hali) → **alt sekme çubuğu**.

**Öğrenci/Konular ekranı:** ‹ geri + avatar + ad + `☰` → yatay kaydırmalı eylem şeridi (Ödev yükle / Ödevler / Hakkında) → HAKKINDA kutusu → ilerleme + 12 ders rayı (6'lık grid, iki satır) → konu arama → konu satırları.

**Ödevler ekranı (Android):** ‹ geri + "Ödev kutusu" + `2 YENİ` → bekleyen ödevler (pembe kartlar) → `DEĞERLENDİRİLDİ` ayırıcısı + geçmiş → "BU AY 18 ders / ₺4.800" kartı → tam genişlikte **Ödev gönder** butonu → alt sekme çubuğu.

**Alt sekme çubuğu:** 4 sekme (Öğrenciler · Konular · Ödevler/Derslerim · Bakiye), `position: sticky; bottom: 0`, üst kenar `3px solid #F2E2DA`, aktif sekme `#F4EDFF` zemin + mor metin. Alt padding = `env(safe-area-inset-bottom)`; her sekme ≥ 52px.

**Mobil kuralları:** yatay kaydırma yok (tek istisna: eylem şeridi); tüm hedefler ≥ 48px; `viewport-fit=cover` + `env(safe-area-inset-top/bottom)`; uzun listelerde momentum scroll.

---

## Veri / state ihtiyacı
Ekranların beslendiği alanlar (repo'daki mevcut modellerle eşleşir):
- **Öğretmen:** ad, bildirim sayısı, bu ay işlenen ders, bakiye.
- **Öğrenci listesi:** ad, e-posta, avatar harfi/rengi, sıradaki ders (gün + saat), geçmiş ders günleri, paket ilerlemesi (işlenen / toplam), hakkında notu (salt okunur).
- **Sıradaki ders:** öğrenci, başlangıç–bitiş, kalan dakika (canlı sayaç), Zoom bağlantısı.
- **Ders paketi:** 12 kayıt (sıra, tarih, durum: işlendi / sıradaki / bekliyor).
- **Konular:** ünite, başlık, açıklama, durum (işlendi / bu derste / bekliyor), kaynak sayısı.
- **Ödevler:** öğrenci, konu, yüklenme zamanı, durum (yeni / değerlendirildi).

## Bu tasarımın çözdüğü kullanılabilirlik sorunları (korunması gerekenler)
1. Sıradaki ders sayfanın en üstünde ve tek eylemi var (Zoom'u aç) — öğretmenin ders başında yapacağı tek iş.
2. Dağınık ikon kutuları yerine landing'in nav pill dili.
3. Öğrenci kartında üstü çizili kırmızı satırlar yerine: yeşil "sıradaki", gri geçmiş çipleri, ilerleme çubuğu.
4. 12 ders sayacı köşeden çıkıp tam genişlikte bir raya dönüştü; sıradaki ders görsel olarak işaretli.
5. 76 konu ünite başlıklarıyla bölündü, arama var, geri kalanı "göster" ile açılıyor — hepsi tek listede akmıyor.
6. Öğretmenin işi olmayan eylemler kaldırıldı (takvim düzenleme, not düzenleme → admin paneli).
