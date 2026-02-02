

# Sticky Bubble Geçiş Sorunu - Kök Neden Analizi ve Düzeltme Planı

## Tespit Edilen Sorun

Scrollbar CSS değişikliği yapılırken `html, body` elementlerine `height: 100%` eklendi (satır 201-208). Bu değişiklik, scroll hesaplamasını bozuyor:

```css
html,
body {
  height: 100%;  /* ← Bu satır soruna neden oluyor */
  margin: 0;
  background: url("/uploads/pinkgingham.png") repeat;
  background-attachment: fixed;
  background-color: transparent;
}
```

### Neden Bozuluyor?

`height: 100%` verildiğinde:
- Bazı tarayıcılarda scroll davranışı değişiyor
- `window.scrollY` değeri doğru güncellenmeyebiliyor
- `offsetTop` hesaplamaları etkilenebiliyor

StickyBubble şu anda `window.scrollY` kullanıyor:
```tsx
const scrollY = window.scrollY + window.innerHeight * 0.4;
```

## Çözüm Planı

İki aşamalı çözüm uygulayacağız:

### Aşama 1: CSS Düzeltmesi

`height: 100%` yerine `min-height: 100%` kullanarak scroll davranışını düzeltme:

```text
┌─────────────────────────────────────────────────┐
│  ÖNCE                    │  SONRA               │
├─────────────────────────────────────────────────┤
│  html, body {            │  html {              │
│    height: 100%;         │    min-height: 100%; │
│    ...                   │    ...               │
│  }                       │  }                   │
│                          │                      │
│                          │  body {              │
│                          │    min-height: 100%; │
│                          │    ...               │
│                          │  }                   │
└─────────────────────────────────────────────────┘
```

### Aşama 2: StickyBubble IntersectionObserver Geçişi

`window.scrollY` yerine **IntersectionObserver API** kullanarak daha güvenilir section detection yapma:

```text
┌─────────────────────────────────────────────────┐
│  IntersectionObserver Avantajları:              │
│                                                 │
│  ✓ Scroll event'e bağımlı değil                 │
│  ✓ CSS değişikliklerinden etkilenmiyor          │
│  ✓ Performans açısından daha verimli            │
│  ✓ Daha güvenilir kesişim tespiti               │
└─────────────────────────────────────────────────┘
```

## Teknik Uygulama

### 1. CSS Değişikliği (`src/index.css`)

```css
/* Scrollbar arka planı için html ve body aynı background */
html {
  min-height: 100%;
  margin: 0;
  background: url("/uploads/pinkgingham.png") repeat;
  background-attachment: fixed;
  background-color: transparent;
  scroll-behavior: smooth;
  overflow-x: hidden;
}

body {
  min-height: 100%;
  margin: 0;
  background: url("/uploads/pinkgingham.png") repeat;
  background-attachment: fixed;
  background-color: transparent;
}
```

### 2. StickyBubble IntersectionObserver (`src/components/landing/StickyBubble.tsx`)

Yeni mantık:

```tsx
useEffect(() => {
  const heroSection = document.getElementById('hero');
  const whySection = document.getElementById('why');
  const kidsSection = document.getElementById('kids-packages');
  const adultSection = document.getElementById('adult-packages');
  const faqSection = document.getElementById('faq');
  const contactSection = document.getElementById('contact');

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          
          if (id === 'hero' || id === 'why') {
            setBubbleType('trial');
          } else if (id === 'kids-packages' || id === 'adult-packages' || id === 'faq') {
            setBubbleType('contact');
          } else if (id === 'contact') {
            setBubbleType('none');
          }
        }
      });
    },
    {
      rootMargin: '-40% 0px -40% 0px', // Ekranın ortasındaki bölümü algıla
      threshold: 0
    }
  );

  // Tüm bölümleri gözlemle
  [heroSection, whySection, kidsSection, adultSection, faqSection, contactSection]
    .filter(Boolean)
    .forEach(section => observer.observe(section!));

  return () => observer.disconnect();
}, []);
```

### Animasyon Mantığı (Mevcut kod korunacak)

Mevcut smooth geçiş animasyonu (`bubble-exit` / `bubble-enter`) korunacak ve IntersectionObserver ile birlikte çalışacak.

## Değiştirilecek Dosyalar

| Dosya | Değişiklik |
|-------|------------|
| `src/index.css` | `height: 100%` → `min-height: 100%` ve html/body ayrımı |
| `src/components/landing/StickyBubble.tsx` | Scroll event → IntersectionObserver |

## Beklenen Sonuç

1. Scrollbar tasarımı aynen korunur (şeffaf track, mor thumb)
2. Section geçişleri güvenilir şekilde algılanır
3. Hero/Why bölümlerinde → Trial bubble (hediye kutusu)
4. Kids/Adult/FAQ bölümlerinde → Contact bubble
5. Contact bölümünde → Bubble kaybolur
6. Smooth morph animasyonları çalışmaya devam eder

