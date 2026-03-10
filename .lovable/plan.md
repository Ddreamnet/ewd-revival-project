

## Plan: Kitap Overflow Sorunu + Sticky Bubble İyileştirmeleri

### 1. Kitap kapsayıcısındaki `overflow: hidden` kaldırılacak

`src/index.css` satır 473'te `.hero-book-wrap` üzerinde `overflow: hidden` var. Bu, kitap animasyonu sırasında üst/alt kısımların kesilmesine neden oluyor. Ayrıca arkada farklı renkli bir katman görünmesine de bu sebep oluyor.

**Değişiklik:** `.hero-book-wrap`'tan `overflow: hidden;` satırını kaldıracağım. Kitap zaten `position: relative` ile kendi alanında duruyor, overflow'a gerek yok.

### 2. Sticky Bubble — Yanıp sönme azaltılacak

Şu an TrialBubble üzerinde aynı anda çalışan çok fazla animasyon var:
- `animate-glow-pulse` (kutu gölge, 2s)
- `animate-pulse-scale` (metin büyüyüp küçülme, 2s)
- `animate-bounce-gentle` (metin zıplama, 2s)
- `animate-wiggle` (hediye kutusu sallanma, 1s)
- `animate-sparkle` (parlama, 2s)

**Değişiklikler:**
- `animate-glow-pulse` süresini 2s → 4s'e uzatacağım
- `animate-pulse-scale`'ı kaldıracağım (metin büyüyüp küçülmesin)
- `animate-bounce-gentle`'ı kaldıracağım (metin zıplamasın)
- `animate-sparkle` süresini 2s → 4s'e uzatacağım
- `animate-wiggle` süresini 1s → 3s'e uzatacağım

### 3. Sticky Bubble — Dark mode renkleri

Dark mode'da gradient renkler (landing-yellow, landing-pink, landing-purple) çok parlak kalıyor. Dark mode'a uygun koyu/mat tonlara çevireceğim:

**Değişiklik:** `StickyBubble.tsx`'teki TrialBubble'da dark mode için renkleri ayarlayacağım:
- Gradient arka planı dark mode'da daha koyu/mat tonlara çevireceğim (`dark:from-[hsl(260,30%,25%)] dark:via-[hsl(280,25%,30%)] dark:to-[hsl(260,35%,20%)]` gibi)
- Metin renklerini dark mode'a uyumlu hale getireceğim
- Glow-pulse box-shadow'ını dark mode'da daha soft yapacağım

### Dosyalar
- `src/index.css` — overflow kaldırma + animasyon sürelerini güncelleme
- `tailwind.config.ts` — animasyon sürelerini güncelleme
- `src/components/landing/StickyBubble.tsx` — animasyon sınıflarını azaltma + dark mode renkleri

