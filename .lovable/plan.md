

# Footer Yeniden Tasarim Plani (Duzeltmeler Dahil)

## Degisecek Dosyalar

| Dosya | Degisiklik |
|---|---|
| `src/components/landing/Footer.tsx` | Tamamen silinip sifirdan yazilacak |
| `src/lib/translations.ts` | `footer` bloguna `tagline` key'i eklenecek |

Footer component'i sifirdan yazilacak. Gerekirse sadece footer'in render edildigi yerlerde (LandingPage, WorkWithUsPage, PrivacyPolicyPage) minimal import/usage duzeltmesi yapilabilir. (Mevcut import zaten `Footer` adi ile yapildigi icin buyuk ihtimalle degisiklik gerekmeyecek.)

---

## Yeni Footer Tasarimi

### Genel Yapi

Footer iki katmanli olacak:

```text
+----------------------------------------------------------------------+
|  [logo.webp]              |  Bizimle Calisin    |  (IG) (WA)        |
|  Online Ingilizce         |  Gizlilik           |                    |
|  dersleri . Cocuk &       |  Politikasi         |  [Google Play]     |
|  Yetiskin                 |                     |  (disabled)        |
|                           |                     |  [App Store]       |
|                           |                     |  (disabled)        |
+----------------------------------------------------------------------+
|  ince pembe/lila divider                                             |
|  (c) {dynamic year} English with Dilara. Tum haklari saklidir.      |
+----------------------------------------------------------------------+
```

### Arkaplan ve Genel Stil

- Arkaplan: **Solid toz pembe** `bg-[#FAD6E6]` -- transparent/blur/cam efekti kesinlikle yok
- Tam genislikli section, gingham arkaplanin ustune "kart" gibi degil
- Padding: `py-10`, icerik `max-w-6xl mx-auto px-6`
- Font: Poppins
- Metin rengi: Koyu mor `text-[#4A2040]` (cok sert siyah degil)

### Sol Kolon: Logo + Tagline

- `logo.webp` (h-12, object-contain), `<Link to="/">`
- Altinda tagline:
  - TR: "Online Ingilizce dersleri . Cocuk & Yetiskin"
  - EN: "Online English lessons . Kids & Adults"
  - Stil: `text-sm text-[#4A2040]/70`

### Orta Kolon: Linkler

- `/bizimle-calisin` ve `/gizlilik-politikasi` (ayni sekmede, `<Link>`)
- Normal: koyu mor metin
- Hover: `text-landing-pink` + `hover:underline underline-offset-4`
- Font: `font-medium text-sm`

### Sag Kolon: Sosyal Ikonlar + Store Butonlari

**Sosyal Ikonlar:**

- Orijinal PNG logolar **kullanilmayacak**
- Lucide outline ikonlar:
  - Instagram: `Instagram` ikonu (lucide-react)
  - WhatsApp: `MessageCircle` ikonu + **tooltip ile "WhatsApp" yazisi** (hover'da gorunur, ayrica `aria-label="WhatsApp"` ile erisilebilirlik)
- Tooltip yaklasimiyla kullanici "bu ne" demez: ikon ustune gelince kucuk bir label belirir
- Her ikon ozel daire buton icinde:
  - Boyut: `w-10 h-10` (40px) `rounded-full`
  - Arkaplan: **`bg-[#FFF0F6]`** (footer arkaplanindan belirgin sekilde daha acik, neredeyse beyaza yakin pembe)
  - Border: **`border border-[#D98BB5]`** (daha belirgin border, butonlarin kaybolmasini onler)
  - Golge: `shadow-sm`
  - Ikon rengi: `text-[#4A2040]` (koyu mor)
  - Hover: `hover:bg-[#FFE0EE]` (bir tik koyulasir) + `hover:text-[#7C2D6B]` (ikon canlilasir)
  - Transition: `transition-colors duration-200`
- URL'ler:
  - WhatsApp: `https://wa.me/905306792831`
  - Instagram: `https://instagram.com/englishwithdilarateacher`
- `target="_blank" rel="noopener noreferrer"`
- Facebook **tamamen yok**

**Renk kontrasti notu:** Footer arka plani `#FAD6E6`, ikon buton arka plani `#FFF0F6` (belirgin sekilde daha acik). Border `#D98BB5` (daha koyu pembe) ile butonlar net sekilde ayirt edilir. "Plastik gibi" gorunme riski ortadan kalkar.

**Store Butonlari:**

- `<button>` elementi (link degil, `href="#"` yok)
- `onClick={e => e.preventDefault()}`
- Kucuk pill seklinde: `rounded-xl px-4 py-2`
- Icinde kucuk ikon + metin:
  - Google Play: `Smartphone` ikonu + TR/EN metin
  - App Store: `Smartphone` ikonu + TR/EN metin (her iki store butonu ayni ikon ailesinden `Smartphone` kullanacak -- lucide'da Apple ikonu yok, sartli/belirsiz ikon secimi yapilmayacak)
- Arkaplan: `bg-[#FFF0F6]` (ikon butonlariyla ayni)
- Border: `border border-[#D98BB5]`
- Disabled: `opacity-60 cursor-not-allowed`
- Altinda: TR "Yakinda" / EN "Coming Soon" (`text-[10px]`)

### Alt Katman: Divider + Copyright

- Divider: `border-t border-[#E9AFCB]/40`
- Copyright: `(c) {new Date().getFullYear()} English with Dilara. {TR/EN}`
- Metin: `text-sm text-[#4A2040]/60`

### Mobil Davranis

- Tek kolon: `flex-col items-center text-center`
- Sira: Logo+tagline, Linkler (alt alta), Ikonlar (yan yana), Store butonlari
- `gap-6`, `flex-wrap`
- Horizontal scroll yok

---

## translations.ts Degisiklik

Mevcut `footer` bloguna tek ek:

```text
tagline: {
  tr: 'Online İngilizce dersleri • Çocuk & Yetişkin',
  en: 'Online English lessons • Kids & Adults',
},
```

Diger mevcut footer key'leri (workWithUs, privacyPolicy, downloadGooglePlay, downloadAppStore, comingSoon, copyright) aynen kalacak.

---

## Test Checklist

### Desktop
- [ ] Footer solid toz pembe arkaplan (`#FAD6E6`), transparent/blur yok
- [ ] 3 kolon duzgun hizalanmis
- [ ] Tagline TR/EN degisiyor
- [ ] Linkler ayni sekmede, hover'da pembe + underline
- [ ] Sosyal ikonlar: Lucide outline stil, daire butonlar, `#FFF0F6` arkaplan, `#D98BB5` border
- [ ] Butonlar footer arkaplanindan belirgin sekilde ayirt ediliyor (kaybolmuyor)
- [ ] WhatsApp ikonu (MessageCircle) hover'da tooltip "WhatsApp" gosteriyor
- [ ] Instagram ikonu hover'da tooltip "Instagram" gosteriyor
- [ ] Orijinal PNG logolar kullanilmiyor
- [ ] Linkler yeni sekmede, `rel="noopener noreferrer"` var
- [ ] Facebook hicbir sekilde yok
- [ ] Store butonlari `<button>`, disabled, "Yakinda"/"Coming Soon" etiketi, her ikisi de `Smartphone` ikonu
- [ ] Ince divider copyright ustunde
- [ ] Copyright yili dinamik (`new Date().getFullYear()`)

### Mobil
- [ ] Tek kolon, ortalanmis
- [ ] Horizontal scroll yok
- [ ] Tum elementler orantili

### Dil
- [ ] Tum footer metinleri TR/EN gecisinde degisiyor
