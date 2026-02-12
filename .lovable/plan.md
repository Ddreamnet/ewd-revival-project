

## Sticky Bubble Metin Blur Sorunu Duzeltmesi

### Sorunun Nedeni

"UeCRETSiZ" yazisinin sag tarafi bulanik gorunuyor. Bunun iki muhtemel sebebi var:

1. **`overflow-hidden`** (satir 71): Parent div uzerindeki bu sinif, gradient text'in kenarlarini kesiyor. `bg-clip-text text-transparent` ile birlikte kullanildiginda, `bg-[length:200%_auto]` genisligindeki gradient arka plan kenarlardan tasiyor ve `overflow-hidden` tarafindan kesiliyor. Bu da ozellikle sag kenarda bulanik/soluk bir gorunum yaratiyor.

2. **Shine overlay** (satir 73-74): Uzerinden gecen yari saydam beyaz gradient katman (`via-white/20`) da metni hafifce ortuyor.

### Yapilacak Degisiklik

**Dosya:** `src/components/landing/StickyBubble.tsx`

1. Satir 71'deki `overflow-hidden` sinifini kaldirmak. Bu sinif sadece shine efekti ve alt ucgen (satir 106-108) icin kullaniliyordu. Shine efekti `overflow-hidden` olmadan ekran disina tasabilir, bu yuzden shine overlay'e de `overflow-hidden` eklenecek veya `pointer-events-none` ile sinirlandirilacak.

2. Alternatif olarak, shine overlay'i (satir 73-74) kendi icinde `overflow-hidden rounded-2xl` ile sarmalayarak, parent div'den `overflow-hidden`'i kaldirmak. Boylece metin tasmasi engellenmez ama shine efekti hala kutu icinde kalir.

### Teknik Detay

```text
Onceki:
div (overflow-hidden) 
  |- shine overlay (tasabilir)
  |- text (gradient kesilir!)
  |- ucgen

Sonraki:
div (overflow-hidden kaldirildi)
  |- shine overlay (kendi icinde overflow-hidden + rounded)
  |- text (artik kesilmez)
  |- ucgen
```

Shine overlay'e `overflow-hidden rounded-2xl` eklenecek ve parent'tan `overflow-hidden` cikarilacak. Boylece metin serbestce renderlanir, blur/kesme sorunu ortadan kalkar.

