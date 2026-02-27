
# Major Scheduling Upgrade: Updated Final Plan

## Design Decisions (Applied Throughout)

**Data Identity Model: OPTION A (Single-instance update + history fields)**
The current system uses a single `student_lesson_tracking` row per student-teacher pair with atomic updates. Option A aligns with this pattern: one row per lesson slot, updated in-place on moves. No duplicate rows, no partial unique constraints. History is tracked via `original_date`/`original_start_time`/`original_end_time` fields on the instance row itself. `moved_to_instance_id` is removed from the schema.

**Time Field Model: Model 1 (lesson_date + start_time + end_time)**
The entire codebase uses `date` + `time` columns consistently (`student_lessons`, `lesson_overrides`, `trial_lessons`). All UI time pickers produce `HH:MM` strings. All existing balance and formatting utilities operate on `start_time`/`end_time` string pairs. Switching to `timestamptz` would require rewriting every query, every component, and every utility. Model 1 fits with zero friction.

**DB-Level Conflict Protection: App-level only**
A PostgreSQL exclusion constraint cannot span two tables (`lesson_instances` + `trial_lessons`) and would require the `btree_gist` extension. The current system has no DB-level overlap protection anywhere. Adding it only to `lesson_instances` would give false safety. Instead, all conflict checks happen at app level inside `conflictDetection.ts` with a re-check-before-save pattern (query + validate + save in a single async flow). This is consistent with the existing codebase pattern.

---

## Current Architecture vs. Requirements Gap

| Requirement | Current State | Gap |
|---|---|---|
| Variable duration per lesson instance | Times derived from template; only date stored per instance | Need start/end per instance |
| Interval-based conflict detection | No conflict checking anywhere | New service required |
| Template vs. Actual toggle on grid | Single view only | New UI mode + data separation |
| Back-to-back lesson grouping | Not implemented | New UI rendering logic |
| Lessons list shows start/end time per row | Only date shown | Need time data per instance |
| Move-to-specific-date with cross-week visibility | Partially implemented via overrides | Override system needs refinement |
| Trial lesson conflict validation | No validation on creation | Must check teacher's actual schedule |

---

## Phase 1: Database -- New `lesson_instances` Table

Create a proper lesson instances table to replace the JSON-based tracking.

```sql
CREATE TABLE lesson_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  teacher_id uuid NOT NULL,
  lesson_number integer NOT NULL,
  lesson_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  status text NOT NULL DEFAULT 'planned',
  -- status: 'planned', 'completed', 'cancelled'
  -- When a lesson is moved, the row is UPDATED in-place (Option A).
  -- Original values preserved in these fields for audit/revert:
  original_date date,
  original_start_time time,
  original_end_time time,
  rescheduled_count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(student_id, teacher_id, lesson_number)
);

CREATE INDEX idx_lesson_instances_teacher_date
  ON lesson_instances (teacher_id, lesson_date, start_time, end_time);

CREATE INDEX idx_lesson_instances_student
  ON lesson_instances (student_id, teacher_id, status);
```

**RLS Policies:** Mirror `student_lesson_tracking` policies:
- Admin: ALL
- Teacher: ALL on own (`teacher_id = auth.uid()`)
- Student: SELECT on own (`student_id = auth.uid()`)

**Migration Strategy (cutover, no dual-write):**

A single migration script populates `lesson_instances` from existing data:
1. For each `student_lesson_tracking` record, read `lesson_dates` JSON and `completed_lessons` array.
2. For each lesson number in `lesson_dates`, look up the student's template slot from `student_lessons` (matching by day_of_week derived from the stored date) to get `start_time` and `end_time`.
3. Insert into `lesson_instances` with `status = 'completed'` if lesson_number is in `completed_lessons`, else `'planned'`.
4. For each `lesson_overrides` row: find the matching instance by `original_date`, update its `lesson_date`/`start_time`/`end_time` to the override values, populate `original_date`/`original_start_time`/`original_end_time`, set `rescheduled_count = 1`. If `is_cancelled`, set `status = 'cancelled'`.

