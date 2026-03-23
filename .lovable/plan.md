

# Plan: Rescheduled UI İşaretleri + Warning-Only Conflict + Aynı Slotta Çoklu Ders Render

## İstek 1: Sarı Çerçeve + Takvim İkonu Sadece "1 Seferlik Değiştir" İçin

### Mevcut Durum
Sarı ring (`ring-2 ring-amber-400`) ve `Calendar` ikonu `rescheduled_count > 0` koşuluna bağlı. Bu sayaç şu 3 akışta artırılıyor:
1. **"1 seferlik değiştir"** — `LessonOverrideDialog.tsx` satır 246
2. **"Sonraki derse aktar"** — `instanceGeneration.ts` satır 276 (`shiftLessonsForward`)
3. **Öğrenci ayarları diyaloğundan değişiklik** — `EditStudentDialog.tsx` satır 355

Kullanıcı yalnızca #1 için bu görselleri istiyor.

### Çözüm: `is_manual_override` boolean sütunu

Mevcut `rescheduled_count` ve `original_date` alanları revert akışı için hâlâ gerekli — dokunulmayacak. Yeni bir `is_manual_override boolean NOT NULL DEFAULT false` sütunu eklenerek ayrım yapılacak.

**Yazma noktaları:**
- `handleOneTimeChange` (LessonOverrideDialog): `is_manual_override: true` set et
- `shiftLessonsForward` (instanceGeneration): dokunma, `false` kalır
- `confirmDateUpdate` (EditStudentDialog): dokunma, `false` kalır
- `handleRevert` (LessonOverrideDialog): `is_manual_override: false` geri al

**Okuma noktaları (UI koşul değişikliği):**
- `AdminWeeklySchedule.tsx` satır 582, 588, 624, 634: `rescheduled_count > 0` → `is_manual_override === true`
- `WeeklyScheduleDialog.tsx` satır 317, 321, 336, 343: aynı değişiklik
- `LessonTracker.tsx`: varsa aynı değişiklik

**Veri modeli:**
- `ActualLesson` interface'ine (`useScheduleGrid.ts` satır 34) `is_manual_override: boolean` ekle
- `fetchActualLessonsForWeek` sorgusuna bu field'ı dahil et

**Geçmiş veri etkisi:** Mevcut override edilmiş instance'lar `false` olarak kalacak — retrospektif sarı çerçeve kaybolur. Bu kabul edilebilir bir trade-off.

### Değişecek Dosyalar
| Dosya | Değişiklik |
|-------|-----------|
| Migration SQL | `ALTER TABLE lesson_instances ADD COLUMN is_manual_override boolean NOT NULL DEFAULT false` |
| `useScheduleGrid.ts` | `ActualLesson` interface + fetch query |
| `LessonOverrideDialog.tsx` | `handleOneTimeChange`: `is_manual_override: true`, `handleRevert`: `is_manual_override: false` |
| `AdminWeeklySchedule.tsx` | 4 yerde koşul değişikliği |
| `WeeklyScheduleDialog.tsx` | 4 yerde koşul değişikliği |

---

## İstek 2: Conflict Warning-Only + Aynı Slotta Çoklu Ders Render

### A) Warning-Only Conflict

**Mevcut blocking noktaları (6 adet):**

| Dosya | Blocking Mekanizması |
|-------|---------------------|
| `LessonOverrideDialog.tsx` satır 217-221 | `if (conflicts.length > 0) { setConflicts(...); return; }` |
| `LessonOverrideDialog.tsx` satır 479, 489, 514 | `disabled={conflicts.length > 0}` butonlarda |
| `AddTrialLessonDialog.tsx` satır 73-76 | `if (conflicts.length > 0) { setConflicts(...); return; }` |
| `AddTrialLessonDialog.tsx` satır 163 | `disabled={conflicts.length > 0}` |
| `EditStudentDialog.tsx` satır 346-348 | `if (c.length > 0) { setConflicts(c); return; }` |
| `instanceGeneration.ts` satır 258-261 | `shiftLessonsForward`: `if (allConflicts.length > 0) return { conflicts, success: false }` |
| `instanceGeneration.ts` satır 146-148 | `syncTemplateChange`: conflict varsa `return { conflicts }` |

**Çözüm yaklaşımı:**

