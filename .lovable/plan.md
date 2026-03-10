

## Plan: iOS Notch / Dynamic Island Safe Area Düzeltmesi (Revize)

### Yaklaşım

`viewport-fit=cover` ile WebView'ı ekran kenarlarına kadar uzatıp, CSS custom property'ler üzerinden `env(safe-area-inset-*)` ile içerikleri güvenli alana çekmek. Arkaplan (`html::before` fixed pseudo-element) zaten edge-to-edge — dokunulmayacak.

### Değiştirilecek Dosyalar

**1. `index.html`** — viewport-fit=cover ekleme

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

Android'de etkisiz.

---

**2. `src/index.css`** — CSS custom property'ler ve safe area utility'leri

Mevcut `pb-safe` utility'si (satır 342-347) genişletilecek. `safe-area-bottom` fallback `0px` olacak:

```css
:root {
  --safe-area-top: env(safe-area-inset-top, 0px);
  --safe-area-bottom: env(safe-area-inset-bottom, 0px);
  --safe-area-left: env(safe-area-inset-left, 0px);
  --safe-area-right: env(safe-area-inset-right, 0px);
}

@layer utilities {
  .pt-safe { padding-top: var(--safe-area-top); }
  .pb-safe { padding-bottom: var(--safe-area-bottom); }
  .px-safe {
    padding-left: var(--safe-area-left);
    padding-right: var(--safe-area-right);
  }
}
```

Tüm bileşenler bu utility sınıflarını kullanır — arbitrary `env()` / `calc()` ifadeleri gerekmez.

---

**3. `capacitor.config.ts`** — StatusBar konfigürasyonu

`StatusBar.overlaysWebView` Capacitor iOS'ta varsayılan olarak `true`'dur. Bu zorunlu bir değişiklik değil; mevcut davranışı netleştirmek ve gelecekte yanlışlıkla değiştirilmesini önlemek için config'e açıkça eklenir. `overlaysWebView: true` iken `backgroundColor` etkisizdir — arkaplan zaten CSS ile yönetiliyor.

```ts
plugins: {
  PushNotifications: { presentationOptions: ["badge", "sound", "alert"] },
  StatusBar: {
    overlaysWebView: true,  // varsayılan davranışı açıkça belirtir
    style: 'DEFAULT'
  }
}
```

---

**4. `src/components/Header.tsx`** — Dashboard header

Dış div arkaplanıyla (`bg-card/50 backdrop-blur-sm`) notch arkasına uzanır. `pt-safe` ile inner content safe area'dan başlar. `px-safe` eklenir ama mevcut `px-2 sm:px-4` zaten minimum yatay padding sağlıyor — `px-safe` landscape'te yan inset varsa ek koruma ekler, portrait'te `0px` döner ve mevcut padding'i etkilemez.

```tsx
<div className="border-b bg-card/50 dark:bg-card/70 backdrop-blur-sm pt-safe px-safe">
  <div className="container mx-auto px-2 sm:px-4 py-2 sm:py-3">
```

`px-safe` dış kaba, `px-2 sm:px-4` inner container'a uygulanır — iki farklı elemana uygulandığı için çakışma olmaz, toplamları geçerlidir.

---

**5. `src/components/landing/LandingHeader.tsx`** — Fixed landing header

Header `fixed top-0 left-0 right-0 bg-transparent`. Inner content wrapper'a (satır 109, `max-w-7xl mx-auto px-4...` div) `pt-safe` eklenir. Logo absolute pozisyonu bu div'e göre olduğu için otomatik olarak safe area altına kayar.

Dış `<header>` elementine `px-safe` eklenir — landscape'te yan inset koruması sağlar. Mevcut `px-4 sm:px-6 lg:px-8` inner container'dadır, `px-safe` dış `<header>`'dadır — farklı elemanlara uygulandığı için toplanır, çakışmaz.

```tsx
<header className="fixed top-0 left-0 right-0 z-50 bg-transparent overflow-visible px-safe">
  ...
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative pt-safe">
```

Double offset yok — `pt-safe` sadece inner container'da, `px-safe` sadece outer header'da.

---

**6. `src/components/ui/toast.tsx`** — Toast viewport

Toast `fixed top-0` kullanıyor (mobile'da üstten). Notch'a çakışmaması için `pt-safe` eklenir. Desktop'ta (`sm:top-auto sm:bottom-0`) etkilenmez.

```tsx
className={cn(
  "fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 pt-safe sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]",
  className,
)}
```

---

### Dokunulmayacaklar
- `html::before` arkaplan — zaten `position: fixed; top: 0` ile edge-to-edge
- Modal/sheet bileşenleri — viewport-relative
- Android görünümü — `env()` fallback `0px`
- AuthForm — kendi fixed top bar'ı yok, safe area sorunu yok

### Özet

| Bileşen | Arkaplan | Interactive Content |
|---------|----------|-------------------|
| LandingHeader | bg-transparent, body BG notch arkasına uzanır | inner div'e `pt-safe` |
| Dashboard Header | bg-card/50 notch arkasına uzanır | dış div'e `pt-safe` |
| Toast | fixed top-0 | `pt-safe` ile notch altından |

Pattern: Dış kap background edge-to-edge → inner content `pt-safe` → interaktif elemanlar güvenli alanda. `px-safe` landscape yan inset koruması için dış kaba eklenir, mevcut yatay padding inner container'da korunur.

