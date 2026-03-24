

# Son Audit Planı — Güncellenmiş (confirmDateUpdate Refresh Notu Ekli)

## Tamamlanan ve Doğru Çalışan Akışlar (Dokunmaya Gerek Yok)

| Akış | Durum |
|------|-------|
| Login / Auth | Sorunsuz |
| Ders işlendi yapma (complete) | Sorunsuz — atomik RPC |
| Ders geri alma (undo) | Sorunsuz — atomik RPC |
| Paket sıfırlama (reset) | Sorunsuz — atomik RPC |
| Kalıcı ders programı değişikliği (template) | Sorunsuz — `rpc_sync_student_schedule` |
| Ders erteleme (shift forward) | Sorunsuz — cascade + error propagation |
| Ders geri alma (revert shift) | Sorunsuz — `shift_group_id` bazlı batch |
| Trial lesson complete/undo | Sorunsuz — atomik RPC |
| Grid cache / prefetch / refresh | Sorunsuz — weekCache + refreshKey |
| Bakiye yönetimi | Sorunsuz — RPC + balance_events audit |
| Öğrenci silme / arşivleme / geri alma | Sorunsuz — atomik RPC |
| LessonOverrideDialog | Sorunsuz |

---

## Tespit Edilen 3 Açık

### Sorun 1: `confirmDateUpdate` Cache + Refresh Eksikliği (Orta Önem)

`confirmDateUpdate` (satır 302-399) başarılı olduğunda:
- `fetchInstances()` çağırıyor → dialog içi liste güncelleniyor
- `clearWeekCache()` **çağırmıyor**
- `onStudentUpdated()` **çağırmıyor**

Sonuç: Dialog içinden tek tek ders tarihi değiştirildiğinde görsel ders programı eski veriyi göstermeye devam ediyor.

#### Sadece `clearWeekCache()` Yeterli mi?

**Hayır, yeterli değil.** Doğrulama sonucu:

`AdminWeeklySchedule`'ın refetch tetikleyicileri:
```
useEffect → [teacherId, refreshKey]     // satır 94
useEffect → [showTemplate, weekOffset]  // satır 96-102
```

`clearWeekCache()` sadece in-memory Map'i temizler. Hiçbir `useEffect` dependency'si değişmediği için `fetchActualSchedule()` veya `fetchSchedule()` **yeniden çağrılmaz**. Grid eski `actualLessons` / `lessons` state'ini göstermeye devam eder.

#### Doğru Çözüm: `clearWeekCache()` + `onStudentUpdated()`

`onStudentUpdated()` → `fetchTeachers()` → `setScheduleRefreshKey(prev + 1)` → `refreshKey` dependency değişir → grid refetch tetiklenir.

Bu zaten `handleSubmit`, `handleDeleteStudent`, `handleArchiveStudent` için çalışan mekanizma. `confirmDateUpdate` için de aynı zincir kullanılacak:

```typescript
// confirmDateUpdate sonuna (satır 393 öncesi):
clearWeekCache();
onStudentUpdated();
```

Hedefli refresh mekanizması (ikinci seçenek) gereksiz çünkü mevcut `refreshKey` zinciri tam olarak bu işi yapıyor. Yeni mekanizma eklemek scope büyütür.

**Dosya**: `src/hooks/useEditStudentDialog.ts` satır 375 sonrası

---

### Sorun 2: `batchUpdateInstances` + Remaining Days Error Check Eksikliği (Düşük Önem)

`batchUpdateInstances` (satır 286-297) ve `confirmDateUpdate` satır 353-364'teki `Promise.all` sonuçları Supabase error kontrolü yapmıyor. Sessiz fail riski.

**Düzeltme**: `.filter(r => r.error)` kontrolü + throw ekle.

**Dosya**: `src/hooks/useEditStudentDialog.ts`

---

### Sorun 3: Dead Import — `syncTemplateChange` (Kozmetik)

`useEditStudentDialog.ts` satır 14'te `syncTemplateChange` import ediliyor ama artık kullanılmıyor (handleSubmit RPC'ye geçti).

**Düzeltme**: Import'tan kaldır.

**Dosya**: `src/hooks/useEditStudentDialog.ts`

---

## Uygulama Planı

| Sıra | Değişiklik | Dosya | Risk |
|------|-----------|-------|------|
| 1 | `confirmDateUpdate` sonuna `clearWeekCache()` + `onStudentUpdated()` ekle | `useEditStudentDialog.ts` | Sıfır |
| 2 | `batchUpdateInstances` ve remaining days Promise.all'a error check ekle | `useEditStudentDialog.ts` | Sıfır |
| 3 | `syncTemplateChange` dead import kaldır | `useEditStudentDialog.ts` | Sıfır |

---

## Sonuç

- **Sadece `clearWeekCache()` yeterli mi?** Hayır. Cache temizlenir ama grid refetch tetiklenmez.
- **Grid refetch hangi mekanizmayla tetiklenecek?** `onStudentUpdated()` → `fetchTeachers()` → `setScheduleRefreshKey(prev+1)` → `useEffect[teacherId, refreshKey]` → `fetchSchedule()` + `fetchActualSchedule()`. Mevcut zincir, ek mekanizma gerekmez.

