

## "UeCRETSiZ" Metin Okunabilirlik Duzeltmesi

### Sorunun Koek Nedeni

Kartin arka plani `bg-gradient-to-br from-landing-yellow via-landing-pink to-landing-purple` kullaniyor. "UeCRETSiZ" yazisi ise `bg-clip-text text-transparent` ile kendi gradient rengini aliyor. Ancak `text-transparent` oldugu icin kartin arka plan gradient'i de metnin arkasinda gorunuyor. Ozellikle sag alt kosedeki koyu mor/pembe, son harflerin arkasinda birikip onlari okunaksiz yapiyor.

### Cozum

"UeCRETSiZ" yazisinin bulundugu `<p>` etiketinin arkasina kucuk, yuvarlak koseli, yari saydam beyaz bir arka plan eklenecek. Bu sayede:
- Kartin gradient'i metnin arkasinda artik gorulmeyecek
- Metnin kendi gradient renkleri net gorunecek
- Kartin genel gorunumu bozulmayacak

### Teknik Detay

**Dosya:** `src/components/landing/StickyBubble.tsx`

Satir 81-87 arasindaki "UeCRETSiZ" `<p>` etiketine:
- `bg-white/80 rounded-md px-1.5 py-0.5 inline-block` (veya benzeri) sinif eklenmeyecek cunku bu `bg-clip-text` ile catisir.

Bunun yerine, bu `<p>` etiketini bir wrapper `<span>` veya `<div>` ile sarilacak ve arka plan bu wrapper'a uygulanacak:

```text
Onceki:
<p className="... bg-clip-text text-transparent ...">UeCRETSiZ</p>

Sonraki:
<span className="inline-block bg-white/70 rounded-md px-1.5 py-0.5">
  <p className="... bg-clip-text text-transparent ...">UeCRETSiZ</p>
</span>
```

Bu wrapper, metnin arkasina opak bir katman koyarak kart gradient'inin metne karismesini onler. `bg-white/70` opakligi gerekirse ayarlanabilir (daha net icin `/80`, daha seffaf icin `/50`).

### Etkilenen Dosya

- `src/components/landing/StickyBubble.tsx` (satir 80-87 arasi)

