

# Implementation Plan: Manual Chain Controls — Revize v3

## Koray Kök Neden Analizi

### Sorun
`computeMinSlot()` (satır 543-556) `instances` dizisine bakıyor. Bu dizi `fetchInstances()` tarafından **current cycle ile filtrelenmiş** durumda (satır 102, 138). Koray'ın son completed dersi (22.03) **önceki cycle'da** — `computeMinSlot()` onu görmüyor, fallback ile `today → 26.03` boundary hesaplıyor.

### 24.03'te görünenler ne?
Ghost/derived kayıtlar. `useScheduleGrid.ts` içindeki `ghostEntries` mantığı template slotlarından türetilmiş görsel kayıtlar. Gerçek planned instance değiller.

### Doğru boundary neden 24.03?
- Son completed: 22.03 Pazar 17:30
- Template slotları: Salı 16:40, Salı 17:20, Perşembe 17:30
- `generateFutureInstanceDates(slots, 1, "2026-03-22", "17:30")` → **24.03 Salı 16:40**
- Geri ok sınırı 24.03 Salı 16:40 olmalı, 26.03 değil

---

## Truth Source Ayrışma Analizi

Sistemde 4 farklı katman aynı veriyi farklı kurallarla hesaplıyor:

| Katman | Truth Source | Sorun |
|--------|-------------|-------|
| `EditStudentDialog` ders listesi | `lesson_instances` current cycle only | Önceki cycle completed'ları görmüyor |
| `computeMinSlot()` boundary | Dialog içi `instances` (current cycle) | Yanlış anchor — önceki cycle'daki completed kaçırılıyor |
| `handleRealignChain()` anchor | Dialog içi `instances` (current cycle) | Aynı problem — realign de yanlış anchor alabilir |
| `useScheduleGrid` ghost/warning | Template + tüm cycle instance'ları | Gerçek planned olmayan slotları gösteriyor |

**Kopukluk:** Dialog ve chain kontrolleri **sadece current cycle** görürken, schedule grid **tüm geçmişi** hesaba katıyor. Bu yüzden grid'de 24.03 uyarı görünüyor ama dialog zinciri 26.03'ten başlıyor.

---

## Aynen Kalan Bölümler (v2'den)

- **A)** Chain data model assessment — değişiklik yok
- **B)** Realign algoritması — in-place update, override koruması, resequence — aynen
- **C)** Arrow mantığı — forward/backward slot shifting — aynen
- **D)** Duplicate prevention strategy — aynen
- **E)** Schedule grid sync strategy — aynen
- **F)** Optimistic UI — aynen
- **H)** Implementation order — genişletildi (aşağıda)
- **I)** Edge cases — genişletildi (aşağıda)

---

## Revize Edilen: Boundary ve Anchor Hesabı

### Fix 1: `computeMinSlot()` — tüm cycle'lardaki son completed'a baksın

Mevcut (hatalı):
```typescript
const completed = instances.filter((i) => i.status === "completed");
// instances = current cycle only → önceki cycle completed kaçırılıyor
```

Düzeltme: `computeMinSlot()` içinde ayrı bir DB sorgusu yapılacak:
```typescript
const { data } = await supabase
  .from("lesson_instances")
  .select("lesson_date, start_time")
  .eq("student_id", studentUserId)
  .eq("teacher_id", teacherUserId)
  .eq("status", "completed")
  .order("lesson_date", { ascending: false })
  .order("start_time", { ascending: false })
  .limit(1);
```

Bu sorgu **tüm cycle'ları** tarar. Sonuç `generateFutureInstanceDates(slots, 1, lastDate, lastTime)` ile minSlot'a dönüştürülür.

### Fix 2: `handleRealignChain()` — aynı cross-cycle anchor

`handleRealignChain()` (satır 594-604) da aynı `instances.filter` ile anchor hesaplıyor. Aynı cross-cycle sorguyu kullanacak.

### Fix 3: Ortak helper — `fetchLastCompletedAnchor()`

Tekrarı önlemek için yeni bir async helper:
```typescript
const fetchLastCompletedAnchor = async (): Promise<{ lessonDate: string; startTime: string } | null>
```

Bu helper şu yerlerde kullanılacak:
- `computeMinSlot()` → backward boundary
- `handleRealignChain()` → realign anchor
- `canShiftBackward` hesabı

**Not:** `computeMinSlot()` async olacak. `canShiftBackward` hesabı da async'e dönmeli — bu bir `useMemo` yerine `useState` + `useEffect` ile hesaplanmalı.

### Koray'da yeni davranış
- `fetchLastCompletedAnchor()` → `{lessonDate: "2026-03-22", startTime: "17:30"}`
- `generateFutureInstanceDates(slots, 1, "2026-03-22", "17:30")` → `{lessonDate: "2026-03-24", startTime: "16:40"}`
- Backward boundary = **24.03 Salı 16:40** (doğru)

---

## Backward Boundary Rule (Revize v3 — Final)

