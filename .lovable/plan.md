
# Android Cihazlarda Yatay Tasma (Overflow) Sorununun Koekten Cozumu

## Sorunun Analizi

Tarayici gelistirici araclarinda "mobil gorunum" secildiginde sorun gorulmuyor, ancak gercek Android cihazlarda (ozellikle Capacitor WebView icinde) iletisim formu saga kayiyor veya sayfanin disina cikiyor.

**Kok Neden:** Android WebView ve bazi mobil tarayicilar, `body` uzerindeki `overflow-x: hidden` ozelligini her zaman dogru sekilde uygulamiyor. Sayfanin icindeki cesitli elementler gorunur alani astiginda, yatay kaydirma olusabiliyor. Bu durum, bilgisayar tarayicisinin "mobil gorunum" modunda fark edilmiyor cunku orada viewport davranisi farkli.

**Tasma yaratan elemanlar:**
1. **ValuesSection karuseli** — Kartlar `translateX(120%)`, `translateX(-120%)` gibi degerlerle gorunmez konumlara tasiniyor ama hala DOM'da yer kapliyor
2. **HeroBook** — Spine (`left: -14px`) ve pages (`right: -10px`) elemanlarinin negatif konumlanmasi
3. **StickyBubble** — `overflow-visible` ile burst partikullerinin ekran disina tasmasi
4. **BlogSection** — Embla carousel elemanlarinin `flex-[0_0_85%]` genislikleri
5. **ContactSection form** — `lg:mx-0` buyuk ekranda ortalama kaldirildiktan sonra grid icindeki konumlanma

## Cozum Plani

### 1. Global Overflow Korumasi — `index.html` ve `src/index.css`

`html` ve `#root` elementlerine `overflow-x: hidden` eklenerek tum sayfa genelinde yatay tasma engellenir. Bu, Android WebView'in `body` uzerindeki overflow'u yok saymasina karsi ikinci ve ucuncu savunma hatti olusturur.

- `index.html`: `<html>` etiketine `style="overflow-x:hidden"` eklenecek
- `src/index.css`: `#root` icin `overflow-x: hidden` kurali eklenecek
- `html` kuralina da acik `overflow-x: hidden` eklenecek (suan yorumla kaldirilmis durumda, geri getirilecek)

### 2. ContactSection Formu — `src/components/landing/ContactSection.tsx`

Form container'ina `lg:mx-auto` eklenerek tum ekran boyutlarinda ortalanmasi saglanacak. Grid icindeki konumlanma duzeltilecek.

### 3. ValuesSection Karuseli — `src/components/landing/ValuesSection.tsx`

Dis section'daki `overflow-hidden` zaten var. Karuselin kartlari icin ek `overflow-hidden` sinifi eklenecek — stage container'a clip yapisi uygulanacak.

### 4. StickyBubble — `src/components/landing/StickyBubble.tsx`

Burst partikullerinin dis container'ina `overflow-hidden` eklenecek, boylece animasyon parcaciklari ekran disina tasmayacak.

### 5. HeroBook CSS — `src/index.css`

`.hero-book-wrap` elementine `overflow: hidden` eklenecek, boylece spine ve pages'in negatif konumlanmasi disari tasmayacak.

---

## Degistirilecek Dosyalar

| Dosya | Degisiklik |
|---|---|
| `index.html` | `<html>` etiketine `style="overflow-x:hidden"` |
| `src/index.css` | `html` ve `#root` icin `overflow-x: hidden`, `.hero-book-wrap` icin `overflow: hidden` |
| `src/components/landing/ContactSection.tsx` | Form container'a `lg:mx-auto` eklenmesi |
| `src/components/landing/ValuesSection.tsx` | Stage container'a ek `overflow-hidden` korumalik |
| `src/components/landing/StickyBubble.tsx` | Burst particles container'a `overflow-hidden` |

Bu degisiklikler topluca uygulandiginda, hem mevcut iletisim formu sorunu hem de diger potansiyel tasma sorunlari site genelinde cozulecek.
