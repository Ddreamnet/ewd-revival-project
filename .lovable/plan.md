

# Footer Sifirdan Yeniden Tasarim Plani

## Hedef

Mevcut "default template" gorunumlu footer'i tamamen silip, ana sayfanin pink gingham + pastel pembe/lila + sticker estetigine bire bir uyumlu, modern ve marka hissi veren bir "footer section" olarak sifirdan yazmak.

## Tasarim Konsepti

Footer duz bir bar degil; ana sayfadaki kartlarin (WhySection, ContactSection) gorunum dilini tasiyan bir **yumusak panel** olacak.

### Container
- Gingham arkaplanin uzerinde duran buyuk yuvarlak koseli panel: `rounded-3xl`
- Panel arka plan: `bg-white/70` (blur yok -- performans guvenli)
- Cok hafif shadow: `shadow-xl` (sticker-card hissi)
- Panelin icinde bolca bosluk (nefes alan tasarim): `py-10 px-6 md:px-10`
- Panelin sayfanin kenarlarindan biraz icerde durmasi icin: `mx-4 md:mx-8 lg:mx-auto max-w-6xl mb-8`
- Panelin ustunde opsiyonel 2-3 minik sparkle/yildiz dekorasyonu (WhySection'daki gibi, Sparkles/Star Lucide ikonu ile, `text-landing-yellow opacity-50`, kucuk boyut)

### Ic Layout (Desktop -- 3 Blok Grid)
`grid grid-cols-1 md:grid-cols-3 gap-8 items-start`

**Sol Blok -- Logo + Tagline**
- `logo.webp` (h-12, object-contain, Link to="/")
- Altinda 1 satirlik tagline:
  - TR: "Online Ingilizce dersleri - Cocuk & Yetiskin"
  - EN: "Online English lessons - Kids & Adults"
- Tagline stili: `text-sm text-foreground/60 mt-2`

**Orta Blok -- Linkler ("pill button" stili)**
- 2 link dikey sirali, her biri bir "pill" icerisinde:
  - `<Link to="/bizimle-calisin">` ve `<Link to="/gizlilik-politikasi">`
  - Pill stili: `inline-block px-5 py-2 rounded-full bg-landing-purple/15 text-foreground/70 font-medium text-sm hover:bg-landing-pink/30 hover:text-landing-purple-dark transition-colors`
  - Aralarinda `gap-3`

**Sag Blok -- Sosyal Ikonlar + Store Butonlari**
- Sosyal ikonlar: WhatsApp ve Instagram (Facebook yok)
  - "Rounded sticker icon button" stili: `w-10 h-10 rounded-xl bg-landing-purple/15 flex items-center justify-center hover:bg-landing-pink/30 transition-colors`
  - Icindeki ikon gorselleri: `/uploads/whatsappLogo.png` ve `/uploads/instagramLogo.png` (`w-5 h-5`)
  - URL'ler: `https://wa.me/905306792831` ve `https://instagram.com/englishwithdilarateacher`
  - `target="_blank" rel="noopener noreferrer"`
  - Yan yana: `flex items-center gap-3`
- Store butonlari (disabled):
  - Sosyal ikonlarin altinda, yan yana
  - Her biri: `flex flex-col items-center`
  - Buton: `px-4 py-2 rounded-xl bg-landing-purple/10 text-foreground/40 text-xs font-medium opacity-60 cursor-not-allowed`
  - Altinda kucuk etiket: "Yakinda" / "Coming Soon" (`text-[10px] text-foreground/40`)

### Mobil Layout
- `grid-cols-1`, tum icerik ortalanmis (`text-center items-center`)
- Logo + tagline ortalanmis
- Pill linkler tam genislik (ama max-w-xs ile sinirli)
- Sosyal ikonlar yan yana ortalanmis
- Store butonlari yan yana, kucuk, tasmadan

### Copyright Satiri
- Panelin icinde, icerik bloklarinin altinda
- Ince ayirici: `border-t border-landing-purple/15 mt-8 pt-6`
- Metin: `text-xs text-foreground/40 text-center`
- Dinamik yil: `new Date().getFullYear()`

### Sparkle Dekorasyonu
- Panelin sol ust kosesine yakin 1 adet `Star` ikonu (Lucide), `text-landing-yellow opacity-40 w-5 h-5`
- Panelin sag ust kosesine yakin 1 adet `Sparkles` ikonu, `text-landing-pink opacity-40 w-4 h-4`
- Absolute konumlandirilmis, panelin `relative` container'i icinde

---

## translations.ts Eklemesi

Mevcut `footer` blogunun icine yeni key:

```
tagline: { tr: 'Online İngilizce dersleri • Çocuk & Yetişkin', en: 'Online English lessons • Kids & Adults' },
```

Diger mevcut footer key'leri aynen kalacak (workWithUs, privacyPolicy, comingSoon, copyright vb.).

---

## Degisecek Dosyalar

| Dosya | Degisiklik |
|---|---|
| `src/components/landing/Footer.tsx` | Tamamen sifirdan yeniden yazilacak (mevcut icerik silinip yeni tasarim) |
| `src/lib/translations.ts` | `footer.tagline` key'i eklenecek (TR/EN) |

Baska hicbir dosya degismeyecek. Route'lar, LandingPage, Header, WorkWithUs, PrivacyPolicy -- hepsi aynen kalacak.

---

## Teknik Detaylar

- Blur yok (hicbir breakpoint'te)
- Facebook yok (hicbir sekilde)
- WhatsApp/Instagram URL'leri projede mevcut olan ayni URL'ler
- Tum linkler ve butonlar keyboard-accessible (focusable, focus-visible ring)
- Horizontal scroll yok
- Poppins font (mevcut, degismez)
- Tum metinler TR/EN (`useLanguage` hook ile)

---

## Test Kontrol Listesi

- [ ] Footer gingham uzerinde yuvarlak koseli panel olarak gorunuyor
- [ ] Sparkle dekorlari gorsel olarak mevcut
- [ ] Logo tiklanabilir ve ana sayfaya gidiyor
- [ ] Tagline TR/EN degisiyor
- [ ] Pill linkler hover'da pembe vurgulu
- [ ] WhatsApp/Instagram ikonlari sticker-button gorunumunde
- [ ] Store butonlari disabled + "Yakinda/Coming Soon"
- [ ] Copyright dinamik yil
- [ ] Mobilde tek kolon, ortalanmis, horizontal scroll yok
- [ ] TR/EN dil gecisi tum footer icerigi icin calisiyor
- [ ] Marka hissi: ana sayfanin sticker/pastel/card estetigiyle uyumlu

