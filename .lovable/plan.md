

# Ders Programı Performans Optimizasyonu

## Kök Neden

`fetchActualLessonsForWeek` fonksiyonu her hafta geçişinde **N+1 sorgu problemi** yaşıyor. İki kritik döngü var:

1. **`ensureInstancesForWeek`** (satır 231-261): Her "missing" öğrenci için **bireysel** `maxCompleted` ve `cycleCount` sorguları atıyor. 5 öğrenci varsa 10+ ekstra sorgu.

2. **Ghost üretimi** (satır 375-387): Her ghost aday öğrenci için **bireysel** `existingInCycleCount` sorgusu atıyor.

3. **Sıfır cache**: Her `weekOffset` değişikliğinde tüm sorgular sıfırdan çalışıyor. Geri dönüldüğünde bile aynı veriler yeniden çekiliyor.

4. **Sıfır prefetch**: Kullanıcı ileri/geri ok tıklayınca veri yüklenmesi o anda başlıyor.

Toplam: Tek hafta geçişinde **~10-20 Supabase round-trip** + `ensureInstancesForWeek` insert işlemi.

## Çözüm (3 katman)

### 1. N+1 sorgularını batch'leme (`useScheduleGrid.ts`)

**`ensureInstancesForWeek`:**
- Satır 231-246'daki per-student `maxCompleted` döngüsünü TEK sorguya çevir: tüm `missingStudents` için `lesson_instances` tablosundan `student_id, MAX(lesson_date) WHERE status='completed' AND package_cycle=X` şeklinde batch çek.
- Satır 256-261'deki per-student `existingInCycleCount` döngüsünü TEK sorguya çevir: tüm `missingStudents` için `student_id, COUNT(*)` group by student_id.

**Ghost üretimi:**
- Satır 375-387'deki per-student `existingInCycleCount` döngüsünü TEK sorguya çevir: tüm `templateStudentIds` için batch count.

Bu değişiklik tek başına sorgu sayısını ~15'ten ~6'ya düşürür.

### 2. Hafta bazlı cache (`useScheduleGrid.ts` + `AdminWeeklySchedule.tsx` + `WeeklyScheduleDialog.tsx`)

- `fetchActualLessonsForWeek` sonucunu hafta anahtarına (`teacherId-weekStartStr`) göre bir in-memory `Map` cache'inde tut.
- Hafta geçişinde önce cache kontrol et; varsa anında göster, arka planda refresh et (stale-while-revalidate).
- Cache'i invalidate: override/shift/revert/complete işlemlerinden sonra ilgili haftanın cache'ini temizle.

### 3. Komşu hafta prefetch

- `weekOffset` değiştiğinde, mevcut hafta yüklendikten sonra `weekOffset+1` ve `weekOffset-1` haftalarını arka planda prefetch et.
- Prefetch sonuçları cache'e yazılır; kullanıcı o haftaya geçtiğinde anında görünür.

## Değişecek dosyalar

| Dosya | Değişiklik |
|-------|-----------|
| `src/hooks/useScheduleGrid.ts` | N+1 batch'leme + module-level cache Map + prefetch helper |
| `src/components/AdminWeeklySchedule.tsx` | Cache'den instant display + prefetch trigger + cache invalidation on actions |
| `src/components/WeeklyScheduleDialog.tsx` | Aynı cache/prefetch mantığı |

## Teknik detay

**Cache yapısı** (module-level, `useScheduleGrid.ts`):
```
const weekCache = new Map<string, { data: ActualLesson[]; ts: number }>();
const CACHE_TTL = 60_000; // 1 dakika
```

**Batch sorgu örneği** (ensureInstancesForWeek):
```sql
-- Mevcut: N adet bireysel sorgu
-- Yeni: Tek sorgu
SELECT student_id, MAX(lesson_date) as max_date
FROM lesson_instances
WHERE teacher_id = X AND student_id IN (...) AND status = 'completed' AND package_cycle = Y
GROUP BY student_id
```
Supabase JS'de bu `.rpc()` veya raw query yerine, tüm cycle-filtered instance'ları tek sorguda çekip JS tarafında group-by yaparak çözülecek.

**Prefetch** (`AdminWeeklySchedule.tsx` / `WeeklyScheduleDialog.tsx`):
```typescript
useEffect(() => {
  if (!showTemplate) {
    // Mevcut haftayı yükle (cache varsa instant)
    fetchActualSchedule();
    // Komşu haftaları arka planda prefetch
    prefetchWeek(teacherId, getWeekStartForOffset(weekOffset + 1));
    prefetchWeek(teacherId, getWeekStartForOffset(weekOffset - 1));
  }
}, [weekOffset, showTemplate, teacherId]);
```

## Beklenen iyileşme

- **İlk yükleme**: ~15-20 round-trip → ~6 round-trip (N+1 eliminasyonu)
- **Cache'li hafta geçişi**: ~0ms (anında)
- **Prefetch'li ilk geçiş**: ~0ms (önceden yüklenmiş)
- **Cache yokken geçiş**: ~6 round-trip (batch sayesinde hala daha hızlı)

## Regresyon riski

- Cache invalidation doğru yapılmazsa eski veri gösterebilir → her mutasyon (shift/revert/complete/reschedule) sonrası `clearWeekCache()` çağrılacak
- Mevcut iş mantığına dokunulmuyor, sadece sorgu yapısı ve veri akışı optimize ediliyor
- UI değişikliği yok

## Test senaryoları

1. Bu hafta → sonraki hafta → geri: İkinci geçiş anında olmalı (cache)
2. Yoğun hafta (5+ öğrenci): İlk yükleme öncekinden belirgin hızlı
3. Ghost lesson olan hafta: Doğru görünmeli, performans düşmemeli
4. Shift/revert/complete sonrası: Güncel veri gösterilmeli (cache invalidated)
5. Admin ve öğretmen paneli aynı hızda çalışmalı
6. Template (Kalıcı) modda değişiklik yok

