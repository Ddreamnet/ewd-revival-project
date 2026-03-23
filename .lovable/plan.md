

# Kod Temizliği + Performans Optimizasyonu Planı

## Tespit Edilen Sorunlar

### Dead Code / Kullanılmayan Fonksiyonlar
1. **`teacherBalance.ts` — `addRegularLessonBalance` ve `subtractRegularLessonBalance`**: Hiçbir dosyadan çağrılmıyor. Tüm bakiye işlemleri artık RPC fonksiyonları (`rpc_complete_lesson`, `rpc_undo_complete_lesson`) üzerinden yapılıyor. Bu iki convenience fonksiyon legacy kalıntısı.

2. **`teacherBalance.ts` — `addToTeacherBalance`**: Sadece `addRegularLessonBalance` tarafından çağrılıyor (ki o da dead code). Dışarıdan hiçbir yerde kullanılmıyor.

3. **`lessonTypes.ts` — `SortedLesson` ve `DisplayLessonData` interface'leri**: `SortedLesson` hiçbir yerden kullanılmıyor. `DisplayLessonData` da hiçbir yerden import edilmiyor.

4. **`useScheduleGrid.ts` — `getActualLessonForDayAndTime` (tekil)**: `getActualLessonsForDayAndTime` (çoğul) zaten var ve kullanılıyor. Tekil versiyon artık sadece import'ta listeleniyor ama gerçek kullanımda çoğul versiyon tercih ediliyor. Import'lardan da kaldırılabilir.

5. **`useScheduleGrid.ts` — `getAllTimeSlots` üçüncü parametresi (`_overrides`)**: `unknown[] = []` olarak tanımlı, hiçbir çağrıda kullanılmıyor (hep `[]` geçiliyor). Legacy `lesson_overrides` tablosundan kalma — parametre silinebilir.

### Performans Sorunları

6. **`confirmDateUpdate` (EditStudentDialog) — Seri conflict check'ler**: Her değiştirilen tarih için ayrı `checkTeacherConflicts` çağrısı yapılıyor (N adet sıralı DB sorgusu). Conflict artık warning-only olduğuna göre bu check'ler paralel yapılabilir veya batch halinde tek sorguda çözülebilir.

7. **`syncTemplateChange` — Seri conflict check + seri update/insert**: `for` döngüsünde her `newDate` için ayrı `checkTeacherConflicts`, sonra her `planned` instance için ayrı `update`, sonra her yeni instance için ayrı `insert`. Toplam: `O(planned × 2)` sıralı DB çağrısı. Batch upsert ile tek çağrıya düşürülebilir.

8. **`shiftLessonsForward` — Seri conflict check + seri update**: Her shift edilecek instance için ayrı conflict check + ayrı update. Warning-only olduktan sonra conflict check paralelize edilebilir ve update'ler batch yapılabilir.

9. **`LessonOverrideDialog.handleRevert` — Seri conflict check + seri update**: Her revert edilecek instance için tek tek DB çağrısı. Batch yapılabilir.

10. **`LessonTracker.loadData` — 3 paralel akış ama her biri kendi içinde sıralı**: `fetchInstances` → 2 sıralı sorgu (tracking + instances), `refreshCompletionState` → `getNextCompletableInstance` ve `getLastCompletedInstance` her biri 2 sıralı sorgu (tracking + instances). Aynı `package_cycle` 3 kez ayrı ayrı fetch ediliyor.

11. **`EditStudentDialog.initializeDialog` — 2 sıralı sorgu**: `students` tablosundan ID çekip sonra `student_lesson_tracking` sonra `lesson_instances`. Tracking + instances paralel yapılabilir.

12. **`handleMarkIncomplete` (AdminWeeklySchedule) — Manuel bakiye düşürme**: Trial lesson undo işlemi `subtractFromTeacherBalance` ile client-side yapılıyor, ama RPC (`rpc_complete_trial_lesson`) sadece complete yönü için var. Undo tarafı tutarsız — RPC yok, client-side balance düşürme yapılıyor. Bu hem güvenlik riski hem tutarsızlık.

### Kod Karmaşası / Tekrar

13. **`EditStudentDialog` — 1082 satır**: Çok büyük dosya. İçinde öğrenci ayarları, ders programı düzenleme, tarih güncelleme, ders işaretleme/geri alma, arşivleme, silme, paket sıfırlama hepsi bir arada. Mantıksal olarak ayrılabilir hook'lara.

14. **`AdminWeeklySchedule` — 856 satır**: Benzer şekilde büyük. Template mode, actual mode, trial lesson management, back-to-back rendering, override dialog integration hepsi tek dosyada.

15. **`confirmDateUpdate` duplicate logic**: `updateRemainingDays` ON/OFF dalları neredeyse aynı conflict check + update mantığını tekrarlıyor. Ortak fonksiyona çekilebilir.

---

## Plan

### Phase 1: Dead Code Temizliği (düşük risk, hızlı etki)

