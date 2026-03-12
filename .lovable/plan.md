

## Plan — Image Preview Fix + Download Icon + 3 Ek Düzeltme

### Kök Neden
`homework-files` bucket'ı private. `handlePreview` raw public URL'yi `<img src>` olarak kullanıyor — auth token olmadan erişilemiyor, bu yüzden "Preview ?" görünüyor.

### Değişiklikler (`src/components/HomeworkListDialog.tsx`)

1. **Image preview:** `handlePreview` → `supabase.storage.download()` ile blob indir, `URL.createObjectURL(blob)` ile geçici URL oluştur, `previewImage` state'ine set et.

2. **PDF preview:** Aynı blob download + `URL.createObjectURL` → `window.open(objectUrl, '_blank')`.

3. **Eski previewImage cleanup (ek düzeltme 1):** Yeni preview açmadan önce mevcut `previewImage` varsa `URL.revokeObjectURL` çağır.

4. **PDF object URL cleanup (ek düzeltme 2):** PDF için oluşturulan object URL'yi `setTimeout` ile kısa süre sonra revoke et (tarayıcı yeni sekmede açtıktan sonra).

5. **filePath çıkarma güvenliği (ek düzeltme 3):** `split('/homework-files/')` sonucu `[1]` yoksa kontrollü hata mesajı ver, devam etme.

6. **Share2 → Download ikonu:** Import'ta `Share2` → `Download`, JSX'te ikon ve title güncelle.

### Aksiyon Tablosu
| Tip | Görüntüle (Eye) | İndir (Download) |
|-----|-----------------|-------------------|
| image/* | Fullscreen overlay (blob URL) | ✓ |
| PDF | window.open (blob URL) | ✓ |
| Diğer | — | ✓ |

### Tek dosya değişecek
`src/components/HomeworkListDialog.tsx`

