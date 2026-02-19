
# Pinkgingham Dikey Çizgi — Gerçek Kök Neden ve Düzeltme

## Neden Önceki Düzeltme Çalışmadı

Önceki çözüm `body`den arka planı kaldırıp yalnızca `html`'de bıraktı. Ancak sorunun kökü bu değil.

**Asıl sorun: `background-attachment: fixed` + scrollbar genişliği kombinasyonu**

Tarayıcı bir sayfa scroll edildiğinde, scrollbar `viewport`dan 8-17px alan alır. `background-attachment: fixed` olan bir arka plan ise tam viewport genişliğini kullanmaya devam eder. Bu durumda:

- `html` elementi: `background-attachment: fixed` → arka plan viewport'a göre sabitlenir (örn. 1920px)
- `body` içerik alanı: scrollbar yüzünden 1903px (1920 - 17px)
- `pinkgingham.png`'nin tile başlangıcı viewport'un sol kenarından başlar
- Sağ kenarda içerik ile tile sınırı hizalanmaz → dikey "dikiş" görünür

Ekran görüntüsünde görülen tam da bu: sağ tarafta tam dikey bir çizgi, görselin kenarıyla viewport kenarı arasındaki boşluk.

## Çözüm: `background-attachment: fixed` Tamamen Kaldırılacak

`background-attachment: fixed` kaldırılıp yerine standart `scroll` davranışı (veya hiç belirtilmemesi) kullanılacak. Bu durumda:
- Arka plan içerik genişliğiyle birlikte tile edilir
- Scrollbar genişliği fark yaratmaz çünkü tile, viewport'a değil içerik kutusuna göre hesaplanır
- Desen her zaman simetrik ve hizalı görünür

### Tek Dezavantaj ve Çözümü
`background-attachment: fixed` kaldırılınca sayfa kaydırıldığında arka plan da kayar (parallax efekti gider). Bu, gingham desen için görsel olarak çok küçük bir fark — kullanıcı zaten "kareler hizalı görünsün" istiyor.

Eğer parallax efekti korunmak istenirse, **alternatif yaklaşım:** arka planı `position: fixed` olan bir pseudo-element (`html::before`) ile tam viewport boyutunda çizmek. Bu yöntemde scrollbar hiç dahil olmaz çünkü element viewport'a göre pozisyonlanır.

## Seçilen Yaklaşım: `html::before` ile Fixed Pseudo-element

Bu yöntem hem parallax benzeri "sabit arka plan" efektini korur hem de scrollbar problemi tamamen ortadan kalkar:

```css
html {
  /* arka plan html'den kaldırılır */
}

html::before {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: url("/uploads/pinkgingham.png") repeat;
  background-size: auto;
  z-index: -1;
  pointer-events: none;
}
```

`position: fixed` + `width: 100vw` + `height: 100vh` → arka plan her zaman tam ekranı kaplar, içerik genişliğinden veya scrollbar'dan etkilenmez. `z-index: -1` ile tüm içeriğin arkasında kalır.

## Etkilenen Dosya

**`src/index.css`** — `html` bloğundan `background` ve `background-attachment` satırları kaldırılır, `html::before` pseudo-element eklenir.

### Mevcut (Hatalı):
```css
html {
  min-height: 100%;
  margin: 0;
  background: url("/uploads/pinkgingham.png") repeat;
  background-attachment: fixed;
  background-size: auto;
  scroll-behavior: smooth;
  overflow-x: hidden;
}
```

### Sonrası (Doğru):
```css
html {
  min-height: 100%;
  margin: 0;
  scroll-behavior: smooth;
  overflow-x: hidden;
}

html::before {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: url("/uploads/pinkgingham.png") repeat;
  background-size: auto;
  z-index: -1;
  pointer-events: none;
}
```

Bu tek değişiklikle:
- Scrollbar genişliği arka plan tile'ını hiç etkilemez
- Arka plan sayfa kaydırılınca da sabit kalır (parallax efekti korunur)
- Dikiş/çizgi tamamen ortadan kalkar

Etkilenen dosya: 1 — `src/index.css`, ~6 satır değişiklik.
