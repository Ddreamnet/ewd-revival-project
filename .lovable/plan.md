
# Plan: "Islenen Dersler" Instance Count Fix and System Alignment

## Problem Analysis

### Root Cause: Two Independent Data Sources Out of Sync

The system has a fundamental design conflict: **two separate sources of truth** that don't stay aligned.

1. **`lesson_instances` table** -- Contains actual lesson records. Can have any number of rows per student (3, 8, 10, etc.) due to:
   - Lazy generation adding new instances per-week as pages are viewed
   - Old instances never being cleaned up when a new month starts
   - No cap on total instance count per student-teacher pair

2. **`student_lesson_tracking` table** -- Contains `lessons_per_week` and the derived total (`lessons_per_week * 4 = 8`). This is the "contract" for how many lessons should be displayed.

### Specific Data Issues Found

| Student | Expected (lpw*4) | Actual Instances | Why |
|---------|------------------|-----------------|-----|
| Eymen | 8 | 8 (but user saw 3 earlier) | Lazy gen created them incrementally across page views. First 1, then 2 more, then 5 more. User opened dialog before all were generated. |
| Yusuf Ali | 8 | 10 | Had 8 original instances (7 completed + 1 planned). Lazy generation added 2 more for this week since his planned lessons were in the past. Total: 10. |

### The Display Logic Problem (EditStudentDialog line 830-905)

```text
if (instances.length > 0) {
  // Shows ALL instances from DB -- no cap at lessonsPerWeek * 4
  return sorted.map(...)
}
```

This displays **every instance in the DB**, not `lessonsPerWeek * 4`. So:
- If lazy gen added extras -> more than 8 shown
- If instances were partially created -> fewer than 8 shown

### The Lazy Generation Problem (useScheduleGrid.ts)

`ensureInstancesForWeek` creates new instances for **every week viewed** without checking if the student already has their full quota (`lessons_per_week * 4`). For Yusuf Ali, his 8 lessons were all in Feb, so when the user views the March week, lazy gen creates 2 more instances (lessons 9 and 10).

### Self-Conflict Bug

When an instance is being updated (date change), `checkTeacherConflicts` uses `excludeInstanceId` to skip the instance being edited. However, a student may have **two instances on the same day at the same time** (e.g., after lazy generation duplicates). The conflict check doesn't filter by `student_id`, so the student's OTHER instances on the same date can trigger a false "conflict."

## Solution Design

### Principle: `lesson_instances` is the Single Source of Truth

The total number of instances for a student-teacher pair should always equal `lessons_per_week * 4`. The "Islenen Dersler" list should show exactly this many rows, sourced from instances, sorted chronologically.

### Change 1: Cap Instance Display at `totalLessons`

**File: `src/components/EditStudentDialog.tsx`**

In `sortedLessonsForDisplay` (line 830-905):
- After sorting instances chronologically, take only the first `totalLessons` (= `lessonsPerWeek * 4`) entries
- If there are fewer instances than `totalLessons`, show empty rows for the remaining slots (legacy fallback style)

### Change 2: Cap Lazy Generation

**File: `src/hooks/useScheduleGrid.ts`**

In `ensureInstancesForWeek`:
- Before generating new instances, check how many instances the student already has (all statuses)
- Fetch `lessons_per_week` from `student_lesson_tracking`
- Only generate instances if `existingCount < lessons_per_week * 4`
- Cap the number of new instances to `(lessons_per_week * 4) - existingCount`

### Change 3: Fix Sifirla (Reset) to Delete and Regenerate Instances

**File: `src/components/EditStudentDialog.tsx`**

In `handleResetAllLessons`:
- Delete ALL existing instances for the student-teacher pair
- Generate fresh `lessonsPerWeek * 4` instances from template slots starting from today
- Update tracking record with new `lesson_dates` from the fresh instances
- This ensures a clean slate with exactly the right number of instances

### Change 4: Fix "First Lesson Marks All Dates" Flow

**File: `src/components/LessonTracker.tsx`**

