

# "Neden English with Dilara?" Bölümü Yeniden Tasarımı

## Genel Bakış
Referans görsel baz alınarak, WhySection bileşeni tamamen yeniden tasarlanacak. Pastel, yumuşak, sticker-like ve çocuksu bir his yaratılacak.

---

## 1. Layout Yapısı

### Desktop (≥1024px)
```text
┌──────────────────────────────────────────────────────────┐
│                     SECTION                               │
│  ┌─────────────────┐    ┌─────────────────────────────┐  │
│  │                 │    │    MOR/LİLA FAYDA KARTI     │  │
│  │  Neden          │    │  ┌─────────────────────┐   │  │
│  │  ENGLISH        │    │  │ • Kişiye özel...    │   │  │
│  │  with           │    │  │ • Birebir...        │   │  │
│  │  DILARA?        │    │  │ • Canlı Zoom...     │   │  │
│  │                 │    │  │ • Konuşma...        │   │  │
│  │ (Dekoratif     │    │  │ • Düzenli takip...  │   │  │
│  │  yıldızlar)     │    │  │ • Ücretsiz deneme..│   │  │
│  │                 │    │  └─────────────────────┘   │  │
│  └─────────────────┘    │                             │  │
│       %45               │  ┌─────────────────────┐   │  │
│                         │  │  PREVIEW PANELİ     │   │  │
│                         │  │  (Video/Görsel)     │   │  │
│                         │  └─────────────────────┘   │  │
│                         └─────────────────────────────┘  │
│                               %55                        │
└──────────────────────────────────────────────────────────┘
```

### Mobile (≤1023px)
- Tek sütun
- Başlık → Fayda kartı → Preview panel (alt alta, ortalı)
- Yatay scroll YOK

---

## 2. Başlık Alanı (Sol Blok)

### Tipografi
| Eleman | Font | Weight | Boyut Desktop | Boyut Mobile | Renk |
|--------|------|--------|---------------|--------------|------|
| "Neden" | Poppins | 800 | 42px | 30px | Koyu morumsu-siyah |
| "ENGLISH" | Poppins | 800 | 48px | 34px | `landing-purple-dark` |
| "with" | Poppins | 600 | 24px | 18px | Koyu gri |
| "DILARA" | Mystery Quest | normal | 52px | 38px | `landing-purple-dark` |
| "?" | Poppins | 800 | 48px | 34px | Sarı vurgulu |

### Dekoratif Detaylar
- Başlık yanında küçük sarı süsleme (görseldeki ok gibi)
- 1-2 adet sparkle ikonu (düşük opaklık)

---

## 3. Fayda Kartı (Sağ Blok)

### Kart Görünümü
| Özellik | Değer |
|---------|-------|
| Arkaplan | Pastel mor/lila (`landing-purple/30`) |
| Border | 3px solid mor (`landing-purple/50`) |
| Köşe radius | 20px |
| Gölge | Soft, yayılmış (`shadow-xl`) |
| İç padding | 20-24px |
| Üst dekor | Sarı klips/pin görseli (CSS ile) |

### Fayda Maddeleri (Görseldeki sıra)
1. Kişiye özel program
2. Birebir & küçük gruplar
3. Canlı Zoom dersleri
4. Konuşma odaklı eğitim
5. Düzenli takip & geri bildirim
6. Ücretsiz deneme dersi

Her madde:
- Sol: Sarı bullet point (•) veya küçük yıldız
- Sağ: Metin (Poppins, 600, koyu morumsu)
- Satır arası: 12-14px

---

## 4. Preview Paneli (Kartın Altında)

### Görünüm
- Boyut: ~200-250px genişlik
- Arkaplan: Çok açık lila/pembe (`landing-purple/15`)
- Border radius: 16px
- Border: 2px solid açık mor
- Konum: Kartın sağ altında (desktop), kartın altında ortalı (mobile)

### İçerik
- Merkeze ortalı bir "laptop + online ders" ikonu veya placeholder
- Yanında/çevresinde 2-3 küçük sparkle

---

## 5. Dekoratif Detaylar

### Sparkle Pozisyonları
1. Başlık sol üstünde (absolute, opacity: 0.6)
2. Fayda kartı sağ üstünde (absolute, opacity: 0.5)
3. Preview panel yanında (absolute, opacity: 0.4)

### Özellikler
- Lucide `Sparkles` veya `Star` ikonu
- Renk: Sarı veya açık pembe
- Boyut: 16-24px
- Opaklık: 0.4-0.7

---

## 6. Animasyonlar

### Fayda Kartı Float
```css
@keyframes whyCardFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}
```
- Süre: 5s
- Easing: ease-in-out
- Infinite loop

### Sparkle Blink
```css
@keyframes whySparkle {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.8; }
}
```
- Süre: 3s

### Performans Kuralları
- Sadece `transform` ve `opacity` kullanılacak
- `will-change: transform, opacity` eklenecek
- `prefers-reduced-motion` desteği

---

## 7. Responsive Kuralları

| Ekran | Davranış |
|-------|----------|
| ≥1024px | İki sütun (sol %45, sağ %55) |
| 768-1023px | Tek sütun, elemanlar ortalı |
| <768px | Tek sütun, küçültülmüş boyutlar |

- `max-w-full` ile taşma engeli
- `overflow-x-hidden` section'da

---

## 8. Değiştirilecek Dosyalar

### `src/components/landing/WhySection.tsx`
Tamamen yeniden yazılacak:
- İki sütunlu grid layout
- Yeni başlık yapısı (Mystery Quest fontu)
- Sticker-style fayda kartı
- Preview paneli
- Dekoratif sparkle'lar
- Float animasyonu

### `src/index.css`
Eklentiler:
- `.why-card-float` animasyon class'ı
- `.why-sparkle-blink` animasyon class'ı
- Kart için özel stiller (klips dekor vb.)

### `src/lib/translations.ts`
Güncelleme:
- `why.miniDesc` eklenmesi (opsiyonel açıklama satırı)

---

## 9. Özet

| Özellik | Açıklama |
|---------|----------|
| Layout | Desktop 2 sütun, mobile tek sütun |
| Kart stili | Pastel mor, soft gölge, sticker-like |
| Tipografi | Poppins + Mystery Quest |
| Dekor | Sarı klips, sparkle'lar |
| Animasyon | Hafif float + sparkle blink |
| Performans | transform/opacity only, reduced-motion |
| Taşma | overflow-x-hidden, max-w-full |

