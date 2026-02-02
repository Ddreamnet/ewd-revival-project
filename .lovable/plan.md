

# English with Dilara - Kapsamli Landing Page Uygulama Plani

## Genel Bakis

Bu plan, "English with Dilara" icin tek sayfalik landing page olusturmayi kapsar. Sayfa yukaridan asagiya dogru akan 6 bolumden olusacak ve tam TR/EN dil destegi sunacaktir.

---

## BOLUM 0: Global Stil ve Genel Kurallar

### Arkaplan Ayarlari
- `pinkgingham.png` body seviyesinde arkaplan olarak ayarlanacak
- Cok seffaf/pastel gorunum (goz yormayan)
- Yukaridan asagiya kesintisiz devam edecek (cizgiler kesilmeyecek)
- Section'lara ayri ayri background verilmeyecek
- `background-repeat: repeat` ile tum sayfada surekli

### Horizontal Scroll Onleme
- `html, body { overflow-x: hidden }` global olarak
- Tum container'lar `max-w-full` ile sinirli
- Mobilde tasma kontrolleri

### Tipografi
- **Genel yazilar**: Poppins (Google Fonts'tan import)
- **"DILARA" yazilari**: Aprilia fontu (ozellikle hero'daki kitap icinde)
- Aprilia font dosyasi projeye eklenecek ve `@font-face` ile yuklenecek

### Renkler
- Header pill butonlari: `#ffb9dc` hissine yakin (Tailwind pink-200/rose-200)
- Kartlardaki mor tonlar: lila/mor pastel (goruntuye uygun)
- Kartlarda border KULLANILMAYACAK
- Okunurluk icin gerekirse cok hafif golge veya dusuk opaklikta acik overlay

---

## BOLUM 1: Sayfa Yapisi - Tek Sayfa + Bolum ID'leri

### Route Yapisi
- Landing page: `/` (ana route)
- Login sayfasi: `/login` (mevcut AuthForm'a yonlendirme)

### Section ID'leri
```text
#hero          - Hero bolumu
#why           - Neden English with Dilara?
#kids-packages - Cocuk ders paketleri
#adult-packages - Yetiskin ders paketleri
#faq           - SSS
#contact       - Bizimle iletisime gec
```

### Header Menu Scroll Davranisi
- "Dersler" tiklaninca → `#kids-packages` bolumune smooth scroll
- "Iletisim" tiklaninca → `#contact` bolumune smooth scroll
- Scroll hizli ve yumusak (isinlanir gibi)

### Scroll Margin
- Header sticky oldugu icin basliklar ustte kalmamali
- Tum section'lara `scroll-margin-top` verilecek (header yuksekligi kadar, yaklasik 80-100px)

---

## BOLUM 2: Header (Tam Seffaf + Sticky)

### Genel Ozellikler
- Arkaplan: tam seffaf (border yok)
- Ustte sticky/fixed duracak
- Scroll'da kaybolmayacak
- z-index yuksek (z-50)

### Sol Taraf - Logo
- `public/uploads/logo.webp` kullanilacak
- Logo **-10 derece dondurulmus** olacak (`transform: rotate(-10deg)`)
- Boyutu buyuk (dikkat cekici, h-16 veya h-20)
- Header ile birlikte sticky

### Orta Taraf - Menu
- Iki pill buton yan yana:
  - **"Dersler"** → `#kids-packages`'a smooth scroll
  - **"Iletisim"** → `#contact`'a smooth scroll
- Pill buton arka plani: `#ffb9dc` yakin ton (bg-pink-200 veya bg-rose-200)
- Scroll sirasinda aktif bolum icin minimal highlight (opaklik/ince vurgu)
- Intersection Observer ile aktif section takibi

### Sag Taraf - Dil + Giris

**Dunya (Globe) Ikonu:**
- Tiklaninca dropdown acilir
- Dropdown secenekleri alt alta:
  - 🇹🇷 TR
  - 🇬🇧 GB
- Default secili: TR
- Dil degisince TUM metinler aninda degisir:
  - Basliklar, butonlar, SSS sorulari, form placeholder'lari, uyari metinleri
- Dil secimi kalici: `localStorage` ile saklama

**Giris Butonu:**
- **Masaustunde**: "Giris yap" butonu → `/login`
- **Mobilde**: Sadece "→]" (LogIn) ikon butonu
  - Ayni route'a gider
  - `aria-label="Giris yap"` eklenmeli

---

## BOLUM 3: Hero Bolumu (#hero)

### Layout Yapisi
- **Sol taraf**: `dilarateacher.png` karakter gorseli (buyuk)
- **Yaninda**: 2 derece sola yatirilmis kitap/kart benzeri panel

### Kitap/Panel Tasarimi
- Kitap gibi gorunen panel
- Icinde yazilar cok okunakli olmali
- Gerekirse panelin icine cok hafif acik overlay

### Kitap Icerigi
```text
ENGLISH          (buyuk, Poppins)
with             (kucuk)
DILARA           (buyuk, %100 Aprilia font)

Alt metin:
"Cocuklar ve yetiskinler icin online Ingilizce dersleri"
"Kisiye ozel programlar, birebir ve grup dersleri, duzenli takip ve geri bildirim."
```

### Animasyonlar (Abartisiz)
- **Dilarateacher gorseli**: Cok hafif "float" (yukari-asagi)
- **Kitap**: Cok hafif "nefes alma" (minik scale/rotate pulse)
- `prefers-reduced-motion` varsa animasyonlar kapali

### Hero Sag Alt Sticky Balon (Ucretsiz Deneme Dersi)
- Sayfanin sag alt kosesinde sticky
- Sohbet baloncugu gorseli/sekli
- Uzerinde satir satir:
  ```text
  Ucretsiz
  Deneme
  Dersi!
  ```
- **Gorunurluk**: Sadece Hero + Neden bolumlerinde gorunur
- **Tiklama davranisi**: `#contact` bolumune smooth scroll

---

## BOLUM 4: "Neden English with Dilara?" Bolumu (#why)

### Layout
- **Sol taraf**: Buyuk baslik "Neden ENGLISH with DILARA?"
- **Sag taraf**: Mor kart icinde maddeler + altinda kucuk gorsel alani

### Mor Kart Icindeki Maddeler
1. Kisiye ozel program
2. Birebir & kucuk gruplar
3. Canli Zoom dersleri
4. Konusma odakli egitim
5. Duzenli takip & geri bildirim
6. Ucretsiz deneme dersi

### Gorsel Kompozisyon
- Referans gorseldeki duzeni koru
- Bu bolum bitince asagi kaydirilinca Cocuk paketleri gelecek

---

## BOLUM 5: Cocuk Ders Paketleri (#kids-packages)

### Sticky Buton Degisimi
- Bu bolume gelince:
  - Hero'daki "Ucretsiz Deneme Dersi" balonu **kaybolur**
  - Yerine sag altta `stickycontact.png` **gelir**

### stickycontact.png Boyutlandirma
- Orijinal: 250x150px
- **Desktop hedef**: 240-280px genislik
- **Mobil hedef**: 170-220px genislik
- CSS `clamp()` ile otomatik ayar: `clamp(170px, 25vw, 280px)`
- Height: auto (oran korunur)
- Sag altta safe-area hesaba katilacak (iOS/Capacitor icin alttan bosluk)

### Baslik Alani
- **Baslik**: "Cocuk Ders Paketleri"
- **Alt aciklama**: "English with Dilara'da tum ders paketleri, ogrencinin yasi, seviyesi ve ihtiyacina gore planlanir."

### Paket Kartlari (Iki Mor Sutun)
- Desktop: yan yana
- Mobil: alt alta

**Sol Sutun - 1. Klasik Paket:**
- Baslik: "1. Klasik Paket"
- Alt baslik: "Paket Icerigi:"
- Maddeler:
  1. Haftada 2 ders
  2. Konusma calismalari
  3. Temel Ingilizce bilgisi
  4. Dinleme ve anlama becerileri
  5. Oyunlar esliginde eglenerek ogrenme
  6. Dijital ekran suresine uygun 30 (dakikalik dersler)
  7. Birebir ve Grup ders secenegi

**Sag Sutun - 2. Okul Destek Paket:**
- Baslik: "2. Okul Destek Paket"
- Alt baslik: "Paket Icerigi:"
- Maddeler:
  1. Okulda islenen Ingilizce konulariyla paralel ilerleme
  2. Ingilizce odevlerin birlikte yapilmasi
  3. Sinavlara destek
  4. Gerektiginde temel Ingilizce calismalariyla okulu destekleme
  5. 30 dakikalik dersler, haftada 2 ders
  6. Birebir ve Grup ders secenegi

### Sag Taraf Blob + Ikon
- Iki sutunun saginda "Abstract Shape Blob Watercolor Illustration" alani
- Simdilik video yok → **Buyuk Student Icon** goster
- Ikon buyuk, ortali, modern, tek renk (hafif opaklik)

### "Daha Fazla Bilgi Icin" CTA
- Gorselde varsa sari kucuk CTA
- Tiklaninca `#contact` bolumune scroll

---

## BOLUM 6: Yetiskin Ders Paketleri (#adult-packages)

### Baslik Alani
- **Baslik**: "Yetiskin Ders Paketleri"
- **Alt aciklama**: "English with Dilara'da tum ders paketleri, ogrencinin yasi, seviyesi ve ihtiyacina gore planlanir."

### Yetiskin Paketi Karti (Mor Kutu)
- **Baslik**: "3. Yetiskin Paketi"
- **Seviye**: "A1-A2-B1-B2-C1"
- **Seviye belirleme metni**: "Seviye, egitim oncesinde yapilan seviye tespit sinavi ile belirlenir."

**Paket Icerigi Maddeleri:**
1. Konusma (Speaking) odakli ilerleme
2. Dinleme, okuma ve yazma calismalari
3. Gunluk hayatta ve is hayatinda kullanilan Ingilizce
4. Is hayatina ozel programlar
5. 1 saatlik dersler, gun ve saatleri is saatlerinize uygun sekilde planlanir
6. Birebir ve Grup ders secenegi

### Sag Taraf Blob Alani
- Simdilik video yok → Buyuk Student Icon
- Gorsel duzenini koru

### Sticky Buton
- `stickycontact.png` sag altta gorunmeye devam edecek

---

## BOLUM 7: SSS Bolumu (#faq)

### Tasarim (Gorseldeki Gibi Bire Bir)
- **Baslik**: "SSS"
- Altinda accordion satirlari (mor/pastel arka plan)
- Her satirin sag tarafinda **+ ikonu**
- Acilinca icerik karti (pembe tonlu) asagiya acilir

### SSS Sorulari
1. "Ders sureleri ne kadar?"
2. "Ucretsiz deneme dersi var mi?"
3. "Dersler hangi platformda yapiliyor?"
4. "Birebir ders mi, grup dersi mi yapiliyor?"

### Acik Icerik Ornegi (4. Soru)
```text
"Her iki secenek de mevcuttur."
- Birebir dersler
- Grup dersleri (maksimum 5 kisilik, ayni seviyedeki ogrencilerle)
```

---

## BOLUM 8: Bizimle Iletisime Gec (#contact)

### Sticky Buton Davranisi
- Bu bolume gelince:
  - Sag alttaki sticky buton **tamamen kaybolmali**
  - Ne "Ucretsiz Deneme", ne `stickycontact.png`
  - Cunku hedef zaten burasi

### Ust Kisim
- **Buyuk baslik**: "Bizimle Iletisime Gecin!"
- **Alt aciklama**: "Ucretsiz deneme dersi, ders paketleri ve seviye tespiti hakkinda bizimle iletisime gecebilirsiniz."

### Iki Buyuk CTA Butonu (Alt Alta)

**Ust Buton (Sari):**
- Solunda WhatsApp ikonu
- Metin: "Whatsapp'tan hemen yazin!"
- Tiklaninca: WhatsApp chat'e git
- Hazir mesaj: "Merhaba, ucretsiz deneme dersi hakkinda bilgi almak istiyorum."
- Link: `https://wa.me/905306792831?text=<encoded_message>`

**Alt Buton (Pembe):**
- Solunda Instagram ikonu
- Metin: "Instagram'dan hemen yazin!"
- Tiklaninca: Instagram hesabina git

### Alt Bolum Layout (Sol Kartlar + Orta Form + Sag Karakter)

**Sol Taraf - Iki Kart:**

*Sari Iletisim Karti (Ikonlu Satirlar):*
- 📞 0530 679 2831
- 🌐 englishwithdilara.com
- ✉️ englishwithdilara@gmail.com

*Altinda Kucuk Kart: "Neden English with Dilara?"*
- ✓ Kisiye ozel program
- ✓ Birebir ve kucuk gruplar
- ✓ Duzenli takip ve geri bildirim
- ✓ Ucretsiz deneme dersi

**Orta Taraf - Form Karti:**
- **Baslik**: "Iletisim Formu"
- **Alanlar**:
  - Ad Soyad (input)
  - Dropdown: "Ogrenci yasi / Kendim" (yas secenekleri + "Kendim")
  - Telefon: Solda sabit "+90", yaninda "Telefon Numaraniz"
  - Mesajiniz (textarea)
- **Buton**: "Gonder"
- **Alt not**: "Formu doldurduktan sonra en kisa surede sizinle iletisime geciyoruz."

**Sag Taraf - Karakter Gorseli:**
- Buyuk karakter yerlesimi
- Formu isaret eder gibi pozisyon
- Gorseldeki kompozisyon korunacak

---

## BOLUM 9: Dil (TR/GB) Ceviriler

### Genel Kurallar
- Tum icerik iki dilde eksiksiz olacak
- TR varsayilan (default)
- GB secilince her sey Ingilizceye gecer

### Ceviri Listesi

**Header / Menu:**
| TR | EN |
|----|----|
| Dersler | Lessons |
| Iletisim | Contact |
| Giris yap | Log in |
| TR | TR |
| GB | GB |

**Hero (Kitap Ici):**
| TR | EN |
|----|----|
| Cocuklar ve yetiskinler icin online Ingilizce dersleri | Online English lessons for children and adults |
| Kisiye ozel programlar, birebir ve grup dersleri, duzenli takip ve geri bildirim. | Personalised programmes, one-to-one and group lessons, with regular progress tracking and feedback. |

**Sticky Balon:**
| TR | EN |
|----|----|
| Ucretsiz / Deneme / Dersi! | Free / Trial / Lesson! |

**Neden Bolumu:**
| TR | EN |
|----|----|
| Neden ENGLISH with DILARA? | Why ENGLISH with DILARA? |
| Kisiye ozel program | Personalised programme |
| Birebir & kucuk gruplar | One-to-one & small groups |
| Canli Zoom dersleri | Live Zoom lessons |
| Konusma odakli egitim | Speaking-focused learning |
| Duzenli takip & geri bildirim | Regular progress tracking & feedback |
| Ucretsiz deneme dersi | Free trial lesson |

**Cocuk Paketleri:**
| TR | EN |
|----|----|
| Cocuk Ders Paketleri | Children's Lesson Packages |
| English with Dilara'da tum ders paketleri... | At English with Dilara, all lesson packages are planned based on the student's age, level, and needs. |
| 1. Klasik Paket | 1. Classic Package |
| 2. Okul Destek Paket | 2. School Support Package |
| Paket Icerigi: | Package includes: |
| Haftada 2 ders | 2 lessons per week |
| Konusma calismalari | Speaking practice |
| Temel Ingilizce bilgisi | Core English foundations |
| Dinleme ve anlama becerileri | Listening and comprehension skills |
| Oyunlar esliginde eglenerek ogrenme | Fun learning through games |
| Dijital ekran suresine uygun 30 dakikalik dersler | 30-minute lessons designed for healthy screen time |
| Birebir ve Grup ders secenegi | One-to-one and group lesson options |
| Okulda islenen Ingilizce konulariyla paralel ilerleme | Progress in line with school English topics |
| Ingilizce odevlerin birlikte yapilmasi | Doing English homework together |
| Sinavlara destek | Exam support |
| Gerektiginde temel Ingilizce calismalariyla okulu destekleme | Extra core English practice when needed to support schoolwork |
| 30 dakikalik dersler, haftada 2 ders | 30-minute lessons, 2 per week |
| Daha fazla bilgi icin | For more information |

**Yetiskin Paketleri:**
| TR | EN |
|----|----|
| Yetiskin Ders Paketleri | Adult Lesson Packages |
| 3. Yetiskin Paketi | 3. Adult Package |
| Seviyeler: A1-A2-B1-B2-C1 | Levels: A1-A2-B1-B2-C1 |
| Seviye, egitim oncesinde yapilan seviye tespit sinavi ile belirlenir. | Your level is determined with a placement test before the lessons begin. |
| Konusma (Speaking) odakli ilerleme | Speaking-focused progress |
| Dinleme, okuma ve yazma calismalari | Listening, reading, and writing practice |
| Gunluk hayatta ve is hayatinda kullanilan Ingilizce | English for everyday life and the workplace |
| Is hayatina ozel programlar | Work-focused programmes |
| 1 saatlik dersler, gun ve saatleri is saatlerinize uygun sekilde planlanir | 60-minute lessons, scheduled to fit around your working hours |

**SSS:**
| TR | EN |
|----|----|
| SSS | FAQ |
| Ders sureleri ne kadar? | How long are the lessons? |
| Ucretsiz deneme dersi var mi? | Is there a free trial lesson? |
| Dersler hangi platformda yapiliyor? | Which platform are the lessons held on? |
| Birebir ders mi, grup dersi mi yapiliyor? | Are lessons one-to-one or in groups? |
| Her iki secenek de mevcuttur. | Both options are available. |
| Birebir dersler | One-to-one lessons |
| Grup dersleri (maksimum 5 kisilik, ayni seviyedeki ogrencilerle) | Group lessons (up to 5 students, at the same level) |

**Iletisim:**
| TR | EN |
|----|----|
| Bizimle Iletisime Gecin! | Get in touch with us! |
| Ucretsiz deneme dersi, ders paketleri ve seviye tespiti hakkinda bizimle iletisime gecebilirsiniz. | Contact us about the free trial lesson, lesson packages, and level assessment. |
| Whatsapp'tan hemen yazin! | Message on WhatsApp now! |
| Instagram'dan hemen yazin! | Message on Instagram now! |
| Neden English with Dilara? | Why English with Dilara? |
| Iletisim Formu | Contact Form |
| Ad Soyad | Full name |
| Ogrenci yasi / Kendim | Student age / Myself |
| Telefon Numaraniz | Your phone number |
| Mesajiniz | Your message |
| Gonder | Send |
| Formu doldurduktan sonra en kisa surede sizinle iletisime geciyoruz. | After you submit the form, we'll get back to you as soon as possible. |

---

## BOLUM 10: Mobil Tasarim Kurallari

### Genel Kurallar
- Tum section'lar gorsel dili koruyarak alt alta dizilmeli
- Iki sutunlar mobilde alt alta dusmeli
- Header mobilde tasma yapmamali (gerekirse kompaktlastir)

### Sticky Butonlar Mobilde
- Icerik ustune binmemeli
- Sayfanin altina yeterli padding birakilacak
- iOS safe-area destegi (`pb-safe`, `env(safe-area-inset-bottom)`)

### Horizontal Scroll
- **Kesinlikle** yatay scroll olmayacak
- `overflow-x-hidden` global
- Tum elementler `max-w-full`

### Header Mobil
- Logo biraz kucuk
- Menu pill'leri kompakt
- Globe + Login ikonu yeterli

---

## BOLUM 11: Kabul Kriterleri (Kontrol Listesi)

1. [x] Background gingham tum sayfada kesintisiz akiyor
2. [x] Header seffaf, sticky, logo -10 derece ve sabit
3. [x] "Dersler" → cocuk paketlerine smooth scroll
4. [x] "Iletisim" → iletisim bolumune smooth scroll
5. [x] Hero+Neden'de sag altta "Ucretsiz Deneme Dersi" balonu var
6. [x] Cocuk paketleri baslayinca balon gidiyor, stickycontact.png geliyor
7. [x] Iletisim bolumune gelince stickycontact.png de kayboluyor
8. [x] Blob alanlarinda simdilik buyuk student icon var
9. [x] SSS accordion gorseldeki gibi
10. [x] Iletisim bolumu bire bir ayni
11. [x] TR/GB dil switch her metni degistiriyor
12. [x] Mobilde tasma yok, yatay scroll yok

---

## Teknik Uygulama Detaylari

### Olusturulacak Yeni Dosyalar
1. `src/pages/LandingPage.tsx` - Ana landing page container
2. `src/components/landing/LandingHeader.tsx` - Sticky header
3. `src/components/landing/HeroSection.tsx` - Hero bolumu
4. `src/components/landing/WhySection.tsx` - Neden bolumu
5. `src/components/landing/KidsPackages.tsx` - Cocuk paketleri
6. `src/components/landing/AdultPackages.tsx` - Yetiskin paketleri
7. `src/components/landing/FAQSection.tsx` - SSS accordion
8. `src/components/landing/ContactSection.tsx` - Iletisim formu
9. `src/components/landing/StickyBubble.tsx` - Dinamik sticky butonlar
10. `src/contexts/LanguageContext.tsx` - Dil yonetimi context
11. `src/lib/translations.ts` - Tum TR/EN ceviriler

### Guncellenecek Dosyalar
1. `src/App.tsx` - Route guncelleme (/ → LandingPage)
2. `src/index.css` - Global stiller, fontlar, arkaplan, animasyonlar
3. `tailwind.config.ts` - Font family, ozel renkler, animasyonlar

### Gorsel Dosyalar (public/uploads/)
- `pinkgingham.png` - Arkaplan
- `dilarateacher.png` - Karakter
- `stickycontact.png` - Sticky iletisim
- `logo.webp` - Logo (mevcut)

### Font Dosyasi
- Aprilia fontu icin woff2 dosyasi veya alternatif cozum

### Intersection Observer Kullanimi
- Aktif section takibi (header menu highlight)
- Sticky buton gorunurluk kontrolu (Hero/Why vs Packages vs Contact)

### localStorage Kullanimi
- Dil tercihi kalici saklama (`language: 'tr' | 'en'`)