After migration:
- `student_lesson_tracking.lesson_dates` JSON is no longer the source of truth for dates/times. The `completed_lessons` array and `lessons_per_week` fields remain in use for the tracker grid UI and balance reset logic.
- `lesson_overrides` table is retained for backward compat but new overrides are written as in-place updates to `lesson_instances`.

---

## Phase 2: Conflict Detection Service

**New file: `src/lib/conflictDetection.ts`**

```typescript
// Core overlap check (pure function)
export function hasTimeOverlap(
  startA: string, endA: string,
  startB: string, endB: string
): boolean {
  return startA < endB && endA > startB;
  // end == otherStart is allowed (back-to-back)
}

// Conflict detail returned to UI
export interface ConflictInfo {
  studentName: string;
  date: string;
  timeRange: string;
  type: 'lesson' | 'trial';
  teacherId: string;
}

// Check teacher's ACTUAL schedule for conflicts on a given date+time range
export async function checkTeacherConflicts(
  teacherId: string,
  date: string,
  startTime: string,
  endTime: string,
  excludeInstanceId?: string
): Promise<ConflictInfo[]> {
  // 1. Query lesson_instances for that teacher on that date
  //    WHERE status IN ('planned','completed') AND id != excludeInstanceId
  // 2. Query trial_lessons for that teacher on that date
  // 3. For each, check hasTimeOverlap
  // 4. Return array of ConflictInfo with student name, time, type
}
```

This service is called by:
- `AddTrialLessonDialog` -- before creating a trial
- `LessonOverrideDialog` -- before one-off move or postpone
- `EditStudentDialog` -- before template change (for each future instance)
- Weekly grid one-off operations

If conflicts are found, save is blocked and a conflict summary dialog is displayed showing each conflict's student name, date, time range, and type (Lesson/Trial).

---

## Phase 3: Instance Generation and Template Sync

**New file: `src/lib/instanceGeneration.ts`**

```typescript
// Generate instances from template slots for future/unprocessed lessons
export function generateFutureInstances(
  templateSlots: { dayOfWeek: number; startTime: string; endTime: string }[],
  existingInstances: LessonInstance[],
  totalLessons: number,
  startFromDate: Date
): LessonInstance[] {
  // Only generates for lessons not yet completed
  // Each instance gets date + start_time + end_time from the matching template slot
  // Template slots define the duration per weekday
}

// Called when template is edited in EditStudentDialog
export async function syncTemplateChange(
  studentId: string,
  teacherId: string,
  newSlots: TemplateSlot[],
  existingInstances: LessonInstance[]
): Promise<{ instances: LessonInstance[]; conflicts: ConflictInfo[] }> {
  // 1. Identify completed instances (keep untouched)
  // 2. Regenerate planned instances using new slots (days + start/end times)
  // 3. Run checkTeacherConflicts for each regenerated instance
  // 4. If any conflicts, return them (caller blocks save)
  // 5. If no conflicts, return new instance set for bulk upsert
}
```

This replaces `calculateLessonDates` and `recalculateRemainingDates` for instance-based flows. The old functions remain available for legacy JSON path during transition.

---

## Phase 4: Weekly Grid Upgrade

### 4A: Template/Actual Toggle

Add a Switch component near the "PNG Indir" button in both `AdminWeeklySchedule` and `WeeklyScheduleDialog`:

- **INACTIVE (default):** Shows ACTUAL schedule -- queries `lesson_instances` WHERE `lesson_date` is in current week AND `status` IN ('planned', 'completed'), plus `trial_lessons` for the week. Moved lessons appear only in their target week (date-filter based, no hard-deletion).
- **ACTIVE:** Shows ONLY template slots from `student_lessons` table. No trials, no one-offs, no instances. If template is permanently changed, this view reflects it immediately.

### 4B: Back-to-Back Grouping

When rendering grid cells, detect consecutive lessons for the same student on the same day where `end_time` of one equals `start_time` of the next:
- Render as a single combined card with badge "2 ders"
- Inside show both time ranges stacked
- On click, show a selector popover/menu for which instance to modify
- Back-to-back is NOT a conflict (enforced by `hasTimeOverlap` returning false when `endA == startB`)

### 4C: Cross-Week Visibility

