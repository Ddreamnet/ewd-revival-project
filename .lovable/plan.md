

# Güncellenmiş Plan — Ders Programı Sistemi Temizlik ve Düzeltme

## Scope Kontrolü

- **Aynen korunan maddeler**: Phase 1 cleanup (ölü kod silme, lessonSync taşıma, EditStudentDialog fetch birleştirme), Phase 2 Düzeltme 1 (rpc_restore_student), Phase 2 Düzeltme 3 (excludeStudentId in handleOneTimeChange)
- **Revize edilen maddeler**: Phase 2 Düzeltme 2 (multi-slot + shift mantığı — product beklentisine göre güncellendi), Phase 2 conflict detection başlığı (syncTemplateChange eklendi)
- **Yeni eklenen maddeler**: `syncTemplateChange` conflict fix, `checkTeacherConflictsBatch` dead code temizliği, same-day cascade shift mantığı, ek audit noktaları
- **Değişmeyen**: Phase 1 → Phase 2 sırası aynı kalıyor. Restore için ek scope açılmıyor.

---

## PHASE 1 — Kod Temizliği / Hazırlık (AYNEN KORUNUYOR)

### 1. Ölü kodu temizle
- `lessonDateCalculation.ts`: `calculateLessonDates` ve `recalculateRemainingDates` sil (hiçbir yerden import edilmiyor)
- `calculateNextLessonDate` kalacak

### 2. `lessonSync.ts` dosyasını kaldır
- `checkNonTemplateWeekday` fonksiyonunu `lessonDateCalculation.ts`'e taşı
- `lessonSync.ts`'i sil
- Import'ları güncelle (EditStudentDialog, LessonOverrideDialog)

### 3. `EditStudentDialog.tsx` duplicate fetch temizliği
- `fetchStudentIds`, `fetchTrackingRecordId`, `fetchInstances` → tek `initializeDialog` fonksiyonuna birleştir
- `fetchTrackingRecordId` hiçbir yerden çağrılmıyor — kaldır

### 4. `checkTeacherConflictsBatch` dead code temizliği *(YENİ)*
- Bu fonksiyon hiçbir dosyadan import edilmiyor — `conflictDetection.ts`'den sil
- Gelecekte gerekirse `excludeStudentId` destekli şekilde yeniden yazılır

### 5. Aynı gün iki ders audit noktaları (davranış değiştirmeden işaretle)
- `instanceGeneration.ts:234` — `shiftLessonsForward` içinde `addDays(..., 1)` → aynı gündeki sonraki slotu atlıyor
- `instanceGeneration.ts:131-143` — `syncTemplateChange` içinde kırılgan manuel conflict filtresi

---

## PHASE 2 — Düzeltmeleri Uygula

### Düzeltme 1: `rpc_restore_student` PL/pgSQL hatası (AYNEN KORUNUYOR)

Migration ile `v_slot.s` → `v_slot` düzeltmesi. `AS s` kaldır. `rpc_reset_package` ile aynı pattern.

**Restore notu**: Restore akışı için ek davranış değişikliği hedeflenmiyor. Veri bütünlüğü açısından bilinen artçı risk: `lesson_number` sıralaması completed instance'larla ardışık olmayabilir ama UI `lesson_date + start_time` sıralaması kullandığı için fonksiyonel etki yok.

### Düzeltme 2: Multi-slot üretimi + Same-day cascade shift *(REVİZE EDİLDİ)*

#### 2a. `generateFutureInstanceDates` çok-slot desteği (AYNEN KORUNUYOR)
`.find()` yerine `.filter()` + `startTime` sıralama. Aynı gündeki tüm slotlar ayrı ayrı üretilir.

#### 2b. `shiftLessonsForward` same-day cascade shift *(YENİ — product beklentisi)*

**Mevcut sorun**: Satır 234'te `addDays(new Date(toShift[0].lesson_date), 1)` her zaman ertesi günden başlatıyor. Aynı günde sonraki slot varsa onu atlıyor.

**Product beklentisi**:
- Öğrencinin Pzt 10:00 ve Pzt 11:00 dersleri var
- Pzt 10:00 "sonraki derse aktar" → ertelenen ders Pzt 11:00 slotuna kaymalı, mevcut 11:00 dersi de sonraki uygun slota kaymalı
- Tekrar "sonraki derse aktar" → zincirleme devam etmeli

**Çözüm**: `shiftLessonsForward` içindeki `startDate` hesabını değiştir:

```text
Mevcut:  startDate = addDays(toShift[0].lesson_date, 1)  // her zaman ertesi gün
Yeni:    startDate = toShift[0].lesson_date               // aynı günden başla
         + startTime filtresi: aynı gündeki slotlardan sadece
           mevcut slot'un startTime'ından SONRA gelenleri dahil et
```

Somut mantık:
1. `startDate` = hedef instance'ın aynı günü (ertesi gün değil)
2. `generateFutureInstanceDates`'e yeni bir `afterTime` parametresi ekle (opsiyonel)
3. `afterTime` verildiğinde, `startDate` gününde sadece `startTime > afterTime` olan slotları dahil et
4. Sonraki günlerde tüm slotları normal dahil et
5. `shiftLessonsForward` çağrısında `afterTime = toShift[0].start_time` geç

