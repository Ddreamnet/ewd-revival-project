

# Targeted Revisions to Existing Refactoring Plan

Below are ONLY the revised/added sections. Everything else in the plan remains unchanged.

---

## Revision 1: Weekly Count Decrease Edge-Case

### Added to: Phase 4 (Package/Rights) + Write Path + Validation Matrix

**Rule:** If reducing `weekly_count` would make `new_total = new_weekly_count × 4` less than `completed_count` in the current cycle, the operation is **blocked at the RPC level**. `rpc_sync_template_change` must check:

```
completed_in_cycle = COUNT(lesson_instances WHERE student_id=X AND teacher_id=Y AND package_cycle=current AND status='completed')
new_total = new_weekly_count × 4
IF new_total < completed_in_cycle → RAISE EXCEPTION
```

The admin UI should pre-check this and show a clear message: "Bu öğrencinin mevcut paketinde N ders işlenmiş. Haftalık sayıyı bu paketin altına düşüremezsiniz. Önce paket sıfırlayın." The decrease will only take effect in a new cycle after reset.

**Added to template change invariants (see Revision 4 below):**
- `remaining_rights` (total − completed) can never be negative
- Weekly count decrease that would cause negative remaining is rejected

---

## Revision 2: Package Cycle Placement — Architectural Note

### Added to: Target Domain Model, after `package_cycle` column description

**Design rationale note:**

The `package_cycle` integer on `student_lesson_tracking` + `lesson_instances` is a deliberately lightweight, pragmatic choice. Reasons:

1. No new table, no new joins — minimal schema change
2. Monotonically increasing integer is trivially queryable and indexable
3. All rights calculations scope to `WHERE package_cycle = current_cycle` — simple and fast
4. No need for cycle metadata (start_date, end_date, etc.) in the current product scope

**Future migration path:** If detailed historical package reporting becomes necessary (e.g., "show me all past packages with their dates, totals, and completion rates"), a dedicated `student_package_cycles` table can be introduced:
```
student_package_cycles (id, student_id, teacher_id, cycle_number, weekly_count, started_at, closed_at, total_rights, completed_count)
```
The current `package_cycle` column on instances would naturally map to `cycle_number` in this table, making migration additive and non-breaking. Until that need arises, the column-based approach is sufficient and correct.

---

## Revision 3: Legacy Tracking Fields — Stronger Language

### Updated in: Source of Truth Strategy + Phase descriptions

**Source of Truth Strategy table — revised rows:**

| Data | Current sources | Target source | Transition status |
|------|----------------|---------------|-------------------|
| Is lesson completed? | `completed_lessons` array + `instance.status` | `instance.status` ONLY | **Phase 0–5: compat-only writes to array. Phase 6: column dropped. Array is NOT a source of truth at any point during or after refactor.** |
| Lesson dates | `lesson_dates` JSON + `instance.lesson_date` | `instance.lesson_date` ONLY | **Phase 0–5: compat-only writes via `rebuildLegacy…`. Phase 6: column dropped. JSON is NOT a source of truth at any point during or after refactor.** |

**Explicit policy (added to Phase 0 and Phase 1 descriptions):**

> `student_lesson_tracking.completed_lessons` and `student_lesson_tracking.lesson_dates` are **legacy compatibility fields only**. From Phase 0 onward, no read path shall use these fields for business logic decisions. All RPC functions that write to these fields during Phases 0–5 do so **exclusively for backward compatibility** with any code not yet migrated to instance-based reads. After Phase 6, all writes to these fields are removed and the columns are dropped.

**Phase 6 — revised language:**

> **Goal: Full legacy retirement.** Drop `completed_lessons` column, drop `lesson_dates` column, drop `lesson_overrides` table. Update `notify_admin_last_lesson` trigger to count `lesson_instances WHERE status='completed' AND package_cycle=current`. After this phase, these fields are **permanently retired** — no code reads or writes them.

---

## Revision 4: Template / Weekly Count Change Invariants

### Added to: Write Path (rpc_sync_template_change) + Phase 4 (Package/Rights)

**Invariants for `rpc_sync_template_change` — must be enforced within the RPC:**

1. Completed instances are **never deleted** by a template change
2. Completed instances' `lesson_date`, `start_time`, `end_time` are **never modified** by a template change
3. Only `planned` instances within the **current `package_cycle`** with `lesson_date >= today` are eligible for deletion or regeneration
4. `remaining_rights` (`new_weekly_count × 4 − completed_count_in_cycle`) **cannot be negative** — if it would be, the RPC raises an exception (see Revision 1)
5. No template change operation causes a hak düşümü (rights deduction) — rights are only consumed by explicit completion

