

## Plan — Footer'dan Store Badge'lerini Native App'lerde Gizleme

### Yaklaşım
Capacitor'ın `@capacitor/core` paketindeki `Capacitor.isNativePlatform()` fonksiyonunu kullanarak, uygulama native (iOS/Android) ortamda çalışıyorsa Google Play ve App Store badge'lerini gizle. Web'de aynen görünmeye devam edecek.

### Değişiklik

**`src/components/landing/Footer.tsx`**
- `import { Capacitor } from '@capacitor/core'`
- Store badge bölümünü (satır 75-124) `{!Capacitor.isNativePlatform() && (...)}` ile sarmalayarak native'de gizle
- Web'de değişiklik yok

Tek dosya, tek koşul.

