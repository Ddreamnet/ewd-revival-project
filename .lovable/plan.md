

## Mobil Landing Header: Hamburger Menü + Popover Panel

### Mevcut Durum
`LandingHeader.tsx` dosyasında mobilde sağ tarafta Globe (dil) ve LogIn ikonları ayrı ayrı duruyor. Tema değiştirme (dark/light) seçeneği mobil header'da hiç yok. `next-themes` ThemeProvider zaten App.tsx'te kurulu, `useTheme()` ile erişilebilir.

### Plan

**Değişecek dosyalar:**
1. `src/components/landing/LandingHeader.tsx` — ana değişiklik
2. `src/components/landing/MobileNavPanel.tsx` — yeni bileşen

**Yaklaşım:**

#### 1. `MobileNavPanel.tsx` (yeni bileşen)
- Radix Popover kullanılacak (zaten projede var) — sağdan hizalı, küçük kart panel
- `rounded-2xl`, hafif shadow, backdrop-blur, site renklerine uyumlu yüzey
- Dışarı tıklayınca otomatik kapanır (Radix Popover davranışı)
- İçerik sırası:

**a) Dil Switch (segmented toggle):**
- Pill şeklinde container (`rounded-full`, `bg-muted`)
- Sol tarafta 🇹🇷, sağ tarafta 🇬🇧
- Aktif dil: `bg-landing-purple text-white` arka planlı knob
- `useLanguage()` hook'una bağlanacak

**b) Tema Switch (sun/moon toggle):**
- Referans görseldeki oval pill switch mantığı
- Sol: Sun ikonu, Sağ: Moon ikonu
- Light modda sol aktif (sarımsı-sıcak knob), dark modda sağ aktif (koyu knob)
- `useTheme()` (next-themes) ile çalışacak
- Smooth `translate-x` geçişi

**c) Giriş Yap Butonu:**
- Tam genişlik, `rounded-full`, belirgin, yazılı buton
- `LogIn` ikonu + metin
- Site palette'ine uygun gradient veya solid arka plan

#### 2. `LandingHeader.tsx` değişiklikleri
- Mobilde (md altı): Globe dropdown ve LogIn icon butonları kaldırılacak
- Yerine tek bir hamburger (`Menu` icon) butonu konacak — aynı `rounded-full bg-landing-purple/10` stili
- Hamburger, `MobileNavPanel` Popover'ını tetikleyecek
- Desktop (md üstü): Mevcut Globe dropdown ve Login butonu aynen kalacak, hiçbir değişiklik yok

#### Teknik Detaylar
- Radix `Popover` bileşeni: `PopoverTrigger` = hamburger butonu, `PopoverContent` = panel (align="end", sideOffset=8)
- Panel genişliği: `w-64` veya `w-72` — viewport taşması olmaz
- Theme toggle: `useTheme` → `setTheme(theme === 'dark' ? 'light' : 'dark')`
- Dil toggle: `useLanguage` → `setLanguage(lang === 'tr' ? 'en' : 'tr')`
- Login: `useNavigate` → `/login`

#### Manuel Test Noktaları
- Mobilde hamburger açılıp kapanması
- Dil değişince tüm sayfanın güncellenmesi
- Tema değişince dark/light geçişi
- Login butonunun /login'e yönlendirmesi
- Desktop'ta hiçbir değişiklik olmaması
- Panel dışına tıklayınca kapanması

