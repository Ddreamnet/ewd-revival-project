# CHANGELOG — v1 handoff'undan Landing v2'ye

Referans: önceki paket (`EWD Redesign v1` + `EWD Bileşen Kütüphanesi`). Aşağıdaki her madde landing'de **uygulanmış** durumdadır.

## Yeni bölümler
### Dersten Kareler (Yetişkin Paketi ↔ Veli Yorumları arasında)
- Mor yıldız zeminli blok; iki eşit panel: solda 9 kareli **fotoğraf karuseli**, sağda 2 videolu **video karuseli**.
- Her panelin üstünde krem etiket ("FOTOĞRAFLAR" / "VİDEOLAR"), altında nokta göstergeleri, iki yanında 60px yuvarlak oklar.
- Fotoğraf karuseli 5 saniyede bir otomatik ilerler; video karuseli sadece manuel.
- Vurgu: oyun / quiz / interaktif etkinlik — "Oyunla öğrenmek çok eğlenceli!".
- **Gizlilik:** tüm yüzler, Zoom kamera kutucukları ve isim etiketleri medya dosyalarının içine yakılmış mor yamalarla kapatıldı; videoların sesi kaldırıldı. Detay: `PRIVACY.md`.

### Veli Yorumları (Dersten Kareler ↔ SSS arasında)
- Pembe çizgi desenli zemin; solda başlık bloğu + nokta navigasyonu + logolu "Kayıt öncesi ücretsiz deneme dersi" kutusu.
- Sağda 4 kartlık **deste karuseli**: ortada aktif yorum, iki yanında arkada duran yorumlar, mor sol/sağ oklar.
- Kartlarda isim/saat yok — sadece alıntı ve altında iki tema etiketi (ör. "YAZILILARDA 100", "ÖZGÜVEN").

## Bölüm bölüm değişiklikler
- **Header** — logo 56px → **76px**.
- **Hero** — tamamen yeniden kuruldu. Eski tek panelli düzen yerine **mozaik** (566 / 1fr / 306): solda puantiye zeminli metin paneli, ortada öğretmen için çizgili panel, sağda "Çocuk dersleri" (mor) ve "Yetişkin dersleri" (sarı) giriş kartları. Kaldırılanlar: lila panel, bant/sticker katmanı, "ücretsiz deneme dersi" sticker'ı, üç özellik pill'i, yıldızlı sarmaşık. Lockup küçültüldü (ENGLISH 86 → 62px). WhatsApp butonu eklendi.
- **Mobil Hero (390px)** — yeni artboard; hero'nun kompakt poster hali (~620px, tek ekranı aşmıyor).
- **Şerit** — düz eğik bantlar yerine **dalgalı SVG kurdele**: kesişen mor ve sarı yollar, yazılar `textPath` ile eğri üzerinde. `showMarquee` prop'u ile kapatılabilir.
- **Neden EWD** — tam genişlik mor blok, yıldız desenli zemin, üst/alt **scallop** kenar, krem çipler taşan 3D rozetlerle.
- **Çocuk Paketleri** — kartlar solid mor / pembe bloklara döndü; içte krem panel + beyaz satırlar, krem madalyon, bookmark şerit, taşan 3D obje.
- **Yetişkin Paketi** — kareli defter zemini, krem kart, A1–C1 seviye pill'i, satır sonunda "Seviye tespiti al" CTA'sı.
- **SSS** — pembe yıldız zeminli blok; sorular **gerçekten açılıp kapanıyor** (tek açık satır).
- **Blog** — puantiye zeminde **tarak (bilet) kenarlı** üç renkli kart (lila / pembe / sarı), ortalanmış içerik, 104px 3D ikon, çerçeveli "Devamını oku". Başlık "Okuma köşesi" oldu.
- **Değerlerimiz** — **polaroid duvarı**: ortada bantlı eğik alıntı kartı, iki yanda eğik siyah-beyaz polaroid çerçeveler (Atatürk fotoğrafları buraya gelecek, şu an placeholder).
- **İletişim** — sarı puantiye panel (telefon/e-posta), açık mor "Neden EWD" listesi, krem form kartı, sağda öğretmen görseli.
- **Footer** — üst kenarda damalı (checker) şerit.

## Uygulanmayan / açık kalan
- Şerit için iki alternatif üretildi (`reference/EWD Şerit Varyasyonları.dc.html`: **3a** tek dev dalga, **3b** dolgu dalga) — seçim yapılmadı; landing'de mevcut kurdele duruyor.
- Yıldızlı sarmaşık şeridi denendi ve **geri alındı** (`reference/EWD Sarmaşık Varyasyonları` — bu paketin dışında bırakıldı).
- Değerlerimiz'deki iki fotoğraf alanı boş.
- Gingham desenleri (`pinkgingham.webp`, `navygingham.webp`) hiçbir bölümde kullanılmıyor.
- Gönderilen `IMG_1283.mp4` kullanılmadı: öğrencinin yüzü karenin merkezinde ve hareketli, maskelenince videodan geriye bir şey kalmıyor. İkinci video slaytı, ekran paylaşımlı kaydın 20–30. saniyesinden çıkarıldı.