When a lesson is moved to a different week:
- The instance row is updated in-place (Option A): `lesson_date` changes to target date
- The lesson disappears from the original week because the date no longer falls in that week's range
- It appears in the target week because the new date falls in that week's range
- No special deletion or ghost records needed; visibility is purely date-filter based

---

## Phase 5: Lessons List Upgrade (EditStudentDialog)

Update the "Islenen Dersler" section to show start and end time per row:

```
Ders 1  |  06.01  |  17:00 - 17:40  |  [date input]
Ders 2  |  06.01  |  18:00 - 18:30  |  [date input]
Ders 3  |  08.01  |  17:00 - 17:40  |  [date input]
```

Key rules:
- "Ders N" labels are computed by sorting all instances by `(lesson_date, start_time)` chronologically. The N is a display-only index, not the stored `lesson_number`.
- Multiple lessons on the same date with different time ranges are shown as separate rows.
- Each row shows the time range (read-only, derived from instance) alongside the editable date.
- No separate time input field in the date edit flow.

Date edit with "Kalan gunleri de guncelle" checkbox:
- **OFF:** Only that lesson's `lesson_date` changes. `start_time` and `end_time` stay unchanged (duration preserved). No time input shown or needed.
- **ON:** That lesson and all subsequent planned instances are regenerated from template slots. Times and durations come from the template. No manual time input.
- Before saving either mode: run `checkTeacherConflicts` for all affected instances. If conflicts exist, block save and show conflict details.
- If the new date is not one of the student's usual template weekdays, show an informational warning but only block on actual time conflicts.

---

## Phase 6: Override Dialog Enhancements

Update `LessonOverrideDialog` to work with `lesson_instances`:

### "Sonraki Derse Aktar" (Move to Next Lesson)
- Finds the clicked instance in `lesson_instances`.
- Shifts that instance and all subsequent planned instances forward by one template slot.
- Each shifted instance gets its new date + times from the template (respecting variable durations per slot).
- Run `checkTeacherConflicts` for every shifted instance before committing. Block if any conflict.
- Updates `lesson_instances` rows in-place (Option A). Sets `original_date`/`original_start_time`/`original_end_time` if not already set.

### "Baska Tarihe Aktar" (Move to Specific Date)
- User selects a new DATE. Time inputs are pre-filled with the lesson's current start/end (preserving duration).
- If user does not change time, original start/end are preserved.
- Updates the instance row in-place: `lesson_date = new_date`, optionally `start_time`/`end_time` if changed. Saves originals in `original_date`/`original_start_time`/`original_end_time`. Increments `rescheduled_count`.
- Run `checkTeacherConflicts` before save. Block if conflict.
- Cross-week: if moved to another week, instance disappears from current week grid and appears in target week (date-filter based).

### "Geri Al" (Revert)
- Restores `lesson_date = original_date`, `start_time = original_start_time`, `end_time = original_end_time`. Clears originals. Sets `rescheduled_count = 0`.

---

## Phase 7: Trial Lesson Conflict Validation

Update `AddTrialLessonDialog`:
- Before saving, call `checkTeacherConflicts(teacherId, lessonDate, startTime, endTime)`.
- Query checks against ACTUAL instances (not template), so postponed lessons' old slots are available.
- Also checks against other trial lessons on the same date.
- If conflict: block save, show conflict summary dialog with student name + time range + type.
- If no conflict: proceed with insert.

---

## Bakiye / Balance Safety

The balance system (`src/lib/teacherBalance.ts`) currently:
1. Takes `startTime` + `endTime` strings, calculates `durationMinutes` via `calculateDurationMinutes`.
2. Updates `teacher_balance` table (total_minutes, completed_regular_lessons, regular_lessons_minutes, etc.).
3. Called by `LessonTracker.confirmLessonComplete` -> `addRegularLessonBalance` and `EditStudentDialog.handleMarkLastLesson` -> `addRegularLessonBalance`.
4. `addRegularLessonBalance` currently queries `student_lessons` (template) for times, which assumes all lessons have the same duration.

