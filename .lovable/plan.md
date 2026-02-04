
# Sticky Bubble Scroll Geçişleri - Tam Optimizasyon

## Tespit Edilen Sorunlar

### 1. Race Condition (Yarış Durumu)
Mevcut kodda `isAnimating.current` flag'i ile state güncellemeleri arasında zamanlama problemi var. Hızlı scroll yapıldığında animasyonlar tamamlanmadan yeni scroll tetikleniyor ve state tutarsız kalıyor.

### 2. Timeout Cleanup Eksikliği
`useEffect` içindeki timeout'lar düzgün temizlenmiyor. Özellikle iç içe timeout'lar (enterTimeout) cleanup fonksiyonunda yakalanmıyor.

### 3. displayBubble = 'none' Durumu
Contact bölümünden yukarı çıkıldığında `displayBubble` hala 'none' olarak kalıyor ve animasyon tetiklenmiyor.

### 4. Animation State Reset
Animasyon durumu 'exiting' veya 'entering' iken component unmount olursa state sıfırlanmıyor.

---

## Çözüm: Basitleştirilmiş State Machine Yaklaşımı

Mevcut karmaşık animasyon sistemini basitleştirip, CSS transitions kullanarak daha güvenilir hale getireceğiz.

### Yeni Mimari

```
Scroll Event
    ↓
Section Detection → bubbleType belirlenir (trial | contact | none)
    ↓
Single useEffect → displayBubble + isVisible kontrolü
    ↓
CSS Transitions → opacity + transform (JavaScript animation yerine)
```

---

## Değişiklikler

### Dosya: `src/components/landing/StickyBubble.tsx`

**Yeni Yaklaşım:**
- Karmaşık animationState yerine basit `isVisible` boolean
- setTimeout yerine CSS transition-delay kullanımı
- `requestAnimationFrame` ile scroll throttling
- Tek bir state: `currentBubble` (displayed bubble type)

```tsx
// KALDIRILACAK STATES:
const [displayBubble, setDisplayBubble] = useState<BubbleType>('trial');
const [animationState, setAnimationState] = useState<AnimationState>('idle');
const [showParticles, setShowParticles] = useState(false);
const previousBubble = useRef<BubbleType>('trial');
const isAnimating = useRef(false);

// YENİ STATES:
const [targetBubble, setTargetBubble] = useState<BubbleType>('trial');
const [visibleBubble, setVisibleBubble] = useState<BubbleType>('trial');
const [isTransitioning, setIsTransitioning] = useState(false);
const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
```

**Yeni Scroll Handler:**
```tsx
useEffect(() => {
  let rafId: number | null = null;
  
  const handleScroll = () => {
    if (rafId) return; // Throttle
    
    rafId = requestAnimationFrame(() => {
      const kidsPackages = document.getElementById('kids-packages');
      const contact = document.getElementById('contact');
      
      if (!kidsPackages || !contact) {
        rafId = null;
        return;
      }
      
      const viewportCenter = window.innerHeight / 2;
      const kidsTop = kidsPackages.getBoundingClientRect().top;
      const contactTop = contact.getBoundingClientRect().top;
      
      let newType: BubbleType;
      if (contactTop < viewportCenter) {
        newType = 'none';
      } else if (kidsTop < viewportCenter) {
        newType = 'contact';
      } else {
        newType = 'trial';
      }
      
      setTargetBubble(newType);
      rafId = null;
    });
  };
  
  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll(); // Initial check
  
  return () => {
    window.removeEventListener('scroll', handleScroll);
    if (rafId) cancelAnimationFrame(rafId);
  };
}, []);
```

**Yeni Transition Handler:**
```tsx
useEffect(() => {
  // Aynı bubble tipiyse işlem yapma
  if (targetBubble === visibleBubble) return;
  
  // Önceki transition'ı temizle
  if (transitionTimeoutRef.current) {
    clearTimeout(transitionTimeoutRef.current);
  }
  
  // Transition başlat
  setIsTransitioning(true);
  
  // Transition süresi sonunda bubble'ı değiştir
  transitionTimeoutRef.current = setTimeout(() => {
    setVisibleBubble(targetBubble);
    
    // Yeni bubble için entry animation
    requestAnimationFrame(() => {
      setIsTransitioning(false);
    });
  }, 300); // Exit animation süresi
  
  return () => {
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
    }
  };
}, [targetBubble, visibleBubble]);
```

**Basitleştirilmiş Render:**
```tsx
// Hiçbir şey gösterme durumu
if (visibleBubble === 'none' && !isTransitioning) {
  return null;
}

const getContainerClasses = () => {
  const base = 'transition-all duration-300 ease-out';
  
  if (isTransitioning) {
    return `${base} opacity-0 scale-75`;
  }
  
  return `${base} opacity-100 scale-100`;
};

return (
  <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-40 pb-safe">
    <div className={getContainerClasses()}>
      {visibleBubble === 'trial' && <TrialBubble onClick={scrollToContact} />}
      {visibleBubble === 'contact' && <ContactBubble onClick={scrollToContact} />}
    </div>
  </div>
);
```

---

## Ek Optimizasyonlar

### 1. BurstParticles Kaldırılacak
Karmaşıklığı azaltmak için parçacık efekti kaldırılacak. İsteğe bağlı olarak daha sonra CSS-only particle efekti eklenebilir.

### 2. FloatingSparkle Sadeleştirme
Mevcut sparkle'lar korunacak ama animasyon basitleştirilecek.

### 3. GPU Hızlandırma
```css
.sticky-bubble-container {
  will-change: opacity, transform;
  transform: translateZ(0); /* GPU layer oluştur */
}
```

---

## Sonuç

| Önceki Durum | Yeni Durum |
|--------------|------------|
| 5 state değişkeni | 3 state değişkeni |
| 2 ref (previousBubble, isAnimating) | 1 ref (transitionTimeoutRef) |
| İç içe setTimeout | Tek setTimeout + cleanup |
| JavaScript animasyonları | CSS transitions |
| Race condition riski | Cleanup garantili |

### Test Senaryoları
1. Hızlı scroll yukarı-aşağı
2. Contact bölümüne inip yukarı çıkma
3. Sayfa yüklendiğinde doğru bubble gösterimi
4. Mobile ve desktop'ta tutarlı davranış
