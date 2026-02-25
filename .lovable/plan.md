

# Blog Sayfasi ve Sayfa Gecisleri Iyilestirmesi

## Istekler Listesi

1. **Sayfalar arasi scroll-to-top**: Herhangi bir sayfadan baska bir sayfaya gecildiginde, yeni sayfa en ustten baslamali
2. **Blog sayfasina LandingHeader eklenmesi**: Ana sayfa, Gizlilik Politikasi ve Bizimle Calisin sayfalarindaki ayni header kullanilmali
3. **Blog sayfasina Footer eklenmesi**: Diger sayfalardaki ayni footer kullanilmali
4. **Blog basliginin ortada ve mor renkte olmasi**: Gizlilik Politikasi sayfasindaki gibi `text-landing-purple-dark text-center`
5. **Blog basliginin fontu**: Gizlilik Politikasi sayfasiyla ayni font (mevcut `font-aprilia` kaldirilacak, diger sayfalarla eslesen `font-bold` kalacak)
6. **"Ana Sayfa" geri butonunun kaldirilmasi**: Blog sayfasindaki custom header ve geri butonu tamamen kaldirilacak
7. **BlogPostPage icin ayni degisiklikler**: Blog yazi detay sayfasi da ayni LandingHeader + Footer yapisina kavusacak, custom header ve geri butonlari kaldirilacak
8. **Hizli sayfa gecisi**: Sayfalar arasi gecis aninda gecikme olmamali

---

## Teknik Plan

### Degisiklik 1: Scroll-to-top — `src/App.tsx`

BrowserRouter icine bir `ScrollToTop` componenti eklenecek. Bu component `useLocation` ile her route degisiminde `window.scrollTo(0, 0)` calistiracak.

```typescript
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
```

Not: LandingPage'deki `scrollTo` state mekanizmasi zaten ayri calisiyor ve bu degisiklikle catismaz — o sayfa mount sonrasi belirli bir bolume kaydirir.

### Degisiklik 2: `src/pages/BlogPage.tsx` — Tam yeniden yapilandirma

- Custom header (logo + geri butonu) tamamen kaldirilacak
- `LanguageProvider` + `LandingHeader` + `Footer` eklenecek
- `landing-body` class'i eklenecek (pinkgingham arka plan)
- Baslik: `text-3xl md:text-4xl font-bold text-landing-purple-dark text-center mb-8`
- Alt yazi kaldirilacak veya ayni stilde tutulacak
- `pt-28 md:pt-32` padding (fixed header icin bosluk — diger sayfalarla ayni)

### Degisiklik 3: `src/pages/BlogPostPage.tsx` — Ayni yapilandirma

- Custom header (logo + "Blog'a don" linki) kaldirilacak
- `LanguageProvider` + `LandingHeader` + `Footer` eklenecek
- `landing-body` class'i eklenecek
- Icerik alani ayni kalacak, sadece wrapper degisecek
- Alt kisimda "Blog'a don" linki kalabilir (icerik ici navigasyon olarak)

---

## Degistirilecek Dosyalar

| Dosya | Degisiklik |
|---|---|
| `src/App.tsx` | `ScrollToTop` componenti ekle, `useLocation` ve `useEffect` import'lari |
| `src/pages/BlogPage.tsx` | Custom header kaldir, LandingHeader + Footer + LanguageProvider ekle, baslik stilini guncelle |
| `src/pages/BlogPostPage.tsx` | Custom header kaldir, LandingHeader + Footer + LanguageProvider ekle |

