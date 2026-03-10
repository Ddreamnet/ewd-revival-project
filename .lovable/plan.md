

## Mobil Nav Panel Kompaktlaştırma

Mevcut `MobileNavPanel.tsx` dosyasında tek dosya değişikliği yapılacak. Değişiklikler:

### `PopoverContent` (satır 33-34)
- `w-64` → `w-48` (256px → 192px, ~%25 küçülme)
- `p-4 space-y-4` → `p-2.5 space-y-2.5`

### Label'lar (satır 38, 71)
- `text-xs` kalacak, zaten küçük

### Switch container'ları (satır 41, 76)
- `h-11` → `h-8` (44px → 32px)
- `p-1` → `p-0.5`

### Switch knob'ları (satır 44, 80)
- `top-1 bottom-1` → `top-0.5 bottom-0.5`
- `w-[calc(50%-4px)]` → `w-[calc(50%-2px)]`
- Translate offset: `calc(100%+8px)` → `calc(100%+4px)`

### Switch buton içerikleri
- `text-sm` → `text-xs`
- `gap-1.5` → `gap-1`
- Flag emoji: `text-base` → `text-sm`
- Sun/Moon ikonları: `h-4.5 w-4.5` → `h-3.5 w-3.5`

### Login butonu (satır 108)
- `h-11` → `h-8`
- `text-sm` → `text-xs`
- `gap-2` → `gap-1.5`
- Login ikonu: `h-4 w-4` → `h-3.5 w-3.5`

### Hamburger tetikleyici (satır 20)
- `p-2.5` → `p-2`
- İkon boyutu `h-5 w-5` → `h-4.5 w-4.5`

Sonuç: Panel ve tüm içerikler ~%25 daha kompakt, yatayda da ~%25 daha dar. Görsel dil ve işlevsellik korunur.