**Senaryo simülasyonu (doğrulama)**:
- Pzt 10:00 shift → `startDate=Pzt, afterTime=10:00` → ilk bulunan: Pzt 11:00 ✅
- Pzt 11:00 shift → `startDate=Pzt, afterTime=11:00` → aynı gün slot yok → sonraki hafta Pzt 10:00 ✅
- Tek-slot öğrenci Pzt 10:00 shift → `afterTime=10:00` → aynı gün başka slot yok → sonraki Pzt 10:00 ✅ (davranış değişmedi)

**Etki analizi**:
- `generateFutureInstanceDates` imzasına opsiyonel `afterTime` ekleniyor — mevcut çağrılar etkilenmez (parametre opsiyonel)
- `syncTemplateChange` bu parametreyi kullanmaz — etkilenmez
- `EditStudentDialog.confirmDateUpdate` bu parametreyi kullanmaz — etkilenmez
- `rpc_reset_package` / `rpc_restore_student` server-side, etkilenmez
- Remaining lessons update etkilenmez (shift sonrası doğru pozisyonlar üretilir)

**Değişecek dosya**: `src/lib/instanceGeneration.ts` — `generateFutureInstanceDates` + `shiftLessonsForward`

### Düzeltme 3: `handleOneTimeChange` eksik `excludeStudentId` (AYNEN KORUNUYOR)

`LessonOverrideDialog.tsx` satır 208-214'teki `checkTeacherConflicts` çağrısına `studentId` ekle.

### Düzeltme 4: `syncTemplateChange` conflict false positive *(YENİ)*

**Mevcut sorun** (satır 131-143): `checkTeacherConflicts` `excludeStudentId` olmadan çağrılıyor. Ardından kırılgan bir manuel filtre uygulanıyor:

```typescript
// Mevcut — kırılgan:
const externalConflicts = conflicts.filter(
  (c) => c.type === "trial" || !existing.some(
    (e) => e.lesson_date === nd.lessonDate && e.start_time === nd.startTime
  )
);
```

Bu filtre sadece tam eşleşmeye (date + startTime) bakıyor, overlap'e değil. Aynı gün farklı saatte instance varsa yakalanmıyor.

**Çözüm**: Manuel filtreyi kaldır, `checkTeacherConflicts`'e doğrudan `excludeStudentId` parametresini geç:

```typescript
// Yeni — temiz:
const conflicts = await checkTeacherConflicts(
  teacherId, nd.lessonDate, nd.startTime, nd.endTime,
  undefined,  // excludeInstanceId — gerekmiyor, tüm öğrenci exclude
  studentId   // excludeStudentId — öğrencinin kendi instance'ları atlanır
);
allConflicts.push(...conflicts);
```

**Değişecek dosya**: `src/lib/instanceGeneration.ts` satır 130-143

### Ek Audit Noktaları *(YENİ)*

Aşağıdaki noktalar Phase 2 sırasında taranacak, sorun bulunursa düzeltilecek:

| Dosya | Risk | Kontrol |
|-------|------|---------|
| `useScheduleGrid.ts` — `getActualLessonForDayAndTime` | `student+date+time` bazlı eşleşme | Aynı gün iki ders varsa ikisi de grid'de ayrı gösteriliyor mu |
| `useScheduleGrid.ts` — `ensureInstancesForWeek` | Template loop | `for of studentTemplates` — çok-slot güvenli ✅ (ama doğrulanacak) |
| `EditStudentDialog.tsx` — `confirmDateUpdate` | Instance sıralaması | Aynı gün iki slot varsa `plannedAfterChanged` doğru mu |
| `LessonOverrideDialog.tsx` — shift sonrası UI state | Local state | Shift sonrası `fetchActualSchedule` tetikleniyor mu |

---

## Phase 2 Uygulama Sırası

1. **Düzeltme 1** — rpc_restore_student (izole, sıfır risk)
2. **Düzeltme 4** — syncTemplateChange conflict fix (izole, düşük risk)
3. **Düzeltme 2** — multi-slot üretimi + same-day cascade shift (en geniş etki)
4. **Düzeltme 3** — excludeStudentId in handleOneTimeChange (tek satır)

## Regresyon Riskleri

- **Düzeltme 2b (cascade shift)**: En riskli değişiklik. `afterTime` parametresi opsiyonel olduğu için mevcut çağrılar bozulmaz. Ama shift zincirinin edge-case'leri (3+ ders aynı gün, son ders shift, cycle sonu) dikkatle test edilmeli.
- **Düzeltme 4 (syncTemplateChange)**: Manuel filtre kaldırılıyor — `excludeStudentId` bunun yerine geçiyor. Aynı pattern `shiftLessonsForward`'da zaten çalışıyor.
- Diğer düzeltmeler sıfır risk.

## Test Checklist

1. Arşivlenmiş öğrenciyi geri al → hata vermemeli
2. Aynı gün 2 dersi olan öğrenci → iki ayrı instance üretilmeli
3. Pzt 10:00 shift → Pzt 11:00'e kaymalı (same-day cascade)
4. Pzt 11:00 shift → sonraki hafta Pzt 10:00'e kaymalı
5. Zincirleme shift → doğru sırayla devam etmeli
6. Template sync → self-conflict false positive olmamalı
7. Tek-slot öğrenci shift → mevcut davranış korunmalı
8. "Kalan dersleri güncelle" çift-slot öğrencide → doğru tarihler

