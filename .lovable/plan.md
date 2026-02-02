

# Logo Bağımsızlık ve 2x Büyütme Planı

## Problem
Şu an logo header'ın içindeki flex container'da yer alıyor. Logo boyutu büyüdüğünde header yüksekliği de artıyor çünkü aynı div içinde.

## Çözüm
Logo'yu header'dan tamamen ayırıp, **absolute positioning** ile bağımsız konumlandırmak. Böylece logo istediği kadar büyüyebilir ve header'ı veya diğer elementleri etkilemez.

---

## Teknik Değişiklikler

### 1. LandingHeader.tsx Değişiklikleri

**Mevcut yapı:**
```
<header>
  <div className="flex items-center justify-between">
    <div> <!-- Logo burada --> </div>
    <nav> <!-- Menu --> </nav>
    <div> <!-- Dil + Giriş --> </div>
  </div>
</header>
```

**Yeni yapı:**
```
<header>
  <!-- Logo - Absolute, header'dan bağımsız -->
  <div className="absolute left-4 top-2 z-10">
    <img className="h-28 md:h-40 w-auto ..." /> <!-- 2x boyut -->
  </div>
  
  <div className="flex items-center justify-between">
    <div className="invisible"> <!-- Placeholder boşluk --> </div>
    <nav> <!-- Menu --> </nav>
    <div> <!-- Dil + Giriş --> </div>
  </div>
</header>
```

### 2. Logo Boyutları (2 Kat Büyütme)

| Cihaz | Mevcut | Yeni (2x) |
|-------|--------|-----------|
| Mobil | h-14 (56px) | h-28 (112px) |
| Tablet/Desktop | h-20 (80px) | h-40 (160px) |

### 3. Pozisyonlama Detayları

- **Position**: `absolute` (header içinde kalacak ama flow'u etkilemeyecek)
- **Sol hiza**: `left-4 sm:left-6 lg:left-8` (responsive padding)
- **Üst hiza**: `top-2 md:top-3` (biraz üstten başlasın)
- **Z-index**: Logo header'ın üstünde olsun
- **Placeholder**: Logo'nun olduğu yere görünmez bir placeholder div eklenecek ki menu ortada kalsın

### 4. Overflow Kontrolü

Logo header'ın dışına taşacağı için:
- Header'a `overflow-visible` eklenmeli
- Sayfada yatay scroll oluşmaması için logo max-width kontrollü olmalı

---

## Dosya Değişiklikleri

**Değiştirilecek:**
- `src/components/landing/LandingHeader.tsx` - Logo absolute konumlandırma ve 2x boyut

