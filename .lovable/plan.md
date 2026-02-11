

# Footer + Bizimle Calisin + Gizlilik Politikasi Plani (Revize v2 -- Son)

Bu plan onceki onaylanmis planin aynisidir. Degisen 4 madde asagida acikca belirtilmistir; geri kalan her sey aynen korunmustur.

**Degisen maddeler:**
1. Sosyal ikonlar: Sadece WhatsApp + Instagram. Facebook tamamen kaldirildi.
2. Sosyal URL'ler: ContactSection.tsx'teki mevcut kaynaklardan alinacak (WhatsApp: `https://wa.me/905306792831`, Instagram: `https://instagram.com/englishwithdilarateacher`). Tum linkler `target="_blank" rel="noopener noreferrer"` ile acilacak ve `https://` tam format kullanacak.
3. Gizlilik Politikasi: "Son guncelleme / Last updated" satiri yok. `PRIVACY_POLICY_LAST_UPDATED` constant'i yok. `translations.privacyPolicy.lastUpdated` alani yok. Sayfa sadece baslik + 7 soft-card.
4. WorkWithUs Formspree: Aynen kaliyor. Endpoint placeholder ise submit engellenir, kullaniciya "Form su an aktif degil / The form is not active at the moment." mesaji gosterilir.

---

## 1. UI/UX Kararlari

### Footer
- 3 kolonlu layout (desktop), tek kolon (mobil)
- Arkaplan: `bg-white/70` + `shadow-[0_-2px_10px_rgba(0,0,0,0.04)]` -- **blur yok, hicbir breakpoint'te yok**
- Border yok, sadece soft shadow
- Font: Poppins (mevcut)
- Renkler: `landing-purple-dark` basliklar, `foreground/70` linkler, `landing-pink` hover efektleri
- Footer her 3 public sayfada gorunecek (Landing, Bizimle Calisin, Gizlilik Politikasi)
- Site ici linkler (Policy, Work-with-us) ayni sekmede acilir (`<Link to="...">`), sosyal medya linkleri yeni sekmede acilir (`target="_blank" rel="noopener noreferrer"`)
- Copyright yili dinamik: `new Date().getFullYear()`
- **Sadece WhatsApp ve Instagram ikonlari gosterilecek. Facebook tamamen yok -- gosterilmeyecek, placeholder yok, kosul yok.**
- Sosyal URL'ler ContactSection.tsx'teki mevcut kaynaklardan alinacak:
  - WhatsApp: `https://wa.me/905306792831`
  - Instagram: `https://instagram.com/englishwithdilarateacher`
- Ikon gorselleri mevcut asset'lerden: `whatsappLogo.png`, `instagramLogo.png`

