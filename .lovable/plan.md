
# Refactoring Plan: Lesson Tracking, Schedule, and Rescheduling Flows

## Current State Analysis

### Files in Scope

| File | Lines | Role |
|---|---|---|
| `src/components/LessonTracker.tsx` | 493 | Teacher panel: marks lessons complete, shows dates with overrides |
| `src/components/StudentLessonTracker.tsx` | 270 | Student panel: read-only view of completed lessons with overrides |
| `src/components/EditStudentDialog.tsx` | 1076 | Admin panel: edit student, mark/undo lessons, reset, date editing |
| `src/components/LessonOverrideDialog.tsx` | 564 | Admin: one-time reschedule + postpone-to-next-lesson |
| `src/components/AdminWeeklySchedule.tsx` | 795 | Admin: weekly grid with override awareness, trial lessons |
| `src/components/WeeklyScheduleDialog.tsx` | 485 | Teacher: weekly grid with override awareness, trial lessons |
| `src/hooks/useLessonOverrides.ts` | 120 | Shared hook for override queries (used by schedule components) |

### Identified Duplication (High-Impact)

**1. `getSortedLessons` logic** -- identical in `LessonTracker.tsx` (lines 354-385) and `StudentLessonTracker.tsx` (lines 139-169). Also `getDisplayLessonData` is duplicated.

**2. `getRowConfig` logic** -- identical layout calculation in both tracker components.

**3. `updateTeacherBalance` / `subtractFromTeacherBalance`** -- duplicated across 4 files:
- `LessonTracker.tsx` (lines 292-340)
- `EditStudentDialog.tsx` (lines 335-423) -- both add and subtract
- `AdminWeeklySchedule.tsx` (lines 440-510) -- trial lesson variant
- `WeeklyScheduleDialog.tsx` (lines 318-371) -- trial lesson variant

**4. `fetchTracking` pattern** (get most recent record by `updated_at DESC LIMIT 1`) -- duplicated in `LessonTracker.tsx`, `StudentLessonTracker.tsx`, `EditStudentDialog.tsx`, and `LessonOverrideDialog.tsx`.

**5. `fetchLessonOverrides` query** -- duplicated in `LessonTracker.tsx`, `StudentLessonTracker.tsx`, `EditStudentDialog.tsx`.

**6. `calculateLessonDates` / `recalculateRemainingDates`** -- similar date-walking logic in `LessonTracker.tsx` and `EditStudentDialog.tsx`, plus `calculateNextLessonDate` in `LessonOverrideDialog.tsx`.

**7. `LessonDates` and `LessonOverride` interfaces** -- redefined identically in 4 files.

**8. Schedule grid logic** (`getLessonForDayAndTime`, `getAllTimeSlots`, `getTrialLessonForDayAndTime`, `getDateForDayIndex`) -- nearly identical in `AdminWeeklySchedule.tsx` and `WeeklyScheduleDialog.tsx`.

**9. `formatTime` utility** -- duplicated across 4+ components.

---

## Refactoring Plan

### Phase 1: Extract Shared Types and Utilities

