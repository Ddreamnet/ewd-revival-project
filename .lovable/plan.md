

# Plan: Scheduling Bug Fixes + Next Week Navigation

## Bug #1: New Students Not Visible in "Guncel" View

### Root Cause
The `create-student` edge function (line 128-146) inserts rows into `student_lessons` (template) but never generates `lesson_instances`. The "Guncel" weekly grid calls `fetchActualLessonsForWeek()` which queries `lesson_instances` only. Result: new students are invisible in the actual view.

### Fix
1. **Update `create-student` edge function** to generate `lesson_instances` after creating `student_lessons`. After the template insert succeeds:
   - Read the newly inserted `student_lessons` rows
   - Generate instances for `lessonsPerWeek * 4` lessons starting from today, using the template slots' day_of_week/start_time/end_time
   - Also create the `student_lesson_tracking` record with `lessons_per_week` and empty `lesson_dates` / `completed_lessons`
   - After inserting instances, rebuild `lesson_dates` JSON from instances

2. **Also handle the "template saved via EditStudentDialog but no instances exist" case**: In `EditStudentDialog.handleSubmit`, after `syncTemplateChange`, if `instances.length === 0` (meaning this is first-time template save for an existing student with no instances), generate fresh instances. This covers edge cases where students were created before the migration.

### Files Changed
- `supabase/functions/create-student/index.ts` -- add instance generation + tracking record creation
- `src/components/EditStudentDialog.tsx` -- handle zero-instances case in handleSubmit

---

## Bug #2: "Islenen Dersler" Date Edit Issues

### Root Cause Analysis
Two issues combined:

1. **"Hic degismiyor" (nothing changes)**: In the OFF path of `confirmDateUpdate` (lines 472-503), the code finds the instance via `findInstanceForLesson(parseInt(key))` which matches by `lesson_number`. But `lessonDates` state uses `lesson_number` as keys from the tracking JSON. After rebuild, if instance lesson_numbers don't align with the JSON keys (e.g. after rescheduling/reordering), the wrong instance gets updated or none at all. Additionally, completed instances are being updated fine in code -- there's no explicit guard blocking completed status. The real problem is likely that `rebuildLegacyLessonDatesFromInstances` runs after the update and overwrites the local state via re-fetch, but since the instance update used the wrong lesson_number, the date appears unchanged.

2. **Non-template weekday**: The non-template weekday check is already non-blocking (info toast only) in the current code. This is correct behavior per the spec. No change needed here.

### Fix
1. **Use instanceId instead of lesson_number for matching**: In `sortedLessonsForDisplay`, each entry already carries `instanceId`. When the user edits a date in the "Islenen Dersler" list, propagate the `instanceId` to the update flow instead of relying on `lesson_number` lookup.
   - Change `updateLessonDate` to also track which instanceId maps to each lesson
   - In `confirmDateUpdate` OFF path, use instanceId directly for the `.update()` call
   - This eliminates the lesson_number mismatch problem entirely

