

# Plan: Stable Student Colors Across Weeks

## Problem
In `AdminWeeklySchedule.tsx`, `fetchActualSchedule` (line 120-124) assigns colors based on the order of students returned for that specific week. When switching weeks, different students appear or in different order, causing color reassignment.

Same issue exists in `WeeklyScheduleDialog.tsx` (line 107-114).

## Fix

Both components already fetch a stable list of ALL active students with templates in `fetchSchedule`. Use that stable student list as the single source for color assignment, and stop reassigning colors in `fetchActualSchedule`.

### AdminWeeklySchedule.tsx
1. In `fetchSchedule` (line 155-158): keep the existing color assignment from template student list — this is stable across weeks
2. In `fetchActualSchedule` (line 120-124): remove color reassignment. Only add colors for students that appear in actual data but weren't in templates (edge case), appending to existing map rather than rebuilding

### WeeklyScheduleDialog.tsx
1. Same pattern: `fetchLessons` (line 148-157) builds stable colors from templates — keep this
2. `fetchActualLessons` (line 107-114): stop rebuilding, only append missing students

## Files
- `src/components/AdminWeeklySchedule.tsx` — ~5 lines changed
- `src/components/WeeklyScheduleDialog.tsx` — ~5 lines changed

## Risk
Zero. Colors become more stable, no logic change.