**New file: `src/lib/lessonTypes.ts`**
- Move `LessonDates`, `LessonOverride` (the local interface, not the hook's), and `LessonTrackingRecord` interfaces here.
- Export `formatTime` utility (currently duplicated everywhere).
- Export `getRowConfig(lessonsPerWeek)` function.

**Why:** Eliminates 4 duplicate interface definitions and scattered utility functions.

### Phase 2: Extract Teacher Balance Service

**New file: `src/lib/teacherBalance.ts`**
- `updateTeacherBalance(teacherId, studentId, lessonType: 'regular' | 'trial', startTime, endTime)`
- `subtractFromTeacherBalance(teacherId, studentId, lessonType, startTime, endTime)`
- Internally calculates duration, checks/creates balance record.

**Why:** This is the single highest-duplication function (4 nearly identical copies). Centralizing it prevents future drift and bugs.

### Phase 3: Extract Lesson Tracking Data Hook

**New file: `src/hooks/useLessonTracking.ts`**
- `useLessonTracking(studentId, teacherId)` returns `{ completedLessons, lessonDates, lessonOverrides, trackingRecordId, loading, refetch }`
- Encapsulates the "fetch most recent record" pattern, override fetching, and optional real-time subscription.
- Replaces duplicate fetch logic in `LessonTracker`, `StudentLessonTracker`, and parts of `EditStudentDialog`.

**Why:** The same fetch-tracking + fetch-overrides + state pattern is repeated 3 times.

### Phase 4: Extract Lesson Sorting Logic

**New file: `src/lib/lessonSorting.ts`**
- `getSortedLessons(lessonDates, lessonOverrides, totalLessons)` -- pure function.
- `getDisplayLessonData(sortedLessons, lessonDates, displayPosition)` -- pure function.

**Why:** Identical logic in `LessonTracker` and `StudentLessonTracker`.

### Phase 5: Extract Lesson Date Calculation

**New file: `src/lib/lessonDateCalculation.ts`**
- `calculateLessonDates(markedLessonNumber, markedDate, studentLessonDays)` -- pure function (from `LessonTracker`).
- `recalculateRemainingDates(fromLessonNumber, startDate, currentDates, lessonDays, totalLessons)` -- pure function (from `EditStudentDialog`).
- `calculateNextLessonDate(currentDate, lessonDays)` -- pure function (from `LessonOverrideDialog`).

**Why:** Date-walking logic is the most error-prone area; centralizing makes it testable and consistent.

### Phase 6: Extract Schedule Grid Logic

**New file: `src/hooks/useScheduleGrid.ts`**
- `useScheduleGrid(lessons, trialLessons, overrides)` returns `{ timeSlots, getLessonForDayAndTime, getTrialLessonForDayAndTime, getDateForDayIndex }`
- Used by both `AdminWeeklySchedule` and `WeeklyScheduleDialog`.

**Why:** ~100 lines of near-identical grid positioning logic in two components.

### Phase 7: Refactor Consumers

Update existing components to use the extracted modules:

| Component | Changes |
|---|---|
| `LessonTracker.tsx` | Use `useLessonTracking`, import `getSortedLessons`, `getDisplayLessonData`, `calculateLessonDates`, `updateTeacherBalance`, `getRowConfig` from shared modules. Estimated reduction: ~150 lines. |
| `StudentLessonTracker.tsx` | Use `useLessonTracking`, import sorting/display functions. Estimated reduction: ~80 lines. |
| `EditStudentDialog.tsx` | Import `updateTeacherBalance`, `subtractFromTeacherBalance`, `recalculateRemainingDates`, types. Estimated reduction: ~100 lines. |
| `LessonOverrideDialog.tsx` | Import `calculateNextLessonDate` from shared module. Minor reduction. |
| `AdminWeeklySchedule.tsx` | Use `useScheduleGrid`, import balance functions. Estimated reduction: ~80 lines. |
| `WeeklyScheduleDialog.tsx` | Use `useScheduleGrid`, import balance functions. Estimated reduction: ~80 lines. |

### Phase 8: Add Tests

**New test files:**
- `src/lib/lessonDateCalculation.test.ts` -- unit tests for date walking, edge cases (Sunday wrap, single lesson day)
- `src/lib/lessonSorting.test.ts` -- unit tests for sorting with cancellations, overrides
- `src/lib/teacherBalance.test.ts` -- unit tests for duration calculation logic (mocking Supabase)

**Why:** The extracted pure functions are now independently testable. These are the highest-risk areas for regressions.

---

## Implementation Order

1. **Phase 1** (types/utilities) -- no risk, additive only
2. **Phase 2** (teacher balance) -- extract, then swap one consumer at a time
3. **Phase 3** (tracking hook) -- extract, swap `StudentLessonTracker` first (simplest), then `LessonTracker`
4. **Phase 4** (sorting) -- extract, swap both trackers
5. **Phase 5** (date calculation) -- extract, swap `LessonTracker` and `EditStudentDialog`
6. **Phase 6** (schedule grid) -- extract, swap both schedule components
7. **Phase 7** (final cleanup of all consumers)
8. **Phase 8** (tests)

Each phase is independently deployable. After each swap, all existing behavior remains identical -- only internal imports change.

## Files Created (New)

| File | Purpose |
|---|---|
| `src/lib/lessonTypes.ts` | Shared interfaces and small utilities |
| `src/lib/teacherBalance.ts` | Balance add/subtract operations |
| `src/lib/lessonSorting.ts` | Sorted lesson display logic |
| `src/lib/lessonDateCalculation.ts` | Date walking algorithms |
| `src/hooks/useLessonTracking.ts` | Tracking data fetch + state hook |
| `src/hooks/useScheduleGrid.ts` | Schedule grid positioning logic |

## Files Modified (Existing)

| File | Nature of Change |
|---|---|
| `src/components/LessonTracker.tsx` | Replace inline logic with shared imports |
| `src/components/StudentLessonTracker.tsx` | Replace inline logic with shared imports |
| `src/components/EditStudentDialog.tsx` | Replace balance/date logic with shared imports |
| `src/components/LessonOverrideDialog.tsx` | Replace date calc with shared import |
| `src/components/AdminWeeklySchedule.tsx` | Replace grid/balance logic with shared imports |
| `src/components/WeeklyScheduleDialog.tsx` | Replace grid/balance logic with shared imports |

No changes to: dashboards, routing, authentication, landing page, or any unrelated components.
