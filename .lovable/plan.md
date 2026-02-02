
# Mobil Header İkon ve Logo Uyumu Planı

## Yapılacak Değişiklikler

### 1. Menü Butonlarına İkonlar Ekleme

**Dersler Butonu:**
- `BookOpen` ikonu eklenecek (kitap ikonu)
- İkon + metin yan yana, mobilde de görünür

**İletişim Butonu:**
- `MessageCircle` veya `Mail` ikonu eklenecek (contact ikonu)
- İkon + metin yan yana, mobilde de görünür

### 2. Canlı ve Güzel Tasarım

```text
┌────────────────────────────────────────┐
│  Mobil Menü Butonları                  │
│                                        │
│  ┌──────────────┐  ┌──────────────┐   │
│  │ 📚 Dersler   │  │ 💬 İletişim  │   │
│  └──────────────┘  └──────────────┘   │
│                                        │
│  • Gradient arka plan (pink → purple) │
│  • İkonlar animasyonlu (hover bounce) │
│  • Hafif gölge efekti                  │
└────────────────────────────────────────┘
```

**Stil Özellikleri:**
- İkonlar: Buton rengiyle uyumlu, sol tarafta
- Hover efekti: İkon hafif bounce/pulse yapacak
- Mobilde daha kompakt spacing (`gap-1`)
- Aktif durumda daha yoğun renk ve gölge

### 3. Logo ve Header Uyumu (Mobil)

**Mevcut Sorun:**
- Logo `h-28` ile oldukça büyük
- Header height `h-20` - logo taşıyor
- Menü butonları logoya yakın kalabiliyor

**Çözüm:**
- Mobilde logo boyutunu küçült: `h-20` (mobil) → `h-28` (tablet) → `h-40` (desktop)
- Logo'nun `top` pozisyonunu ayarla
- Menü butonlarının padding/margin'ini optimize et
- Header'a minimum height garantisi ekle

### Teknik Detaylar

**Import Güncellemesi:**
```tsx
import { Globe, LogIn, BookOpen, MessageCircle } from 'lucide-react';
```

**Dersler Butonu:**
```tsx
<button className="flex items-center gap-1 md:gap-2 px-3 md:px-6 py-2 md:py-2.5 
                   rounded-full text-xs md:text-base font-medium 
                   transition-all duration-300 group
                   bg-gradient-to-r from-landing-pink/80 to-landing-purple/30
                   hover:from-landing-pink/90 hover:to-landing-purple/40
                   hover:shadow-md">
  <BookOpen className="w-4 h-4 md:w-5 md:h-5 group-hover:scale-110 transition-transform" />
  {t.header.lessons[language]}
</button>
```

**İletişim Butonu:**
```tsx
<button className="flex items-center gap-1 md:gap-2 px-3 md:px-6 py-2 md:py-2.5 
                   rounded-full text-xs md:text-base font-medium 
                   transition-all duration-300 group
                   bg-gradient-to-r from-landing-pink/80 to-landing-purple/30
                   hover:from-landing-pink/90 hover:to-landing-purple/40
                   hover:shadow-md">
  <MessageCircle className="w-4 h-4 md:w-5 md:h-5 group-hover:scale-110 transition-transform" />
  {t.header.contact[language]}
</button>
```

**Logo Responsive Boyutlandırma:**
```tsx
<img
  src="/uploads/logo.webp"
  alt="English with Dilara"
  className="h-20 sm:h-28 md:h-40 w-auto transform -rotate-[10deg] 
             hover:scale-105 transition-transform duration-300"
/>

{/* Logo container pozisyon ayarı */}
<div className="absolute left-2 sm:left-4 lg:left-8 top-1 sm:top-2 md:top-3 z-[60]">
```

**Invisible Placeholder Güncelleme:**
```tsx
<div className="w-20 sm:w-28 md:w-40 flex-shrink-0 invisible" />
```

## Değiştirilecek Dosyalar

| Dosya | Değişiklik |
|-------|------------|
| `src/components/landing/LandingHeader.tsx` | İkon import, buton tasarımı, logo responsive |

## Görsel Sonuç

**Mobil (320-640px):**
- Logo: Daha küçük (`h-20`), sol üstte
- Menü: Kompakt butonlar, ikonlu, ortalanmış
- Sağ: Globe ve Login ikonları

**Tablet (640-768px):**
- Logo: Orta boy (`h-28`)
- Menü: Normal boyut butonlar

**Desktop (768px+):**
- Logo: Tam boyut (`h-40`)
- Menü: Geniş padding, tam metin
