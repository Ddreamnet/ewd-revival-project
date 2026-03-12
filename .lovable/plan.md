

## Plan — 7 Düzeltme

### Analiz Sonuçları

**iOS Zoom Kök Nedeni:**
- `textarea.tsx` satır 11: `text-sm` (14px) kullanıyor. iOS Safari/WebView 16px altındaki input'lara focus olunca otomatik zoom yapar.
- `input.tsx` satır 11: `text-base` + `md:text-sm` — bu zaten doğru pattern (mobilde 16px, desktop'ta 14px).
- **Textarea aynı pattern'i kullanmıyor** — bu iOS zoom'un kök nedeni.

**Bottom-sheet durumu:**
- `UploadHomeworkDialog` satır 24-25, 188: `BOTTOM_SHEET_CLASSES` const + className'de kullanılıyor
- `EditHomeworkDialog` satır 12-13, 89: aynı
- `AddResourceDialog` satır 206: inline bottom-sheet class'ları

**Download/Share durumu:**
- `nativeDownload.ts` satır 65-68: `Share.share` çağrılıyor, kullanıcı share sheet'i kapatırsa hata fırlatılıyor çünkü `catch` bloğuna düşüyor ve `return false` → `HomeworkListDialog` satır 165'te `throw new Error("Native download failed")`
- Share.share cancellation genellikle error fırlatmaz ama bazı platformlarda `activityType` null dönebilir — asıl sorun `HomeworkListDialog`'daki `if (!success)` → `throw` mantığı

**Toast süreleri:**
- `use-toast.ts` satır 6: `TOAST_REMOVE_DELAY = 1000000` — bu sadece remove delay, radix toast'un kendi `duration` prop'u var
- `ToastProvider` satır 8: duration prop verilmemiş — default 5000ms
- Tip bazlı süre için `ToastProvider`'a default duration verilip, toast çağrılarında `duration` override edilebilir

---

### 1. iOS Zoom Fix — Textarea font-size

`src/components/ui/textarea.tsx` satır 11:
- `text-sm` → `text-base md:text-sm`
- Input component ile aynı pattern: mobilde 16px (zoom tetiklemez), desktop'ta 14px

Tek satır değişiklik. Tüm textarea'lar otomatik düzelir.

### 2. Bottom-Sheet Geri Alma

**UploadHomeworkDialog:**
- Satır 24-25: `BOTTOM_SHEET_CLASSES` const'ı sil
- Satır 188: className'den `${BOTTOM_SHEET_CLASSES}` referansını kaldır

**EditHomeworkDialog:**
- Satır 12-13: `BOTTOM_SHEET_CLASSES` const'ı sil
- Satır 89: className'den `${BOTTOM_SHEET_CLASSES}` referansını kaldır

**AddResourceDialog:**
- Satır 206: inline bottom-sheet class'larını kaldır, sadece `max-h-[90dvh]` kalsın

Üç dialog da centered modal olarak kalacak.

### 3. Dosya Görüntüleme / Kaydet-Paylaş Ayrımı

`HomeworkListDialog` dosya listesinde her dosya için iki aksiyon butonu:

**A) Görseller (image/\*):**
- "Görüntüle" butonu → tam ekran overlay/modal ile `<img>` göster (indirmeden)
- "Kaydet/Paylaş" butonu → mevcut download + share akışı

**B) PDF:**
- "Görüntüle" butonu → `window.open(fileUrl, '_blank')` ile tarayıcıda/in-app aç
- "Kaydet/Paylaş" butonu → mevcut download + share akışı

**C) Diğer (DOCX vb.):**
- "Kaydet/Paylaş" butonu → download + share
- Preview mümkün değil, sadece kaydet/paylaş sunulur

Yeni UI: Dosya satırında iki küçük icon button — `Eye` (görüntüle, varsa) + `Share2`/`Download` (kaydet/paylaş)

Görsel preview için basit bir fullscreen overlay (dialog içinde dialog olmaz — ayrı state ile):
```tsx
{previewImage && (
  <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center" onClick={closePreview}>
    <img src={previewImage} className="max-w-full max-h-full object-contain" />
    <button className="absolute top-4 right-4">✕</button>
  </div>
)}
```

### 4. Share Sheet Cancellation

`nativeDownload.ts`:
- `Share.share` çağrısını try/catch ile sarmalayıp, share hatalarını yoksay (cancellation)
- Dosya yazma başarılı → `return true` (share sonucu ne olursa olsun)
- Dosya yazma başarısız → `return false`

```typescript
// Write successful — file is ready
// Open share sheet (cancellation is OK)
try {
  await Share.share({ title: fileName, url: writeResult.uri });
} catch (e) {
  // User cancelled share sheet — not an error
  console.log('Share cancelled or unavailable:', e);
}
return true;
```

`HomeworkListDialog` satır 162-166:
```typescript
if (success) {
  toast({ title: "Dosya hazırlandı", description: "Kaydetmek veya paylaşmak için açılıyor" });
}
// success false ise — gerçek dosya yazma hatası
```
Zaten mevcut hali yakın ama `else throw` kaldırılacak, `catch` bloğundaki mesaj güncellenir.

### 5. Toast Metinleri

- Download/share başarı: "Dosya hazırlandı" (zaten var, korunur)
- Download/share hata: "Dosya hazırlanamadı" (gerçek hata)
- Görüntüle: toast gerekmez
- Cancellation: toast yok

### 6. Toast Süreleri

`src/components/ui/toaster.tsx`:
- `ToastProvider`'a default `duration` verme — variant bazlı çöz
- Her `Toast` render'ında variant'a göre `duration` prop ekle:
  - `destructive` → `duration={5000}` (5 saniye)
  - default → `duration={3000}` (3 saniye)

```tsx
<Toast key={id} duration={props.variant === "destructive" ? 5000 : 3000} {...props}>
```

---

### Değiştirilecek Dosyalar

| Dosya | Değişiklik |
|-------|-----------|
| `src/components/ui/textarea.tsx` | `text-sm` → `text-base md:text-sm` |
| `src/components/UploadHomeworkDialog.tsx` | Bottom-sheet class'ları kaldır |
| `src/components/EditHomeworkDialog.tsx` | Bottom-sheet class'ları kaldır |
| `src/components/AddResourceDialog.tsx` | Bottom-sheet class'ları kaldır |
| `src/components/HomeworkListDialog.tsx` | Görüntüle/Kaydet-Paylaş ayrımı, share error handling, toast metinleri |
| `src/lib/nativeDownload.ts` | Share cancellation → hata sayma |
| `src/components/ui/toaster.tsx` | Variant bazlı toast duration |

### Manuel Yapılacaklar

1. `npx cap sync` — textarea font-size değişikliği native'de de etkili olacak
2. iOS cihazda test: textarea'ya focus olunca zoom yapmamalı
3. Görüntüle/Kaydet-Paylaş butonlarını test et

