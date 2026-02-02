
# Header Ortalama ve Yaratıcı İkon Tasarımı Planı

## Yapılacak Değişiklikler

### 1. Menü Butonlarını Ortaya Getirme

Şu anki yapı flex ile `justify-between` kullanıyor. Menüyü tam ortaya getirmek için:

- Nav elementini `absolute` yapıp `left-1/2 -translate-x-1/2` ile tam ortaya konumlandıracağız
- Logo placeholder ve sağ taraftaki butonlar kendi yerlerinde kalacak
- Bu sayede menü tam sayfa ortasında olacak

### 2. Dil İkonu (Globe) - Yaratıcı Tasarım

Mevcut basit Globe ikonu yerine mor tonlu, yaratıcı bir tasarım:

```text
┌─────────────────────────────────────┐
│   ┌───────────────┐                 │
│   │   🌐          │ ← Mor gradient  │
│   │   Globe       │    arka plan    │
│   │   + Sparkle   │ ← Parıltı       │
│   │   efekti      │    dekorasyonu  │
│   └───────────────┘                 │
└─────────────────────────────────────┘
```

**Özellikler:**
- İkon rengi: `text-landing-purple-dark` (metinlerde kullanılan mor)
- Hover'da hafif scale ve glow efekti
- Küçük parıltı/sparkle dekorasyonu
- Rounded-full gradient arka plan (mor tonlarında)

### 3. Giriş Butonu - Yaratıcı Tasarım

Globe ikonu ile uyumlu, mor tonlu:

**Masaüstü:**
- Mor gradient arka plan (`from-landing-purple/20 to-landing-pink/20`)
- Text rengi: `text-landing-purple-dark`
- Hover'da glow efekti ve scale
- Pill şeklinde (rounded-full)
- Yanında küçük bir ikon (örn: Sparkles veya yıldız)

**Mobil:**
- Globe ile aynı stilde ikon butonu
- LogIn ikonu mor renkte
- Aynı hover efektleri

### Renk Paleti

| Element | Renk |
|---------|------|
| İkon rengi | `text-landing-purple-dark` |
| Arka plan | `bg-landing-purple/10` veya gradient |
| Hover glow | `shadow-[0_0_15px_rgba(147,112,219,0.4)]` |
| Aktif durumu | Daha yoğun mor |

## Teknik Değişiklikler

**Dosya: `src/components/landing/LandingHeader.tsx`**

1. **Nav Konumlandırma:**
   - Nav'ı `absolute left-1/2 -translate-x-1/2` ile ortala
   - Container'ı `relative` yap

2. **Globe İkonu Güncelleme:**
   - `text-landing-purple-dark` rengi
   - `bg-landing-purple/10` arka plan
   - `hover:bg-landing-purple/20 hover:scale-110` efektleri
   - `hover:shadow-[0_0_12px_rgba(147,112,219,0.4)]` glow
   - Küçük dekoratif element (opsiyonel Sparkles)

3. **Login Butonu Güncelleme:**

   **Desktop:**
   ```tsx
   <Button className="bg-landing-purple/10 text-landing-purple-dark 
                      hover:bg-landing-purple/20 hover:scale-105
                      hover:shadow-[0_0_12px_rgba(147,112,219,0.4)]
                      rounded-full px-4 font-medium flex items-center gap-2
                      transition-all duration-300">
     <Sparkles className="w-4 h-4" />
     {t.header.login[language]}
   </Button>
   ```

   **Mobile:**
   ```tsx
   <Button className="bg-landing-purple/10 text-landing-purple-dark
                      hover:bg-landing-purple/20 hover:scale-110
                      rounded-full transition-all duration-300">
     <LogIn className="h-5 w-5" />
   </Button>
   ```

## Değiştirilecek Dosyalar

- `src/components/landing/LandingHeader.tsx` - Tüm değişiklikler bu dosyada
