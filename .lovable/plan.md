
# Landing Page Spacing Analizi ve Düzeltme Planı

## Mevcut Durum: Tutarsızlıklar

Tüm section'lar tek tek incelendi. İşte bulunan sorunlar:

### 1. Dikey Padding Tutarsızlığı (En kritik sorun)

| Section | Mevcut Padding | Standart mı? |
|---|---|---|
| Hero | `pt-24 md:pt-28 pb-12` | ❌ Farklı (min-h-screen + özel) |
| Why | `py-16 md:py-24` | ✅ Referans |
| KidsPackages | `py-16 md:py-24` | ✅ |
| AdultPackages | `py-16 md:py-24` | ✅ |
| FAQ | `py-16 md:py-24` | ✅ |
| Blog | `py-16 md:py-24` + ayrıca `px-4` | ⚠️ `px-4` fazladan var, iç wrapper'da `sm:px-6 lg:px-8` yok |
| Values | `py-16 md:py-24` | ✅ |
| Contact | `pt-16 md:pt-24 pb-0` | ❌ Alt padding yok, Footer'a yapışık |

**Standardın `py-16 md:py-24` (64px mobile / 96px desktop) olduğu tespit edildi.**

### 2. İç Container Genişliği Tutarsızlığı

| Section | Container | Tutarlı mı? |
|---|---|---|
| Why | `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8` | ✅ Referans |
| KidsPackages | `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8` | ✅ |
| AdultPackages | `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8` | ✅ |
| FAQ | `max-w-3xl mx-auto px-4 sm:px-6 lg:px-8` | ✅ (kasıtlı dar) |
| Blog | `max-w-7xl mx-auto` (px-4 section'da) | ⚠️ Section'a `px-4` yazılmış, wrapper'da `sm:px-6 lg:px-8` eksik |
| Values | `max-w-7xl mx-auto px-4` | ⚠️ `sm:px-6 lg:px-8` eksik |
| Contact | `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8` | ✅ |

### 3. Header Boşluğu (mb) Tutarsızlığı

| Section | Header mb | Tutarlı mı? |
|---|---|---|
| KidsPackages | `mb-12` | ✅ Referans |
| AdultPackages | `mb-12` | ✅ |
| FAQ | `mb-12` | ✅ |
| Blog | `mb-10 md:mb-14` | ❌ Farklı (10→14 yerine sabit 12 olmalı) |
| Values | `mb-12 md:mb-16` | ❌ Farklı (12→16 yerine sabit 12 olmalı) |
| Contact | `mb-8 md:mb-12` | ⚠️ Mobilde 8 az, 12 olmalı |

### 4. Contact Section Alt Boşluk Sorunu

`ContactSection` → `pt-16 md:pt-24 pb-0` şeklinde tanımlanmış. Alt padding **hiç yok**, bu Footer ile arasında boşluk bırakmıyor veya section içindeki `mb-[12px]` gibi garip bir değer kullanılıyor (`mb-[12px]` → `max-w-7xl` wrapper'ında). Bu tutarsız ve düzeltilmeli.

### 5. Blog Section Ek `px-4` Sorunu

`BlogSection`'da section elementi `py-16 md:py-24 px-4` şeklinde. Diğer section'larda `px-*` section seviyesinde değil, iç `div`'de. Bu tutarsızlık özellikle büyük ekranlarda blog slider'ının diğer section'lardan farklı genişlikte görünmesine neden olur.

---

## Yapılacak Değişiklikler

### Dosya 1: `src/components/landing/BlogSection.tsx`

**Sorun:** Section'da fazladan `px-4` var, iç container'da `sm:px-6 lg:px-8` eksik. Header `mb` tutarsız.

**Değişiklik:**
- `<section>` → `py-16 md:py-24` (px-4 kaldırılır)
- `<div className="max-w-7xl mx-auto">` → `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`
- Header div → `mb-12` (sabit, `mb-10 md:mb-14` yerine)

### Dosya 2: `src/components/landing/ValuesSection.tsx`

**Sorun:** İç container'da `sm:px-6 lg:px-8` eksik. Header `mb` tutarsız.

**Değişiklik:**
- `<div className="max-w-7xl mx-auto px-4">` → `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`
- Header div → `mb-12` (sabit, `mb-12 md:mb-16` yerine)

### Dosya 3: `src/components/landing/ContactSection.tsx`

**Sorun:** `pt-16 md:pt-24 pb-0` → alt padding yok. Wrapper'da `mb-[12px]` gibi garip bir değer. Header `mb-8 md:mb-12` tutarsız.

**Değişiklik:**
- `<section>` → `py-16 md:py-24` (hem üst hem alt padding eşit)
- Inner wrapper'daki `mb-[12px]` kaldırılır
- Header div → `mb-12` (sabit)

---

## Özet: Standart Pattern (Tüm section'lara uygulanacak)

```text
<section className="scroll-section py-16 md:py-24">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div className="text-center mb-12">   ← Başlık alanı
      <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-landing-purple-dark">
```

Bu pattern Why, KidsPackages, AdultPackages, FAQ section'larında zaten doğru. Blog, Values ve Contact düzeltilecek.

**Etkilenen dosyalar:** 3 dosya, her birinde 2-4 satır değişiklik.
