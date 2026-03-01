

# Fix: Lazy Generation Skipping Past Days Within Current Week

## Root Cause

In `src/hooks/useScheduleGrid.ts`, line 202:

```text
if (lessonDate < today) continue;
```

This skips generating instances for days earlier than today **within the current week**. Alex's template days are Monday and Wednesday. Since today is Sunday March 1, both Monday (Feb 23) and Wednesday (Feb 25) are skipped. No instances are created, so Alex is invisible in the Guncel grid.

**Same issue affects:** Oykü Naz, Mehmet Ali, and any student whose template days have already passed within the current week.

## Fix

**File:** `src/hooks/useScheduleGrid.ts`

**Change:** Remove the `if (lessonDate < today) continue;` line (line 201-202).

The existing guard at the top of the function already prevents generation for entirely past weeks:

```text
if (weekEnd < today) return;
```

This is sufficient. For the current week, past days should still get instances so:
1. Students appear in the weekly grid
2. Teachers can mark those lessons as completed
3. The schedule view is complete and accurate

## What Changes

| File | Change |
|---|---|
| `src/hooks/useScheduleGrid.ts` | Remove lines 201-202 (`// Skip dates in the past` + `if (lessonDate < today) continue;`) |

That is the only change needed. One line removal.

## Expected Result

- Alex, Oykü Naz, Mehmet Ali will appear in this week's Guncel grid after the fix
- The lazy generation will create instances for their template days (Mon/Wed for Alex) even if those days have passed
- No impact on conflict detection, balance, or other logic
- Future weeks continue to work as before

## Risk

Low. The only guard removed is per-day within a week. The per-week guard (`weekEnd < today`) still prevents polluting historical weeks. For the current week, generating instances for past days is desirable behavior.

