

# Implementation Plan: Manual Chain Controls (Realign + Arrow Shift) — Revize v2

## A) Current Chain Data Model — Assessment

The chain is stored in `lesson_instances` with `lesson_date + start_time` as the de facto ordering. `lesson_number` is assigned at creation but NOT reliably re-sequenced after mutations. The `generateFutureInstanceDates` helper already handles same-day multi-slot correctly (sorts by dayOfWeek then startTime, uses `afterTime` to skip filled slots).

**Verdict: No pre-cleanup needed.** The existing `generateFutureInstanceDates` is the correct engine for both "realign" and "arrow shift". We reuse it directly.

---

## B) "Zinciri Yeniden Hizala" (Realign Chain)

### What it does
Takes all `planned` instances after the last `completed` instance (excluding `is_manual_override = true` instances) and regenerates their dates/times from the template slots.

### Algorithm
1. Find last completed instance (by date+time DESC)
2. Collect all planned instances sorted by date+time, split into:
   - **Protected**: `is_manual_override = true` — skip these entirely
   - **Realignable**: the rest
3. Calculate anchor: `startDate = lastCompleted.lesson_date`, `afterTime = lastCompleted.start_time` (if no completed: `startDate = today`, no afterTime)
4. Call `generateFutureInstanceDates(templateSlots, realignableCount, startDate, afterTime)`
5. In-place UPDATE each realignable instance with new date/time (no delete+insert = no duplicate risk)
6. Re-sequence `lesson_number` across all instances in cycle using date+time order

### Why in-place update, not delete+insert
- Preserves instance IDs (important for `shift_group_id`, `balance_events` references)
- Zero duplicate risk — same row count before and after
- `is_manual_override` instances keep their position untouched

### Implementation location
- New function `realignPlannedChain()` in `useEditStudentDialog.ts`
- Uses existing `generateFutureInstanceDates` from `instanceGeneration.ts`
- No new RPC needed — client-side batch update (same pattern as existing `batchUpdateInstances`)

---

## C) Arrow Buttons (Shift Chain Forward/Backward by 1 Slot)

### What "1 slot" means
Template slots sorted chronologically: e.g., [Tue 16:40, Tue 17:20, Thu 17:30]. One arrow press = shift entire planned chain by one position in this ordered slot list.

### Forward arrow
1. Get all planned instances (excluding `is_manual_override`)
2. Find first planned instance's current slot position in template
3. Call `generateFutureInstanceDates(templateSlots, count, firstPlannedDate, firstPlannedStartTime)`
   - This naturally produces the "next slot" onward
4. In-place update all realignable planned instances

### Backward arrow
1. Same collection of planned instances
2. Need to find the slot BEFORE the first planned instance
3. Build reverse lookup: given current first slot, find previous slot in the sorted template ring
4. **Boundary check**: see section below
5. Generate from that earlier slot position forward

### ~~REVISED~~ Backward Boundary Rule

**Önceki kural (hatalı):** Completed yoksa sınır = today.

**Yeni kural:** Geri kaydırmanın alt sınırı = son completed dersten sonraki **ilk uygun template slotu**.

Teknik hesaplama:

```
1. Son completed instance'ı bul (lesson_date DESC, start_time DESC)
2. generateFutureInstanceDates(templateSlots, 1, lastCompleted.lesson_date, lastCompleted.start_time)
   → Bu, tam olarak "completed'dan sonraki ilk uygun slot"u üretir
   → Buna "minSlot" diyelim: { date, startTime }
3. Backward arrow'un ürettiği yeni ilk slot >= minSlot olmalı
4. Eğer backward sonucu minSlot'un altına düşüyorsa → button disabled / no-op
```

**Completed hiç yoksa:**
- `minSlot = generateFutureInstanceDates(templateSlots, 1, today)` → bugünden itibaren ilk uygun template slotu
- Yani sınır "today" değil, "bugünden itibaren ilk uygun slot". Fark: bugün Çarşamba ama dersleri Salı/Perşembe ise, sınır Perşembe olur, Çarşamba'ya zaten gidilemez

