

## Plan: Tema Butonu + Panel Header Düzenlemeleri

### 1. Yeni bileşen: `ThemeToggleButton`
Yeni bir `src/components/ThemeToggleButton.tsx` oluşturulacak. `next-themes`'den `useTheme` kullanarak:
- Daire şeklinde buton (`rounded-full`)
- Dark modda `Sun` ikonu, light modda `Moon` (hilal) ikonu (MobileNavPanel'deki ile aynı)
- Tıklanınca tema değişir
- Boyut ve stil prop ile kontrol edilebilir (landing vs panel header için)

### 2. `LandingHeader.tsx` - Desktop/tablet tema butonu
- Dil dropdown'unun **soluna** yeni `ThemeToggleButton` eklenecek (satır ~191 civarı)
- Dil butonuyla aynı boyut ve stil: `rounded-full bg-landing-purple/10 text-landing-purple-dark hover:bg-landing-purple/20 hover:scale-110 hover:shadow-...`
- Sadece `hidden md:flex` (mobilde hamburger menüdeki mevcut switch kullanılıyor)

### 3. `TeacherDashboard.tsx` - İletişim butonunu kaldır, tema butonu ekle
- Satır 189'daki `<ContactDialog />` kaldırılacak
- rightActions'a `ThemeToggleButton` eklenecek (çıkış butonunun yanına)

### 4. `StudentDashboard.tsx` - Tema butonu ekle
- rightActions'a `ThemeToggleButton` eklenecek
- `<ContactDialog />` öğretmen panelinde kaldırılıyor ama öğrenci panelinde de kaldırılıp kaldırılmayacağı: kullanıcı sadece "öğretmen panellerindeki" dedi, öğrenci panelindeki kalacak

### 5. `AdminDashboard.tsx` - Tema butonu ekle
- rightActions'a `ThemeToggleButton` eklenecek (çıkış butonunun soluna)

### Teknik detaylar
- `ThemeToggleButton` bileşeni `useTheme()` hook'unu kullanacak, `resolvedTheme` ile mevcut temayı okuyacak
- İkonlar: `Moon` (light modda gösterilir → dark'a geçir), `Sun` (dark modda gösterilir → light'a geçir) — MobileNavPanel ile aynı mantık
- Panel header'larında buton stili: `variant="outline" size="sm"` ile mevcut butonlarla uyumlu

