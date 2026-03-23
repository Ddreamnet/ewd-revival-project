

# Ders Programı Sistemi — İki Aşamalı Temizlik ve Düzeltme Planı

## Sistem Haritası (Güncellenmiş)

```text
TABLOLAR (Source of Truth)
├─ student_lessons        → Haftalık şablon (template) slotlar
├─ lesson_instances       → Gerçek ders planı (SSoT) — planned/completed
├─ student_lesson_tracking→ Paket döngüsü + haftalık sayı
├─ students               → Öğrenci-öğretmen ilişkisi + archive
├─ teacher_balance        → Bakiye
└─ balance_events         → Audit log

RPC FONKSİYONLARI
├─ rpc_complete_lesson      → Ders tamamla (atomik)
├─ rpc_undo_complete_lesson → Geri al (atomik)
├─ rpc_reset_package        → Paket sıfırla (atomik)
├─ rpc_archive_student      → Arşivle (atomik)
├─ rpc_restore_student      → Geri yükle (BUGLU — v_slot.s hatası)
└─ rpc_delete_student       → Sil (atomik)

CLIENT DOSYALARI
├─ instanceGeneration.ts   → getNextDateForSlots, generateFutureInstanceDates,
│                            syncTemplateChange, shiftLessonsForward
├─ useScheduleGrid.ts      → ensureInstancesForWeek, fetchActualLessonsForWeek,
│                            getActualLessonForDayAndTime, back-to-back grouping,
│                            cache/prefetch
├─ conflictDetection.ts    → checkTeacherConflicts, hasTimeOverlap
├─ lessonService.ts        → RPC wrapper'ları (temiz, dokunma)
├─ lessonDateCalculation.ts→ calculateLessonDates, recalculateRemainingDates,
│                            calculateNextLessonDate
├─ lessonSync.ts           → checkNonTemplateWeekday (tek fonksiyon)
├─ lessonTypes.ts          → Ortak tipler ve utility'ler
├─ EditStudentDialog.tsx   → Öğrenci ayarları + template edit + instance list
├─ LessonOverrideDialog.tsx→ Tekil ders düzenleme + shift + revert
├─ AdminWeeklySchedule.tsx → Admin takvim grid
└─ WeeklyScheduleDialog.tsx→ Öğretmen takvim grid
```

## Tespit Edilen Sorunlar ve Ortak Kök Nedenler

| Kök Neden | Etkilenen Sorunlar |
|-----------|-------------------|
| `getNextDateForSlots` aynı gün tek slot varsayımı (`.find()`) | #2, #3, #4 |
| `rpc_restore_student` PL/pgSQL `v_slot.s` alias hatası | #1 |
| `handleOneTimeChange`'de eksik `excludeStudentId` | #5 |
| Ölü kod: `calculateLessonDates`, `recalculateRemainingDates` (hiçbir yerden import edilmiyor) | Kod karmaşası |
| `lessonSync.ts` tek fonksiyonlu dosya | Kod karmaşası |
| `lessonDateCalculation.ts`'in 3 fonksiyonundan 2'si ölü, 1'i sadece LessonOverrideDialog'da | Kod karmaşası |

---

## PHASE 1 — Kod Temizliği / Sadeleştirme / Hazırlık

### 1. Ölü kodu temizle

**`src/lib/lessonDateCalculation.ts`**: `calculateLessonDates` ve `recalculateRemainingDates` fonksiyonları hiçbir dosyadan import edilmiyor. Bunlar legacy dönemden kalan, instance-based sisteme geçişten önce kullanılan fonksiyonlar. Silinecek.

Dosyada kalan tek fonksiyon `calculateNextLessonDate` — sadece `LessonOverrideDialog.tsx`'de kullanılıyor ve orada da sadece "Sonraki Derse Aktar" butonunun altında preview amaçlı gösteriliyor. Bu fonksiyon kalacak.

### 2. `lessonSync.ts` dosyasını kaldır

Bu dosya tek bir fonksiyon içeriyor: `checkNonTemplateWeekday`. Bu fonksiyon sadece uyarı amaçlı (engelleyici değil). İki yerde import ediliyor: `EditStudentDialog.tsx` ve `LessonOverrideDialog.tsx`.

Bu fonksiyonu `lessonDateCalculation.ts`'e taşı (zaten tarih/gün hesaplama utility dosyası). `lessonSync.ts`'i sil.

### 3. Aynı gün iki ders senaryosu audit — tüm tehlikeli noktaları işaretle

Phase 1'de davranış değiştirmeden, şu noktaları kod içinde yorum/not ile işaretle:

- `instanceGeneration.ts:46` — `sortedSlots.find()` → sadece ilk eşleşmeyi döndürüyor
- `instanceGeneration.ts:74` — `addDays(next.date, 1)` → aynı gündeki ikinci slotu atlıyor
- `lessonDateCalculation.ts:calculateNextLessonDate` — gün bazlı arama, slot-agnostik (ama sadece preview için kullanılıyor, sorun değil)

Bu noktalar Phase 2'de düzeltilecek.

### 4. `EditStudentDialog.tsx` içindeki duplicate fetchStudentIds temizliği

`fetchStudentIds` (satır 92) ve `fetchTrackingRecordId` (satır 104) ve `fetchInstances` (satır 133) hepsi `students` tablosundan ayrı ayrı `student_id, teacher_id` çekiyor. Bu 3 ayrı sorgu aynı veriyi istiyor.

