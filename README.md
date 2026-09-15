# English with Dilara

Online İngilizce dersleri veren **English with Dilara**'nın kendi yazılımı:
herkese açık tanıtım sitesi, öğrenci / öğretmen / yönetici paneli ve aynı
kodu paylaşan iOS + Android uygulaması.

- **Web:** <https://englishwithdilara.com>
- **Diller:** Türkçe, İngilizce, Fransızca, Rusça, İspanyolca, Almanca, Arapça

---

## Kurulum

Node.js 20+ ve npm gerekiyor.

```sh
npm install
npm run dev        # http://localhost:8080
```

| Komut | Ne yapar |
| --- | --- |
| `npm run dev` | Geliştirme sunucusu |
| `npm run build` | Üretim derlemesi → `dist/` |
| `npm run build:dev` | Kaynak haritalı derleme |
| `npm run preview` | `dist/` klasörünü yerelde sunar |
| `npm run lint` | ESLint |
| `npm run check:i18n` | Yedi dilin de eksiksiz olduğunu doğrular |
| `npm run build:sitemap` | `public/sitemap.xml`'i Supabase'teki yazılarla yeniler |
| `npm run prerender` | Hazır `dist/` üzerinde ön işlemeyi tek başına çalıştırır |

`npm run check:i18n` sözlükte eksik dil bırakmadığınızı denetler — metin
eklerken bunu çalıştırın, TypeScript eksik yaprağı ancak okunduğunda yakalar.

---

## Yığın

- **Vite + React 18 + TypeScript**, yönlendirme `react-router-dom`
- **Tailwind CSS + shadcn/ui**, marka katmanı `src/styles/ewd.css`
- **Supabase** — Postgres, Auth, Storage, Edge Functions (Deno)
- **Capacitor 8** — iOS ve Android kabuğu (`ios/`, `android/`)
- **TanStack Query** — sunucu durumu

## Klasörler

```
src/
  components/landing/   Tanıtım sayfası bölümleri
  components/student|teacher|admin/   Panel ekranları
  pages/                Yol karşılıkları (App.tsx içindeki Route'lar)
  contexts/             Auth ve dil sağlayıcıları
  hooks/                Veri kancaları ve useDocumentMeta
  lib/                  translations.ts, kelime bankaları, yardımcılar
  integrations/supabase/  İstemci ve üretilmiş tipler
supabase/
  functions/            Edge Functions (Deno)
  migrations/           Şema geçmişi
docs/clone/             Projeyi yeni bir Supabase hesabına taşıma rehberi
scripts/                İkon/görsel üreteçleri, dil denetimi
public/                 Statik dosyalar, simgeler, sitemap, robots
```

---

## Arama motoru ve paylaşım

Site tek sayfalık; sunucu tarafında ön işleme yok. Bunun sonuçları:

- `index.html` — JS çalıştırmayan botların gördüğü tek sürüm. Başlık,
  açıklama, canonical, Open Graph etiketleri ve `EducationalOrganization` +
  `WebSite` + `FAQPage` yapılandırılmış verisi burada duruyor. Bir bölümün
  metni sitede değişirse buradaki karşılığını da güncelleyin.
- `src/hooks/useDocumentMeta.ts` — JS çalıştıran botlar, tarayıcı sekmesi ve
  ekran okuyucular için yol bazlı başlık/açıklama/görsel/canonical. Başlık
  kalıbı: ana sayfada `English with Dilara · <ne yapıldığı>`, diğer
  sayfalarda `<Sayfa> · English with Dilara`.
- `src/hooks/useStructuredData.ts` — sayfaya özel JSON-LD: kırıntı yolu
  (arama sonucundaki `englishwithdilara.com › Blog › Yazı` satırı) ve blog
  yazılarının `BlogPosting` künyesi.
- `src/App.tsx › RobotsMeta` — panel ve kişisel yolları `noindex` yapar.
- `public/robots.txt` — elle tutuluyor.
- `public/sitemap.xml` — **üretilmiş dosya, elle düzenlemeyin.**
  `scripts/build-sitemap.mjs` her `npm run build`'de yeniler: statik yollar
  betiğin içinde, blog yazıları Supabase'ten geliyor. Yeni bir herkese açık
  yol eklerseniz betikteki `STATIK` listesine ekleyin. Tek başına çalıştırmak
  için `npm run build:sitemap`.