1. **`LessonOverrideDialog`**: Conflict bulunduğunda `return` yerine uyarı göster + "Yine de kaydet" butonu ekle. Mevcut conflict UI (kırmızı box) korunacak, altına `Button variant="destructive"` ile "Yine de Kaydet" eklenir. Butonlardaki `disabled={conflicts.length > 0}` kaldırılmaz ama "Yine de Kaydet" butonu disabled olmaz.
2. **`AddTrialLessonDialog`**: Aynı pattern — conflict göster + "Yine de Onayla" butonu.
3. **`EditStudentDialog`**: Aynı pattern — conflict göster + devam seçeneği.
4. **`shiftLessonsForward`**: Conflict'leri caller'a döndür ama `success: true` ile. Caller uyarı gösterip devam edebilir. Veya daha basit: conflict check'i tamamen kaldır (shift zaten otomatik, kullanıcı zaten kabul etti).
5. **`syncTemplateChange`**: Conflict'leri bilgilendirme olarak döndür ama instance'ları yine oluştur.

**Önerilen en sade yaklaşım:** Her dialog'da conflict bulunduğunda `return` satırını kaldır, yerine state'e at. UI'da uyarıyı göster ama butonları disable etme. Kullanıcı isterse uyarıyı görmezden gelip kaydedebilir.

### B) Aynı Slotta Çoklu Ders Render

**Mevcut sorun:** `getActualLessonForDayAndTime` (satır 483) `.find()` kullanıyor — aynı slotta sadece ilk dersi döndürüyor.

**Çözüm:**

1. Yeni helper: `getActualLessonsForDayAndTime` (çoğul) — `.filter()` ile tüm eşleşenleri döndür
2. Grid render değişikliği (`AdminWeeklySchedule.tsx` + `WeeklyScheduleDialog.tsx`):

```text
<td className="border border-border p-1">
  <div className="flex gap-0.5 h-full">
    {lessons.map(lesson => (
      <Button className="flex-1 min-w-0 px-1 text-[10px] truncate">
        {name} {time}
      </Button>
    ))}
  </div>
</td>
```

- `flex-1 min-w-0` ile kartlar eşit genişlikte sıkışır
- `overflow-hidden text-ellipsis` ile taşan isim kesilir
- `<td>` boyutu sabit kalır (mevcut CSS korunur)
- 3+ ders olursa kartlar daha da sıkışır — pratikte 2 ders yeterli

**Back-to-back gruplar:** Mevcut back-to-back mantığı `student_id` eşleşmesi yapıyor — farklı öğrencilerin aynı slottaki dersleri gruplanmaz. Bu doğru davranış, dokunulmayacak.

**Mobil/tablet:** Kartlar zaten `min-w-0` ile sıkışıyor. Küçük ekranlarda isim daha çok kesilir ama hücre boyutu değişmez.

### Değişecek Dosyalar (İstek 2)
| Dosya | Değişiklik |
|-------|-----------|
| `useScheduleGrid.ts` | Yeni `getActualLessonsForDayAndTime` helper |
| `AdminWeeklySchedule.tsx` | Grid render: tekil → çoklu ders, conflict UI: disabled kaldır |
| `WeeklyScheduleDialog.tsx` | Aynı grid render değişikliği |
| `LessonOverrideDialog.tsx` | Blocking → warning-only (return kaldır, "Yine de Kaydet" ekle) |
| `AddTrialLessonDialog.tsx` | Blocking → warning-only |
| `EditStudentDialog.tsx` | Blocking → warning-only |
| `instanceGeneration.ts` | `shiftLessonsForward` ve `syncTemplateChange`: conflict'te devam et |

---

## Riskler / Edge-case'ler

- **3+ ders aynı slotta**: Kartlar çok küçülür, isimler neredeyse okunamaz. Pratik limit 2-3. Tooltip ile tam isim gösterilebilir.
- **Warning-only sonrası gerçek çakışmalar**: Öğretmen fiziksel olarak aynı anda iki derse giremez — bu artık kullanıcının sorumluluğu.
- **Retrospektif veri**: Mevcut `rescheduled_count > 0` olan instance'lar artık sarı çerçeve göstermeyecek.
- **Back-to-back + farklı öğrenci overlap**: Aynı slotta hem back-to-back grup hem farklı öğrenci varsa render karmaşıklaşabilir. Düşük olasılık ama ele alınmalı.

## Uygulama Sırası

1. **Migration**: `is_manual_override` sütunu ekle
2. **Veri katmanı**: `ActualLesson` interface + fetch query + yeni çoğul helper
3. **LessonOverrideDialog**: `is_manual_override` yazma + warning-only conflict
4. **AddTrialLessonDialog**: Warning-only conflict
5. **EditStudentDialog**: Warning-only conflict
6. **instanceGeneration.ts**: `shiftLessonsForward` / `syncTemplateChange` conflict'te devam
7. **AdminWeeklySchedule + WeeklyScheduleDialog**: `is_manual_override` koşulu + çoklu ders render