Bunları tek bir `initializeDialog` fonksiyonuna birleştir. `fetchTrackingRecordId` aslında hiç çağrılmıyor (kullanılmıyor) — kaldır.

### 5. `rpc_restore_student` ile `rpc_reset_package` pattern karşılaştırması

Phase 1'de SQL değişikliği yapmadan, iki fonksiyonun loop pattern'lerini karşılaştır ve farkı dokümante et:
- `rpc_reset_package`: `FOR v_slot IN SELECT * FROM jsonb_array_elements(p_template_slots) LOOP` → `v_slot->>'dayOfWeek'` (doğru)
- `rpc_restore_student`: `FOR v_slot IN SELECT * FROM jsonb_array_elements(v_slots) AS s LOOP` → `v_slot.s->>'dayOfWeek'` (HATA)

Bu fark Phase 2'de düzeltilecek.

### Phase 1 Değişecek Dosyalar

| Dosya | Değişiklik |
|-------|-----------|
| `src/lib/lessonDateCalculation.ts` | Ölü fonksiyonları sil, `checkNonTemplateWeekday`'i buraya taşı |
| `src/lib/lessonSync.ts` | Dosyayı sil |
| `src/components/EditStudentDialog.tsx` | Import'u güncelle, duplicate fetch'leri birleştir, `fetchTrackingRecordId`'yi kaldır |
| `src/components/LessonOverrideDialog.tsx` | Import'u güncelle |

### Phase 1 Riskli vs Güvenli

- **Güvenli**: Ölü kod silme — davranış değiştirmez
- **Güvenli**: `lessonSync.ts` taşıma — sadece import path değişir
- **Güvenli**: Duplicate fetch birleştirme — aynı veri, daha az sorgu
- **Güvenli**: `fetchTrackingRecordId` silme — hiçbir yerden çağrılmıyor

---

## PHASE 2 — Düzeltmeleri Uygula

### Düzeltme 1: `rpc_restore_student` PL/pgSQL hatası (Sorun #1)

Migration ile `v_slot.s` referanslarını `v_slot` olarak düzelt. `AS s` alias'ını kaldır. `rpc_reset_package` ile aynı pattern'e getir.

### Düzeltme 2: `getNextDateForSlots` çok-slot desteği (Sorun #2, #3, #4)

`instanceGeneration.ts`'deki `getNextDateForSlots` ve `generateFutureInstanceDates` fonksiyonlarını yeniden yaz:

Mevcut mantık:
```
for offset in 0..13:
  candidate = afterDate + offset
  slot = slots.find(s => s.dayOfWeek === candidate.getDay())  // İLK eşleşme
  if slot: return {date, slot}
```

Yeni mantık — `generateFutureInstanceDates` doğrudan çok-slot destekleyecek:
```
for offset in 0..maxDays:
  candidate = afterDate + offset
  matchingSlots = slots.filter(s => s.dayOfWeek === candidate.getDay())
    .sort(by startTime)
  for each slot in matchingSlots:
    results.push({date, slot})
    if results.length >= count: return results
```

`getNextDateForSlots` fonksiyonunu kaldır; `generateFutureInstanceDates` artık kendi içinde multi-slot iterasyonu yapacak.

`shiftLessonsForward` bu fonksiyonu kullanıyor → aynı düzeltmeden faydalanacak.

### Düzeltme 3: `handleOneTimeChange` eksik `excludeStudentId` (Sorun #5)

`LessonOverrideDialog.tsx` satır 208-214'teki `checkTeacherConflicts` çağrısına 6. parametre olarak `studentId` ekle.

### Phase 2 Değişecek Dosyalar

| Dosya | Değişiklik |
|-------|-----------|
| Migration SQL | `rpc_restore_student` fonksiyonunu düzelt |
| `src/lib/instanceGeneration.ts` | `generateFutureInstanceDates` çok-slot desteği |
| `src/components/LessonOverrideDialog.tsx` | `excludeStudentId` parametresi ekle |

### Uygulama Sırası

1. **Düzeltme 1** (rpc_restore_student) — izole, sıfır risk
2. **Düzeltme 2** (multi-slot) — en geniş etki, #2+#3+#4
3. **Düzeltme 3** (excludeStudentId) — tek satır

### Regresyon Riskleri

- **Düzeltme 1**: Sadece restore fonksiyonu etkilenir. Archive/delete dokunulmaz.
- **Düzeltme 2**: `generateFutureInstanceDates` hem `syncTemplateChange`, hem `shiftLessonsForward`, hem `EditStudentDialog.confirmDateUpdate` tarafından kullanılıyor. Tek-slot-per-day öğrencilerde davranış aynı kalmalı çünkü `filter` tek eleman döndürecek.
- **Düzeltme 3**: False positive azalır, yeni false negative oluşmaz.

### Test Checklist

1. Arşivlenmiş öğrenciyi geri al → hata vermemeli, planned instance'lar oluşmalı
2. Aynı gün 2 dersi olan öğrenci → iki ayrı instance üretilmeli
3. Shift-next zinciri 2 dersli öğrencide → doğru sırayla kaymalı
4. "Kalan dersleri güncelle" 2 dersli öğrencide → doğru tarihler üretilmeli
5. Tekil ders düzenleme (1 seferlik değiştir) → self-conflict olmamalı
6. Template sync sonrası → instance'lar template'e uygun olmalı
7. Tek-slot-per-day öğrenci → mevcut davranış korunmalı

