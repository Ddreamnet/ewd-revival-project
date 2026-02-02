
# Sticky Bubble Geçiş Animasyonları

## Mevcut Durum

Şu anda iki sticky bubble (trial kartı ve stickycontact) arasındaki geçiş ani oluyor. `tailwind.config.ts` dosyasında `bubble-enter` ve `bubble-exit` animasyonları tanımlı ama hiç kullanılmıyor.

## Yaratıcı Animasyon Planı

Her iki kart için farklı, dikkat çekici geçiş animasyonları ekliyorum:

### Yeni Keyframes (tailwind.config.ts)

| Animasyon | Efekt | Açıklama |
|-----------|-------|----------|
| `magic-pop-in` | Büyüme + Döndürme + Bounce | Kart sihirli kutudan çıkar gibi belirir |
| `magic-pop-out` | Küçülme + Döndürme + Solma | Kart sihirli bir şekilde kaybolur |
| `flip-in` | 3D Y ekseni dönüşü | Kart arkadan öne döner |
| `flip-out` | 3D Y ekseni dönüşü | Kart önden arkaya döner |
| `confetti-burst` | Parçacık patlaması | Geçişte konfeti efekti |

### Component Mantığı (StickyBubble.tsx)

```text
┌─────────────────────────────────────────────────────────────┐
│                    Animasyon Akışı                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Trial Kart Görünür                                         │
│         │                                                   │
│         ▼ (scroll - kids-packages'a ulaştı)                 │
│  ┌──────────────────┐                                       │
│  │ Trial: magic-pop-out (400ms)                             │
│  │ Konfeti patlaması                                        │
│  └──────────────────┘                                       │
│         │                                                   │
│         ▼ (200ms gecikme)                                   │
│  ┌──────────────────┐                                       │
│  │ Contact: flip-in (500ms)                                 │
│  │ 3D döndürme efekti                                       │
│  └──────────────────┘                                       │
│         │                                                   │
│         ▼ (scroll - contact'a ulaştı)                       │
│  ┌──────────────────┐                                       │
│  │ Contact: flip-out (400ms)                                │
│  │ Yavaşça kaybolma                                         │
│  └──────────────────┘                                       │
│                                                             │
│  Ters scroll için aynı animasyonlar tersine oynar           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### State Yönetimi

Animasyonların düzgün çalışması için state yapısını güncelleme:

- `currentBubble`: Aktif olan bubble ('trial' | 'contact' | 'none')
- `isAnimating`: Animasyon sırasında true
- `animationClass`: Hangi animasyon sınıfı uygulanacak

### Özel Efektler

1. **Konfeti Parçacıkları**: Trial kartı değişirken etrafında küçük parıltılar/yıldızlar patlar
2. **3D Flip**: Contact kartı sahneye 3D döndürme ile girer
3. **Elastic Bounce**: Kartlar yerine oturduğunda hafif zıplama efekti
4. **Glow Trail**: Geçiş sırasında parıldayan iz efekti

---

## Değiştirilecek Dosyalar

| Dosya | Değişiklik |
|-------|------------|
| `tailwind.config.ts` | Yeni keyframes ve animasyon tanımları |
| `src/index.css` | Ek CSS animasyonları ve parçacık stilleri |
| `src/components/landing/StickyBubble.tsx` | Animasyon state yönetimi ve geçiş mantığı |

---

## Teknik Detaylar

### tailwind.config.ts - Yeni Keyframes

```typescript
// Sihirli pop-in animasyonu
"magic-pop-in": {
  "0%": { 
    opacity: "0", 
    transform: "scale(0.3) rotate(-20deg)" 
  },
  "50%": { 
    transform: "scale(1.15) rotate(5deg)" 
  },
  "70%": { 
    transform: "scale(0.95) rotate(-2deg)" 
  },
  "100%": { 
    opacity: "1", 
    transform: "scale(1) rotate(0deg)" 
  }
}

// 3D flip animasyonu
"flip-in-y": {
  "0%": { 
    opacity: "0", 
    transform: "perspective(400px) rotateY(-90deg)" 
  },
  "100%": { 
    opacity: "1", 
    transform: "perspective(400px) rotateY(0deg)" 
  }
}

// Parıltı patlaması
"burst-particle": {
  "0%": { 
    opacity: "1", 
    transform: "translate(0, 0) scale(1)" 
  },
  "100%": { 
    opacity: "0", 
    transform: "translate(var(--tx), var(--ty)) scale(0)" 
  }
}
```

### StickyBubble.tsx - Animasyon Mantığı

```typescript
// Geçiş yönetimi için state
const [displayBubble, setDisplayBubble] = useState<BubbleType>('trial');
const [animationState, setAnimationState] = useState<'idle' | 'exiting' | 'entering'>('idle');
const previousBubble = useRef<BubbleType>('trial');

// Bubble değiştiğinde animasyon tetikleme
useEffect(() => {
  if (bubbleType !== previousBubble.current) {
    // Önce çıkış animasyonu
    setAnimationState('exiting');
    
    // Çıkış animasyonu bitince giriş animasyonu
    setTimeout(() => {
      setDisplayBubble(bubbleType);
      setAnimationState('entering');
      
      // Giriş animasyonu bitince idle
      setTimeout(() => {
        setAnimationState('idle');
      }, 500);
    }, 400);
    
    previousBubble.current = bubbleType;
  }
}, [bubbleType]);
```

### Parçacık Efekti Komponenti

```tsx
// Konfeti patlaması için parçacıklar
const BurstParticles = ({ isActive }: { isActive: boolean }) => {
  if (!isActive) return null;
  
  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible">
      {[...Array(8)].map((_, i) => (
        <span
          key={i}
          className="absolute w-2 h-2 rounded-full animate-burst-particle"
          style={{
            '--tx': `${Math.cos(i * 45 * Math.PI / 180) * 60}px`,
            '--ty': `${Math.sin(i * 45 * Math.PI / 180) * 60}px`,
            background: ['#FFB6C1', '#DDA0DD', '#FFD700', '#98FB98'][i % 4],
            left: '50%',
            top: '50%',
          }}
        />
      ))}
    </div>
  );
};
```

Bu plan, sticky bubble geçişlerine canlı, dikkat çekici ve profesyonel animasyonlar ekleyecek.
