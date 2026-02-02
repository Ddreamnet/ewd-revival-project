
# İletişim Bölümü - Bottom Hizalama ve Görsel Boyutu

## Yapılacak Değişiklikler

### 1. Form ve Dilara Teacher Bottom'a Bitişik Olsun
Grid container'a `items-end` zaten ekli durumda. Form kartının ve görsel container'ın alt kenarlarının section'a bitişik olması için:
- Section'a veya container'a ek padding-bottom ayarlaması yapılabilir
- Mevcut yapı zaten `items-end` ile alta hizalı, ancak form kartının dış container'ına `self-end` eklenebilir

### 2. Dilara Teacher 1.5 Kat Büyüsün
Mevcut boyut: `w-[400px] xl:w-[500px]`
Yeni boyut (1.5x): `w-[600px] xl:w-[750px]`

---

## Teknik Detaylar

| Değişiklik | Mevcut | Yeni |
|------------|--------|------|
| Dilara boyut | `w-[400px] xl:w-[500px]` | `w-[600px] xl:w-[750px]` |

---

## Değiştirilecek Dosya

`src/components/landing/ContactSection.tsx`

**Satır 214 - Dilara Teacher Görsel Boyutu:**
```tsx
// Önceki
className="w-[400px] xl:w-[500px] h-auto object-contain drop-shadow-xl"

// Yeni - 1.5x büyük
className="w-[600px] xl:w-[750px] h-auto object-contain drop-shadow-xl"
```

---

## Özet

- Dilara görseli 1.5 kat büyütülür (400px → 600px, 500px → 750px)
- `items-end` zaten mevcut olduğu için form ve görsel bottom'a hizalı kalır
