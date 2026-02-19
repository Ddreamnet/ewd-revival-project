
# Mobil & Tablet Uyumsuzluk - Kapsamlı Tespit ve Düzeltme Planı

## Tespit Edilen Sorunlar

Tüm bileşenler ve CSS kodu incelendi. Aşağıdaki sorunlar kod analizinden ve tarayıcı görüntülerinden tespit edilmiştir:

---

### SORUN 1 — HeroSection: Tablet (768px) görünümde kitap çok geniş, karakter görünmüyor

**Dosya:** `src/components/landing/HeroSection.tsx`

```
<div className="flex flex-col lg:flex-row items-center justify-center gap-6 lg:gap-12">
  <HeroBook />
  <div className="flex-shrink-0 animate-float">
    <img className="w-48 h-auto md:w-64 lg:w-80 xl:w-96 ...">
```

**Sorun:** `lg:flex-row` yalnızca 1024px üzerinde yan yana dizer. 768px tablet'te kitap + karakter **üst üste dikey** sıralanır. Hero kitabı `min(360px, 92vw)` = 706px genişliğe çıkar. Karakter küçük kalır ve birlikte tek bir ekrana sığmaz.

**Düzeltme:** 
- `md:flex-row` yapılarak tablet'te de yan yana dizilmesi sağlanacak
- Tablet'te kitap genişliği sınırlanacak: CSS'te `min(280px, 50vw)` şeklinde güncelleme
- Karakter görseli tablet'te küçültülecek: `md:w-48 lg:w-72 xl:w-96`

---

### SORUN 2 — ValuesSection: Carousel kartlar mobilde taşıyor

**Dosya:** `src/components/landing/ValuesSection.tsx`

```css
style={{ height: "clamp(420px, 60vw, 640px)" }}
```
```
translateX: offset > 0 ? "70%" : "-70%"  // adjacent
translateX: offset > 0 ? "130%" : "-130%" // far
width: "clamp(260px, 38vw, 420px)"
```

**Sorun:** 375px mobilde kart genişliği `clamp(260px, 38vw, 420px)` = **260px** sabit. Adjacent kartlar `%70` offset'te sağa/sola taşar: 260 × 0.7 = 182px offset. Bu 375px ekranda sağ/sol kenardan taşmaya neden olur. Section `overflow-hidden` var ama **kartlar absolute positioned**, bu durumda `overflow-hidden` dışına çıkabilirler. Sticky bubble ile üst üste binme riski var.

**Düzeltme:**
- Mobilde kart genişliğini `clamp(220px, 80vw, 420px)` yaparak mobil için büyük tut, vw bağla
- Adjacent translateX değerini mobilde `60%` → `55%`, far'ı `120%` → `100%` olarak güncelle (CSS container query veya JS)
- Section height: `clamp(380px, 55vw, 640px)` ile küçültülecek

---

### SORUN 3 — ContactSection: Form kartı `max-w-[340px]` sabit, küçük telefonlarda taşıyor

**Dosya:** `src/components/landing/ContactSection.tsx`

```jsx
<div className="w-full max-w-[340px] mx-auto lg:mx-0">
```

**Sorun:** 320px ekranlarda (Galaxy Fold açık, küçük Android) `max-w-[340px]` ile `px-4` (16px×2=32px) toplandığında: 340px kart + 32px padding = 372px > 320px ekran. Yatay taşma veya sıkışma oluşur.

**Düzeltme:** `w-full max-w-[340px]` → `w-full max-w-[min(340px,calc(100%-2rem))]` ile sıfır padding sorununu önle.

---

### SORUN 4 — LandingHeader: Logo tablet (768px) görünümde nav butonlarıyla çakışıyor

**Dosya:** `src/components/landing/LandingHeader.tsx`

```jsx
<div className="absolute left-2 sm:left-4 lg:left-8 top-1 sm:top-2 md:top-3 z-[60]">
  <img className="h-20 sm:h-28 md:h-40 w-auto ..." />
</div>
```
```jsx
<nav className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 md:gap-4">
```

**Sorun:** Logo tablet'te `md:h-40` = 160px yüksekliğe çıkar, genişliği yaklaşık 120-130px olur. Nav bar `left-1/2 -translate-x-1/2` ile merkezde durur. 768px'de: logo 4px+130px = ~134px kaplar, nav merkezi = 384px. Fark yeterli ama üst nav `mt-[16px]` ile sabit yükseklikte — logo aşağı taşar ve görsel dengesizlik yaratır.

Daha büyük sorun: Mobilde (`sm` = 640px) logo `sm:h-28` = 112px. Nav ikonları `p-2.5` ile küçük. Sağdaki Globe + Login ikonları ile logo, özellikle 360-414px aralığında çakışabilir çünkü her ikisi de absolute/flex pozisyonlu.

