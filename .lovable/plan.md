
# İletişim Bölümü Layout Düzenlemeleri

## Yapılacak Değişiklikler

### 1. Form ve Dilara Teacher Alt Sınıra Dayansın
Mevcut grid yapısında `items-end` kullanılarak tüm elemanlar alta hizalanacak.

### 2. Dilara Teacher - Sağ Alt Köşe + 3x Büyük
- Görsel boyutu `w-48 xl:w-64` yerine yaklaşık 3 kat artırılacak → `w-[400px] xl:w-[500px]`
- Container sağ alta yaslanacak (`justify-end items-end`)
- Görselin taşmasını engellemek için container'a `overflow-hidden` eklenecek

### 3. Mobilde "Neden English with Dilara?" Kartı Gizlenecek
- Why Card'a `hidden lg:block` class'ı eklenerek sadece desktop'ta görünür olacak

---

## Teknik Detaylar

| Değişiklik | Mevcut | Yeni |
|------------|--------|------|
| Grid hizalama | `grid lg:grid-cols-3 gap-6` | `grid lg:grid-cols-3 gap-6 items-end` |
| Dilara container | `hidden lg:flex items-end justify-center` | `hidden lg:flex items-end justify-end` |
| Dilara boyut | `w-48 xl:w-64` | `w-[400px] xl:w-[500px]` (3x büyük) |
| Why Card | Sınıf yok | `hidden lg:block` |

---

## Değiştirilecek Dosya

`src/components/landing/ContactSection.tsx`

**Satır 81 - Grid container:**
```tsx
// Önceki
<div className="grid lg:grid-cols-3 gap-6 lg:gap-8">

// Yeni - items-end eklenecek
<div className="grid lg:grid-cols-3 gap-6 lg:gap-8 items-end">
```

**Satır 102-113 - Why Card:**
```tsx
// Önceki
<div className="bg-landing-purple/20 backdrop-blur-sm rounded-2xl p-5 shadow-lg">

// Yeni - hidden lg:block eklenerek mobilde gizlenecek
<div className="hidden lg:block bg-landing-purple/20 backdrop-blur-sm rounded-2xl p-5 shadow-lg">
```

**Satır 209-216 - Dilara Teacher Container ve Görsel:**
```tsx
// Önceki
<div className="hidden lg:flex items-end justify-center">
  <img
    src="/uploads/dilarateacher.png"
    alt="Dilara Teacher"
    className="w-48 xl:w-64 h-auto object-contain drop-shadow-xl"
  />
</div>

// Yeni - Sağ alt + 3x büyük + overflow hidden
<div className="hidden lg:flex items-end justify-end overflow-hidden">
  <img
    src="/uploads/dilarateacher.png"
    alt="Dilara Teacher"
    className="w-[400px] xl:w-[500px] h-auto object-contain drop-shadow-xl"
  />
</div>
```

---

## Özet

- Grid'e `items-end` → Form ve görsel alta hizalanır
- Dilara görseli sağa yaslanır ve 3 kat büyütülür
- Why Card mobilde gizlenir (`hidden lg:block`)
