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
  ekran okuyucular için yol bazlı başlık/açıklama/görsel/canonical.
- `src/App.tsx › RobotsMeta` — panel ve kişisel yolları `noindex` yapar.
- `public/robots.txt`, `public/sitemap.xml` — yeni bir herkese açık yol
  eklediğinizde sitemap'e de ekleyin.

**Tam çözüm için ön işleme (prerender) gerekir.** Bağlantı önizlemesi üreten
botların çoğu (WhatsApp dâhil) JavaScript çalıştırmaz; bugün her yol için
`index.html`'deki ana sayfa kartını görüyorlar.

### Simgeler

| Dosya | Nerede |
| --- | --- |
| `public/favicon.svg` | Sekme ikonu — logonun yıldızı, zemin şeffaf. **Kaynak dosya budur.** |
| `public/favicon.ico` | 16/32/48 saydam PNG kareleri; SVG desteklemeyen tarayıcılar için |
| `public/favicon-32.png` | Tekil PNG karşılığı |
| `public/apple-touch-icon.png` | iOS ana ekran — tam marka, opak zemin |
| `public/icons/icon-*.webp` | PWA / Android ikonları |
| `resources/icon.png`, `resources/splash.png` | Capacitor kaynakları |

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
