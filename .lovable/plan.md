

# Plan: EditStudentDialog Schedule Değişikliği Neden Yansımıyor

## Kök Neden

`handleSubmit` (`useEditStudentDialog.ts` satır 512-513) başarılı şekilde:
1. `student_lessons` tablosunu günceller (template)
2. `lesson_instances` tablosunu günceller (actual — `syncTemplateChange` ile)
3. `onStudentUpdated()` callback'ini çağırır

Ama `onStudentUpdated`, `AdminDashboard.tsx` satır 395'te `fetchTeachers` fonksiyonuna bağlı — bu sadece öğretmen/öğrenci listesini yeniler.

**Sorun:** `AdminWeeklySchedule` bileşeninin kendi `weekCache`'i (60 saniyelik in-memory cache) ve kendi `actualLessons` state'i var. `handleSubmit` sonrasında:
- `clearWeekCache()` **çağrılmıyor** — eski veri cache'te kalıyor
- `fetchActualSchedule()` **tetiklenmiyor** — grid eski state'i göstermeye devam ediyor
- `fetchSchedule()` (template mode) **tetiklenmiyor** — template grid de eski kalıyor

Mehmet Ali ve Öykünaz'ın dersleri DB'de doğru güncellendi, ama ekranda eski cache'ten okunuyor.

## Düzeltme

`useEditStudentDialog.ts` → `handleSubmit` içinde, `onStudentUpdated()` çağrılmadan hemen önce `clearWeekCache()` çağır. Bu, schedule grid'in bir sonraki render'da taze veriyi DB'den çekmesini sağlar.

### Değişecek Dosya

| Dosya | Değişiklik |
|-------|-----------|
| `src/hooks/useEditStudentDialog.ts` | `handleSubmit`, `handleDeleteStudent`, `handleArchiveStudent` içinde `onStudentUpdated()` öncesine `clearWeekCache()` ekle |

### Tek satırlık değişiklik (3 yerde):

```typescript
import { clearWeekCache } from "@/hooks/useScheduleGrid";

// handleSubmit satır ~512:
clearWeekCache();
onStudentUpdated();

// handleDeleteStudent satır ~527:
clearWeekCache();
onStudentUpdated();

// handleArchiveStudent satır ~542:
clearWeekCache();
onStudentUpdated();
```

Ek olarak `AdminDashboard`'un `fetchTeachers` callback'i zaten öğrenci listesini yeniden çekiyor — bu da `AdminWeeklySchedule`'ın `teacherId` prop'unu güncelleyerek `useEffect` üzerinden `fetchSchedule()` + `fetchActualSchedule()` tetiklemesine yol açıyor. `clearWeekCache()` olmadan bu refetch stale cache'ten okuyordu — şimdi taze veriyi çekecek.

## Risk

Sıfır risk. `clearWeekCache()` sadece in-memory Map'i temizler, bir sonraki okumada DB'den taze veri gelir.

