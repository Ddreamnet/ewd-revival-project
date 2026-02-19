
# Pinkgingham Arka Plan — Gerçek Kök Neden Tespit Edildi

## Sorun: `100vw` Scrollbar Genişliğini Dahil Ediyor

Şu anda uygulanan `html::before` yaklaşımında:

```css
html::before {
  width: 100vw;
  height: 100vh;
  position: fixed;
  ...
}
```

`100vw` değeri **scrollbar genişliğini her zaman içerir** (scrollbar görünür olsun ya da olmasın, `100vw = layout viewport genişliği`). Ama `html` elementinde `overflow-x: hidden` var. Bu kombinasyon şunu yaratır:

- `html::before` scrollbar genişliği kadar (8-17px) dışarı taşar
- `overflow-x: hidden` bu taşmayı kırpar
- Gingham deseni tam sayfa genişliğini kaplamamış olur
- Sağ kenarda tile'ın başladığı yerde dikey çizgi görünür

Aynı zamanda ekran görüntülerinde net görülen çizgi, **pinkgingham.png'nin kendi doğal genişliğinin tile tekrar noktası ile viewport kenar farkından** kaynaklanıyor.

## Çözüm: `width: 100%` + `right: 0` Kullan, `overflow-x: hidden`'ı Kaldır

İki adımlı düzeltme:

### Adım 1: `html::before` için `width: 100vw` yerine `right: 0` kullan

```css
html::before {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  right: 0;      /* width: 100vw yerine right: 0 */
  bottom: 0;     /* height: 100vh yerine bottom: 0 */
  background: url("/uploads/pinkgingham.png") repeat;
  background-size: auto;
  z-index: -1;
  pointer-events: none;
}
```

`right: 0` + `left: 0` kombinasyonu `width: 100vw`'den farklı davranır: element **containing block'a** göre genişler, scrollbar dahil `100vw` hesaplaması yapılmaz. `position: fixed` olduğunda containing block viewport kendisi olur ve scrollbar alanını **doğal olarak** dışarıda bırakır.

### Adım 2: `html`'den `overflow-x: hidden` kaldır, `body`'de bırak

`overflow-x: hidden` sadece `body`'de kalacak. `html`'deki `overflow-x: hidden` `::before` pseudo-elementini etkileyip kırpıyordu.

```css
html {
  min-height: 100%;
  margin: 0;
  scroll-behavior: smooth;
  /* overflow-x: hidden kaldırıldı */
}
```

`body`'de zaten `overflow-x: hidden` var, bu yatay taşmayı engellemeye devam eder.

## Özet

| Değişiklik | Neden |
|---|---|
| `width: 100vw; height: 100vh` → `right: 0; bottom: 0` | `100vw` scrollbar genişliğini içerip taşmaya neden oluyordu |
| `html`'den `overflow-x: hidden` kaldır | `overflow-x: hidden` `::before`'u kırpıp tile sınırı oluşturuyordu |

Etkilenen dosya: 1 — `src/index.css`, ~5 satır değişiklik.
