

## 6 Sorun — Final Revize Plan

### Değişiklik Özeti (Önceki plandan farklar)

1. **Download:** `Filesystem.downloadFile` yerine `@capacitor/file-transfer` (`FileTransfer.downloadFile`) kullanılacak. `@capacitor/filesystem` sadece hedef path/URI hazırlama için tutulacak. `@capacitor/share` dosyayı kullanıcıya sunmak için kalacak.
2. **Manuel adımlar:** `bun install` → `npm install`
3. **Keyboard:** `dvh` + `interactive-widget` ana düzeltme. `@capacitor/keyboard` + `resize: "body"` iOS için güçlü aday/yardımcı — test ile doğrulanacak.
4. **Android permissions:** Camera plugin normal kullanımda ek manifest permission gerektirmez. Gereksiz CAMERA/READ_EXTERNAL_STORAGE/READ_MEDIA_IMAGES eklenmeyecek.
5. **iOS permissions:** Üç key birlikte: NSCameraUsageDescription, NSPhotoLibraryUsageDescription, NSPhotoLibraryAddUsageDescription.

---

### KONU 1 — Klavye + Dialog Layout

**Ana düzeltme:** `dvh` + `interactive-widget`
- `dialog.tsx` satır 39: `max-h-[90vh]` → `max-h-[90dvh]`
- `index.html` viewport meta: `interactive-widget=resizes-content` eklenir
- `UploadHomeworkDialog.tsx` ve `EditHomeworkDialog.tsx` Textarea'lara `max-h-[120px] overflow-y-auto`

**Yardımcı (güçlü aday, test ile doğrulanacak):**
- `@capacitor/keyboard` package.json'a eklenir
- `capacitor.config.ts`'e `Keyboard: { resize: "body" }` — iOS'ta WebView resize davranışını kontrol eder. Android'de bu ayar etkisiz (Android davranışı manifest'e bağlı).

---

### KONU 2 & 3 — iOS Camera Crash + Android Take Photo Eksik

**Çözüm:** `@capacitor/camera` eklenir. Yeni `src/lib/nativeCamera.ts` oluşturulur:
- `Camera.getPhoto({ source: CameraSource.Prompt, resultType: CameraResultType.DataUrl })` — hem iOS hem Android'de "Camera" + "Gallery" seçeneklerini sunar
- Native platformda bu wrapper çağrılır, web'de mevcut file input korunur
- `UploadHomeworkDialog.tsx` ve `AddResourceDialog.tsx` güncellenir

**Permissions:**
- **iOS (manuel):** NSCameraUsageDescription, NSPhotoLibraryUsageDescription, NSPhotoLibraryAddUsageDescription — üçü birlikte Info.plist'e eklenmeli
- **Android:** Ek manifest permission **gerekmez**. Capacitor Camera plugin normal kullanımda (`saveToGallery` olmadan) kendi intent'i ile çalışır, manifest'te CAMERA permission aramaz.

---

### KONU 4 — Dosya İndirme

**Yaklaşım:** `@capacitor/file-transfer` + `@capacitor/filesystem` + `@capacitor/share`

Akış:
1. `Filesystem.getUri({ directory: Directory.Cache, path: fileName })` ile hedef path/URI hazırla
2. `FileTransfer.downloadFile({ url, path: fileInfo.uri })` ile dosyayı indir
3. `Share.share({ url: fileInfo.uri })` ile native paylaşım/kaydetme sheet'i aç
4. Web'de mevcut blob + `<a download>` yöntemi korunur

Neden bu yaklaşım:
- `@capacitor/file-transfer` resmi Capacitor plugin'i, `Filesystem.downloadFile` deprecated
- `FileTransfer.downloadFile` URL'den doğrudan native filesystem'e indirir
- `Filesystem` sadece URI hazırlama için kullanılır (dosya yazma değil)
- `Share.share` dosyayı kullanıcıya sunar (Files'a kaydet, başka app'e gönder vb.)
- Toast "indirildi" mesajı sadece `FileTransfer.downloadFile` başarılı olduktan sonra gösterilir

Yeni dosya: `src/lib/nativeDownload.ts`
Güncellenen dosya: `src/components/HomeworkListDialog.tsx` (`handleDownload`)

---

### KONU 5 — Uzun Dosya Adı Overflow

