

# Plan: Archived Student Cleanup + Lesson Tracker Consistency

## Verified Root Causes

### Issue 1: Archived students in schedule
- **Confirmed**: `EditStudentDialog` archive handler (line 1195-1198) only sets `is_archived = true`. No cleanup of `lesson_instances` or `lesson_overrides`.
- **Confirmed**: `fetchActualLessonsForWeek` (line 234-242) queries `lesson_instances` without filtering archived students. After `ensureInstancesForWeek` correctly skips archived students, pre-existing planned instances still show.
- **Confirmed**: `checkTeacherConflicts` (line 46-51) queries `lesson_instances` without archive filter — archived students' planned instances cause false conflicts.

### Issue 2: Lesson tracker inconsistency
- **Confirmed**: `StudentLessonTracker` reads `lessons_per_week` from `student_lesson_tracking` (line 123), while `LessonTracker` derives it from `studentLessonDays.length` (template count).
- **Confirmed**: `StudentLessonTracker` does not fetch `lesson_instances` for `instanceStartTimes`, so `getSortedLessons` may sort differently than the teacher panel for same-day multi-lesson students.

---

## Fix Strategy

### Issue 1: Clean up at archive time

In `EditStudentDialog.tsx` archive handler (after line 1200), add:

1. Delete all `planned` instances: `DELETE FROM lesson_instances WHERE student_id = X AND teacher_id = Y AND status = 'planned'`
2. Delete all `lesson_overrides`: `DELETE FROM lesson_overrides WHERE student_id = X AND teacher_id = Y`

Keep `completed` instances for history. On unarchive, lazy generation auto-creates new planned instances.

Additionally, add an archived-student filter in `fetchActualLessonsForWeek` as a safety net: after fetching instances, filter out any whose `student_id` is not in the active students set. This handles edge cases where cleanup didn't run (e.g., students archived before this fix).

### Issue 2: Align lessonsPerWeek + sorting

**A) `StudentLessonTracker.tsx`**: Fetch `student_lessons` count for the student and use that as `lessonsPerWeek` instead of `student_lesson_tracking.lessons_per_week`.

**B) `StudentLessonTracker.tsx`**: Fetch `lesson_instances` to get `instanceStartTimes`, pass to `getSortedLessons` for consistent same-day ordering.

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/EditStudentDialog.tsx` | Archive handler: add planned instance deletion + override deletion |
| `src/hooks/useScheduleGrid.ts` | `fetchActualLessonsForWeek`: add safety-net filter for archived students |
| `src/components/StudentLessonTracker.tsx` | Fetch `student_lessons` count for `lessonsPerWeek`; fetch `lesson_instances` for `instanceStartTimes` |

## Implementation Order

1. Archive cleanup in `EditStudentDialog` (data integrity, no UI change)
2. Safety-net filter in `fetchActualLessonsForWeek` (defense in depth)
3. `StudentLessonTracker` alignment (read-side consistency)

## Risks

- Deleting planned instances on archive is safe — unarchive triggers lazy regeneration
- Safety-net filter adds one extra query (active students) — negligible cost
- Changing `lessonsPerWeek` source in `StudentLessonTracker` may change grid size for students with stale tracking data — this is a correction

