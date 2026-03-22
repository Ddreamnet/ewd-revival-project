

# Ders Programı — İlk Yükleme Performans Optimizasyonu (2. Tur)

## Bulunan Darboğazlar

### 1. `ensureInstancesForWeek` her çağrıda 3+ sorgu atıyor (en büyük darboğaz)
`fetchActualLessonsForWeekCore` her çağrıldığında **önce** `ensureInstancesForWeek`'i bekliyor. Bu fonksiyon her seferinde:
- templates sorgusu
- activeStudents sorgusu  
- existingInstances sorgusu
yapıyor. Çoğu zaman haftanın instance'ları zaten mevcut ve hiçbir şey insert etmiyor. Ama yine de **3 round-trip** harcıyor.

**Çözüm**: Module-level `ensuredWeeks` Set cache'i. Bir teacher+week için ensure çalıştıysa, aynı session'da tekrar çalıştırma. Mutation sonrası (shift/revert/complete) cache temizlenir.

### 2. Eksik composite index
Ana fetch sorgusu `teacher_id + lesson_date range + status IN ('planned','completed')` filtresi kullanıyor. Mevcut index `(teacher_id, lesson_date, start_time, end_time)` status'ü kapsamıyor. Ayrıca `ensureInstancesForWeek`'teki `student_id + teacher_id + lesson_date range` sorgusu da tam indexli değil.

**Çözüm**: `(teacher_id, status, lesson_date)` composite index ekle.

### 3. Admin panelinde template + actual fetch sıralı
İlk mount'ta `fetchSchedule` (template) ve `fetchActualSchedule` (actual) ayrı useEffect'lerde tetikleniyor. Birbirinden bağımsız oldukları halde sıralı çalışıyorlar.

**Çözüm**: İlk mount'ta ikisini paralel çalıştır.

## Beklenen İyileşme

- **ensuredWeeks cache**: Cache hit durumunda 3 round-trip tamamen elenir → ilk hafta sonrası her geçişte ~100-200ms tasarruf, prefetch'li haftalar anında
- **Composite index**: Tüm lesson_instances sorgularında scan süresini azaltır (veri büyüdükçe etkisi artar)
- **Paralel fetch**: İlk açılışta template + actual verisi eşzamanlı gelir → ~30-40% daha hızlı ilk render

## Değişecek Dosyalar

| Dosya | Değişiklik |
|-------|-----------|
| `src/hooks/useScheduleGrid.ts` | `ensuredWeeks` Set cache + `clearWeekCache`'e ekleme |
| `src/components/AdminWeeklySchedule.tsx` | İlk mount'ta paralel fetch |
| Migration SQL | Composite index `(teacher_id, status, lesson_date)` |

## Regresyon Riski
- `ensuredWeeks` cache mutation sonrası temizlendiği için stale veri riski yok
- Index ekleme read-only ve mevcut sorguları bozmaz
- Paralel fetch sonucu aynı state güncellemeleri, sadece zamanlama değişir
- UI değişikliği yok

## Test Senaryoları
1. İlk açılış → template + actual aynı anda yüklenmeli
2. Hafta geçişi → ensuredWeeks cache sayesinde 3 sorgu atlanmalı
3. Shift/revert/complete sonrası → cache temizlenmeli, yeni veri doğru gelmeli
4. Ghost lesson haftası → doğru görünmeli
5. Çok öğrencili hafta → index sayesinde sorgu süresi azalmış olmalı