When teacher marks the first lesson and `lessonDates` is empty (line 184-200):
- `calculateLessonDates` generates dates and saves them to tracking
- BUT it doesn't update the corresponding instances' `lesson_date` values
- After calculating dates, also update each instance's `lesson_date` to match
- This ensures instances and tracking stay in sync

### Change 5: Fix Self-Conflict in Date Edits

**File: `src/components/EditStudentDialog.tsx`**

In `confirmDateUpdate`, when checking conflicts for date changes:
- Currently `excludeInstanceId` only excludes the one instance being edited
- When a student has multiple instances on the same day (e.g., 2 lessons same day), the student's OTHER instance at different time should not conflict with itself
- Add `student_id` awareness: exclude ALL instances of the same student when checking conflicts for that student's lesson edits (since a student can't conflict with their own lessons under the same teacher)

Actually, more precisely: the conflict check should exclude all instances belonging to the **same student** being edited. A student having two lessons on the same day at different times is valid (e.g., the "Alex" scenario with two lessons on 10.02).

### Change 6: Clean Up Excess Instances (Yusuf Ali case)

**File: `src/hooks/useScheduleGrid.ts`** or **`src/components/EditStudentDialog.tsx`**

When `fetchInstances` returns more instances than `lessonsPerWeek * 4`:
- The display already caps at `totalLessons` (Change 1)
- But excess planned instances remain in DB, polluting the weekly grid
- In `ensureInstancesForWeek`, after checking existing count, if there are MORE planned instances than needed, delete the excess (latest planned ones)

## Implementation Order

1. **Change 2**: Cap lazy generation (prevents new excess instances)
2. **Change 6**: Clean excess planned instances (fixes existing data like Yusuf Ali)
3. **Change 1**: Cap display at `totalLessons` (immediate visual fix)
4. **Change 3**: Fix Reset to delete + regenerate
5. **Change 4**: Sync instance dates when teacher marks first lesson
6. **Change 5**: Fix self-conflict detection

## Files Changed

| File | Changes |
|---|---|
| `src/hooks/useScheduleGrid.ts` | Cap lazy generation at `lessons_per_week * 4`, trim excess planned instances |
| `src/components/EditStudentDialog.tsx` | Cap `sortedLessonsForDisplay` at `totalLessons`, fix Reset flow, fix self-conflict |
| `src/components/LessonTracker.tsx` | Sync instance dates when first lesson is marked |

## Self-Conflict Detail

The current `checkTeacherConflicts` accepts a single `excludeInstanceId`. For the date edit scenario in EditStudentDialog, when we change a lesson's date, we only exclude that ONE instance. But if the student has another instance on the target date (at a different time), it won't conflict because times don't overlap. If at the same time, it would conflict -- but that's the "Alex" scenario where admin intentionally puts 2 lessons same day same time? No -- Alex's scenario is same day, sequential times. So the real self-conflict issue is:

When lazy gen creates duplicate instances for the same slot (same date, same time) due to a bug, these duplicates conflict with each other. The fix is actually in Change 2 (preventing excess instances) rather than changing conflict detection. However, to be safe, we should also pass all instance IDs of the student being edited as exclusions.

## Preserved Behaviors

- Completed lessons remain dimmed in grids and lists
- Balance add/subtract only on mark/undo
- Conflict detection for different students unchanged
- Back-to-back allowed
- Template/Actual toggle unchanged
- Week navigation unchanged

## Test Scenarios

1. Open Eymen's settings -> should show exactly 8 lessons
2. Open Yusuf Ali's settings -> should show exactly 8 lessons (excess trimmed)
3. Reset Eymen -> all 8 lessons regenerated from today, dates assigned
4. Teacher marks first lesson -> all 8 lesson dates calculated and synced to instances
5. Admin edits completed lesson date -> no self-conflict error
6. Navigate to next week for a student with all lessons complete -> no new instances created (cap reached)
7. Create new student with 2 lessons/week -> 8 instances created, all visible in "Islenen Dersler"