**Added to Phase 4 description:**

> These invariants are checked at the top of the RPC function body. Violations raise exceptions that the frontend catches and displays as user-facing validation errors.

---

## Revision 5: Teacher Undo — Clearer Rule

### Updated in: Phase 1 (Teacher Undo Flow) + Risks and Tradeoffs

**Phase 1 teacher undo section — revised:**

> **Teacher undo is intentionally simple.** It undoes the chronologically most recent completed instance (by `lesson_date, start_time` DESC) within the **current `package_cycle`** only. There is no selective undo, no historical undo across past cycles, and no UI for choosing which lesson to undo. This constraint is deliberate: it matches the sequential completion rule (only the next chronological lesson can be completed, so only the last can be undone) and avoids complex state reconciliation.
>
> Both admin and teacher call the same `rpc_undo_complete_lesson` RPC. The RPC enforces: target instance must be `status='completed'`, must be in the current cycle, and must be the chronologically last completed instance in that cycle.

**Added to Risks and Tradeoffs table:**

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Teacher wants to undo a specific past lesson, not the most recent | Low | Product decision: sequential undo only. Admin can handle edge cases via direct DB access if truly needed. Not in scope for this refactor. |

---

## Revision 6: Balance Events — Stronger Typing Note

### Updated in: Target Domain Model (balance_events table definition)

**Revised `event_type` column note:**

> `event_type TEXT NOT NULL` — **Recommended: use a `CHECK` constraint** to enforce a controlled value set:
> ```sql
> CHECK (event_type IN ('lesson_complete', 'lesson_undo', 'trial_complete', 'trial_undo', 'manual_adjust', 'balance_reset'))
> ```
> A full DB enum (`CREATE TYPE balance_event_type AS ENUM (...)`) is also acceptable but harder to extend. The `CHECK` constraint provides financial audit-grade control (no arbitrary strings) while remaining easy to add new values via `ALTER TABLE ... DROP CONSTRAINT ... ADD CONSTRAINT`.
>
> Free text is **not recommended** for this column due to audit requirements — every balance mutation must be attributable to a known event category.

---

## Revision 7: Archive RPC — Legacy Overrides Transition Note

### Added to: Phase 5 (Archive/Delete/Reset Safety) + Phase 6 (Legacy Retirement)

**Phase 5 — added note to archive section:**

> The `rpc_archive_student` RPC currently deletes `lesson_overrides` for the archived student. **This dependency exists only during the transition period (Phases 0–5).** After Phase 6 drops the `lesson_overrides` table entirely, the archive RPC must be updated to remove this DELETE statement. This is tracked as a Phase 6 cleanup item.

**Phase 6 — added to scope:**

> After dropping `lesson_overrides` table: update `rpc_archive_student` to remove the `DELETE FROM lesson_overrides` statement. The archive flow should have zero legacy table dependencies post-Phase 6.

---

## Revision 8: Additional Test Scenarios

### Added to: Validation & Regression Test Matrix (appended to existing table)

| # | Scenario | Action | Expected Result |
|---|----------|--------|-----------------|
| 21 | Weekly count decrease below completed | Try to change 3→1 when 6 lessons completed in current cycle | **Blocked** — RPC raises exception, UI shows validation error |
| 22 | Current vs old cycle remaining rights | Complete 4 of 8 in cycle 1, reset, complete 2 of 8 in cycle 2 | Cycle 2 shows remaining=6. Cycle 1 data preserved in DB with `package_cycle=1` |
| 23 | Reset preserves old cycle history | Reset package, then query old cycle instances | All `completed` instances with `package_cycle=old` still exist, untouched |
| 24 | Teacher undo scope | Teacher undoes after completing lessons 1,2,3 | Only lesson 3 reverted. Lesson 2 and 1 remain completed. |
| 25 | Teacher undo cross-cycle blocked | Complete lessons in cycle 1, reset to cycle 2, attempt undo | No completable undo target in cycle 2 — undo button disabled |
| 26 | Legacy tracking not source of truth | Manually corrupt `completed_lessons` array in DB, check all panels | Panels show correct data from `lesson_instances.status`, not from array |
| 27 | Archive post-Phase 6 | Archive student after `lesson_overrides` table dropped | Archive succeeds without error — no override dependency |