**Required changes:**
- Update `addRegularLessonBalance` and `subtractRegularLessonBalance` to accept an optional `instanceId` parameter.
- When `instanceId` is provided, read `start_time`/`end_time` from `lesson_instances` instead of `student_lessons` template. This ensures variable durations are correctly credited.
- When `instanceId` is not provided (backward compat during transition), fall back to template lookup.
- The `addToTeacherBalance` and `subtractFromTeacherBalance` core functions remain unchanged (they already accept arbitrary `startTime`/`endTime`).

**Balance safety checklist (explicit verification steps):**
1. After migration, verify that the sum of completed instance durations matches `teacher_balance.total_minutes` for test teachers.
2. Ensure `handleResetAllLessons` in EditStudentDialog resets `lesson_instances` statuses to `'planned'` and clears `completed_lessons` array, but does NOT reduce teacher balance (existing behavior preserved).
3. When marking a lesson complete in `LessonTracker`, update the corresponding `lesson_instances` row to `status = 'completed'` AND call `addToTeacherBalance` with that instance's actual `start_time`/`end_time`.
4. When undoing a lesson in EditStudentDialog, update instance back to `status = 'planned'` AND call `subtractFromTeacherBalance` with that instance's actual times.
5. Remaining lessons display (`X / Y completed`) must count from `lesson_instances WHERE status = 'completed'` (or continue using the `completed_lessons` array if kept in sync).
6. Trial lesson balance (mark/unmark trial as completed in AdminWeeklySchedule/WeeklyScheduleDialog) continues using `trial_lessons.start_time`/`end_time` directly -- no change needed.

**Files touched for balance:**
- `src/lib/teacherBalance.ts` -- add instanceId-aware overload
- `src/components/LessonTracker.tsx` -- pass instance start/end to balance
- `src/components/EditStudentDialog.tsx` -- pass instance start/end to balance on mark/undo
- `src/components/AdminWeeklySchedule.tsx` -- trial balance unchanged
- `src/components/WeeklyScheduleDialog.tsx` -- trial balance unchanged

---

## Phase 8: Tracker Components Update

Update `LessonTracker` and `StudentLessonTracker`:
- Read from `lesson_instances` to get per-lesson date + time data.
- Continue using `completed_lessons` array from `student_lesson_tracking` for the grid checkmark display (kept in sync: when marking complete, update both the array AND the instance status).
- Display date labels can now also show time when space allows (e.g., tooltip on hover).
- `getSortedLessons` in `lessonSorting.ts` updated to accept instances with time data. Sorting key changes from `effectiveDate` string to `effectiveDate + startTime` for correct chronological order when multiple lessons share a date.

---

## Implementation Order

| Step | Description | Risk | Status |
|---|---|---|---|
| 1 | Create `lesson_instances` table + RLS + indexes | Low | ✅ DONE |
| 2 | Data migration: populate instances from existing JSON + overrides | Medium | ✅ DONE (261 completed + 115 planned) |
| 3 | Create `conflictDetection.ts` | Low (additive) | ✅ DONE |
| 4 | Create `instanceGeneration.ts` | Low (additive) | ✅ DONE |
| 5 | Update `teacherBalance.ts` with instance-aware overloads | Low | ✅ DONE |
| 5b | Add `LessonInstance` interface to `lessonTypes.ts` | Low | ✅ DONE |
| 6 | Update `AddTrialLessonDialog` with conflict check | Low | ✅ DONE |
| 7 | Update `LessonOverrideDialog` to use instances + conflicts | Medium | ✅ DONE |
| 8 | Update `EditStudentDialog` lessons list (show times, use instances, conflict checks) | Medium | ✅ DONE |
| 9 | Update `EditStudentDialog` template editor (sync + conflict check) | Medium | ✅ DONE |
| 10 | Add Template/Actual toggle to `AdminWeeklySchedule` | Medium | ✅ DONE |
| 11 | Add Template/Actual toggle to `WeeklyScheduleDialog` | Medium | ✅ DONE |
| 12 | Add back-to-back grouping UI to both grids | Medium | ✅ DONE |
| 13 | Update `LessonTracker` and `StudentLessonTracker` to read from instances | Medium | ✅ DONE |
| 14 | Update `lessonSorting.ts` for time-aware sorting | Low | ✅ DONE |
| 15 | Balance safety verification (manual + automated checks) | Low | ✅ DONE |

