-- ============================================================================
-- Atomic chain reschedule: rpc_apply_chain_dates
-- ============================================================================
--
-- Every chain operation (realign / shift forward / shift backward / bulk date
-- edit / "Sonraki Derse Aktar") was applied as N parallel client UPDATEs.
-- Three failure modes came out of that:
--
--  1. Transient unique violations. `uniq_active_planned_slot` is a partial
--     UNIQUE index on (student_id, lesson_date, start_time) WHERE status =
--     'planned'. While a chain rotates, the lesson moving into the next slot
--     collides with the lesson still sitting there unless that one has already
--     moved — and parallel writes have no ordering guarantee. Users saw this as
--     an intermittent "zaten bir ders var" error when postponing a lesson.
--  2. Partial application. Some rows committed and others failed, leaving the
--     chain split across two layouts with no rollback.
--  3. A check-then-write race: conflicts were verified over the network
--     seconds before the writes actually landed.
--
-- This function performs the whole operation in one transaction: verify
-- conflicts, park every moving row on a unique sentinel date, write the real
-- values (optionally recording override bookkeeping), then renumber the chain
-- by date order.
--
-- p_mark_override   — record original_date/start/end and bump rescheduled_count
--                     (used by one-time reschedules and "Sonraki Derse Aktar").
-- p_shift_group_id  — stamp a shared id so a batch shift can be reverted as one.

