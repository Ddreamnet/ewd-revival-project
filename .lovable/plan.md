

# Paket Biten Öğrencilerin Ders Programında Görünmeye Devam Etmesi

## Kök Neden

`useScheduleGrid.ts` dosyasındaki `ensureInstancesForWeek()` fonksiyonu, satır 265'te paketi dolan öğrencileri atlıyor:

```typescript
if (existingInCycle >= totalRights) continue; // Package exhausted
```

Bu yüzden paketi biten öğrenci için gelecek haftalara yeni `lesson_instances` üretilmiyor. "Güncel" mod yalnızca `lesson_instances` tablosundan okuyarak grid'i doldurduğu için bu öğrenciler programdan düşüyor.

## Mevcut Akış

1. Hafta navigasyonu yapılınca `fetchActualLessonsForWeek()` çağrılıyor
2. Bu fonksiyon önce `ensureInstancesForWeek()` ile eksik instance'ları üretiyor
3. Paketi dolan öğrenciler bu üretimden atlanıyor
4. Sonra sadece mevcut `lesson_instances` sorgulanıyor → paketi biten öğrenci yok

## Çözüm Yaklaşımı

Veritabanına sahte instance üretmeden, **fetch seviyesinde** template slotlarından "ghost" girdiler oluşturup bunları gerçek instance'larla birlikte döndürmek. Ghost girdiler yalnızca görsel amaçlı; DB'ye yazılmayacak.

### Değişecek Dosyalar

| Dosya | Değişiklik |
|-------|-----------|
| `src/hooks/useScheduleGrid.ts` | `ActualLesson` interface'ine `isGhost?: boolean` ekle; `fetchActualLessonsForWeek` içinde paketi dolan aktif öğrencilerin template slotlarından ghost entry üret |
| `src/components/AdminWeeklySchedule.tsx` | Ghost ders kartında sağ üstte küçük ikon göster; ghost derse tıklamayı engelle |
| `src/components/WeeklyScheduleDialog.tsx` | Aynı ghost ikon mantığı |

### Teknik Detay

**`useScheduleGrid.ts` — `fetchActualLessonsForWeek`:**

1. Mevcut akışla gerçek instance'ları getir
2. Aktif öğrencilerin template slotlarını (`student_lessons`) ve tracking bilgilerini (`student_lesson_tracking`) al
3. Bu haftada instance'ı olmayan ve paketi dolan (`existingInCycle >= totalRights`) öğrenciler için template'den sanal `ActualLesson` girdileri üret:
   - `id`: `ghost-{studentId}-{date}-{time}` (geçici, DB'de yok)
   - `isGhost: true`
   - `status: "planned"`, `rescheduled_count: 0`
   - `lesson_date`: template day_of_week'ten o haftanın tarihine çevrilmiş
4. Bunları gerçek instance'larla birleştirip döndür

**`AdminWeeklySchedule.tsx` + `WeeklyScheduleDialog.tsx`:**

- Ghost kart rendering: mevcut kart yapısı korunacak, sadece `isGhost === true` ise:
  - Sağ üstte küçük `AlertCircle` (lucide) ikonu, `text-amber-500`, 12px
  - Karta `opacity-60` eklenir
  - `onClick` devre dışı (tıklanamaz, override/shift açılmaz)
- Karşılık gelen renk sistemi aynen kullanılır
- Tüm mevcut kart düzeni, grid, spacing korunur

### Arşivli/Silinmiş Öğrenci Ayrımı

Mevcut `is_archived = false` filtresi korunacak. Ghost üretimi yalnızca aktif öğrenciler için yapılır. Arşivli veya silinmiş öğrenci hiçbir şekilde görünmez.

### Paket Yenilenince İkon Kalkması

Paket yenilendiğinde (`rpc_reset_package`) yeni cycle başlar ve yeni planned instance'lar üretilir. Bu durumda `ensureInstancesForWeek` normal instance üretir → ghost koşulu sağlanmaz → ikon otomatik olarak yok.

### UI Değişikliği Kapsamı

- Yeni buton, badge, kart düzeni, modal, filtre YOK
- Sadece mevcut kartın sağ üstüne koşullu küçük ikon
- Mevcut opacity/renk sistemiyle uyumlu

## Test Senaryoları

1. Aktif öğrenci, paketi bitmiş → gelecek haftalarda ghost kart + ikon görünür
2. Aynı öğrenci paketi yenilenince → normal kart, ikon yok
3. Arşivli öğrenci → hiç görünmez
4. Silinmiş öğrenci → hiç görünmez
5. Aktif + paketli öğrenci → normal kart, regresyon yok
6. Admin paneli ve öğretmen paneli aynı davranış
7. Template (Kalıcı) modda değişiklik yok
8. Ghost karta tıklayınca override dialog açılmaz
9. İşlenen dersler alanında değişiklik yok

