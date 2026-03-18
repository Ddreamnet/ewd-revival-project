

# Production Repair Plan: Lesson Instance Data & Cycle Integrity

## Root Cause Summary

1. **Read paths missing `package_cycle` filter**: `LessonTracker`, `StudentLessonTracker`, `EditStudentDialog` fetch ALL instances across ALL cycles, then `slice(0, totalLessonsPerMonth)` — mixing old and current cycle data.
2. **`ensureInstancesForWeek` generates unbounded instances**: No cycle awareness, no cap check, no `package_cycle` set on inserts. Every new week creates more planned instances regardless of rights.
3. **`syncTemplateChange` and `shiftLessonsForward` have no cycle filter**: Operate on all instances across all cycles.
4. **Pre-Phase-6 reconciliation gap**: Legacy `completed_lessons` data was not fully reconciled into `lesson_instances` before legacy columns were dropped.

---

## Step 1: Add `data_repair` to `balance_events` CHECK constraint

The existing CHECK constraint on `balance_events.event_type` only allows: `lesson_complete`, `lesson_undo`, `trial_complete`, `trial_undo`, `manual_adjust`, `balance_reset`.

The repair migration needs to log audit events with `event_type = 'data_repair'`. Without this, every repair log INSERT will fail.

**Migration**: Drop and recreate the CHECK constraint to include `data_repair`:

```sql
ALTER TABLE balance_events DROP CONSTRAINT balance_events_event_type_check;
ALTER TABLE balance_events ADD CONSTRAINT balance_events_event_type_check
  CHECK (event_type = ANY (ARRAY[
    'lesson_complete', 'lesson_undo',
    'trial_complete', 'trial_undo',
    'manual_adjust', 'balance_reset',
    'data_repair'
  ]));
```

---

## Step 2: Two-Phase Repair Migration (SQL)

### Phase A — Dry-run audit report (read-only RAISE NOTICE)

For each active, non-archived student:
- Compute `total_rights = lessons_per_week * 4`
- Count completed and planned instances in current `package_cycle`
- Categorize:
  - **OVER_COMPLETED**: completed > total_rights → manual review list, delete all planned
  - **EXCESS_PLANNED**: completed + planned > total_rights → auto-fix: keep earliest N planned (N = total_rights - completed), delete rest
  - **ORPHAN_PLANNED**: planned instances with wrong `package_cycle` or NULL → delete if `status='planned'`, report if `status='completed'`
  - **OK**: no issues

### Phase B — Safe auto-repair

- Delete excess planned instances (EXCESS_PLANNED cases) — keep chronologically earliest
- Delete orphan planned instances (wrong cycle, only `status='planned'`)
- Delete all planned instances for OVER_COMPLETED students
- Set `package_cycle` on planned instances where NULL and unambiguous single active cycle exists
- **Never touch completed instances**
- **Never modify teacher_balance**
- Log all deletions to `balance_events` with `event_type = 'data_repair'`
- Students with `completed > total_rights` are flagged for manual review only

---

## Step 3: Add `package_cycle` filter to all READ paths

**Files**: `LessonTracker.tsx`, `StudentLessonTracker.tsx`, `EditStudentDialog.tsx`

Each `fetchInstances` will:
1. Fetch `package_cycle` from `student_lesson_tracking`
2. Add `.eq("package_cycle", currentCycle)` to the instances query
3. Remove the `slice(0, totalLessonsPerMonth)` hack — cycle-filtered data is already correctly scoped

---

## Step 4: Add `package_cycle` filter to all WRITE paths

### `instanceGeneration.ts` — `syncTemplateChange`
- Fetch current cycle from tracking
- Add `.eq("package_cycle", currentCycle)` to instance query
- Set `package_cycle` on any newly inserted instances
- Enforce `total_rights` cap: don't generate more planned instances than `total_rights - completed_in_cycle`

### `instanceGeneration.ts` — `shiftLessonsForward`
- Add `.eq("package_cycle", currentCycle)` to instance query

### RPCs (already cycle-aware — confirmed correct):
- `rpc_complete_lesson` — filters by current cycle
- `rpc_undo_complete_lesson` — filters by current cycle
- `rpc_reset_package` — increments cycle, generates for new cycle

---

## Step 5: Make `ensureInstancesForWeek` cycle-aware with cap

**File**: `useScheduleGrid.ts`

Changes:
- Fetch `package_cycle` and `lessons_per_week` from `student_lesson_tracking` for each missing student
- Count existing instances in current cycle: `completed + planned`
- Enforce invariant: `completed + planned <= weekly_count * 4`
- Only generate if `existing_count < total_rights`
- Generate at most `total_rights - existing_count` new instances
- Set `package_cycle` on all inserted instances
- If package exhausted (`completed >= total_rights`): skip generation entirely

---

## Step 6: Block completion when package exhausted

**`LessonTracker.tsx`**:
- If `rights.remaining <= 0`, disable completion UI and show "Paket tamamlandı" message
- `getNextCompletableInstance` already returns null when no planned instances exist, so this is mainly a UI clarity improvement

---

## Step 7: Handle `completed > total_rights` students safely

- Do NOT auto-reassign or delete completed instances
- Delete any remaining planned instances in current cycle (package is over-completed)
- Add student to manual review list in migration output
- UI will show actual completed count (e.g., "12/8") with a warning badge

---

## Files Modified

| File | Change |
|------|--------|
| `src/components/LessonTracker.tsx` | Add cycle filter to fetchInstances, remove slice hack |
| `src/components/StudentLessonTracker.tsx` | Add cycle filter to fetchInstances, remove slice hack |
| `src/components/EditStudentDialog.tsx` | Add cycle filter to fetchInstances |
| `src/hooks/useScheduleGrid.ts` | Cycle-aware `ensureInstancesForWeek` with cap |
| `src/lib/instanceGeneration.ts` | Cycle filter on `syncTemplateChange` and `shiftLessonsForward` |
| New migration SQL | CHECK constraint update + two-phase audit/repair |

---

## Safety Constraints

- Completed instances are never modified, moved, or deleted
- Teacher balances are never touched
- Archived students are excluded from repair
- Old cycle history is preserved
- `package_cycle` NULL or mismatched completed instances are reported, not auto-fixed
- Only orphan planned instances with clear rules are auto-deleted
- All repair actions logged to `balance_events` with `event_type = 'data_repair'`
- Students with `completed > total_rights` flagged for manual review, not silently "fixed"

