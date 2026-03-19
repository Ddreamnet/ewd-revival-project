

# DAY_MISMATCH Recovery: Sequence-Based Slot Mapping

## Summary
Remove `DAY_MISMATCH` as a rejection reason. Instead, use sequence-based slot mapping: dates come from restore truth, times come from template slots via `slot_index = (lesson_number - 1) % slot_count`.

## Edge Function Changes (`supabase/functions/data-recovery/index.ts`)

### 1. Add `mapping_mode` to `ClassifiedStudent` interface (line 57)
Add field: `mapping_mode: "exact_weekday_match" | "sequence_based_recovery" | "none"`

### 2. Replace DAY_MISMATCH rejection (lines 293-304)
Instead of pushing MANUAL_REVIEW and `continue`, set a flag `useSequenceMapping = true` and skip the SLOT_OVERFLOW check (lines 306-327).

### 3. Add sequence-based instance building (after line 327)
When `useSequenceMapping === true`:
- Sort template slots by `day_of_week ASC`, `start_time ASC`
- For each lesson in `lessonDateEntries`, use its `lessonNumber` to determine slot:
  - `slot_index = (lessonNumber - 1) % templates.length`
  - Assign that slot's `start_time` / `end_time`
- Use restore date as-is (date is truth, time comes from template sequence)
- Mark completed/planned from `completedSet`

**Critical rule**: Slot assignment uses `lesson_number`, NOT chronological index `i`. This ensures deterministic mapping:
- lesson_number 1 → slot 0
- lesson_number 2 → slot 1
- lesson_number 3 → slot 0
- lesson_number 4 → slot 1

When `useSequenceMapping === false` (exact match path): keep existing logic (lines 359-386).

Both paths then share CHECK 6 (LPW) and CHECK 7 (contiguity).

### 4. Updated flow
```text
CHECK 1: Archived → SKIP
CHECK 2: Empty dates → MANUAL_REVIEW
CHECK 3: No template → MANUAL_REVIEW
CHECK 4: Day mismatch?
  YES → useSequenceMapping = true (skip slot overflow)
  NO  → useSequenceMapping = false → CHECK 5: Slot overflow
CHECK 6: LPW resolution
Build instances (exact OR sequence path)
CHECK 7: Contiguity check
ALL PASS → SAFE_APPLY
```

### 5. Response payload additions
- Add `mapping_mode` to safeApply response objects (line 561-575)
- Add summary counts: `exactMatchCount`, `sequenceRecoveryCount`, `dbFallbackCount`

## Recovery HTML Changes (`public/recovery.html`)

### 1. Version bump to v5

### 2. Summary grid — add sub-counts
Show exact match / sequence recovery / DB fallback breakdown below safe apply count.

### 3. SAFE_APPLY table — add "Mod" column
- `📐 Exact` (green) for `exact_weekday_match`
- `🔀 Seq` (purple) for `sequence_based_recovery`

Grid template updated from 9 to 10 columns.

## Files Modified

| File | Change |
|---|---|
| `supabase/functions/data-recovery/index.ts` | Sequence-based recovery path, mapping_mode field, updated summary |
| `public/recovery.html` | Mapping mode column, expanded summary, v5 |

