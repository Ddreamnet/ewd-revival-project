
# StickyBubble Tam Düzeltme Planı

## Problem Analizi

Mevcut kodda tespit edilen kritik sorunlar:

### 1. Animasyon State Eksikliği
Mevcut `getAnimationClass()` fonksiyonu her zaman bir animasyon class'ı döndürüyor:
- `isExiting: true` → exit animasyonu (doğru)
- `isExiting: false` → entry animasyonu (YANLIŞ - sürekli tetikleniyor)

Entry animasyonu sadece bubble değiştiğinde bir kez çalışmalı, sonra "idle" durumuna geçmeli.

### 2. Transition Tamamlanma Takibi Yok
Kod exit animasyonu bitince bubble'ı değiştiriyor ama entry animasyonunun bittiğini takip etmiyor. Bu yüzden entry animasyonu sürekli tekrarlanıyor.

### 3. Çözüm: 3 Durumlu State Machine
```text
┌─────────────────────────────────────────────────────────────┐
│                    STATE MACHINE                             │
├─────────────────────────────────────────────────────────────┤
│  IDLE → (target değişti) → EXITING → (350ms) → ENTERING →  │
│         (600ms) → IDLE                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Çözüm Detayları

### Dosya: `src/components/landing/StickyBubble.tsx`

**Değişiklik 1: State Yapısını Güncelle (Satır 131-138)**

Mevcut:
```tsx
const [targetBubble, setTargetBubble] = useState<BubbleType>('trial');
const [visibleBubble, setVisibleBubble] = useState<BubbleType>('trial');
const [isExiting, setIsExiting] = useState(false);
const [showParticles, setShowParticles] = useState(false);
```

Yeni:
```tsx
type AnimationPhase = 'idle' | 'exiting' | 'entering';

const [targetBubble, setTargetBubble] = useState<BubbleType>('trial');
const [visibleBubble, setVisibleBubble] = useState<BubbleType>('trial');
const [animationPhase, setAnimationPhase] = useState<AnimationPhase>('idle');
const [showParticles, setShowParticles] = useState(false);
```

**Değişiklik 2: Transition Effect'i Güncelle (Satır 187-219)**

Yeni transition logic:
```tsx
useEffect(() => {
  // Aynı bubble, işlem yapma
  if (targetBubble === visibleBubble) return;
  
  // Zaten animasyon varsa, timeout'u temizle ve yeniden başla
  if (transitionTimeoutRef.current) {
    clearTimeout(transitionTimeoutRef.current);
    transitionTimeoutRef.current = null;
  }

  // Phase 1: Exit animasyonu başlat
  setAnimationPhase('exiting');
  setShowParticles(true);

  // Phase 2: Exit bittikten sonra bubble'ı değiştir ve entry başlat
  transitionTimeoutRef.current = setTimeout(() => {
    setShowParticles(false);
    setVisibleBubble(targetBubble);
    setAnimationPhase('entering');

    // Phase 3: Entry bittikten sonra idle'a geç
    transitionTimeoutRef.current = setTimeout(() => {
      setAnimationPhase('idle');
      transitionTimeoutRef.current = null;
    }, 600); // Entry animasyonu süresi (flip-in-y: 0.6s)
    
  }, 400); // Exit animasyonu süresi (magic-pop-out: 0.4s)

  return () => {
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }
  };
}, [targetBubble, visibleBubble]);
```

**Değişiklik 3: getAnimationClass Fonksiyonunu Düzelt (Satır 241-253)**

Mevcut:
```tsx
const getAnimationClass = () => {
  if (isExiting) {
    if (visibleBubble === 'trial') return 'animate-magic-pop-out';
    if (visibleBubble === 'contact') return 'animate-flip-out-y';
    return 'opacity-0 scale-75';
  }
  
  // Entry animation when bubble just changed
  if (visibleBubble === 'trial') return 'animate-magic-pop-in';
  if (visibleBubble === 'contact') return 'animate-flip-in-y';
  
  return '';
};
```

Yeni:
```tsx
const getAnimationClass = () => {
  switch (animationPhase) {
    case 'exiting':
      if (visibleBubble === 'trial') return 'animate-magic-pop-out';
      if (visibleBubble === 'contact') return 'animate-flip-out-y';
      return 'opacity-0 scale-75';
      
    case 'entering':
      if (visibleBubble === 'trial') return 'animate-magic-pop-in';
      if (visibleBubble === 'contact') return 'animate-flip-in-y';
      return 'opacity-100 scale-100';
      
    case 'idle':
    default:
      // Idle durumunda animasyon yok - sadece statik görünüm
      return 'opacity-100 scale-100';
  }
};
```

**Değişiklik 4: Render Kontrolünü Güncelle (Satır 256-258)**

Mevcut:
```tsx
if (visibleBubble === 'none' && !isExiting) {
  return null;
}
```

Yeni:
```tsx
if (visibleBubble === 'none' && animationPhase === 'idle') {
  return null;
}
```

---

## Özet

| Önceki | Yeni |
|--------|------|
| `isExiting` boolean | `animationPhase: 'idle' \| 'exiting' \| 'entering'` |
| Entry animasyonu sürekli | Entry sadece 'entering' phase'de |
| Idle durumu yok | Idle'da animasyon class'ı yok |
| Tek timeout (350ms) | İki timeout: exit (400ms) + enter (600ms) |

### Test Senaryoları
1. Sayfa yüklendiğinde trial bubble görünmeli (idle state)
2. Kids packages'a scroll → contact bubble'a geçiş (exit → enter → idle)
3. Contact bölümüne scroll → bubble kaybolmalı
4. Yukarı scroll → bubble tekrar görünmeli
5. Hızlı scroll yapınca bozulmamalı
