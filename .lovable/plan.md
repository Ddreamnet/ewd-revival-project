
# Lesson Scheduling System — Refactoring Plan

## Current Status: Phase 0 COMPLETE ✅

---

## Phase 0 Deliverables (DONE)

### Schema Changes (Migration)
- ✅ `lesson_instances.package_cycle` INTEGER NOT NULL DEFAULT 1
- ✅ `student_lesson_tracking.package_cycle` INTEGER NOT NULL DEFAULT 1
- ✅ `teacher_balance.manual_adjustment_minutes` INTEGER NOT NULL DEFAULT 0
- ✅ `balance_events` table with CHECK constraint on event_type
- ✅ RLS policies on balance_events (admin full, teacher view own)
- ✅ Indexes on package_cycle columns
- ✅ `teacher_balance_teacher_id_key` UNIQUE constraint for upsert support

### RPC Functions (Atomic Transactions)
- ✅ `rpc_complete_lesson(instance_id, teacher_id)` — sequential completion + balance + audit
- ✅ `rpc_undo_complete_lesson(instance_id, teacher_id)` — last-completed undo + balance reversal + audit
- ✅ `rpc_reset_package(student_id, teacher_id, template_slots)` — non-destructive cycle increment
- ✅ `rpc_archive_student(record_id, student_user_id, teacher_user_id)` — atomic archive
- ✅ `rpc_manual_balance_adjust(teacher_id, amount, notes)` — separate manual category
- ✅ `rpc_complete_trial_lesson(trial_id, teacher_id)` — trial completion + balance + audit

### Frontend Service Layer
- ✅ `src/lib/lessonService.ts` — thin wrapper around all RPCs
  - `completeLesson()`, `undoCompleteLesson()`, `resetPackage()`
  - `archiveStudent()`, `manualBalanceAdjust()`, `completeTrialLesson()`
  - `getNextCompletableInstance()`, `getLastCompletedInstance()`, `getRemainingRights()`

---

## Phase 1: Write Path Consolidation (NEXT)

### Goal
Wire all existing mutation call sites to use `lessonService.ts` instead of inline logic.

### Changes Required
1. **LessonTracker.tsx** — `confirmLessonComplete` → `lessonService.completeLesson()`
   - Add undo button calling `lessonService.undoCompleteLesson()`
   - Enforce sequential: only enable button for `getNextCompletableInstance()` result
2. **EditStudentDialog.tsx** — `handleMarkLastLesson` → `lessonService.completeLesson()`
   - `handleUndoLastLesson` → `lessonService.undoCompleteLesson()`
   - `handleResetAllLessons` → `lessonService.resetPackage()`
   - Archive handler → `lessonService.archiveStudent()`
3. **LessonOverrideDialog.tsx** — stop writing to `lesson_overrides` in reschedule
4. **AdminBalanceManager.tsx** — manual adjustments → `lessonService.manualBalanceAdjust()`
5. **Trial lesson completion** → `lessonService.completeTrialLesson()`

### Key Rule Changes
- Teacher gets undo capability (same RPC as admin)
- Completion becomes strictly sequential (first planned by date in current cycle)
- Balance writes become atomic (no more multi-step client-side updates)

---

## Phase 2: Read Path Unification

All panels derive display data from `lesson_instances.status` instead of legacy `completed_lessons` array or `lesson_dates` JSON.

---

## Phase 3: Reschedule/Postpone Cleanup

Stop writing to `lesson_overrides`. Instance-only reschedule.

---

## Phase 4: Package/Rights Model

- Cycle-aware remaining rights display
- Non-destructive reset (already implemented in RPC)
- Weekly count change validation (block if new_total < completed_in_cycle)

---

## Phase 5: Archive/Delete/Reset Safety

Verify archive/delete flows use RPCs. Balance integrity checks.

---

## Phase 6: Legacy Data Retirement

Drop `completed_lessons`, `lesson_dates` columns. Drop `lesson_overrides` table. Update triggers.

---

## Phase 7: Cancelled Status Removal

Remove `cancelled` concept from UI/code.

---

## Key Design Decisions

### Package Cycle
- Lightweight `package_cycle` INTEGER on existing tables (no new join table)
- Pragmatic choice: sufficient for current needs
- Future migration path to `student_package_cycles` table if reporting needs grow

### Balance Events
- `event_type` uses CHECK constraint: `lesson_complete`, `lesson_undo`, `trial_complete`, `trial_undo`, `manual_adjust`, `balance_reset`
- Append-only audit trail alongside accumulator
- Manual adjustments tracked in separate `manual_adjustment_minutes` column

### Legacy Fields Policy
- `completed_lessons` array and `lesson_dates` JSON are **compatibility-only** from Phase 0 onward
- No read path uses them for business logic
- Writes continue during transition (Phases 0-5) for backward compat only
- Permanently retired in Phase 6

### Teacher Undo
- Intentionally simple: only the chronologically last completed in current cycle
- No selective historical undo
- Same RPC for admin and teacher