```
1. fetchLastCompletedAnchor() — TÜM cycle'lar, lesson_date+start_time DESC, LIMIT 1
2. Varsa: generateFutureInstanceDates(templateSlots, 1, lastDate, lastTime) → minSlot
3. Yoksa: generateFutureInstanceDates(templateSlots, 1, today) → minSlot
4. Backward arrow sonucu >= minSlot olmalı, değilse disabled/no-op
```

Same-day multi-slot örneği (aynen v2'den):
- Son completed = Salı 16:40 → minSlot = Salı 17:20
- Backward en fazla Salı 17:20'ye kadar

Realign de aynı anchor'ı kullanır (afterTime mekanizmasıyla).

---

## Eklenen: Truth Source Koordinasyon Planı

### Phase 1 (Bu PR — Koray fix)
1. `fetchLastCompletedAnchor()` helper ekle
2. `computeMinSlot()` ve `handleRealignChain()` bu helper'ı kullansın
3. `canShiftBackward` async state'e dönüşsün

### Phase 2 (Sonraki PR — Koordinasyon iyileştirmesi)
Şu an ayrı scope. Ama plana kaydediyoruz:

**Ghost/Schedule ile dialog arasındaki kopukluk:**
- `useScheduleGrid` ghost mantığı `cycleCountMap` üzerinden "exhausted" kontrolü yapıyor
- Dialog chain kontrolleri `instances` (current cycle) üzerinden çalışıyor
- İkisi farklı veriyi referans aldığı için "grid'de uyarı var ama dialog'da o slot yok" durumu oluşuyor

**Olası iyileştirme:**
- Ghost üretimi ile chain boundary'nin aynı anchor kuralını kullanması
- En azından: "uyarı ikonu görünen slot varsa, backward arrow o slota kadar inebilmeli" tutarlılığı

Bu v3 PR'ında ghost mantığına dokunulmayacak; sadece boundary hesabı düzeltilecek.

---

## G) Files to Modify (Güncel)

| File | Change |
|------|--------|
| `src/lib/instanceGeneration.ts` | `getSlotBefore` helper — aynen v2 |
| `src/hooks/useEditStudentDialog.ts` | `fetchLastCompletedAnchor()` helper ekle. `computeMinSlot()` async yapıp cross-cycle sorgu kullan. `canShiftBackward` → `useState` + `useEffect`. `handleRealignChain` anchor'ı bu helper'dan alsın. |
| `src/components/EditStudentDialog.tsx` | UI buttons — aynen v2 |

No new RPC. No migration. No new table.

---

## H) Implementation Order (Güncel)

1. `getSlotBefore` helper → `instanceGeneration.ts`
2. `fetchLastCompletedAnchor()` helper → `useEditStudentDialog.ts`
3. `computeMinSlot()` async refactor + cross-cycle query
4. `canShiftBackward` → async state (`useState` + `useEffect`)
5. `handleRealignChain` anchor'ı `fetchLastCompletedAnchor` ile güncelle
6. UI buttons → `EditStudentDialog.tsx`

---

## I) Edge Cases (Güncel)

- All lessons completed → arrows disabled, realign disabled
- No completed lessons (hiçbir cycle'da) → boundary = first template slot from today
- Completed sadece önceki cycle'da → **cross-cycle sorgu doğru anchor verir** (Koray vakası)
- Only manual overrides remaining → no-op
- Package exhausted → all controls disabled
- Rapid clicks → loading guard
- 24.03'te görünenler ghost ise → backward arrow 24.03'e inebilir ama orada gerçek instance yoksa chain o slotlara planned üretir (in-place update — mevcut instance'lar taşınır, yeni instance üretilmez)

---

## Duplicate ve Veri Kaybı Riski

| Risk | Mitigation |
|------|-----------|
| Cross-cycle completed sorgusu yanlış veri dönerse | `ORDER BY lesson_date DESC, start_time DESC LIMIT 1` — deterministik, tek satır |
| canShiftBackward async race | `shifting` loading guard zaten var, ek `useEffect` dependency'leri doğru set edilecek |
| Ghost slot'a geri kaydırınca duplicate | In-place UPDATE — ghost gerçek instance değil, DB'de karşılığı yok, chain kontrolleri sadece gerçek `lesson_instances` satırlarını taşır |
| Realign + arrow aynı anda | `shifting` state her ikisini de bloklar |

---

## Revision Summary (v2 → v3)

- **Aynen kalan**: Realign algoritması, forward arrow, duplicate prevention, sync strategy, optimistic UI, `getSlotBefore` helper, override koruması
- **Revize edilen**:
  - `computeMinSlot()`: current cycle `instances` → **cross-cycle DB sorgusu** (`fetchLastCompletedAnchor`)
  - `handleRealignChain()` anchor: aynı cross-cycle helper
  - `canShiftBackward`: senkron hesap → **async state**
- **Eklenen**:
  - Truth source ayrışma analizi
  - Phase 2 koordinasyon planı (ghost/schedule hizalaması — ayrı PR)
  - 24.03 ghost vs planned açıklaması
- **Koray fix özeti**:
  - Sorun: `computeMinSlot()` sadece current cycle'a bakıyordu
  - Çözüm: Tüm cycle'lardaki son completed'a bakan cross-cycle sorgu
  - Sonuç: Boundary 26.03 → **24.03 Salı 16:40**

