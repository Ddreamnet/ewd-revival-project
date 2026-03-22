

# "Sonraki Derse Aktar" False Conflict Bug — Analysis & Fix Plan

## Root Cause (Confirmed)

The bug is in `src/lib/instanceGeneration.ts`, function `shiftLessonsForward()`, lines 245-255.

When "Sonraki Derse Aktar" runs, it shifts the target instance AND all subsequent planned instances forward by one template slot. The conflict check runs **before any DB updates**, checking each instance's NEW position against the current DB state.

The problem: `checkTeacherConflicts` is called with only `excludeInstanceId` (the single instance being checked), but **NOT** `excludeStudentId`. The other instances of the **same student** that are also part of the shift batch are still sitting at their OLD positions in the DB.

**Concrete example:**
- Student has lessons on Monday (instance A) and Wednesday (instance B)
- Admin clicks "Sonraki Derse Aktar" on Monday's lesson
- System plans: A moves Mon→Wed, B moves Wed→next Mon
- Conflict check for A's new position (Wed): finds instance B still at Wed → **false conflict reported**
- The system doesn't know that B will also be moved

The `checkTeacherConflicts` function already has an `excludeStudentId` parameter (line 41) specifically for this purpose, but `shiftLessonsForward` never passes it.

## Why Previous Fixes Didn't Address This

This is not a regression from recent changes. The `excludeStudentId` parameter was added to `checkTeacherConflicts` for use in `syncTemplateChange`, but was never wired into the shift logic. The shift function only passes `check.id` (single instance exclusion), which is insufficient for batch operations on the same student.

## Fix

**File: `src/lib/instanceGeneration.ts`**
**Function: `shiftLessonsForward()`**, lines 246-254

Change the conflict check to pass `excludeStudentId`:

```typescript
// Current (broken):
const c = await checkTeacherConflicts(
  teacherId,
  check.date,
  check.startTime,
  check.endTime,
  check.id        // only excludes this one instance
);

// Fixed:
const c = await checkTeacherConflicts(
  teacherId,
  check.date,
  check.startTime,
  check.endTime,
  check.id,
  studentId        // excludes ALL instances of this student
);
```

This is safe because:
- All instances being shifted belong to the same student
- The shift operation moves ALL of this student's planned instances from the target onward
- Conflicts with OTHER students' lessons and trial lessons are still detected
- `excludeStudentId` only filters `lesson_instances`, not `trial_lessons` (line 61-63 in conflictDetection.ts)

## Files to Change

| File | Change |
|------|--------|
| `src/lib/instanceGeneration.ts` | Add `studentId` as 6th argument to `checkTeacherConflicts` call in `shiftLessonsForward` |

One line change. No other files affected.

## Security & Side Effect Check

- Real conflicts with OTHER students are still caught (different student_id not excluded)
- Real conflicts with trial lessons are still caught (trial check doesn't use excludeStudentId)
- Same student + same teacher + different cycle instances: not affected (query already filters by current cycle)
- Package/balance/history: unaffected (conflict check is read-only gate)
- Single vs multi-instance shift: both fixed since all shifted instances share the same student_id

## Test Scenarios

1. **Bug reproduction**: Student with 2+ lessons/week → click "Sonraki Derse Aktar" on first lesson → should succeed without false conflict
2. **Real conflict**: Another student has a lesson at the shifted target time → should still block
3. **Trial lesson conflict**: Trial lesson at shifted target time → should still block
4. **3+ lessons/week**: Student with Mon/Wed/Fri → shift Mon → all three cascade correctly
5. **Single lesson/week**: Student with 1 lesson → shift works (no self-conflict possible)
6. **Back-to-back**: Two students at adjacent times → shift should allow (endA == startB is not conflict)