Flex child'lara `min-w-0` eklenir:
- `HomeworkListDialog.tsx` satır 322: `<span>` → `min-w-0` ekle
- `UploadHomeworkDialog.tsx` satır 201: `<span>` → `min-w-0` ekle  
- `AddResourceDialog.tsx` satır 274: `<span>` → `min-w-0` ekle

---

### KONU 6 — "Dosya seçilmedi" Metni

`UploadHomeworkDialog.tsx`:
- `<Input type="file">` → `className="hidden"` + `ref={fileInputRef}` ile gizle
- Yerine custom "Dosya Ekle" button'u koy → `fileInputRef.current?.click()`
- Native input'un "No file chosen" metni hiç gösterilmez

---

### Değiştirilecek Dosyalar

| Dosya | Değişiklik |
|-------|-----------|
| `package.json` | `@capacitor/camera`, `@capacitor/file-transfer`, `@capacitor/filesystem`, `@capacitor/share`, `@capacitor/keyboard` ekle (tümü `^8.0.0`) |
| `capacitor.config.ts` | `Keyboard: { resize: "body" }` ekle (iOS için güçlü aday) |
| `index.html` | viewport meta'ya `interactive-widget=resizes-content` ekle |
| `src/components/ui/dialog.tsx` | `max-h-[90vh]` → `max-h-[90dvh]` |
| `src/components/UploadHomeworkDialog.tsx` | File input gizle + custom button, textarea max-h, native camera, dosya adı min-w-0 |
| `src/components/EditHomeworkDialog.tsx` | Textarea max-h ekle |
| `src/components/AddResourceDialog.tsx` | Native camera desteği, dosya adı min-w-0 |
| `src/components/HomeworkListDialog.tsx` | Native download (FileTransfer + Share), dosya adı min-w-0 |
| `src/lib/nativeCamera.ts` | **Yeni** — Camera.getPhoto wrapper |
| `src/lib/nativeDownload.ts` | **Yeni** — FileTransfer.downloadFile + Filesystem.getUri + Share.share |

### Senin Manuel Yapman Gerekenler

1. `npm install` — yeni paketleri yükle
2. `npx cap sync` — native projelere sync et
3. **iOS Info.plist'e üç key ekle:**
   - `NSCameraUsageDescription` → "Ödev fotoğrafı çekmek için kamera erişimi gereklidir"
   - `NSPhotoLibraryUsageDescription` → "Ödev dosyası seçmek için fotoğraf kütüphanesi erişimi gereklidir"
   - `NSPhotoLibraryAddUsageDescription` → "Çekilen fotoğrafları kaydetmek için fotoğraf kütüphanesi erişimi gereklidir"
4. **Android:** Ek permission **gerekmez**
5. Fiziksel cihazda test: keyboard, camera, download akışları

### İzin Tablosu

| İzin | Platform | Gerekli mi | Neden |
|------|----------|-----------|-------|
| NSCameraUsageDescription | iOS | **Evet** | Kamera erişimi için zorunlu |
| NSPhotoLibraryUsageDescription | iOS | **Evet** | Galeri okuma erişimi için zorunlu |
| NSPhotoLibraryAddUsageDescription | iOS | **Evet** | Galeri yazma (fotoğraf kaydetme) |
| CAMERA | Android | **Hayır** | Camera plugin kendi intent'i ile açar |
| READ_EXTERNAL_STORAGE | Android | **Hayır** | saveToGallery kullanılmıyor |
| READ_MEDIA_IMAGES | Android | **Hayır** | saveToGallery kullanılmıyor |

### Test Edge-Case'leri

- Klavye açık iken dialog dvh ile küçülmeli, kapanınca eski boyutuna dönmeli
- iOS'ta kamera izni reddetme → kontrollü hata mesajı (crash değil)
- Android'de CameraSource.Prompt → hem kamera hem galeri seçeneği çıkmalı
- Native download: PDF, image, DOCX dosyaları gerçekten cihaza inmeli + paylaşım sheet açılmalı
- Supabase auth gerektiren URL'ler FileTransfer ile çalışıyor mu (fallback: blob + writeFile)
- Çok uzun Türkçe dosya adı → truncate çalışmalı
- Dosya seçildikten sonra "No file chosen" metni görünmemeli

