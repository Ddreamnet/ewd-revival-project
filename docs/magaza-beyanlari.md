# Mağaza beyanları ve sürüm çıkarma sırası

App Store Connect ve Play Console'daki veri beyanları üç yerle **aynı şeyi** söylemeli:
sitedeki gizlilik politikası (`/gizlilik-politikasi`), iOS gizlilik bildirimi
(`ios/App/App/PrivacyInfo.xcprivacy`) ve bu liste. Birini değiştiren diğerlerini de günceller.

Uygulamanın topladığı veri (20 Eylül 2026 itibarıyla koddan doğrulandı): ad soyad, e-posta,
ödev fotoğrafları, ödev dosyaları ve metinleri ile öğretmen notları, bildirim için cihaz kimliği (FCM
token). Reklam, analitik, izleme, konum, rehber **yok**. Telefon numarası panelde saklanmıyor.

## App Store Connect › App Privacy

"Data Not Collected" **seçilmez**. Şu beş tür eklenir; hepsinde aynı üç yanıt:
**Amaç:** App Functionality · **Kullanıcıya bağlı mı:** Evet · **İzleme için mi:** Hayır

| Bölüm | Tür |
|---|---|
| Contact Info | Name |
| Contact Info | Email Address |
| User Content | Photos or Videos |
| User Content | Other User Content |
| Identifiers | Device ID |

- **Privacy Policy URL:** `https://englishwithdilara.com/gizlilik-politikasi`
- **App Review › Sign-in required:** dolu veriyle açılan bir demo hesap (yeni ders sisteminde dersi,
  ödevi olan bir öğrenci). Nota şunu yazmak incelemeyi kısaltır: *"Accounts are created by the school
  for enrolled students and teachers. There is no in-app registration and no in-app purchase."*
- Derleme **Xcode 26 / iOS 26 SDK** ile yapılmalı (28 Nisan 2026'dan beri zorunlu).
- Xcode › General › **Minimum Deployments 15.0** olmalı (mağazadaki 1.4 yanlışlıkla 26.0 ile çıkmış;
  iOS'u güncel olmayan veliler indiremiyor).

## Play Console › Uygulama içeriği › Veri güvenliği (Data safety)

- Uygulama kullanıcı verisi topluyor mu? **Evet** · Aktarım sırasında şifreleniyor mu? **Evet**
- Kullanıcı verilerinin silinmesini isteyebilir mi? **Evet** (politika: e-posta ile, en geç 30 gün)
- Hesap oluşturma yöntemi: **uygulama hesap oluşturmaya izin vermiyor** (hesabı kurum açıyor)

Her tür için: **Toplanıyor: Evet · Paylaşılıyor: Hayır · Amaç: Uygulama işlevi**
(Supabase ve Firebase bizim adımıza işleyen hizmet sağlayıcı; Google'ın tanımında "paylaşım" sayılmaz.)

| Kategori | Tür | Zorunlu mu |
|---|---|---|
| Kişisel bilgiler | Ad | Zorunlu |
| Kişisel bilgiler | E-posta adresi | Zorunlu |
| Fotoğraflar ve videolar | Fotoğraflar | İsteğe bağlı |
| Dosyalar ve dokümanlar | Dosyalar ve dokümanlar | İsteğe bağlı — **Eylül 2026'da eklendi (kaynak/ödev dosyası)** |
| Uygulama etkinliği | Kullanıcı tarafından oluşturulan diğer içerikler | İsteğe bağlı |
| Cihaz veya diğer kimlikler | Cihaz veya diğer kimlikler | İsteğe bağlı (bildirim izni verilirse) |

- **Hedef kitle ve içerik:** işaretli yaş grupları gerçek öğrencilerle uyuşmalı. 13 yaş altı
  işaretliyse Aileler politikası geçerli olur; uygulama buna uygun (reklam yok, izleme yok, gizlilik
  politikası çocuk verisini anlatıyor).
- Hedef API **36** (31 Ağustos 2026'dan beri zorunlu) — `android/variables.gradle` zaten 36.

## Sürüm çıkarma sırası

1. `android/app/build.gradle` → `versionCode` +1, `versionName`; `project.pbxproj` →
   `CURRENT_PROJECT_VERSION` aynı sayı, `MARKETING_VERSION` aynı ad. **İki platformda derleme numarası
   aynı tutulur** — sürüm kapısı bu sayıyla çalışıyor.
2. `npm ci && npm run build:app` (prerender'sız derleme + `cap sync`). Mac'te de bu komut; `dist/`
   git'te olmadığı için yalnızca `cap sync` eski paketi senkronlar.
3. Xcode'da arşivle / Android Studio'da imzalı AAB üret, mağazalara yükle.
4. **İki mağazada da yayına girdikten sonra** `app_settings.app_release` içindeki `latestBuild`
   (kapatılabilir "yeni sürüm çıktı" kartı) ya da `minBuild` (kapatılamayan "Güncelle" ekranı) yükseltilir.
   Erken yükseltilirse "Güncelle" düğmesi güncelleme olmayan bir mağaza sayfasına götürür.
