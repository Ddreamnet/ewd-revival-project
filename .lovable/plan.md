## Plan — Formspree Entegrasyonu (2 Form)

### Mevcut Durum

1. **ContactSection (öğrenci formu):** `handleSubmit` sadece `console.log` yapıyor. Formspree bağlantısı yok. Controlled state kullanıyor. `name` attribute'ları eksik. Success/error translation key'leri yok.
2. **WorkWithUsPage (öğretmen formu):** Formspree yapısı var ama endpoint `YOUR_FORM_ID` placeholder. Uncontrolled form (FormData) kullanıyor. Submit/loading/success zaten kısmen var.

### Değişiklikler

#### 1. `src/lib/translations.ts`

Contact form için success/error/sending translation key'leri ekle:

```
contact.form.success: "Başvurunuz gönderildi!" / "Your application has been submitted!"
contact.form.error: "Bir hata oluştu, lütfen tekrar deneyin." / "An error occurred, please try again."
contact.form.sending: "Gönderiliyor..." / "Sending..."
contact.form.submitted: "Gönderildi ✓" / "Submitted ✓"
```

#### 2. `src/components/landing/ContactSection.tsx`

- Formspree endpoint: `https://formspree.io/f/mzdjgzzo`
- `isSubmitting` ve `submitted` state ekle
- Tüm input/textarea/select'e anlamlı `name` attribute ekle (`fullName`, `studentAge`, `phone`, `message`)
- Honeypot anti-spam alanı ekle (gizli input `_gotcha`)
- `handleSubmit`: `fetch` ile Formspree'ye POST, FormData kullan
- Submit butonu: `disabled={isSubmitting}`, loading text göster, submitted state
- Başarıda form reset + success toast, hatada error toast
- `required` attribute ekle zorunlu alanlara
- `autocomplete` attribute ekle
- Input font-size zaten `text-sm` — `text-base md:text-sm` yaparak iOS zoom fix (input.tsx pattern ile uyumlu)

#### 3. `src/pages/WorkWithUsPage.tsx`

- Endpoint'i `https://formspree.io/f/mwvrbpvp` olarak güncelle
- Honeypot anti-spam alanı ekle
- `autocomplete` attribute ekle
- Input'lara `text-base md:text-sm` (iOS zoom fix)
- Loading state'de spinner veya "Gönderiliyor..." göster

#### 4. Anti-spam (her iki form)

Formspree'nin kendi `_gotcha` honeypot field'ı:

```html
<input type="text" name="_gotcha" style={{ display: 'none' }} tabIndex={-1} autoComplete="off" />
```

### Dosya Listesi


| Dosya                                       | Değişiklik                                                  |
| ------------------------------------------- | ----------------------------------------------------------- |
| `src/lib/translations.ts`                   | Contact form success/error/sending key'leri ekle            |
| `src/components/landing/ContactSection.tsx` | Formspree entegrasyonu, validation, submit akışı, anti-spam |
| `src/pages/WorkWithUsPage.tsx`              | Endpoint düzelt, anti-spam, iOS font fix                    |


**Ek dikkat:**

- AJAX/fetch submit’lerde `Accept: application/json` header’ı kesin olsun

- Öğrenci formu endpoint: https://formspree.io/f/mzdjgzzo

- Öğretmen formu endpoint: https://formspree.io/f/mwvrbpvp

- Placeholder, TODO veya yarım entegrasyon bırakma

- Her iki form da gerçek submit, loading, success, error, validation ve anti-spam ile tam çalışır halde bitsin  
Dokunulmayan

- UI tasarımı, renkler, spacing, tipografi — hiçbiri değişmez
- Mevcut translation yapısı korunur