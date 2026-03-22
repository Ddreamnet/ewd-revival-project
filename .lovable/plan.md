

# Ghost Kartlardan Soluk Görünümü Kaldır

İki dosyada `opacity-50` ghost koşulunu kaldırmak yeterli. AlertCircle ikonu zaten yerinde kalacak.

## Değişiklikler

### 1. `src/components/AdminWeeklySchedule.tsx` (satır 606)
- `actualLesson.isGhost ? "opacity-50 cursor-default"` → `actualLesson.isGhost ? "cursor-default"`

### 2. `src/components/WeeklyScheduleDialog.tsx` (satır 329)
- `actualLesson.isGhost ? "opacity-50"` → `actualLesson.isGhost ? ""` (satır 329)
- Satır 331'deki `!actualLesson.isGhost ? "opacity-100" : ""` → `"opacity-100"` (ghost'lar da tam opaklıkta)

