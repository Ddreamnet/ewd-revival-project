

## Final Plan — 4 Düzeltme

### Dosya Analizi Sonuçları

**AddResourceDialog durumu:**
- `max-h-[90vh]` kullanıyor (satır 206) → dvh'ye çevrilmeli
- Textarea'da `max-h` yok (satır 309-315) → eklenmeli
- Dosya adı: `min-w-0 truncate` zaten var (satır 274) → OK
- File input: `className="hidden"` + custom button zaten var → OK
- Klavye sorunu: centered modal + vh → etkileniyor → bottom-sheet gerekli
- Native kamera: Kullanmıyor, sadece file input. Kaynak türleri PDF/video/image/document/link — dosya seçimi ağırlıklı. Kamera ihtiyacı düşük, sistem chooser yeterli.
- **Sonuç:** dvh, textarea max-h ve bottom-sheet eklenmeli. Native camera dropdown gerekmez.

**UploadHomeworkDialog durumu:**
- Ayrı "Fotoğraf Çek" butonu var (satır 225-235) → kaldırılacak
- `handleNativeCamera` fonksiyonu var (satır 63-76) → kaldırılacak
- Camera import var (satır 9-10) → güncelleme gerekecek
- Bottom-sheet class'ları yok → eklenecek

**EditHomeworkDialog durumu:**
- `max-h` yok (satır 85) → dvh + bottom-sheet eklenecek
- Textarea max-h zaten var → OK

**nativeDownload.ts:**
- `recursive: true` eksik (satır 43-47)
- mkdir yok

**nativeCamera.ts:**
- Source parametresi sabit `CameraSource.Prompt` — opsiyonel source desteği eklenecek (Android fallback dropdown için)

---

### 1. Scoped Mobile Bottom-Sheet

Global `dialog.tsx` değişmeyecek. Üç dialog'a className override:

```
max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-auto 
max-sm:left-0 max-sm:translate-x-0 max-sm:translate-y-0 
max-sm:rounded-b-none max-sm:rounded-t-xl max-sm:max-h-[85dvh]
max-sm:data-[state=open]:slide-in-from-bottom 
max-sm:data-[state=closed]:slide-out-to-bottom
```

`dialog.tsx` satır 39'daki `left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%]` mobilde bastırılır:
- `max-sm:left-0` → `left-[50%]` override
- `max-sm:top-auto` → `top-[50%]` override
- `max-sm:translate-x-0 max-sm:translate-y-0` → translate'ler sıfırlanır
- `max-sm:bottom-0 max-sm:inset-x-0` → alta yapışır, tam genişlik

Desktop'ta (`sm:` üzeri) bu override'lar etkisiz.

**Uygulanacak dialoglar:** UploadHomeworkDialog, EditHomeworkDialog, AddResourceDialog

---

### 2. Tek Butonlu Akış — Platform Bazlı Strateji

**UploadHomeworkDialog:**

- Ayrı "Fotoğraf Çek" butonu kaldırılacak (satır 225-235)
- `handleNativeCamera` kaldırılacak (satır 63-76)
- `Camera` lucide import kaldırılacak

Tek "Dosya Seç" butonu:
- **Web:** `fileInputRef.current?.click()` — mevcut davranış
- **iOS:** `fileInputRef.current?.click()` — iOS sistem chooser'ı Info.plist permission'lar düzeltildikten sonra kamera + galeri + dosya seçeneklerini sunar. Ek dropdown gerekmez.
- **Android (fallback):** Android WebView'da `<input type="file">` kamera seçeneği sunmaz. Bu yüzden Android'de butona basınca bir ActionSheet/alert ile 3 seçenek sunulacak:
  1. "Fotoğraf Çek" → `pickImageNative(CameraSource.Camera)`
  2. "Galeriden Seç" → `pickImageNative(CameraSource.Photos)`
  3. "Dosya Seç" → `fileInputRef.current?.click()`

Bunu radix dropdown yerine basit bir `window.confirm` benzeri yapı veya custom küçük bir dialog ile yapabiliriz. En temiz yaklaşım: Android'de `Capacitor.getPlatform() === 'android'` kontrolü ile koşullu ActionSheet.

**nativeCamera.ts güncelleme:** `pickImageNative` fonksiyonuna opsiyonel `source` parametresi eklenir (default: `CameraSource.Prompt`). Android fallback'te `Camera` ve `Photos` ayrı ayrı çağrılabilir.

**AddResourceDialog:** Değişiklik yok. Kaynak türü çeşitliliği (PDF/video/document/link) nedeniyle sistem chooser yeterli. Native kamera dropdown eklenmeyecek.

---

### 3. Native Download — mkdir + recursive + toast düzeltmesi

`nativeDownload.ts` satır 42-47:

```typescript
// mkdir ile downloads klasörünü oluştur
try {
  await Filesystem.mkdir({ path: 'downloads', directory: Directory.Cache, recursive: true });
} catch (e: any) {
  if (!e?.message?.includes('exist')) console.warn('mkdir warning:', e);
}

const writeResult = await Filesystem.writeFile({
  path: targetPath,
  data: base64,
  directory: Directory.Cache,
  recursive: true,  // ← eklendi
});
```

`HomeworkListDialog.tsx` satır 163: toast mesajı `"Dosya indirildi"` → `"Dosya hazırlandı"`

---

### 4. AddResourceDialog Ek Düzeltmeler

- Satır 206: `max-h-[90vh]` → `max-h-[90dvh]` + bottom-sheet class'ları
- Satır 309-315: Textarea'ya `max-h-[120px] overflow-y-auto` ekle

---

### Değiştirilecek Dosyalar

| Dosya | Değişiklik |
|-------|-----------|
| `src/components/UploadHomeworkDialog.tsx` | Kamera butonu kaldır, tek buton (web+iOS: file input, Android: 3 seçenekli fallback), bottom-sheet className |
| `src/components/EditHomeworkDialog.tsx` | dvh + bottom-sheet className |
| `src/components/AddResourceDialog.tsx` | `max-h-[90vh]`→`max-h-[90dvh]`, textarea max-h, bottom-sheet className |
| `src/components/HomeworkListDialog.tsx` | Toast mesajı düzelt |
| `src/lib/nativeCamera.ts` | Source parametresi opsiyonel kabul et |
| `src/lib/nativeDownload.ts` | mkdir + recursive:true |

**Dokunulmayan:** `dialog.tsx`, `capacitor.config.ts`, `index.html`

### Manuel Yapılacaklar

1. iOS Info.plist'e üç key ekle (NSCameraUsageDescription, NSPhotoLibraryUsageDescription, NSPhotoLibraryAddUsageDescription)
2. `npm install` + `npx cap sync`
3. Test: mobilde bottom-sheet + keyboard, iOS'ta tek buton + sistem chooser, Android'de tek buton + 3 seçenekli fallback, download