2. **Ensure completed instances can have their dates changed**: Verify no guard prevents this (current code doesn't block it, confirmed). The fix is purely about correct instance matching.

3. **"Kalan gunleri guncelle" ON path with completed lessons**: When ON is selected, the code currently filters `instances.filter(inst => inst.lesson_number >= firstChangedLesson && inst.status === "planned")`. This is correct -- it only regenerates planned instances. But the `firstChangedLesson` is derived from `lessonDates` keys which are lesson_numbers. With instance-based display where displayIndex != lesson_number, this mapping can be wrong. Fix: use the instanceId from the sorted display to identify which instance was changed, then shift all planned instances from that point forward.

### Files Changed
- `src/components/EditStudentDialog.tsx`:
  - Add state to track `instanceIdMap: Record<string, string>` (lessonNumber -> instanceId)
  - Build this map from `sortedLessonsForDisplay`
  - In `confirmDateUpdate` OFF path: use instanceId for direct update
  - In `confirmDateUpdate` ON path: find the correct starting instance by instanceId, then regenerate subsequent planned instances
  - Ensure no balance operations during date-only edits

---

## Feature C: Next Week Navigation

### Design
Add week navigation (previous/current/next) to both `AdminWeeklySchedule` and `WeeklyScheduleDialog`.

### UI
- Add a row above the grid with: `<` (previous) | "Bu Hafta" (reset) | week date range label | `>` (next)
- Place near the existing toggle and PNG download buttons
- Compact design with chevron arrows

### Data Changes
- Add `weekOffset` state (default 0 = current week)
- Modify `getDateForDayIndex` to accept an optional `weekStart` parameter instead of always using `startOfWeek(today)`
- Modify `fetchActualLessonsForWeek` to accept `weekStart` date parameter
- Modify `getTrialLessonForDayAndTime` to use the selected week's dates
- PNG export uses the currently displayed week

### Files Changed
- `src/hooks/useScheduleGrid.ts`:
  - Add `getWeekStartForOffset(offset: number): Date` helper
  - Update `fetchActualLessonsForWeek` to accept optional `weekStart` parameter
  - Update `getDateForDayIndex` to accept optional `weekStart`
  - Update `getTrialLessonForDayAndTime` to accept optional `weekStart`
  - Update `getActualLessonForDayAndTime` to accept optional `weekStart`
  - Update `getBackToBackGroups` / `isSecondaryInBackToBack` / `getBackToBackGroupForLesson` to accept optional `weekStart`

- `src/components/AdminWeeklySchedule.tsx`:
  - Add `weekOffset` state
  - Add week navigation UI (chevrons + date range label + "Bu Hafta" button)
  - Pass `weekStart` to all grid helper calls
  - Re-fetch actual lessons when `weekOffset` changes

- `src/components/WeeklyScheduleDialog.tsx`:
  - Same `weekOffset` state and navigation UI
  - Same `weekStart` propagation

---

## Implementation Order

1. Bug #1: Update `create-student` edge function to generate instances
2. Bug #1: Handle zero-instances in `EditStudentDialog.handleSubmit`
3. Bug #2: Refactor `EditStudentDialog` to use instanceId-based matching
4. Feature C: Add `weekOffset` + helpers to `useScheduleGrid.ts`
5. Feature C: Add week navigation UI to `AdminWeeklySchedule`
6. Feature C: Add week navigation UI to `WeeklyScheduleDialog`

---

## Preserved Behaviors
- Completed lessons remain visually dimmed (opacity-40) in grids
- Completed lessons show dimmed indicator in lessons list
- Conflict detection unchanged (interval overlap logic)
- Balance add/subtract only on mark/undo, never on date edits
- Back-to-back grouping logic unchanged
- Guncel/Kalici toggle semantics unchanged
- Legacy JSON sync via `rebuildLegacyLessonDatesFromInstances` after all instance mutations

---

## Test Checklist (20 cases)

1. Create a new student with template slots -> verify they appear in Guncel grid this week
2. Create a new student whose first lesson is next week -> use Next Week nav to verify visibility
3. Open Kalici view -> new student appears in template view
4. Edit a completed lesson's date to a non-template weekday (e.g. Saturday) -> info toast shown, save succeeds
5. Edit a completed lesson's date to a conflicting time -> save blocked with conflict details
6. Alex scenario: set Ders1 and Ders2 both to 10.02, "Kalan gunleri guncelle" ON -> Ders3+ follow template from next slot after 10.02
7. Fatih/Eymen scenario: change completed Ders1 from 01.03 (Sunday) to 28.02 (Saturday) -> saves successfully
8. After date edit, verify balance unchanged (no add/subtract)
9. Mark a lesson complete -> balance increases by instance duration
10. Undo last lesson -> balance decreases by instance duration
11. Reset all lessons -> balance stays unchanged
12. Navigate to next week -> grid shows correct instances + trials for that week
13. Navigate to previous week -> grid shows correct data
14. Click "Bu Hafta" -> returns to current week
15. PNG download on next week -> exports the displayed week
16. Back-to-back lessons visible with "2 ders" badge in next week view
17. Override dialog from Guncel view passes correct instanceId
18. "Sonraki derse aktar" shifts planned instances, rebuilds legacy JSON
19. "1 seferlik degistir" updates instance in-place, rebuilds legacy JSON
20. "Geri al" reverts to original_date, rebuilds legacy JSON

---

## Risks

1. **Edge function deployment**: The `create-student` function needs redeployment. Instance generation logic must handle timezone correctly (UTC dates vs local).
2. **Existing students without instances**: Students created before the migration may have zero instances. The EditStudentDialog handleSubmit fix covers this, but a one-time backfill migration may be safer for production.
3. **Week boundary (Monday vs Sunday)**: `startOfWeek` with `weekStartsOn: 1` is used consistently. Ensure trial lesson `lesson_date` filtering aligns.
4. **Concurrency**: Two admins editing the same student's dates simultaneously could cause drift. Low risk at current scale.
5. **Instance lesson_number gaps**: After deletions or regeneration, lesson_numbers may have gaps. The instanceId-based matching eliminates dependency on sequential numbers.

