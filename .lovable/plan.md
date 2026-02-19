
# Pinkgingham Arka Plan — Sağdaki Dikey Çizgi Sorunu

## Sorunun Kökü

`html` ve `body` elementlerinde `background-attachment: fixed` kullanılıyor.

Bu özellik şu davranışı tetikler:
- Browser, scrollbar için viewport'un sağından **8px** alan ayırır
- `body` içeriği bu 8px'lik alanı kaybeder, ancak `fixed` arka plan **tam viewport genişliğini** kullanmaya devam eder
- Sonuç: `body`nin tile başlangıç noktası ile `html`nin tile başlangıç noktası hizalanmaz
- Gingham deseninin tekrar (tile) noktasında sağ kenarda dikey bir "dikiş" görünür

Ek sorun: `html` ve `body` **ikisi birden** aynı `background` tanımını taşıyor. Bu da iki katmanlı arka planın üst üste binmesine yol açabilir — özellikle scrollbar alanının 8px'lik farkıyla desenin yanlış hizalanmasına neden olur.

## Çözüm

### Değişiklik 1: `body`den background kaldır

Arka planı **sadece `html` elementinde** tanımla. `body`nin kendi background'u olmasın — zaten `html`den görünüyor.

```css
/* ÖNCE */
html {
  background: url("/uploads/pinkgingham.png") repeat;
  background-attachment: fixed;
}
body {
  background: url("/uploads/pinkgingham.png") repeat;
  background-attachment: fixed;
}

/* SONRA */
html {
  background: url("/uploads/pinkgingham.png") repeat;
  background-attachment: fixed;
}
body {
  /* background yok — html'den miras alır, çift katman ortadan kalkar */
}
```

### Değişiklik 2: `background-size` ile tam hizalama

`background-attachment: fixed` olduğunda, browser'ın tile boyutunu viewport'a göre hesaplaması gerekir. `background-size` ile görselin tam pixel boyutunu belirterek scrollbar genişliğinden kaynaklanan 1px'lik kaymaları ortadan kaldır.

Pinkgingham görseli `public/uploads/pinkgingham.png` — boyutunu kontrol et ve CSS'te açıkça yaz:

```css
html {
  background: url("/uploads/pinkgingham.png") repeat;
  background-attachment: fixed;
  background-size: auto; /* ya da görselin gerçek px boyutu: "200px 200px" gibi */
}
```

### Değişiklik 3: `overflow-x: hidden` ile tutarlılık

`html`'de `overflow-x: hidden` zaten var. `body`'de de bulunduğundan emin ol — bu, scrollbar'ın yarattığı genişlik farkını minimize eder.

## Etkilenen Dosya

**`src/index.css`** — satır 215-232 arası:

- `body { background: ... background-attachment: fixed; }` bloğu kaldırılır (ikinci `body` bloğu, satır 226-232)
- `html` bloğunda `background-size: auto` açıkça eklenir
- `body`'ye `background: transparent` eklenerek üst üste binme tamamen engellenir

## Özet

| Adım | Değişiklik |
|---|---|
| `body` background kaldır | Çift katmanlı tile üst üste binmesi ortadan kalkar |
| `background-size: auto` ekle | Tile hizalaması viewport genişliğinde tutarlı kalır |
| `body { background: transparent }` | `html` arka planı temiz görünür, iki kaynak çakışmaz |

Etkilenen dosya sayısı: 1 — `src/index.css`, ~5 satır değişiklik.
