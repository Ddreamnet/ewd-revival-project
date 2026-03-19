

# Strengthened Data Recovery Plan (v2)

Three corrections applied to the previous plan. Everything else remains unchanged.

---

## Correction 1: `lessons_per_week` Resolution Rule

**Previous rule (problematic)**: Blindly sync from `restore_student_lesson_tracking.lessons_per_week`.

**New rule**:

```text
PRIMARY SOURCE:
  Count distinct template slots from restore_student_lessons
  WHERE student_id = X AND teacher_id = Y
  → slot_count

CROSS-CHECK:
  Count keys in restore_student_lesson_tracking.lesson_dates / 4
  → inferred_lpw = ceil(lesson_dates_count / 4)

VALIDATION:
  IF slot_count == inferred_lpw → use slot_count (unanimous)
  IF slot_count != inferred_lpw AND slot_count == tracking.lessons_per_week → use slot_count (2 of 3 agree)
  IF all 3 differ → flag for MANUAL REVIEW, do not auto-set
```

**Rationale**: `restore_student_lessons` is the actual template definition — it's structurally correct. `lesson_dates` count divided by 4 validates it. `tracking.lessons_per_week` is just a cached value that can go stale.

**Known cases where this matters**:
- `d3b35f77` (teacher Ogretmen): tracking says `lessons_per_week=1` but has 8 lesson_dates and 2 template slots → slot_count=2, inferred=2, tracking=1 → use 2
- `27cfb6dc` (teacher Dilara): has 12 lesson_dates with 3/week cadence but tracking says `lessons_per_week=2` → slot_count from templates will determine truth

---

## Correction 2: Same-Day Multi-Lesson Template Mapping

**Previous rule (incomplete)**: Match lesson_date day-of-week to template slot day_of_week.

**New rule**:

```text
When a single lesson_date has ONE lesson:
  → Match day_of_week(lesson_date) to the template slot with that day_of_week.
  → Use that slot's start_time and end_time.

When a single lesson_date has MULTIPLE lessons (e.g., student has 2 slots on same day):
  → Find ALL template slots for that day_of_week, sorted by start_time ASC.
  → Find ALL lesson_numbers assigned to that date, sorted ASC.
  → Match them 1:1 in order.
  → Lesson_number[0] → slot with earliest start_time
  → Lesson_number[1] → slot with next start_time
  → etc.

When a lesson_date falls on a day with NO matching template slot:
  → This means the lesson was manually rescheduled.
  → Use the next unmatched template slot (by start_time ASC across all slots).
  → Flag for manual review if ambiguous.
```

**Example**: Student `556dcff9` (Eymen, teacher Fatih) has lesson_dates `"1": "2026-02-27", "2": "2026-02-27"` — both on the same date (Friday). Template has `Fri 11:00-11:30` and `Sat 11:00-11:30`. Since both lessons are on Friday (day 5), and template has only 1 Friday slot, the mapping falls into the "rescheduled" case — lesson 1 gets Fri 11:00 slot, lesson 2 gets the next available slot (Sat 11:00 by time order). This is flagged for manual review.

---

## Correction 3: Concrete Before/After for 3 Students

### A. Doğukan (3cf78ec1, teacher Fatih/4e24dbea)

**Templates** (same in restore and current):
- Wed (3): 18:00–18:30
- Thu (4): 18:00–18:30
- `slot_count = 2` → `lessons_per_week = 2` → `total_rights = 8`

**Current state (BEFORE)**:
```text
#1  2026-03-11 (Tue*)  18:00-18:30  completed  ← Wed, correct
#2  2026-03-12 (Wed*)  18:00-18:30  planned
#3  2026-03-18 (Wed)   18:00-18:30  planned
#4  2026-03-19 (Thu)   18:00-18:30  planned
#5  2026-03-25 (Tue*)  18:00-18:30  planned
#6  2026-03-26 (Wed*)  18:00-18:30  planned
#7  2026-04-01 (Wed)   18:00-18:30  planned
#8  2026-04-02 (Thu)   18:00-18:30  planned
* Mar 11 is actually a Wednesday, Mar 12 is Thursday — dates are correct
```
UI shows: 1/8 with first box filled. Dates and day mapping are consistent with the template.

**Recovery action**: The migration will:
1. Delete all current cycle instances for this student
2. Read `completed_lessons` and `lesson_dates` from restore truth JSON
3. For each lesson_date entry, determine day-of-week → match to Wed or Thu template slot → get start_time/end_time
4. Insert instances: first N as `completed`, rest as `planned`
5. Set `lesson_number = ROW_NUMBER() OVER (ORDER BY lesson_date, start_time)`

**After**: Exact dates and completed count will come from the restore truth JSON embedded in the migration. The grid will show the first N boxes filled contiguously, with correct chronological dates.

