

## Plan: Kitap 3D Görünüm Düzeltmesi + Tablet Taşma Sorunu

### Sorun Analizi

1. **3D görünüm kaybı**: `overflow: hidden` kaldırıldığında kitabın köşe elementleri (corner--a, corner--b) ve kapak dışındaki parçalar artık sınırlanmıyor. Asıl sorun, `transform-style: preserve-3d` var ama `perspective` tanımlı değil — bu da 3D derinlik hissini zayıflatıyor.

2. **Sağdaki siyah-beyaz şerit**: `.hero-book__pages` elementi. Dark mode'da `--page` rengi `hsl(222 20% 14%)` (çok koyu) ve gradient `var(--page)` → `#ffeef8` (açık pembe) arası gidiyor. Bu dark mode'da siyah-beyaz kontrast oluşturuyor.

3. **Tablet'te metin taşması**: Kitap 280px'e küçülüyor ama font boyutları aynı kalıyor.

### Yapılacaklar

#### 1. Kitaba gerçek 3D perspektif ekleme (`src/index.css`)

- `.hero-book-wrap`'a `perspective: 800px` eklenecek — bu tüm alt elementlere derinlik kazandırır
- `.hero-book`'a `transform-style: preserve-3d` zaten var, spine ve pages'e `translateZ()` değerleri eklenecek:
  - `.hero-book__spine`: `transform: translateZ(-12px)` — kapağın arkasında görünsün
  - `.hero-book__pages`: `transform: translateZ(-6px)` — kapakla sırt arasında
  - `.hero-book__cover`: `transform: translateZ(0)` — en önde
- Kapağa hafif `box-shadow` derinliği artırılacak

#### 2. Pages (sağ kenar) dark mode renk düzeltmesi

- Dark mode'da pages gradienti `var(--page)` → `#ffeef8` yerine, tamamen `--page` tonlarında olacak:
  ```css
  .dark .hero-book__pages {
    background: linear-gradient(180deg, hsl(260 20% 30%), hsl(260 15% 22%));
  }
  ```

#### 3. Spine dark mode renk uyumu
- Spine gradienti de dark mode'a uyumlu hale getirilecek

#### 4. Tablet font boyutu küçültme

- `@media (min-width: 768px) and (max-width: 1023px)` media query'sine kitap içi metin boyutları eklenecek:
  ```css
  .hero-book__english { font-size: 28px; }
  .hero-book__dilara { font-size: 28px; }
  .hero-book__lead { font-size: 14px; }
  .hero-book__sub { font-size: 12px; }
  .hero-book__content { inset: 22px; padding: 10px; gap: 8px; }
  ```

### Dosyalar
- `src/index.css` — Tüm değişiklikler burada yapılacak