**Same-day multi-slot örneği:**
- Koray: Salı 16:40, Salı 17:20, Perşembe 17:30
- Son completed = Salı 16:40
- `generateFutureInstanceDates(slots, 1, "Salı", "16:40")` → **Salı 17:20** (aynı gün, sonraki slot)
- minSlot = Salı 17:20
- Backward arrow, zinciri en fazla Salı 17:20'ye kadar geri çekebilir
- Salı 16:40'a (completed) veya öncesine inemez

**Bu kural realign için de geçerli mi?**
Evet. "Zinciri yeniden hizala" aksiyonunda da başlangıç anchor'ı aynı formülle hesaplanır: `generateFutureInstanceDates(templateSlots, 1, lastCompleted.date, lastCompleted.startTime)`. Realign zaten bu kuralı doğal olarak uygular çünkü `generateFutureInstanceDates`'e `afterTime` geçiyor — completed dersin zamanından sonraki ilk slottan başlar.

---

## D) Duplicate Prevention Strategy

| Risk | Mitigation |
|------|-----------|
| Same date+time duplicate | In-place UPDATE only, never INSERT+DELETE |
| Race condition (rapid clicks) | Disable arrows during pending mutation, loading state |
| Override collision | Filter out `is_manual_override = true` from all operations |
| lesson_number drift | Re-sequence after realign using `ROW_NUMBER() OVER (ORDER BY lesson_date, start_time)` |
| Thu single-slot becoming double | `generateFutureInstanceDates` only produces entries for matching template slots — Thu with 1 template slot = 1 instance per Thu, always |

---

## E) Schedule Grid Sync Strategy

After any chain mutation (realign or arrow):
1. `clearWeekCache()` — forces schedule grid to refetch
2. `onStudentUpdated()` → triggers parent `fetchTeachers()` → `scheduleRefreshKey++` → grid refetch
3. Local `fetchInstances()` — updates dialog's own instance list

Same pattern already used by `confirmDateUpdate`, `handleResetAllLessons`, and `handleSubmit`.

---

## F) Optimistic UI for Arrow Speed

- **Step 1**: Compute new dates locally using `generateFutureInstanceDates` (pure function, instant)
- **Step 2**: Update local `instances` state immediately (UI feels instant)
- **Step 3**: Fire parallel DB updates in background
- **Step 4**: On error → rollback local state to pre-mutation snapshot, show toast
- **Step 5**: On success → `clearWeekCache()` + `onStudentUpdated()`

Safe because `generateFutureInstanceDates` is deterministic; we update existing rows only.

---

## G) Files to Modify

| File | Change |
|------|--------|
| `src/lib/instanceGeneration.ts` | Add `getSlotBefore(templateSlots, currentDate, currentTime)` helper (~15 lines) |
| `src/hooks/useEditStudentDialog.ts` | Add `handleRealignChain()`, `handleShiftForward()`, `handleShiftBackward()` + `shifting` loading state |
| `src/components/EditStudentDialog.tsx` | Add "Zinciri Hizala" button + forward/backward arrow buttons |

No new RPC. No migration. No new table.

---

## H) Implementation Order

1. Add `getSlotBefore` helper to `instanceGeneration.ts`
2. Add handlers to `useEditStudentDialog.ts`
3. Add UI buttons to `EditStudentDialog.tsx`

---

## I) Edge Cases

- All lessons completed → arrows disabled, realign disabled
- No completed lessons → boundary = first template slot from today
- Only manual overrides remaining → no realignable instances → no-op
- Package exhausted → all controls disabled
- Rapid clicks → loading guard

---

## Revision Summary

- **Aynen kalan**: Tüm plan — realign algoritması, forward arrow, duplicate prevention, sync strategy, optimistic UI, file list, implementation order
- **Revize edilen**: Backward boundary kuralı
  - Eski: completed yoksa sınır = today
  - Yeni: sınır = `generateFutureInstanceDates(templateSlots, 1, lastCompletedDate, lastCompletedStartTime)` → son completed'dan sonraki ilk uygun template slotu. Completed yoksa bugünden itibaren ilk uygun slot.
- **Backward arrow artık hangi anchor'a kadar geri gidebilecek**: Son completed dersten sonraki ilk uygun template slotuna kadar. Örn: completed 24.03 Salı 16:40 → minSlot = Salı 17:20 → en fazla oraya kadar.
- **Realign** de aynı anchor kuralını kullanır (doğal olarak, `afterTime` mekanizmasıyla).