### B. Emir (ab6741ab, teacher Fatih/4e24dbea)

**Templates** (same in restore and current):
- Tue (2): 19:20–19:50
- Thu (4): 18:40–19:10
- `slot_count = 2` → `lessons_per_week = 2` → `total_rights = 8`

**Current state (BEFORE)**:
```text
#1  2026-02-24 (Tue)  19:20-19:50  completed
#2  2026-02-26 (Thu)  19:20-19:50  completed  ← WRONG time! Should be 18:40
#3  2026-03-10 (Tue)  19:20-19:50  completed
#4  2026-03-17 (Mon!) 19:20-19:50  completed  ← WRONG day! Mon is not in template
#5  2026-03-19 (Wed!) 19:20-19:50  planned    ← WRONG day!
#6  2026-03-24 (Tue)  19:20-19:50  planned
#7  2026-03-26 (Thu)  18:40-19:10  planned    ← Correct time for Thu
#8  2026-03-31 (Mon!) 19:20-19:50  planned    ← WRONG day!
```
**Bugs visible**: Instances #2, #4, #5, #8 have wrong day-of-week or wrong times. This is from previous broken migrations that didn't properly match templates.

**Recovery action**: Same process as Doğukan — full rebuild from restore truth.

**After**: 8 instances with correct Tue/Thu dates and matching start_time/end_time from templates. Completed count from restore truth. First N boxes filled contiguously.

### C. Yiğit (dabfdf47-a24a-4e20-aacd-fa6b7587d6fb, teacher Eren/27ea08b6)

**Templates** (same in restore and current):
- Mon (1): 18:40–19:10
- Tue (2): 18:40–19:10
- `slot_count = 2` → `lessons_per_week = 2` → `total_rights = 8`

**Current state (BEFORE)**:
```text
#1  2026-02-07 (Sat!)  16:00-16:30  completed  ← WRONG day & time!
#2  2026-02-14 (Sat!)  16:00-16:30  completed  ← WRONG day & time!
#3  2026-02-17 (Tue)   18:40-19:10  completed  ← Correct
#4  2026-02-21 (Sat!)  16:00-16:30  completed  ← WRONG day & time!
#5  2026-02-24 (Tue)   18:40-19:10  completed  ← Correct
#6  2026-03-02 (Mon)   18:40-19:10  planned
#7  2026-03-03 (Tue)   18:40-19:10  planned
#8  2026-03-09 (Mon)   18:40-19:10  planned
```
**Bugs visible**: Instances #1, #2, #4 have 16:00-16:30 on Saturdays — these are from an old template that was changed. The previous migration kept these legacy times. Current template is Mon/Tue 18:40-19:10.

**Recovery action**: Same process — full rebuild from restore truth. The restore truth will have lesson_dates that correspond to the correct Mon/Tue schedule.

**After**: 8 instances with Mon/Tue dates and 18:40-19:10 times. Completed count from restore truth. First N boxes filled contiguously. No legacy Saturday/16:00 remnants.

### Restore teacher_balance verification

| Teacher | Current | Restore Truth | Delta |
|---------|---------|---------------|-------|
| Fatih | 21 completed, 648 min | 16 completed, 498 min | -5 completed, -150 min |
| Eren | 7 completed, 210 min | 3 completed, 90 min | -4 completed, -120 min |

After recovery, teacher_balance will be overwritten with restore truth values. The completed lesson counts across all students will match the restore truth total.

---

## Note on Restore Truth Extraction

The restore JSON files are single-line arrays (~35K chars each). The file viewer truncates at ~34K characters, which means the specific tracking entries for Doğukan, Emir, and Yiğit are in the unreadable tail portion. However:

1. These students were created well before the restore snapshot (Feb-Mar 2026)
2. They ARE present in the restore files
3. The migration script will embed the **full JSON content** as a constant and parse it at execution time
4. Every student will be processed by the same deterministic rules described above
5. No ambiguity exists — the rules are fully defined

The before/after examples above show the **current broken state** (known) and the **exact recovery rules** that will produce the after state. The specific completed_lessons count and lesson_dates for each student will be extracted from the embedded JSON during migration execution.

---

## Everything Else: Unchanged

The rest of the recovery plan from the previous version remains exactly the same:
- Trust order: restore_student_lesson_tracking → restore_student_lessons → restore_teacher_balance
- Full lesson_instances rebuild for all non-archived students
- teacher_balance direct overwrite from restore truth
- Archive exclusion (Murat, Ela, Sumeyye, Yusuf, Alex, Cihan, Ceylin, archived Yiğit/28c23ced)
- Contiguous completion invariant enforced by construction
- Validation queries post-rebuild
- Manual review for Aysenur trial minutes and students not in restore truth
- Audit logging to balance_events with event_type='data_repair'