- Her herkese açık sayfada tek bir `<h1>` olmalı; ana sayfanınki hero'daki
  marka lockup'ıdır (`HeroSection.tsx`).
- Site ilk açılışta **her zaman Türkçe**dir (`LanguageContext › detectLanguage`).
  Tarayıcı dili okunmuyor: Googlebot çoğunlukla `en-US` yerelinde tarıyor ve
  siteyi baştan sona İngilizce indeksliyordu. Ziyaretçi başlıktaki seçiciden
  dilini değiştirir, tercihi `localStorage`da kalır.
- Blog adresleri `generateSlug()` ile üretilen sade slug'lardır. Eski
  başlık-adresleri hâlâ açılıyor (`useBlogPostBySlug` başlıkla da arar), ama
  canonical her zaman slug'lı adresi gösterir.

### Ön işleme

`scripts/prerender.mjs` derlemeden sonra çalışır: `dist/`i yerelde sunar, her
herkese açık yolu gerçek bir tarayıcıda açar ve çizilmiş HTML'i o yolun kendi
`index.html`ine yazar. Böylece JavaScript çalıştırmayan botlar (WhatsApp,
Instagram, yapay zekâ tarayıcıları) sayfanın kendi başlığını, açıklamasını ve
metnini görür.

- **Bağımlılık yok:** sistemde kurulu Chrome ya da Edge'i `--dump-dom` ile
  çalıştırır. Windows, macOS ve Linux'ta olağan kurulum yollarına bakar.
  Bulamazsa uyarı basıp atlar — derleme düşmez, site ön işlemesiz yayına gider.
- Tarayıcı yolunu elle vermek için:
  `PRERENDER_BROWSER="C:\Program Files\Google Chrome\Application\chrome.exe" npm run build`
- Yollar `dist/sitemap.xml`den okunur; yeni blog yazısı kendiliğinden dâhil olur.
- Boş ya da yarım çizilen sayfa diske **yazılmaz**; o yol atlanır ve uyarı basılır.

**Barındırma koşulu:** sunucu `/blog/yazi` isteğinde önce
`dist/blog/yazi/index.html` dosyasını aramalı, yoksa `dist/index.html`e
düşmeli. Vercel, Netlify, Cloudflare Pages ve nginx'in
`try_files $uri $uri/index.html /index.html` kalıbı bunu zaten yapar. Sunucu
her yolu koşulsuz `index.html`e yönlendiriyorsa ön işleme etkisiz kalır.

### Simgeler

| Dosya | Nerede |
| --- | --- |
| `public/favicon.svg` | Sekme ikonu — logonun yıldızı, zemin şeffaf. **Kaynak dosya budur.** |
| `public/favicon.ico` | 16/32/48 saydam PNG kareleri; SVG desteklemeyen tarayıcılar için |
| `public/favicon-32.png` | Tekil PNG karşılığı |
| `public/apple-touch-icon.png` | iOS ana ekran — tam marka, opak zemin |
| `public/icons/icon-*.webp` | PWA / Android ikonları |
| `assets/icon-only.png`, `assets/splash*.png` | Capacitor kaynakları — `npx capacitor-assets generate` bunları okur |

`favicon.svg` elle düzenlenebilir; `.ico` ve `.png` ondan türetilir. 16'lık
kare ayrı bir çizimdir — o boyutta allık ve gülümseme lekeye dönüştüğü için
kalın hatlı, sade sürüm kullanılıyor.

---

## Mobil

```sh
npm run build
npx cap sync
npx cap open ios       # veya: npx cap open android
```

Push bildirimi kurulumunun üretim notları:
`docs/archive/ios-push-production-plan.md`.

---

## Supabase

Proje kimliği ve anon anahtarı `src/integrations/supabase/client.ts` içinde.
Şema değişiklikleri `supabase/migrations/` altında; Edge Function'lar
`supabase/functions/` altında ve `supabase/config.toml` hangisinin JWT
doğruladığını söyler.

Projeyi baştan yeni bir Supabase hesabına kurmak için:
[`docs/clone/KURULUM-REHBERI.md`](docs/clone/KURULUM-REHBERI.md).

Bilinen güvenlik ve mimari borçları: [`AUDIT_REPORT.md`](AUDIT_REPORT.md).