**1.1** `teacherBalance.ts` — `addRegularLessonBalance` ve `subtractRegularLessonBalance` fonksiyonlarını sil. `addToTeacherBalance` fonksiyonunu da sil (sadece dead convenience fonksiyonu tarafından çağrılıyor, doğrudan dışarıdan çağrılmıyor). `subtractFromTeacherBalance` kalacak (AdminWeeklySchedule ve WeeklyScheduleDialog trial undo'da kullanıyor).

**1.2** `lessonTypes.ts` — `SortedLesson` ve `DisplayLessonData` interface'lerini sil.

**1.3** `useScheduleGrid.ts` — `getActualLessonForDayAndTime` (tekil) fonksiyonunu sil. Import eden dosyalardaki (`AdminWeeklySchedule`, `WeeklyScheduleDialog`) import listesinden kaldır. `getAllTimeSlots` üçüncü parametresini (`_overrides`) kaldır, çağrı noktalarındaki `[]` argümanını da sil.

### Phase 2: Performans Optimizasyonu (orta risk, büyük etki)

**2.1** `LessonTracker` — `package_cycle` tekrar fetch'ini ortadan kaldır:
- `fetchInstances`, `getNextCompletableInstance`, `getLastCompletedInstance` hepsi ayrı ayrı `student_lesson_tracking` sorgusu yapıyor
- Çözüm: `loadData` içinde `package_cycle`'ı bir kez fetch et, ardından her üç fonksiyona parametre olarak geç
- Beklenen etki: 3 gereksiz DB sorgusu yok

**2.2** `EditStudentDialog.initializeDialog` — Tracking + instances fetch'lerini paralelize et:
- Şu an sıralı: önce `students` → sonra `student_lesson_tracking` → sonra `lesson_instances`
- Students sorgusu zorunlu olarak önce (ID lazım), ama tracking + instances `Promise.all` ile paralel yapılabilir
- Beklenen etki: dialog açılış süresi ~%30 kısalır

**2.3** `syncTemplateChange` — Batch operations:
- Conflict check'leri `Promise.all` ile paralelize et (warning-only olduğu için sıra önemsiz)
- Planned instance update'lerini tek bir batch query'ye dönüştür (birden fazla `.update()` yerine)
- Excess instance delete'leri tek sorguda yap (`.in("id", excessIds)`)

**2.4** `shiftLessonsForward` — Batch operations:
- Conflict check'leri `Promise.all` ile paralelize et
- Shift update'lerini batch'e al

**2.5** `confirmDateUpdate` — Conflict check paralelize:
- Warning-only olduğu için her tarih değişikliği için yapılan conflict check'ler `Promise.all` ile paralel çalıştırılabilir

**2.6** `handleRevert` (LessonOverrideDialog) — Batch update:
- Tüm revert edilecek instance'ları tek tek update etmek yerine, ID listesi ile tek sorguda update et

### Phase 3: Trial Lesson Undo Tutarsızlığı (düşük risk)

**3.1** `handleMarkIncomplete` — Trial lesson undo için RPC oluştur (`rpc_undo_trial_lesson`):
- Şu an client-side'da `update trial_lessons` + `subtractFromTeacherBalance` yapılıyor
- Bu pattern bakiye tutarsızlığına açık (partial failure riski)
- Yeni RPC: trial_lessons + teacher_balance + balance_events'i tek transaction'da güncellesin
- Bu RPC oluşturulduktan sonra `subtractFromTeacherBalance` artık hiçbir yerde kullanılmayacak → onu da sil
- Sonuç: `teacherBalance.ts` dosyası tamamen silinebilir (tüm fonksiyonları ya dead code ya da RPC'ye taşınmış olur)

### Phase 4: Kod Karmaşası Azaltma (opsiyonel, yüksek etki ama geniş scope)

**4.1** `EditStudentDialog` — Hook extraction:
- `useStudentDialogState` hook'u: initializeDialog, fetchInstances, lessonDates state management
- `useStudentMutations` hook'u: handleMarkLastLesson, handleUndoLastLesson, handleResetAllLessons, confirmDateUpdate, handleSubmit
- Dialog component sadece render + event binding kalır
- Bu 1082 satırlık dosyayı ~400 satıra düşürür

**4.2** `AdminWeeklySchedule` — Component extraction:
- `ScheduleGridCell` componenti: tek bir `<td>` render mantığı (single, b2b, trial, multi)
- `TrialLessonActions` componenti: trial lesson dialog + mark/unmark/delete
- Ana component ~400 satıra düşer

---

## Etkilenen Dosyalar

| Dosya | Phase | Değişiklik |
|-------|-------|-----------|
| `src/lib/teacherBalance.ts` | 1.1, 3.1 | Dead fonksiyonları sil → dosya tamamen silinebilir |
| `src/lib/lessonTypes.ts` | 1.2 | 2 unused interface sil |
| `src/hooks/useScheduleGrid.ts` | 1.3 | Tekil helper sil, overrides parametresi sil |
| `src/components/AdminWeeklySchedule.tsx` | 1.3, 4.2 | Import temizliği, opsiyonel extraction |
| `src/components/WeeklyScheduleDialog.tsx` | 1.3 | Import temizliği |
| `src/components/LessonTracker.tsx` | 2.1 | package_cycle tek fetch |
| `src/components/EditStudentDialog.tsx` | 2.2, 2.5, 4.1 | Paralel fetch, opsiyonel hook extraction |
| `src/lib/instanceGeneration.ts` | 2.3, 2.4 | Batch operations |
| `src/components/LessonOverrideDialog.tsx` | 2.6 | Batch revert |
| Migration SQL | 3.1 | `rpc_undo_trial_lesson` oluştur |

## Uygulama Sırası

1. Phase 1 (dead code) — sıfır risk, hemen yapılabilir
2. Phase 2 (performans) — düşük-orta risk, en büyük hız etkisi
3. Phase 3 (trial undo RPC) — düşük risk, veri tutarlılığı
4. Phase 4 (refactor) — opsiyonel, sadece code maintainability

## Sorular

Karar vermeni istediğim bir nokta var:

**Phase 4 (EditStudentDialog ve AdminWeeklySchedule refactor)** scope olarak büyük. Bu dosyaları hook'lara ve alt component'lere bölmek davranış değiştirmez ama dosya yapısını değiştirir. Bunu şimdi yapmak ister misin yoksa Phase 1-3'e odaklanıp Phase 4'ü sonraya bırakalım mı?

