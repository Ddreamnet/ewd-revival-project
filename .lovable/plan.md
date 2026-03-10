

# Plan: Fix Students Not Appearing on Future Weeks Due to Instance Cap

## Problem

The `lpw * 4` cap added in `ensureInstancesForWeek` prevents lazy generation for students whose total instance count already reaches the cap -- even when ALL those instances are from past weeks.

**Affected students (Fatih's):**
- **Nur**: 8/8 instances, all in February (cap = 8). Next week: 0 instances, invisible on grid.
- **Hira**: 12/12 instances, all in past (cap = 12). Next week: 0 instances, invisible on grid.

## Root Cause

The cap logic checks `remaining = cap - currentCount` globally. If a student has 8 total instances (all from February), `remaining = 0`, and no new instances are generated for March weeks. This makes the student invisible on the weekly grid.

## Solution

**Remove the total-count cap from lazy generation entirely.** The cap was meant to limit the "Islenen Dersler" display list (which it already does via `sortedLessonsForDisplay`). Lazy generation should always create instances for a viewed week if the student has template slots and no instances for that week -- this was the original behavior before the cap was added.

### Change: `src/hooks/useScheduleGrid.ts` -- `ensureInstancesForWeek`

1. **Remove the `lpw * 4` cap check** from the instance generation loop. The logic should return to: "if student has templates but no instances for this week, generate them."

2. **Keep the excess cleanup logic** but modify it: instead of cleaning up based on total count, it should only clean up if there are duplicate instances for the same date/time slot (true duplicates from bugs), not legitimate instances across different weeks.

3. The `lpwMap`, `allInstanceCounts`, and `remaining` variables and their queries become unnecessary and will be removed, simplifying the function.

### What stays the same

- The "Islenen Dersler" display cap (`sortedLessonsForDisplay` showing only `totalLessons` rows) remains -- this is the correct place for the cap
- The `datesUnassigned` logic for reset stays
- The self-conflict fix stays
- Template-based generation logic stays (only generates for template day slots)

### Technical Detail

The simplified `ensureInstancesForWeek` will:
1. Get templates for teacher
2. Get active students
3. Check which students already have instances for this specific week
4. For students missing instances this week, generate from templates (no cap check)
5. Remove: lpw fetch, total count fetch, remaining calculation, excess cleanup loop

This brings the function back to its original purpose: ensuring every active student with templates has instances for the viewed week.

### Files Changed

| File | Change |
|---|---|
| `src/hooks/useScheduleGrid.ts` | Remove lpw cap from `ensureInstancesForWeek`, keep it simple: generate instances for any week where student has templates but no instances |