CREATE OR REPLACE FUNCTION public.rpc_apply_chain_dates(
  p_student_id uuid,
  p_teacher_id uuid,
  p_updates jsonb,  -- [{ "id": uuid, "lessonDate": date, "startTime": time, "endTime": time }]
  p_mark_override boolean DEFAULT false,
  p_shift_group_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conflict_name text;
  v_conflict_date date;
  v_conflict_start time;
  v_conflict_end time;
  v_count integer := 0;
  v_cycle integer;
  v_before jsonb;
BEGIN
  IF NOT public.is_teacher_caller(p_teacher_id) THEN
    RETURN json_build_object('success', false, 'error', 'Bu işlem için yetkiniz yok');
  END IF;

  IF p_updates IS NULL OR jsonb_array_length(p_updates) = 0 THEN
    RETURN json_build_object('success', false, 'error', 'Taşınacak ders bulunamadı');
  END IF;

  -- Serialize concurrent chain edits for this student's rows.
  PERFORM 1 FROM lesson_instances
   WHERE teacher_id = p_teacher_id AND student_id = p_student_id
   FOR UPDATE;

  -- ── 1. Conflict check, inside the transaction ──────────────────────────────
  -- Overlap test is half-open (A.start < B.end AND A.end > B.start), so
  -- back-to-back lessons are allowed. Rows being moved are excluded so the
  -- chain never flags itself. Archived students are ignored: their completed
  -- rows are kept for balance history and must not block live scheduling.
  SELECT pr.full_name, li.lesson_date, li.start_time, li.end_time
    INTO v_conflict_name, v_conflict_date, v_conflict_start, v_conflict_end
  FROM jsonb_array_elements(p_updates) e
  JOIN lesson_instances li
    ON li.teacher_id = p_teacher_id
   AND li.lesson_date = (e->>'lessonDate')::date
   AND li.status IN ('planned', 'completed')
   AND li.start_time < (e->>'endTime')::time
   AND li.end_time   > (e->>'startTime')::time
   AND li.id NOT IN (SELECT (x->>'id')::uuid FROM jsonb_array_elements(p_updates) x)
  LEFT JOIN students s
    ON s.student_id = li.student_id AND s.teacher_id = p_teacher_id
  LEFT JOIN profiles pr ON pr.user_id = li.student_id
  WHERE COALESCE(s.is_archived, false) = false
  LIMIT 1;

  IF v_conflict_date IS NOT NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'conflict',
      'conflict_student', COALESCE(v_conflict_name, 'Bilinmeyen Öğrenci'),
      'conflict_date', v_conflict_date,
      'conflict_time', to_char(v_conflict_start, 'HH24:MI') || ' - ' || to_char(v_conflict_end, 'HH24:MI')
    );
  END IF;

  -- Trial lessons occupy the same calendar.
  SELECT tl.lesson_date, tl.start_time, tl.end_time
    INTO v_conflict_date, v_conflict_start, v_conflict_end
  FROM jsonb_array_elements(p_updates) e
  JOIN trial_lessons tl
    ON tl.teacher_id = p_teacher_id
   AND tl.lesson_date = (e->>'lessonDate')::date
   AND tl.start_time < (e->>'endTime')::time
   AND tl.end_time   > (e->>'startTime')::time
  LIMIT 1;

  IF v_conflict_date IS NOT NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'conflict',
      'conflict_student', 'Deneme Dersi',
      'conflict_date', v_conflict_date,
      'conflict_time', to_char(v_conflict_start, 'HH24:MI') || ' - ' || to_char(v_conflict_end, 'HH24:MI')
    );
  END IF;

  -- Snapshot pre-move values: the parking step below overwrites lesson_date, so
  -- original_* bookkeeping has to be captured before it runs.
  SELECT jsonb_object_agg(li.id::text, jsonb_build_object(
           'd',  li.lesson_date, 's', li.start_time, 'e', li.end_time,
           'od', li.original_date, 'os', li.original_start_time,
           'oe', li.original_end_time, 'rc', li.rescheduled_count))
    INTO v_before
  FROM lesson_instances li
  WHERE li.id IN (SELECT (x->>'id')::uuid FROM jsonb_array_elements(p_updates) x)
    AND li.student_id = p_student_id AND li.teacher_id = p_teacher_id;

  -- ── 2. Park moving rows on unique sentinel dates ───────────────────────────
  -- Each parked row lands on its own far-future date, so no intermediate state
  -- can violate uniq_active_planned_slot while the chain rotates.
  UPDATE lesson_instances li
  SET lesson_date = DATE '9999-01-01' + (u.ord - 1)::integer  -- row_number() is bigint
  FROM (
    SELECT (e->>'id')::uuid AS id, row_number() OVER () AS ord
    FROM jsonb_array_elements(p_updates) e
  ) u
  WHERE li.id = u.id
    AND li.student_id = p_student_id
    AND li.teacher_id = p_teacher_id;

  -- ── 3. Write the real values ───────────────────────────────────────────────
  UPDATE lesson_instances li
  SET lesson_date = (e->>'lessonDate')::date,
      start_time  = (e->>'startTime')::time,
      end_time    = (e->>'endTime')::time,
      original_date = CASE WHEN p_mark_override
        THEN COALESCE((v_before->(li.id::text)->>'od')::date, (v_before->(li.id::text)->>'d')::date)
        ELSE li.original_date END,
      original_start_time = CASE WHEN p_mark_override
        THEN COALESCE((v_before->(li.id::text)->>'os')::time, (v_before->(li.id::text)->>'s')::time)
        ELSE li.original_start_time END,
      original_end_time = CASE WHEN p_mark_override
        THEN COALESCE((v_before->(li.id::text)->>'oe')::time, (v_before->(li.id::text)->>'e')::time)
        ELSE li.original_end_time END,
      rescheduled_count = CASE WHEN p_mark_override
        THEN COALESCE((v_before->(li.id::text)->>'rc')::integer, 0) + 1
        ELSE li.rescheduled_count END,
      shift_group_id = COALESCE(p_shift_group_id, li.shift_group_id),
      updated_at = now()
  FROM jsonb_array_elements(p_updates) e
  WHERE li.id = (e->>'id')::uuid
    AND li.student_id = p_student_id
    AND li.teacher_id = p_teacher_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- ── 4. Renumber the chain by date order, in the same transaction ───────────
  SELECT package_cycle INTO v_cycle
  FROM student_lesson_tracking
  WHERE student_id = p_student_id AND teacher_id = p_teacher_id;
  v_cycle := COALESCE(v_cycle, 1);

  WITH ordered AS (
    SELECT id, row_number() OVER (ORDER BY lesson_date, start_time, created_at) AS rn
    FROM lesson_instances
    WHERE student_id = p_student_id
      AND teacher_id = p_teacher_id
      AND package_cycle = v_cycle
      AND status IN ('planned', 'completed')
  )
  UPDATE lesson_instances li
  SET lesson_number = -o.rn
  FROM ordered o
  WHERE li.id = o.id AND li.lesson_number <> o.rn;

  UPDATE lesson_instances
  SET lesson_number = -lesson_number
  WHERE student_id = p_student_id
    AND teacher_id = p_teacher_id
    AND package_cycle = v_cycle
    AND lesson_number < 0;

  RETURN json_build_object('success', true, 'updated', v_count, 'cycle', v_cycle);
END;
$$;

COMMENT ON FUNCTION public.rpc_apply_chain_dates IS
  'Atomically reschedules a set of lesson_instances for one student: conflict check, sentinel-parked reorder, optional override bookkeeping, then renumber by date.';

REVOKE EXECUTE ON FUNCTION public.rpc_apply_chain_dates(uuid, uuid, jsonb, boolean, uuid) FROM anon;

-- ============================================================================
-- One-off repair: renumber every existing chain by date order.
-- 78 rows across 24 chains had drifted because the old client-side renumbering
-- swallowed its unique-violation errors. A snapshot is kept in
-- _backup_lesson_numbers_20260828 so this is reversible.
-- ============================================================================
-- WITH ordered AS (
--   SELECT id, row_number() OVER (PARTITION BY student_id, teacher_id, package_cycle
--                                 ORDER BY lesson_date, start_time, created_at) AS rn
--   FROM lesson_instances WHERE status IN ('planned','completed')
-- )
-- UPDATE lesson_instances li SET lesson_number = -o.rn
-- FROM ordered o WHERE li.id = o.id AND li.lesson_number <> o.rn;
-- UPDATE lesson_instances SET lesson_number = -lesson_number WHERE lesson_number < 0;