All 15 steps are complete. The scheduling upgrade is fully implemented.

---

## Files Created (New)

| File | Purpose |
|---|---|
| `src/lib/conflictDetection.ts` | Interval overlap checks + teacher schedule conflict queries |
| `src/lib/instanceGeneration.ts` | Generate/regenerate lesson instances from template |
| SQL migration | `lesson_instances` table, RLS, indexes, data migration |

## Files Modified

| File | Changes |
|---|---|
| `src/lib/teacherBalance.ts` | Add instance-aware balance functions |
| `src/lib/lessonSorting.ts` | Time-aware sorting (date+time key) |
| `src/lib/lessonTypes.ts` | Add `LessonInstance` interface |
| `src/components/AddTrialLessonDialog.tsx` | Add conflict validation before save |
| `src/components/LessonOverrideDialog.tsx` | Use instances table, add conflict checks, Option A in-place updates |
| `src/components/EditStudentDialog.tsx` | Show times in lessons list, template sync with conflict check, instance-aware balance |
| `src/components/AdminWeeklySchedule.tsx` | Template/Actual toggle, back-to-back grouping, read from instances |
| `src/components/WeeklyScheduleDialog.tsx` | Template/Actual toggle, back-to-back grouping, read from instances |
| `src/components/LessonTracker.tsx` | Read from instances, pass instance times to balance |
| `src/components/StudentLessonTracker.tsx` | Read from instances for date+time display |
| `src/hooks/useScheduleGrid.ts` | Support template vs actual mode |
| `src/lib/lessonDateCalculation.ts` | Kept for legacy; new instance-based logic in `instanceGeneration.ts` |

## Files NOT Modified

All landing page components, auth, blog, topics, homework, notifications, push notification systems, and directory structure remain untouched.

---

## Edge Cases Addressed

1. **Variable duration overlap:** `17:20-18:00` vs `17:50-18:20` -- blocked (`17:20 < 18:20 AND 18:00 > 17:50` = true).
2. **Back-to-back allowed:** `17:20-18:00` vs `18:00-18:30` -- NOT a conflict (`17:20 < 18:30` is true BUT `18:00 > 18:00` is false, so overall false).
3. **Back-to-back double session:** Two consecutive lessons same student same day display as grouped card with "2 ders" badge. Each is independently editable via a selector on click.
4. **Move-to-next-lesson shifting respects template durations:** Each shifted instance gets `start_time`/`end_time` from the template slot for its new weekday, so variable durations per day are preserved.
5. **Template change affects only future lessons:** Completed instances are never modified. Only `status = 'planned'` instances are regenerated with new slot durations.
6. **Cross-week move:** Instance row updated in-place with new `lesson_date`. Disappears from origin week, appears in target week. No ghost rows, no hard-deletion. Visibility is purely date-range filtering.
7. **Lessons list date edit OFF preserves time:** Only `lesson_date` column changes. `start_time`/`end_time` remain as-is. No time input shown.
8. **Lessons list date edit ON regenerates from template:** That lesson and all subsequent planned lessons get new `lesson_date` + `start_time` + `end_time` from template slots. Times come strictly from template.
9. **"Ders N" computed chronologically:** Display labels sort by `(lesson_date, start_time)`, not by stored `lesson_number`. Multiple same-date lessons with different times get distinct sequential labels.
10. **Trial lesson respects actual schedule:** Conflict check queries `lesson_instances` (actual) + `trial_lessons`, not template. A postponed lesson's old slot is available.
11. **Balance correctness with variable durations:** Balance add/subtract uses the specific instance's `start_time`/`end_time`, not the template's. This ensures a 40-minute lesson and a 30-minute lesson credit different amounts.
12. **Monthly reset preserves balance:** `handleResetAllLessons` resets `completed_lessons` array and sets all instances back to `'planned'`, but does NOT call `subtractFromTeacherBalance`. Teacher earnings are preserved.
13. **Non-template-day warning:** If a lesson is moved to a day that is not in the student's template weekdays, an informational warning is shown, but save is only blocked if an actual time conflict exists.