**Düzeltme:**
- Logo yüksekliğini tablet'te sınırla: `md:h-32` (160 yerine 128px)
- Header yüksekliğini tablet'te büyüt: `md:h-28` olarak ayarla
- Nav `mt-[16px]` → tablet için `md:mt-0`

---

### SORUN 5 — StickyBubble: Mobil altta content ile üst üste binme

**Dosya:** `src/components/landing/StickyBubble.tsx`

```jsx
className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-40 pb-safe"
```
```jsx
<img className="w-[clamp(170px,25vw,280px)] h-auto drop-shadow-xl" />
```

**Sorun:** Mobilde `clamp(170px, 25vw, 280px)` = 170px sabit minimum. `bottom-4` = 16px boşluk. 375px ekranda 170px genişliğinde baloncuk, sağ alt köşede iletişim formunun CTA butonlarıyla (WhatsApp/Instagram) örtüşebilir. Contact bölümünde zaten `'none'` yapılıyor, bu kısmen çözülü ama `trial` bubble'da Değerlerimiz bölümünde scroll edince overlap sorusu var.

**Düzeltme:**
- `contact` image min genişliğini düşür: `clamp(140px,22vw,240px)` 
- TrialBubble mobilde biraz küçültülecek: `p-3 md:p-4` (zaten var, ama metin boyutu ayarlanacak)

---

### SORUN 6 — Footer: Mobil görünümde store butonları gereksiz alan kaplıyor

**Dosya:** `src/components/landing/Footer.tsx`

```jsx
<div className="flex-wrap items-center gap-2 flex flex-col">
  Google Play + App Store disabled butonları...
</div>
```

**Sorun:** Footer'da disabled olan iki store butonu mobilde dikey sütunda görünüyor ve gereksiz yer kaplıyor. App henüz yayınlanmamışsa bu butonlar kafa karışıklığı yaratır. Ayrıca footer `flex-col md:flex-row` ile tablet'te yatay sıralanıyor — ortadaki linkler (`gap-16` ile) 768px'de çok dar kalabilir.

**Düzeltme:**
- Store butonlarını `hidden` yaparak şimdilik gizle (app yayına girince gösterilir)
- Footer center links `gap-16` → `gap-6 md:gap-16` ile tablet'te daralt

---

### SORUN 7 — WhySection: Mobilde heading metni taşması

**Dosya:** `src/components/landing/WhySection.tsx`

```jsx
<span className="text-landing-yellow text-4xl md:text-5xl lg:text-6xl font-extrabold">?</span>
```

**Sorun:** `text-4xl` = 36px başlık, `lg:text-6xl` = 60px. Mobilde sola/sağa metin taşması yok ama tablet'te `lg:col-span-5 text-right` içinde "ENGLISH with DILARA?" başlığı 768px'de **left col olmadığı için** (`grid-cols-1` tek sütun) `text-center` ile ortalanıyor. Bu sorun değil. Gerçek sorun: benefits card `w-full max-w-md` = 448px, tablet'te ortalanıyor ama Preview Panel div'i `w-48 md:w-56 lg:mr-8` beklenmedik boşluk yaratıyor.

**Düzeltme:**
- Küçük: `lg:mr-8` kaldırılacak, bu boş placeholder div gereksiz, already `hidden` değil sadece görünmez içerikli. Görsel sorun değil.

---

## Uygulama Planı

### Değiştirilecek Dosyalar

| Dosya | Değişiklik |
|---|---|
| `src/components/landing/HeroSection.tsx` | `md:flex-row` tablet yan yana, görsel boyutları |
| `src/index.css` | `.hero-book` tablet width düzeltme |
| `src/components/landing/ValuesSection.tsx` | Carousel kart genişliği ve offset güncelleme |
| `src/components/landing/ContactSection.tsx` | Form kartı responsive genişlik |
| `src/components/landing/LandingHeader.tsx` | Logo tablet yüksekliği |
| `src/components/landing/StickyBubble.tsx` | Contact image min genişlik küçültme |
| `src/components/landing/Footer.tsx` | Store butonları gizleme, center gap düzeltme |

### Öncelik Sırası
1. **Kritik:** HeroSection tablet layout (Sorun 1)
2. **Kritik:** ValuesSection carousel taşma (Sorun 2)
3. **Yüksek:** ContactSection form taşma (Sorun 3)
4. **Orta:** Header logo boyutu (Sorun 4)
5. **Orta:** StickyBubble boyutu (Sorun 5)
6. **Düşük:** Footer store butonları (Sorun 6)

Toplamda 7 dosyada ~30 satır değişiklik yapılacak.
