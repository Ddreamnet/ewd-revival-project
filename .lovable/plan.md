

## Plan

### 1. ThemeToggleButton ve Konular butonunun yerini değiştir (`TeacherDashboard.tsx`)

Satır 185-189'da mevcut sıra: `Konular` → `ThemeToggleButton`

Yeni sıra: `ThemeToggleButton` → `Konular`

### 2. Ders renk mantığını ters çevir (`TeacherDashboard.tsx`)

Satır 262'deki sınıfları değiştir:

**Mevcut:**
- `past` → `text-green-600 line-through` (yeşil, üzeri çizili)
- `upcoming` → `text-red-600 font-medium` (kırmızı)

**Yeni (light mode):**
- `past` → `text-red-600 line-through` (kırmızı, üzeri çizili)
- `upcoming` → `text-green-600 font-medium` (yeşil)

**Yeni (dark mode):**
- `past` → `text-red-900 dark:text-red-800 line-through` → koyu bordo
- `upcoming` → `text-green-800 dark:text-green-700` → koyu haki yeşil

Tam sınıflar:
- `past`: `text-[10px] text-red-600 dark:text-red-800 line-through`
- `upcoming`: `text-sm text-green-600 dark:text-green-700 font-medium`