### Bizimle Calisin Sayfasi
- ContactSection'daki form karti bire bir kopyalanacak (pembe cerceve + beyaz/lila ic panel + mor inputlar + sari buton)
- Gingham arkaplan devam edecek (`landing-body` class'i)
- Formspree FormData ile POST entegrasyonu (configurable endpoint)
- **Form uncontrolled olacak** (`name` attribute'leri ile). `e.currentTarget.reset()` guvenle calisir.
- Submit sonrasi: buton metni degisir, 2-3 sn sonra normale doner
- **Endpoint guvenlik kontrolu:** `YOUR_FORM_ID` iceriyorsa submit engellenir + `console.warn` + kullaniciya toast: "Form su an aktif degil / The form is not active at the moment."

### Gizlilik Politikasi Sayfasi
- Soft card yapisi (sabit gorunur kartlar, accordion degil)
- `landing-purple/20` arkaplan kartlari
- Gingham arkaplan devam edecek
- **"Son guncelleme" satiri yok. `PRIVACY_POLICY_LAST_UPDATED` constant'i eklenmeyecek. `translations.privacyPolicy.lastUpdated` alani eklenmeyecek.**
- Sayfa yapisi: Baslik + 7 soft-card bolum (TR/EN)
- Ucuncu taraflar bolumunde sadece kesin kullanilan servisler
- Guvenlik bolumunde kesin teknik iddia yok, genel ifade
- Metinler kisa: her bolum 2-4 cumle

---

## 2. Route Listesi ve Navigation

| Route | Sayfa | Footer'dan Link | Header'dan Link |
|---|---|---|---|
| `/` | LandingPage | -- | Logo (mevcut) |
| `/bizimle-calisin` | WorkWithUsPage | TR: "Bizimle Calisin" / EN: "Work with Us" (ayni sekme) | -- |
| `/gizlilik-politikasi` | PrivacyPolicyPage | TR: "Gizlilik Politikasi" / EN: "Privacy Policy" (ayni sekme) | -- |
| `/login` | AuthForm | -- | Giris yap (mevcut) |
| `/dashboard` | DashboardRoutes | -- | -- |

Her iki sayfa da `LanguageProvider` ile sarilacak.

---

## 3. Component Listesi

| Component | Dosya | Aciklama |
|---|---|---|
| `Footer` | `src/components/landing/Footer.tsx` | 3 kolonlu footer |
| `WorkWithUsPage` | `src/pages/WorkWithUsPage.tsx` | Bizimle calisin sayfasi |
| `PrivacyPolicyPage` | `src/pages/PrivacyPolicyPage.tsx` | Gizlilik politikasi sayfasi |

**Degisecek dosyalar:**
- `src/App.tsx`: 2 yeni route
- `src/lib/translations.ts`: footer, workWithUs, privacyPolicy cevirileri
- `src/pages/LandingPage.tsx`: Footer render + route state scroll + useRef guard
- `src/components/landing/LandingHeader.tsx`: scrollToSection cross-page fallback + useNavigate

---

## 4. Footer Detayli Tasarim

```text
+------------------------------------------------------------------+
|  [logo.webp]    |  Bizimle Çalışın        |  [WA] [IG]           |
|  (küçük, ~h-12) |  Gizlilik Politikası    |                      |
|                 |                          |  [Google Play btn]   |
|                 |                          |  (disabled, Yakında) |
|                 |                          |  [App Store btn]     |
|                 |                          |  (disabled, Yakında) |
+------------------------------------------------------------------+
|  © {yıl} English with Dilara. Tüm hakları saklıdır.             |
+------------------------------------------------------------------+
```

- Sol kolon: `logo.webp` (h-12, object-contain)
- Orta kolon: `<Link>` ile `/bizimle-calisin` ve `/gizlilik-politikasi` (ayni sekmede)
- Sag kolon:
  - **Sadece WhatsApp ve Instagram** -- `target="_blank" rel="noopener noreferrer"` ile yeni sekmede
  - WhatsApp URL: `https://wa.me/905306792831` (ContactSection ile ayni)
  - Instagram URL: `https://instagram.com/englishwithdilarateacher` (ContactSection ile ayni)
  - Ikon gorselleri: `/uploads/whatsappLogo.png`, `/uploads/instagramLogo.png` (mevcut asset'ler)
  - **Facebook yok -- hicbir sekilde gosterilmeyecek**
  - Store butonlari: disabled, `opacity-60 cursor-not-allowed`, "Yakinda" / "Coming Soon" etiketi
- Mobil: `flex-col items-center text-center`, `gap-8`
- Arkaplan: `bg-white/70`, blur yok

---

## 5. Header Cross-Page Navigation

1. `LandingHeader.tsx`'deki `scrollToSection`:
   - Section varsa `scrollIntoView({ behavior: 'smooth' })`
   - Yoksa `navigate('/', { state: { scrollTo: id } })`

2. `LandingPage.tsx`'de `useRef` guard ile tek seferlik scroll:
   - `scrollHandled = useRef(false)` ile cift scroll onlenir
   - State temizlemesi: `navigate(location.pathname, { replace: true, state: {} })`

---

## 6. Bizimle Calisin Form Detaylari

**Uncontrolled form** -- input'lar `name` attribute ile, `value=` state'e baglanmaz.

| Alan | name | Type | Placeholder TR | Placeholder EN | Validation |
|---|---|---|---|---|---|
| Ad Soyad | fullName | text | Ad Soyad | Full Name | required |
| Yas | age | text | Yaş | Age | required, inputMode="numeric" |
| Universite | university | text | Üniversite | University | required |
| Bolum | department | text | Bölüm | Department | required |
| E-posta | email | email | E-posta | Email | required, type="email" |
| Telefon | phone | tel | Telefon Numaranız | Your Phone Number | required, inputMode="numeric" |

- Buton: Sari gradient
- Submit sonrasi buton metni degisir, 2-3 sn sonra normale doner
- Basarili gonderimde `e.currentTarget.reset()`
- Endpoint `YOUR_FORM_ID` iceriyorsa submit engellenir + console.warn + toast: "Form su an aktif degil / The form is not active at the moment."

---

## 7. Formspree Entegrasyon

```typescript
const FORMSPREE_ENDPOINT = "https://formspree.io/f/YOUR_FORM_ID";
```

- Endpoint kontrolu: `YOUR_FORM_ID` iceriyorsa `console.warn("[WorkWithUs] Formspree endpoint henuz yapilandirilmamis!")` + toast mesaji (`formNotReady` key'i ile: TR: "Form su an aktif degil." / EN: "The form is not active at the moment.") + return
- FormData ile POST: `new FormData(e.currentTarget)`, headers: `{ Accept: 'application/json' }`
- Basari: toast success + form reset + buton gecici degisim
- Hata: toast error

---

## 8. Gizlilik Politikasi Icerik -- Tam TR/EN Metinler

**"Son guncelleme" satiri YOK. Constant YOK. Translation key YOK.**

Sayfa yapisi: Baslik (TR: "Gizlilik Politikasi" / EN: "Privacy Policy") + 7 soft-card bolum.

Her kart `bg-landing-purple/20 rounded-2xl p-4 md:p-5`.

### Bolum 1: Topladigimiz Bilgiler / Information We Collect
- **TR:** Iletisim ve basvuru formlari araciligiyla ad soyad, e-posta, telefon ve yas bilgisi toplamaktayiz. Bu bilgiler yalnizca sizin tarafinizdan formlara girildiginde alinir.
- **EN:** We collect your full name, email address, phone number, and age through our contact and application forms. This information is only collected when you voluntarily submit it via our forms.

### Bolum 2: Bilgileri Ne Amacla Kullaniyoruz / How We Use Your Information
- **TR:** Toplanan bilgiler yalnizca sizinle iletisime gecmek, ders ve basvuru sureclerini yonetmek ve hizmet kalitemizi artirmak amaciyla kullanilir.
- **EN:** The information we collect is used solely to contact you, manage lesson and application processes, and improve the quality of our services.

### Bolum 3: Ucuncu Taraflar / Third Parties
- **TR:** Form verileriniz Formspree araciligiyla iletilmektedir. WhatsApp ve Instagram baglantilari sizi ilgili platformlara yonlendirir; bu platformlarin kendi gizlilik politikalari gecerlidir. Gelecekte ek hizmetler kullanilmasi durumunda bu politika guncellenecektir.
- **EN:** Your form data is transmitted via Formspree. Our WhatsApp and Instagram links redirect you to the respective platforms, which are governed by their own privacy policies. Should additional services be used in the future, this policy will be updated accordingly.

### Bolum 4: Veri Saklama Suresi / Data Retention
- **TR:** Kisisel verileriniz hizmet suresince ve makul bir sure boyunca saklanir. Artik gerekli olmadiginda guvenli bir sekilde silinir.
- **EN:** Your personal data is retained for the duration of our services and for a reasonable period thereafter. It is securely deleted once it is no longer required.

### Bolum 5: Guvenlik / Security
- **TR:** Verilerinizi korumak icin makul teknik ve organizasyonel onlemler uygulariz.
- **EN:** We implement reasonable technical and organisational measures to protect your data.

### Bolum 6: Kullanici Haklari / Your Rights
- **TR:** Kisisel verilerinize erisim, duzeltme veya silme talebinde bulunabilirsiniz. Talepleriniz icin asagidaki iletisim adresinden bize ulasabilirsiniz.
- **EN:** You may request access to, correction of, or deletion of your personal data. Please contact us using the details below to submit your request.

### Bolum 7: Iletisim / Contact
- **TR:** Gizlilik politikamiz hakkindaki sorulariniz icin dilarasirlan30@gmail.com adresinden bize ulasabilirsiniz.
- **EN:** For any questions regarding our privacy policy, please contact us at dilarasirlan30@gmail.com.

---

## 9. translations.ts Eklemeleri -- Tam Icerik

```text
footer: {
  workWithUs:        { tr: 'Bizimle Çalışın',          en: 'Work with Us' },
  privacyPolicy:     { tr: 'Gizlilik Politikası',      en: 'Privacy Policy' },
  downloadGooglePlay:{ tr: "Google Play'den İndir",     en: 'Get it on Google Play' },
  downloadAppStore:  { tr: "App Store'dan İndir",       en: 'Download on the App Store' },
  comingSoon:        { tr: 'Yakında',                   en: 'Coming Soon' },
  copyright:         { tr: 'Tüm hakları saklıdır.',     en: 'All rights reserved.' },
},

workWithUs: {
  title:     { tr: 'Bizimle Çalışın',    en: 'Work with Us' },
  fullName:  { tr: 'Ad Soyad',           en: 'Full Name' },
  age:       { tr: 'Yaş',                en: 'Age' },
  university:{ tr: 'Üniversite',          en: 'University' },
  department:{ tr: 'Bölüm',              en: 'Department' },
  email:     { tr: 'E-posta',            en: 'Email' },
  phone:     { tr: 'Telefon Numaranız',   en: 'Your Phone Number' },
  submit:    { tr: 'Gönder',             en: 'Submit' },
  submitted: { tr: 'Gönderildi ✓',       en: 'Submitted ✓' },
  note: {
    tr: 'Başvurunuzu aldıktan sonra en kısa sürede sizinle iletişime geçeceğiz.',
    en: 'After receiving your application, we will contact you as soon as possible.',
  },
  success: {
    tr: 'Başvurunuz başarıyla gönderildi!',
    en: 'Your application has been submitted successfully!',
  },
  error: {
    tr: 'Bir hata oluştu, lütfen tekrar deneyin.',
    en: 'An error occurred, please try again.',
  },
  formNotReady: {
    tr: 'Form şu an aktif değil.',
    en: 'The form is not active at the moment.',
  },
},

privacyPolicy: {
  title: { tr: 'Gizlilik Politikası', en: 'Privacy Policy' },
  sections: [
    {
      title:   { tr: 'Topladığımız Bilgiler',        en: 'Information We Collect' },
      content: {
        tr: 'İletişim ve başvuru formları aracılığıyla ad soyad, e-posta, telefon ve yaş bilgisi toplamaktayız. Bu bilgiler yalnızca sizin tarafınızdan formlara girildiğinde alınır.',
        en: 'We collect your full name, email address, phone number, and age through our contact and application forms. This information is only collected when you voluntarily submit it via our forms.',
      },
    },
    {
      title:   { tr: 'Bilgileri Ne Amaçla Kullanıyoruz', en: 'How We Use Your Information' },
      content: {
        tr: 'Toplanan bilgiler yalnızca sizinle iletişime geçmek, ders ve başvuru süreçlerini yönetmek ve hizmet kalitemizi artırmak amacıyla kullanılır.',
        en: 'The information we collect is used solely to contact you, manage lesson and application processes, and improve the quality of our services.',
      },
    },
    {
      title:   { tr: 'Üçüncü Taraflar',              en: 'Third Parties' },
      content: {
        tr: 'Form verileriniz Formspree aracılığıyla iletilmektedir. WhatsApp ve Instagram bağlantılarımız sizi ilgili platformlara yönlendirir; bu platformların kendi gizlilik politikaları geçerlidir. Gelecekte ek hizmetler kullanılması durumunda bu politika güncellenecektir.',
        en: 'Your form data is transmitted via Formspree. Our WhatsApp and Instagram links redirect you to the respective platforms, which are governed by their own privacy policies. Should additional services be used in the future, this policy will be updated accordingly.',
      },
    },
    {
      title:   { tr: 'Veri Saklama Süresi',           en: 'Data Retention' },
      content: {
        tr: 'Kişisel verileriniz hizmet süresince ve makul bir süre boyunca saklanır. Artık gerekli olmadığında güvenli bir şekilde silinir.',
        en: 'Your personal data is retained for the duration of our services and for a reasonable period thereafter. It is securely deleted once it is no longer required.',
      },
    },
    {
      title:   { tr: 'Güvenlik',                      en: 'Security' },
      content: {
        tr: 'Verilerinizi korumak için makul teknik ve organizasyonel önlemler uygularız.',
        en: 'We implement reasonable technical and organisational measures to protect your data.',
      },
    },
    {
      title:   { tr: 'Kullanıcı Hakları',             en: 'Your Rights' },
      content: {
        tr: 'Kişisel verilerinize erişim, düzeltme veya silme talebinde bulunabilirsiniz. Talepleriniz için aşağıdaki iletişim adresinden bize ulaşabilirsiniz.',
        en: 'You may request access to, correction of, or deletion of your personal data. Please contact us using the details below to submit your request.',
      },
    },
    {
      title:   { tr: 'İletişim',                      en: 'Contact' },
      content: {
        tr: 'Gizlilik politikamız hakkındaki sorularınız için dilarasirlan30@gmail.com adresinden bize ulaşabilirsiniz.',
        en: 'For any questions regarding our privacy policy, please contact us at dilarasirlan30@gmail.com.',
      },
    },
  ],
},
```

---

## 10. Responsive Kurallari

| Element | Desktop (lg+) | Tablet (md) | Mobil (<md) |
|---|---|---|---|
| Footer kolonlar | 3 kolon yan yana | 3 kolon (daraltilmis) | Tek kolon, alt alta, `text-center` |
| Footer store butonlari | Yan yana, disabled | Yan yana, disabled | Yan yana (kucuk), disabled |
| Bizimle Calisin form | Ortalanmis, max-w-[400px] | Ayni | `w-[calc(100%-1rem)]` kenar bosluklu |
| Privacy Policy kartlari | max-w-3xl ortalanmis | Ayni | Tam genislik, px-4 |
| Header | Mevcut (degismez) | Mevcut | Mevcut |

Horizontal scroll olmayacak: `overflow-x-hidden`, store butonlarinda `flex-wrap`.

---

## 11. Form Validasyonu

- Tum alanlar `required`
- E-posta: `type="email"` (tarayici native)
- Telefon: `inputMode="numeric"` + opsiyonel `pattern="[0-9]*"`
- Yas: `inputMode="numeric"`
- Submit butonunda loading state: disabled + spinner
- Bos/gecersiz alanlarda tarayicinin native hata mesajlari

---

## 12. Test Checklist

### Desktop
- [ ] Footer 3 kolon gorunuyor, bg-white/70, blur yok, soft shadow var
- [ ] Footer linkleri ayni sekmede dogru route'lara gidiyor
- [ ] WhatsApp ikonu gorunuyor, `https://wa.me/905306792831` adresine yeni sekmede gidiyor, `rel="noopener noreferrer"` var
- [ ] Instagram ikonu gorunuyor, `https://instagram.com/englishwithdilarateacher` adresine yeni sekmede gidiyor, `rel="noopener noreferrer"` var
- [ ] Facebook ikonu **hicbir sekilde** gosterilmiyor
- [ ] Store butonlari disabled, "Yakinda" / "Coming Soon" etiketi var
- [ ] Copyright yili dinamik
- [ ] Bizimle Calisin formu pembe cerceve, mor inputlar
- [ ] Endpoint `YOUR_FORM_ID` iceriyorsa submit engelleniyor + console.warn + toast "Form su an aktif degil"
- [ ] Form submit FormData ile POST
- [ ] Submit sonrasi buton "Gonderildi ✓" / "Submitted ✓", 2-3 sn sonra normal
- [ ] Submit sonrasi form input'lari temizleniyor (uncontrolled reset)
- [ ] Success/error toast gorunuyor
- [ ] Gizlilik Politikasi 7 bolum gorunuyor
- [ ] Gizlilik Politikasi'nda "Son guncelleme / Last updated" satiri **yok**
- [ ] Guvenlik bolumunde genel ifade var, kesin teknik iddia yok
- [ ] TR/EN gecisi: footer, form placeholders, buton metinleri, privacy policy tamami degisiyor

### Mobil
- [ ] Footer tek kolon, ortalanmis
- [ ] Horizontal scroll yok
- [ ] Footer'da jank yok (blur yok)
- [ ] Form mobilde kenar bosluklari duzgun
- [ ] Privacy policy okunabilir
- [ ] Header butonlari WorkWithUs/Privacy'den Landing'e yonlendiriyor (route state + useRef guard)

### Form
- [ ] Bos form submit edilemiyor (required)
- [ ] E-posta kontrolu (type="email")
- [ ] Telefon/yas alanlarinda inputMode="numeric" (mobilde sayi klavyesi)
- [ ] Loading state'te buton disabled
- [ ] Basarili gonderimde form resetleniyor (uncontrolled)
- [ ] Placeholder endpoint ile submit denediginde "Form su an aktif degil" toast + console.warn

### Dil
- [ ] Footer TR: "Bizimle Calisin", "Gizlilik Politikasi", "Yakinda", "Tum haklari saklidir."
- [ ] Footer EN: "Work with Us", "Privacy Policy", "Coming Soon", "All rights reserved."
- [ ] Form TR placeholders: "Ad Soyad", "Yas", "Universite", "Bolum", "E-posta", "Telefon Numaraniz"
- [ ] Form EN placeholders: "Full Name", "Age", "University", "Department", "Email", "Your Phone Number"
- [ ] Form buton TR: "Gonder" -> "Gonderildi ✓"
- [ ] Form buton EN: "Submit" -> "Submitted ✓"
- [ ] Form not TR: "Basvurunuzu aldiktan sonra..."
- [ ] Form not EN: "After receiving your application..."
- [ ] Form not ready TR: "Form su an aktif degil."
- [ ] Form not ready EN: "The form is not active at the moment."
- [ ] Privacy TR basliklari: Topladigimiz Bilgiler, Bilgileri Ne Amacla Kullaniyoruz, Ucuncu Taraflar, Veri Saklama Suresi, Guvenlik, Kullanici Haklari, Iletisim
- [ ] Privacy EN basliklari: Information We Collect, How We Use Your Information, Third Parties, Data Retention, Security, Your Rights, Contact
- [ ] Privacy TR/EN icerik: tum 7 bolumun metni dil degisiminde degisiyor
- [ ] Store butonlari TR: "Google Play'den Indir", "App Store'dan Indir"
- [ ] Store butonlari EN: "Get it on Google Play", "Download on the App Store"

---

## 13. Olusacak/Degisecek Dosyalar Ozeti

### Yeni Dosyalar
| Dosya | Aciklama |
|---|---|
| `src/components/landing/Footer.tsx` | Footer (3 kolon, bg-white/70, blur yok, sadece WA+IG, Facebook yok, store disabled, tam TR/EN) |
| `src/pages/WorkWithUsPage.tsx` | Bizimle calisin (uncontrolled form, FormData POST, endpoint guard, tam TR/EN) |
| `src/pages/PrivacyPolicyPage.tsx` | Gizlilik politikasi (7 soft card, "son guncelleme" yok, tam TR/EN baslik + icerik) |

### Degisecek Dosyalar
| Dosya | Degisiklik |
|---|---|
| `src/App.tsx` | 2 yeni route (`/bizimle-calisin`, `/gizlilik-politikasi`) |
| `src/lib/translations.ts` | `footer`, `workWithUs`, `privacyPolicy` bloklari (tam TR/EN, `lastUpdated` yok) |
| `src/pages/LandingPage.tsx` | Footer render + route state scroll + useRef guard |
| `src/components/landing/LandingHeader.tsx` | scrollToSection cross-page fallback + useNavigate |

