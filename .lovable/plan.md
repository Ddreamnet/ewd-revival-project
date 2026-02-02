

# Yaratıcı Ücretsiz Deneme Dersi Animasyonu Planı

## Tasarım Konsepti

**"Parlayan Hediye Kutusu + Konfeti Patlaması"** konsepti ile ücretsiz deneme dersinin özel ve heyecan verici bir fırsat olduğunu vurgulayacağız.

## Görsel Tasarım

```text
┌─────────────────────────────────────┐
│  ✨ Parıldayan Yıldızlar ✨          │
│                                     │
│   ┌───────────────────────────┐     │
│   │  🎁 GIFT ICON (Pulse)     │     │
│   │                           │     │
│   │   ✦ ÜCRETSİZ ✦           │ ← Gradient renk geçişi
│   │      Deneme               │ ← Bounce animasyonu
│   │      Dersi!               │ ← Shimmer efekti
│   │                           │     │
│   │  ─────────────────────    │     │
│   │  "Hemen deneyin!" CTA     │ ← Parlak ok animasyonu
│   └───────────────────────────┘     │
│                                     │
│  Floating sparkles etrafında ✨     │
└─────────────────────────────────────┘
```

## Animasyonlar

### 1. Ana Kart Animasyonları
- **Pulse Glow**: Kartın etrafında yumuşak parlama efekti
- **Gentle Float**: Hafif yukarı-aşağı hareket (mevcut float'tan farklı ritim)
- **Shimmer Border**: Kenarlarda kayan ışık efekti

### 2. Metin Animasyonları
- **"ÜCRETSİZ"**: 
  - Gradient renk geçişi (sarı → pembe → mor döngüsü)
  - Hafif scale pulse
  - Sparkle efekti (yıldız parıltıları)
  
- **"Deneme"**: 
  - Subtle bounce (yumuşak zıplama)
  - Delayed animation (0.2s gecikme)
  
- **"Dersi!"**: 
  - Typewriter benzeri reveal
  - Ünlem işaretinde ekstra bounce

### 3. Dekoratif Animasyonlar
- **Floating Sparkles**: Kartın etrafında yüzen küçük yıldızlar/parıltılar
- **Gift Icon**: Hediye ikonu pulse + wiggle (sallanma)
- **Arrow Bounce**: CTA okunda dikkat çekici bounce

### 4. Hover Efektleri
- Scale up (1.08x)
- Glow intensify (parlama artışı)
- Sparkles hızlanır
- CTA metni belirginleşir

## Teknik Detaylar

### Yeni Keyframes (index.css'e eklenecek)

```css
/* Gradient renk geçişi */
@keyframes gradient-shift {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

/* Yumuşak parlama */
@keyframes glow-pulse {
  0%, 100% { box-shadow: 0 0 20px rgba(255, 185, 220, 0.4); }
  50% { box-shadow: 0 0 40px rgba(255, 185, 220, 0.8); }
}

/* Yıldız parıltısı */
@keyframes sparkle {
  0%, 100% { opacity: 0; transform: scale(0); }
  50% { opacity: 1; transform: scale(1); }
}

/* Sallanma efekti */
@keyframes wiggle {
  0%, 100% { transform: rotate(-5deg); }
  50% { transform: rotate(5deg); }
}

/* Ok bounce */
@keyframes arrow-bounce {
  0%, 100% { transform: translateX(0); }
  50% { transform: translateX(5px); }
}

/* Shimmer efekti */
@keyframes shimmer {
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
}
```

### Bileşen Yapısı

```tsx
<button className="relative group">
  {/* Floating sparkles (4 adet, farklı pozisyonlarda) */}
  <span className="sparkle absolute ..." />
  
  {/* Ana kart - glow pulse */}
  <div className="bg-gradient-to-br from-landing-yellow via-landing-pink to-landing-purple 
                  animate-glow-pulse rounded-3xl p-5">
    
    {/* Hediye ikonu - wiggle */}
    <Gift className="animate-wiggle" />
    
    {/* "ÜCRETSİZ" - gradient text + sparkle */}
    <p className="text-2xl font-black bg-gradient-to-r from-yellow-500 via-pink-500 to-purple-500 
                  bg-clip-text text-transparent animate-gradient-shift">
      ÜCRETSİZ
    </p>
    
    {/* "Deneme" + "Dersi!" - staggered bounce */}
    <p className="animate-bounce-subtle delay-100">Deneme</p>
    <p className="animate-bounce-subtle delay-200">Dersi!</p>
    
    {/* CTA */}
    <div className="flex items-center gap-1">
      <span>Hemen deneyin</span>
      <ArrowRight className="animate-arrow-bounce" />
    </div>
  </div>
  
  {/* Bubble tail */}
</button>
```

## Dil Desteği (translations.ts güncelleme)

Mevcut çeviriler korunacak:
- TR: "Ücretsiz" / "Deneme" / "Dersi!"
- EN: "Free" / "Trial" / "Lesson!"

Yeni CTA ekleme:
- TR: "Hemen deneyin"
- EN: "Try now"

## Renk Paleti

| Element | Renk |
|---------|------|
| Kart arka plan | Gradient: yellow → pink → purple |
| "ÜCRETSİZ" text | Animated gradient (gold → pink → violet) |
| Sparkles | Beyaz/sarı tonu |
| Glow | Pink (#ffb9dc) |
| CTA | Koyu mor |

## Responsive Davranış

- **Desktop**: Tam animasyonlar, büyük boyut
- **Mobil**: Daha küçük boyut, performans için azaltılmış sparkle sayısı
- **Reduced Motion**: Tüm animasyonlar devre dışı, statik görünüm

## Dosya Değişiklikleri

1. **src/index.css** - Yeni keyframes ve animasyon sınıfları
2. **tailwind.config.ts** - Yeni animasyon tanımları
3. **src/components/landing/StickyBubble.tsx** - Yaratıcı tasarım implementasyonu
4. **src/lib/translations.ts** - Yeni CTA metni ekleme

