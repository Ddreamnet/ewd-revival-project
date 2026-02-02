

# Sticky Bubble Geçiş Sorunu ve Animasyon Düzeltmesi

## Tespit Edilen Sorun

`StickyBubble.tsx` dosyasındaki scroll hesaplaması şu şekilde çalışıyor:

```
whyBottom = whySection.offsetTop + whySection.offsetHeight
```

Bu hesaplama doğru görünüyor, ancak iki önemli sorun var:

1. **Geçiş Hassasiyeti**: `window.scrollY + window.innerHeight / 2` kullanılıyor - bu ekranın ortası anlamına geliyor. Uzun bölümlerde geçiş hissedilmiyor olabilir.

2. **Animasyon Eksikliği**: Bubble değiştiğinde ani bir şekilde görünüp kayboluyor - smooth geçiş yok.

## Çözüm Planı

### 1. Geçiş Mantığını İyileştir

Kids-packages bölümünün başlangıcını referans alarak daha tutarlı bir geçiş:

```tsx
const kidsPackagesSection = document.getElementById('kids-packages');

if (kidsPackagesSection) {
  const kidsPackagesTop = kidsPackagesSection.offsetTop;
  
  if (scrollY < kidsPackagesTop) {
    setBubbleType('trial');
  } else if (scrollY < contactTop) {
    setBubbleType('contact');
  } else {
    setBubbleType('none');
  }
}
```

### 2. Smooth Animasyonlu Geçiş

**Mevcut durum**: Bubble aniden değişiyor (`{bubbleType === 'trial' && ...}`)

**Yeni yaklaşım**: Flip/morph animasyonu ile akıcı geçiş:

```text
┌────────────────────────────────────────────┐
│  GEÇİŞ ANİMASYONU                          │
│                                            │
│  Trial Bubble ──────────> Contact Bubble   │
│                                            │
│  1. Ölçek küçülme (scale: 1 → 0.8)         │
│  2. Opaklık azalma (opacity: 1 → 0)        │
│  3. Yeni bubble belirir                    │
│  4. Ölçek büyüme (scale: 0.8 → 1)          │
│  5. Opaklık artma (opacity: 0 → 1)         │
│                                            │
│  Süre: 400ms, easing: ease-in-out          │
└────────────────────────────────────────────┘
```

### 3. Teknik Uygulama

**State Yapısı:**
```tsx
const [bubbleType, setBubbleType] = useState<BubbleType>('trial');
const [isTransitioning, setIsTransitioning] = useState(false);
const [displayedBubble, setDisplayedBubble] = useState<BubbleType>('trial');
```

**Geçiş Mantığı:**
```tsx
useEffect(() => {
  if (bubbleType !== displayedBubble && !isTransitioning) {
    setIsTransitioning(true);
    
    // Çıkış animasyonu bekle
    setTimeout(() => {
      setDisplayedBubble(bubbleType);
      setIsTransitioning(false);
    }, 300);
  }
}, [bubbleType, displayedBubble, isTransitioning]);
```

**CSS Animasyonları (tailwind.config.ts'e eklenecek):**
```tsx
keyframes: {
  "bubble-exit": {
    "0%": { opacity: "1", transform: "scale(1) rotate(0deg)" },
    "100%": { opacity: "0", transform: "scale(0.6) rotate(-10deg)" }
  },
  "bubble-enter": {
    "0%": { opacity: "0", transform: "scale(0.6) rotate(10deg)" },
    "100%": { opacity: "1", transform: "scale(1) rotate(0deg)" }
  }
}
```

**JSX Yapısı:**
```tsx
<div className={`
  transition-all duration-300 ease-in-out
  ${isTransitioning ? 'animate-bubble-exit' : 'animate-bubble-enter'}
`}>
  {displayedBubble === 'trial' && (
    // Trial bubble içeriği
  )}
  {displayedBubble === 'contact' && (
    // Contact bubble içeriği
  )}
</div>
```

## Değiştirilecek Dosyalar

| Dosya | Değişiklik |
|-------|------------|
| `src/components/landing/StickyBubble.tsx` | Scroll mantığı düzeltme, animasyon state yönetimi |
| `tailwind.config.ts` | bubble-exit ve bubble-enter keyframe animasyonları |

## Görsel Sonuç

Kullanıcı sayfayı kaydırırken:

1. **Hero/Why bölümü**: Trial bubble (hediye kutusu) görünür
2. **Kids-packages bölümüne geçiş**: Bubble dönerek küçülür → kaybolur → Contact bubble dönerek büyür
3. **Adult-packages/FAQ bölümleri**: Contact bubble görünür  
4. **Contact bölümü**: Bubble tamamen kaybolur

Geçişler yumuşak, görsel olarak çekici ve profesyonel görünecek.

