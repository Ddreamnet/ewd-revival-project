-- ============================================================================
-- Lesson rescheduling engine — one server-side writer, slot-aware placement
-- ============================================================================
--
-- Problem being fixed
-- -------------------
-- Rescheduling was spread across four client code paths that each did their own
-- date math and their own writes:
--
--   * LessonOverrideDialog "1 Seferlik Değiştir" — a raw UPDATE on
--     lesson_instances. No transaction, no renumber, check-then-write race.
--     After it ran, lesson_number no longer followed date order, so the date
--     inputs in Öğrenci Ayarları (keyed by lesson_number, listed by date) moved
--     the *wrong lesson*.
--   * LessonOverrideDialog "Sonraki Derse Aktar" — marked every shifted lesson
--     is_manual_override = true. That silently disabled the chain arrows
--     (they skip manual overrides) and made the lessons ignore later template
--     edits.
--   * useEditStudentDialog date edits — remapped times to a template slot by
--     day-of-week without checking whether that slot was already taken, so two
--     lessons could be assigned the same time and the save failed with
--     "çakışma".
--   * generateFutureInstanceDates (client) — walked template slots blindly.
--     Chain shifts landed on slots already held by a completed lesson or by
--     another student and failed instead of moving on to the next free slot.
--
-- Model
-- -----
-- Everything now goes through ONE writer, rpc_apply_chain_dates, and ONE slot
-- generator, free_lesson_slots. The client sends intent ("move this lesson
-- here", "push this one and the rest along"); the server resolves times,
-- checks conflicts, writes and renumbers inside a single transaction.
--
-- Two flags that used to be conflated are now separate:
--   original_date/…/rescheduled_count  — bookkeeping, "where did this come
--                                        from", enables Geri Al.
--   is_manual_override                 — "a human pinned this lesson here".
--                                        Chain operations skip it and
--                                        rpc_sync_student_schedule preserves
--                                        it. Only a deliberate single-lesson
--                                        move sets it.

-- ── 1. Slot generator ───────────────────────────────────────────────────────
--
-- The single source of truth for "where can this lesson go". Walks the
-- student's weekly template forward from a point in time and yields the first
-- p_count slots that are actually free on the teacher's calendar — skipping
-- anything held by a lesson (of any of that teacher's active students) or by a
-- trial lesson. Rows in p_exclude are the ones being moved, so they never
-- block themselves.

CREATE OR REPLACE FUNCTION public.free_lesson_slots(
  p_student_id uuid,
  p_teacher_id uuid,
  p_count      integer,
  p_from_date  date,
  p_from_time  time DEFAULT NULL,
  p_inclusive  boolean DEFAULT false,
  p_exclude    uuid[] DEFAULT '{}'::uuid[],
  p_max_date   date DEFAULT NULL
)
RETURNS TABLE (lesson_date date, start_time time, end_time time)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slots   jsonb;
  v_slot    jsonb;
  v_day     date;
  v_offset  integer := 0;
  v_found   integer := 0;
  v_taken   boolean;
BEGIN
  IF p_count IS NULL OR p_count <= 0 THEN
    RETURN;
  END IF;

  SELECT jsonb_agg(jsonb_build_object('d', sl.day_of_week, 's', sl.start_time, 'e', sl.end_time)
                   ORDER BY sl.day_of_week, sl.start_time)
    INTO v_slots
  FROM student_lessons sl
  WHERE sl.student_id = p_student_id AND sl.teacher_id = p_teacher_id;

  IF v_slots IS NULL THEN
    RETURN;  -- no template: nothing to place
  END IF;

  WHILE v_offset <= 400 AND v_found < p_count LOOP
    v_day := p_from_date + v_offset;
    EXIT WHEN p_max_date IS NOT NULL AND v_day > p_max_date;

    FOR v_slot IN
      SELECT value FROM jsonb_array_elements(v_slots)
      WHERE (value->>'d')::integer = EXTRACT(DOW FROM v_day)::integer
      ORDER BY (value->>'s')::time
    LOOP
      EXIT WHEN v_found >= p_count;

      -- On the anchor day, honour the cutoff. Exclusive is the normal case
      -- ("the slot after this one"); inclusive is used by the backward arrow,
      -- which has already picked the exact slot it wants to start on.
      IF v_offset = 0 AND p_from_time IS NOT NULL THEN
        IF p_inclusive THEN
          CONTINUE WHEN (v_slot->>'s')::time < p_from_time;
        ELSE
          CONTINUE WHEN (v_slot->>'s')::time <= p_from_time;
        END IF;
      END IF;

      -- Occupied by one of this teacher's lessons? Half-open overlap, so
      -- back-to-back lessons are fine. Archived students' rows survive for
      -- balance history and must not block live scheduling.
      SELECT EXISTS (
        SELECT 1
        FROM lesson_instances li
        LEFT JOIN students st
          ON st.student_id = li.student_id AND st.teacher_id = li.teacher_id
        WHERE li.teacher_id  = p_teacher_id
          AND li.lesson_date = v_day
          AND li.status IN ('planned', 'completed')
          AND NOT (li.id = ANY (COALESCE(p_exclude, '{}'::uuid[])))
          AND COALESCE(st.is_archived, false) = false
          AND li.start_time < (v_slot->>'e')::time
          AND li.end_time   > (v_slot->>'s')::time
      ) INTO v_taken;

      CONTINUE WHEN v_taken;

      SELECT EXISTS (
        SELECT 1 FROM trial_lessons tl
        WHERE tl.teacher_id  = p_teacher_id
          AND tl.lesson_date = v_day
          AND tl.start_time < (v_slot->>'e')::time
          AND tl.end_time   > (v_slot->>'s')::time
      ) INTO v_taken;

      CONTINUE WHEN v_taken;

      lesson_date := v_day;
      start_time  := (v_slot->>'s')::time;
      end_time    := (v_slot->>'e')::time;
      v_found     := v_found + 1;
      RETURN NEXT;
    END LOOP;

    v_offset := v_offset + 1;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.free_lesson_slots IS
  'The next p_count template slots after (p_from_date, p_from_time) that are free on the teacher''s calendar. Rows in p_exclude are treated as already vacated.';

-- ── 2. Previous free slot (backward arrow) ──────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_prev_free_slot(
  p_student_id  uuid,
  p_teacher_id  uuid,
  p_before_date date,
  p_before_time time,
  p_exclude     uuid[] DEFAULT '{}'::uuid[]
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slots  jsonb;
  v_slot   jsonb;
  v_day    date;
  v_offset integer := 0;
  v_floor_date date;
  v_floor_time time;
  v_taken  boolean;
BEGIN
  IF NOT public.is_teacher_caller(p_teacher_id) THEN
    RETURN json_build_object('success', false, 'error', 'Bu işlem için yetkiniz yok');
  END IF;

  SELECT jsonb_agg(jsonb_build_object('d', sl.day_of_week, 's', sl.start_time, 'e', sl.end_time))
    INTO v_slots
  FROM student_lessons sl
  WHERE sl.student_id = p_student_id AND sl.teacher_id = p_teacher_id;

  IF v_slots IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'no_template');
  END IF;

  -- A planned lesson can never be pulled back past the last lesson already
  -- taught, and never into the past.
  SELECT li.lesson_date, li.start_time INTO v_floor_date, v_floor_time
  FROM lesson_instances li
  WHERE li.student_id = p_student_id AND li.teacher_id = p_teacher_id
    AND li.status = 'completed'
  ORDER BY li.lesson_date DESC, li.start_time DESC
  LIMIT 1;

  IF v_floor_date IS NULL OR v_floor_date < CURRENT_DATE THEN
    v_floor_date := GREATEST(COALESCE(v_floor_date, CURRENT_DATE), CURRENT_DATE);
    v_floor_time := NULL;
  END IF;

  WHILE v_offset <= 400 LOOP
    v_day := p_before_date - v_offset;
    EXIT WHEN v_day < v_floor_date;

    FOR v_slot IN
      SELECT value FROM jsonb_array_elements(v_slots)
      WHERE (value->>'d')::integer = EXTRACT(DOW FROM v_day)::integer
      ORDER BY (value->>'s')::time DESC
    LOOP
      CONTINUE WHEN v_offset = 0 AND (v_slot->>'s')::time >= p_before_time;
      CONTINUE WHEN v_day = v_floor_date AND v_floor_time IS NOT NULL
                    AND (v_slot->>'s')::time <= v_floor_time;

      SELECT EXISTS (
        SELECT 1
        FROM lesson_instances li
        LEFT JOIN students st
          ON st.student_id = li.student_id AND st.teacher_id = li.teacher_id
        WHERE li.teacher_id  = p_teacher_id
          AND li.lesson_date = v_day
          AND li.status IN ('planned', 'completed')
          AND NOT (li.id = ANY (COALESCE(p_exclude, '{}'::uuid[])))
          AND COALESCE(st.is_archived, false) = false
          AND li.start_time < (v_slot->>'e')::time
          AND li.end_time   > (v_slot->>'s')::time
      ) OR EXISTS (
        SELECT 1 FROM trial_lessons tl
        WHERE tl.teacher_id  = p_teacher_id
          AND tl.lesson_date = v_day
          AND tl.start_time < (v_slot->>'e')::time
          AND tl.end_time   > (v_slot->>'s')::time
      ) INTO v_taken;

      CONTINUE WHEN v_taken;

      RETURN json_build_object(
        'success', true,
        'lessonDate', v_day,
        'startTime', (v_slot->>'s')::time,
        'endTime',   (v_slot->>'e')::time
      );
    END LOOP;

    v_offset := v_offset + 1;
  END LOOP;

  RETURN json_build_object('success', false, 'error', 'no_slot');
END;
$$;

COMMENT ON FUNCTION public.rpc_prev_free_slot IS
  'The nearest free template slot before (p_before_date, p_before_time), never earlier than today or the last completed lesson.';

-- ── 3. The single writer ────────────────────────────────────────────────────
--
-- Every date/time change to lesson_instances goes through here. One
-- transaction: lock, resolve missing times, check conflicts, park the moving
-- rows on sentinel dates so a rotating chain never trips
-- uniq_active_planned_slot, write, renumber by date.
--
-- p_updates element:
--   { "id": uuid,                     -- required
--     "lessonDate": date,             -- required
--     "startTime": time,              -- optional; resolved from the template
--     "endTime":   time,              --   when omitted (first free slot on
--                                     --   that date, else the row's own time)
--     "markOverride": bool,           -- record original_* / bump reschedule count
--     "manual":       bool,           -- pin the lesson (chain ops skip it)
--     "clear":        bool }          -- revert: wipe override bookkeeping
--
-- p_mark_override is the default for rows that don't carry "markOverride".

CREATE OR REPLACE FUNCTION public.rpc_apply_chain_dates(
  p_student_id uuid,
  p_teacher_id uuid,
  p_updates jsonb,
  p_mark_override boolean DEFAULT false,
  p_shift_group_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conflict_name  text;
  v_conflict_self  boolean;
  v_conflict_date  date;
  v_conflict_start time;
  v_conflict_end   time;
  v_count integer := 0;
  v_cycle integer;
  v_before jsonb;
  v_resolved jsonb;
  v_ids uuid[];
BEGIN
  IF NOT public.is_teacher_caller(p_teacher_id) THEN
    RETURN json_build_object('success', false, 'error', 'Bu işlem için yetkiniz yok');
  END IF;

  IF p_updates IS NULL OR jsonb_array_length(p_updates) = 0 THEN
    RETURN json_build_object('success', false, 'error', 'Taşınacak ders bulunamadı');
  END IF;

  SELECT array_agg((e->>'id')::uuid) INTO v_ids
  FROM jsonb_array_elements(p_updates) e;

  -- Serialize concurrent chain edits for this student's rows.
  PERFORM 1 FROM lesson_instances
   WHERE teacher_id = p_teacher_id AND student_id = p_student_id
   FOR UPDATE;

  -- ── Snapshot pre-move values ───────────────────────────────────────────────
  -- The parking step below overwrites lesson_date, so original_* bookkeeping
  -- and the "keep my own time" fallback both have to be captured first.
  SELECT jsonb_object_agg(li.id::text, jsonb_build_object(
           'd',  li.lesson_date, 's', li.start_time, 'e', li.end_time,
           'od', li.original_date, 'os', li.original_start_time,
           'oe', li.original_end_time, 'rc', li.rescheduled_count))
    INTO v_before
  FROM lesson_instances li
  WHERE li.id = ANY (v_ids)
    AND li.student_id = p_student_id AND li.teacher_id = p_teacher_id;

  IF v_before IS NULL OR (SELECT count(*) FROM jsonb_object_keys(v_before)) <> array_length(v_ids, 1) THEN
    RETURN json_build_object('success', false, 'error', 'Ders bulunamadı veya bu öğrenciye ait değil');
  END IF;

  -- ── Resolve every row to a concrete date + time ────────────────────────────
  -- A row that carries no startTime is a "just change the date" edit: take the
  -- first free template slot on the new date, and fall back to the lesson's own
  -- time when the day isn't in the template or every slot on it is taken. This
  -- is what used to be done client-side by counting slots, which happily handed
  -- two lessons the same time and then failed the write.
  SELECT jsonb_agg(
           CASE
             WHEN e ? 'startTime' AND e->>'startTime' IS NOT NULL THEN e
             ELSE e || COALESCE(
               (SELECT jsonb_build_object('startTime', fs.start_time, 'endTime', fs.end_time)
                  FROM public.free_lesson_slots(
                         p_student_id, p_teacher_id, 1,
                         (e->>'lessonDate')::date, NULL, true, v_ids,
                         (e->>'lessonDate')::date) fs
                 LIMIT 1),
               jsonb_build_object(
                 'startTime', v_before->(e->>'id')->>'s',
                 'endTime',   v_before->(e->>'id')->>'e')
             )
           END
           ORDER BY ord)
    INTO v_resolved
  FROM jsonb_array_elements(p_updates) WITH ORDINALITY AS t(e, ord);

  -- Two moving rows must not be resolved onto the same slot. free_lesson_slots
  -- excludes every moving row (they are vacating), so it can hand the same free
  -- slot to two of them; catch that here rather than at the unique index.
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_resolved) e
    GROUP BY e->>'lessonDate', e->>'startTime'
    HAVING count(*) > 1
  ) THEN
    RETURN json_build_object('success', false, 'error',
      'Aynı tarih ve saate birden fazla ders atanamaz. Tarihleri tek tek değiştirin.');
  END IF;

  -- ── Conflict check, inside the transaction ─────────────────────────────────
  SELECT (li.student_id = p_student_id), pr.full_name, li.lesson_date, li.start_time, li.end_time
    INTO v_conflict_self, v_conflict_name, v_conflict_date, v_conflict_start, v_conflict_end
  FROM jsonb_array_elements(v_resolved) e
  JOIN lesson_instances li
    ON li.teacher_id = p_teacher_id
   AND li.lesson_date = (e->>'lessonDate')::date
   AND li.status IN ('planned', 'completed')
   AND li.start_time < (e->>'endTime')::time
   AND li.end_time   > (e->>'startTime')::time
   AND NOT (li.id = ANY (v_ids))
  LEFT JOIN students s
    ON s.student_id = li.student_id AND s.teacher_id = p_teacher_id
  LEFT JOIN profiles pr ON pr.user_id = li.student_id
  WHERE COALESCE(s.is_archived, false) = false
  LIMIT 1;

  IF v_conflict_date IS NOT NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'conflict',
      'conflict_self', COALESCE(v_conflict_self, false),
      'conflict_student', COALESCE(v_conflict_name, 'Bilinmeyen Öğrenci'),
      'conflict_date', v_conflict_date,
      'conflict_time', to_char(v_conflict_start, 'HH24:MI') || ' - ' || to_char(v_conflict_end, 'HH24:MI')
    );
  END IF;

  SELECT tl.lesson_date, tl.start_time, tl.end_time
    INTO v_conflict_date, v_conflict_start, v_conflict_end
  FROM jsonb_array_elements(v_resolved) e
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
      'conflict_self', false,
      'conflict_student', 'Deneme Dersi',
      'conflict_date', v_conflict_date,
      'conflict_time', to_char(v_conflict_start, 'HH24:MI') || ' - ' || to_char(v_conflict_end, 'HH24:MI')
    );
  END IF;

  -- ── Park moving rows on unique sentinel dates ──────────────────────────────
  UPDATE lesson_instances li
  SET lesson_date = DATE '9999-01-01' + (u.ord - 1)::integer
  FROM (
    SELECT (e->>'id')::uuid AS id, row_number() OVER () AS ord
    FROM jsonb_array_elements(v_resolved) e
  ) u
  WHERE li.id = u.id
    AND li.student_id = p_student_id
    AND li.teacher_id = p_teacher_id;

  -- ── Write the real values ──────────────────────────────────────────────────
  UPDATE lesson_instances li
  SET lesson_date = (e->>'lessonDate')::date,
      start_time  = (e->>'startTime')::time,
      end_time    = (e->>'endTime')::time,

      original_date = CASE
        WHEN COALESCE((e->>'clear')::boolean, false) THEN NULL
        WHEN COALESCE((e->>'markOverride')::boolean, p_mark_override)
          THEN COALESCE((v_before->(li.id::text)->>'od')::date, (v_before->(li.id::text)->>'d')::date)
        ELSE li.original_date END,

      original_start_time = CASE
        WHEN COALESCE((e->>'clear')::boolean, false) THEN NULL
        WHEN COALESCE((e->>'markOverride')::boolean, p_mark_override)
          THEN COALESCE((v_before->(li.id::text)->>'os')::time, (v_before->(li.id::text)->>'s')::time)
        ELSE li.original_start_time END,

      original_end_time = CASE
        WHEN COALESCE((e->>'clear')::boolean, false) THEN NULL
        WHEN COALESCE((e->>'markOverride')::boolean, p_mark_override)
          THEN COALESCE((v_before->(li.id::text)->>'oe')::time, (v_before->(li.id::text)->>'e')::time)
        ELSE li.original_end_time END,

      rescheduled_count = CASE
        WHEN COALESCE((e->>'clear')::boolean, false) THEN 0
        WHEN COALESCE((e->>'markOverride')::boolean, p_mark_override)
          THEN COALESCE((v_before->(li.id::text)->>'rc')::integer, 0) + 1
        ELSE li.rescheduled_count END,

      -- "A human pinned this one." Only a deliberate single-lesson move sets
      -- it; chain shifts leave it false so the arrows and template sync keep
      -- working on those lessons.
      is_manual_override = CASE
        WHEN COALESCE((e->>'clear')::boolean, false) THEN false
        WHEN e ? 'manual' THEN (e->>'manual')::boolean
        ELSE li.is_manual_override END,

      -- A shift group is stamped by the operation that creates it. Any later
      -- move of a row leaves that group, so "Geri Al" can never drag lessons
      -- that have since been re-placed back to a stale position.
      shift_group_id = p_shift_group_id,

      updated_at = now()
  FROM jsonb_array_elements(v_resolved) e
  WHERE li.id = (e->>'id')::uuid
    AND li.student_id = p_student_id
    AND li.teacher_id = p_teacher_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- ── Renumber the chain by date order, in the same transaction ──────────────
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

  RETURN json_build_object('success', true, 'updated', v_count, 'cycle', v_cycle,
                           'placements', v_resolved);
END;
$$;

COMMENT ON FUNCTION public.rpc_apply_chain_dates IS
  'The single writer for lesson_instances date/time changes: resolves missing times from the template, conflict-checks, sentinel-parks the reorder, applies override bookkeeping and renumbers by date — all in one transaction.';

REVOKE EXECUTE ON FUNCTION public.rpc_apply_chain_dates(uuid, uuid, jsonb, boolean, uuid) FROM anon;

-- ── 4. Intent-level operations ──────────────────────────────────────────────
--
-- These are what the UI calls. Each one derives student_id / teacher_id from
-- the rows themselves (never from a client parameter), builds an update set
-- and hands it to rpc_apply_chain_dates.

-- Re-lay a set of lessons onto the next free template slots from a point in
-- time. Backs "Hizala", the ◀ ▶ arrows and the tail of every cascade.
CREATE OR REPLACE FUNCTION public.rpc_relayout_chain(
  p_instance_ids   uuid[],
  p_from_date      date,
  p_from_time      time DEFAULT NULL,
  p_inclusive      boolean DEFAULT false,
  p_mark_override  boolean DEFAULT false,
  p_shift_group_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student uuid;
  v_teacher uuid;
  v_distinct integer;
  v_needed integer;
  v_updates jsonb;
BEGIN
  IF p_instance_ids IS NULL OR array_length(p_instance_ids, 1) IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Taşınacak ders bulunamadı');
  END IF;

  SELECT count(*), count(DISTINCT student_id) + count(DISTINCT teacher_id)
    INTO v_needed, v_distinct
  FROM lesson_instances WHERE id = ANY (p_instance_ids);

  IF v_needed <> array_length(p_instance_ids, 1) OR v_distinct <> 2 THEN
    RETURN json_build_object('success', false, 'error', 'Dersler tek bir öğrenciye ait olmalı');
  END IF;

  SELECT student_id, teacher_id INTO v_student, v_teacher
  FROM lesson_instances WHERE id = p_instance_ids[1];

  IF NOT public.is_teacher_caller(v_teacher) THEN
    RETURN json_build_object('success', false, 'error', 'Bu işlem için yetkiniz yok');
  END IF;

  -- Pair the lessons (in their current chronological order) with the free
  -- slots (in chronological order). Slots already held by a completed lesson,
  -- a pinned lesson or another student are skipped rather than collided with —
  -- that is the whole "çakışma" class of failures, gone.
  WITH targets AS (
    SELECT id, row_number() OVER (ORDER BY lesson_date, start_time, created_at) AS rn
    FROM lesson_instances WHERE id = ANY (p_instance_ids)
  ),
  slots AS (
    SELECT lesson_date, start_time, end_time, row_number() OVER () AS rn
    FROM public.free_lesson_slots(v_student, v_teacher, v_needed,
                                  p_from_date, p_from_time, p_inclusive, p_instance_ids)
  )
  SELECT jsonb_agg(jsonb_build_object(
           'id', t.id,
           'lessonDate', s.lesson_date,
           'startTime',  s.start_time,
           'endTime',    s.end_time,
           'markOverride', p_mark_override,
           'manual', false
         ) ORDER BY t.rn)
    INTO v_updates
  FROM targets t JOIN slots s ON s.rn = t.rn;

  IF v_updates IS NULL OR jsonb_array_length(v_updates) <> v_needed THEN
    RETURN json_build_object('success', false, 'error',
      'Ders programında yeterli boş slot bulunamadı. Ders günlerini kontrol edin.');
  END IF;

  RETURN public.rpc_apply_chain_dates(v_student, v_teacher, v_updates, false, p_shift_group_id);
END;
$$;

COMMENT ON FUNCTION public.rpc_relayout_chain IS
  'Re-lays the given lessons onto the next free template slots from a point in time, skipping occupied ones.';

-- "Sonraki Derse Aktar": push this lesson to the next free slot and carry every
-- later planned lesson along with it. Rights are preserved — nothing is
-- deleted, the whole tail simply moves one slot down.
CREATE OR REPLACE FUNCTION public.rpc_postpone_lesson(p_instance_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inst lesson_instances%ROWTYPE;
  v_ids uuid[];
BEGIN
  SELECT * INTO v_inst FROM lesson_instances WHERE id = p_instance_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Ders bulunamadı');
  END IF;
  IF NOT public.is_teacher_caller(v_inst.teacher_id) THEN
    RETURN json_build_object('success', false, 'error', 'Bu işlem için yetkiniz yok');
  END IF;
  IF v_inst.status <> 'planned' THEN
    RETURN json_build_object('success', false, 'error', 'İşlenmiş bir ders ertelenemez');
  END IF;

  -- The clicked lesson always moves; lessons a human has pinned to a specific
  -- date stay where they are, and the cascade flows around them.
  SELECT array_agg(id ORDER BY lesson_date, start_time, created_at) INTO v_ids
  FROM lesson_instances
  WHERE student_id = v_inst.student_id
    AND teacher_id = v_inst.teacher_id
    AND package_cycle = v_inst.package_cycle
    AND status = 'planned'
    AND (lesson_date, start_time) >= (v_inst.lesson_date, v_inst.start_time)
    AND (id = p_instance_id OR is_manual_override = false);

  -- markOverride records where each lesson came from, so a single "Geri Al"
  -- undoes the whole postpone. It deliberately does NOT pin the lessons:
  -- they stay part of the chain and keep following the template.
  RETURN public.rpc_relayout_chain(
    v_ids, v_inst.lesson_date, v_inst.start_time, false, true, gen_random_uuid()
  );
END;
$$;

COMMENT ON FUNCTION public.rpc_postpone_lesson IS
  'Moves a lesson to the next free slot and cascades every later planned lesson by one slot, as one revertible group.';

-- Move one lesson to an explicit date/time. p_cascade decides whether the rest
-- of the chain follows it or stays put.
CREATE OR REPLACE FUNCTION public.rpc_move_lesson(
  p_instance_id uuid,
  p_date        date,
  p_start       time,
  p_end         time,
  p_cascade     boolean DEFAULT false
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inst lesson_instances%ROWTYPE;
  v_tail uuid[];
  v_all  uuid[];
  v_group uuid;
  v_updates jsonb;
  v_needed integer;
BEGIN
  SELECT * INTO v_inst FROM lesson_instances WHERE id = p_instance_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Ders bulunamadı');
  END IF;
  IF NOT public.is_teacher_caller(v_inst.teacher_id) THEN
    RETURN json_build_object('success', false, 'error', 'Bu işlem için yetkiniz yok');
  END IF;
  IF p_date IS NULL OR p_start IS NULL OR p_end IS NULL OR p_end <= p_start THEN
    RETURN json_build_object('success', false, 'error', 'Geçersiz tarih veya saat');
  END IF;

  IF NOT p_cascade THEN
    -- A single deliberate placement: pin it, so chain operations and template
    -- edits leave it where the admin put it.
    RETURN public.rpc_apply_chain_dates(
      v_inst.student_id, v_inst.teacher_id,
      jsonb_build_array(jsonb_build_object(
        'id', p_instance_id, 'lessonDate', p_date,
        'startTime', p_start, 'endTime', p_end,
        'markOverride', true, 'manual', true)),
      false, NULL);
  END IF;

  SELECT array_agg(id ORDER BY lesson_date, start_time, created_at) INTO v_tail
  FROM lesson_instances
  WHERE student_id = v_inst.student_id
    AND teacher_id = v_inst.teacher_id
    AND package_cycle = v_inst.package_cycle
    AND status = 'planned'
    AND id <> p_instance_id
    AND is_manual_override = false
    AND (lesson_date, start_time) > (v_inst.lesson_date, v_inst.start_time);

  v_tail  := COALESCE(v_tail, '{}'::uuid[]);
  v_all   := p_instance_id || v_tail;
  v_group := gen_random_uuid();
  v_needed := array_length(v_tail, 1);

  IF v_needed IS NULL THEN
    RETURN public.rpc_apply_chain_dates(
      v_inst.student_id, v_inst.teacher_id,
      jsonb_build_array(jsonb_build_object(
        'id', p_instance_id, 'lessonDate', p_date,
        'startTime', p_start, 'endTime', p_end,
        'markOverride', true, 'manual', false)),
      false, v_group);
  END IF;

  WITH targets AS (
    SELECT id, row_number() OVER (ORDER BY lesson_date, start_time, created_at) AS rn
    FROM lesson_instances WHERE id = ANY (v_tail)
  ),
  slots AS (
    SELECT lesson_date, start_time, end_time, row_number() OVER () AS rn
    FROM public.free_lesson_slots(v_inst.student_id, v_inst.teacher_id, v_needed,
                                  p_date, p_start, false, v_all)
  )
  SELECT jsonb_agg(jsonb_build_object(
           'id', t.id, 'lessonDate', s.lesson_date,
           'startTime', s.start_time, 'endTime', s.end_time,
           'markOverride', true, 'manual', false) ORDER BY t.rn)
    INTO v_updates
  FROM targets t JOIN slots s ON s.rn = t.rn;

  IF v_updates IS NULL OR jsonb_array_length(v_updates) <> v_needed THEN
    RETURN json_build_object('success', false, 'error',
      'Ders programında yeterli boş slot bulunamadı. Ders günlerini kontrol edin.');
  END IF;

  RETURN public.rpc_apply_chain_dates(
    v_inst.student_id, v_inst.teacher_id,
    jsonb_build_array(jsonb_build_object(
      'id', p_instance_id, 'lessonDate', p_date,
      'startTime', p_start, 'endTime', p_end,
      'markOverride', true, 'manual', false)) || v_updates,
    false, v_group);
END;
$$;

COMMENT ON FUNCTION public.rpc_move_lesson IS
  'Moves one lesson to an explicit slot. p_cascade=false pins it; p_cascade=true carries the rest of the chain along behind it.';

-- Undo. Puts the lesson — or its whole shift group — back on the date and time
-- it was moved away from, and clears the override bookkeeping.
CREATE OR REPLACE FUNCTION public.rpc_revert_lesson(p_instance_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inst lesson_instances%ROWTYPE;
  v_updates jsonb;
BEGIN
  SELECT * INTO v_inst FROM lesson_instances WHERE id = p_instance_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Ders bulunamadı');
  END IF;
  IF NOT public.is_teacher_caller(v_inst.teacher_id) THEN
    RETURN json_build_object('success', false, 'error', 'Bu işlem için yetkiniz yok');
  END IF;
  IF v_inst.original_date IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Geri alınacak bir değişiklik yok');
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
           'id', li.id,
           'lessonDate', li.original_date,
           'startTime',  COALESCE(li.original_start_time, li.start_time),
           'endTime',    COALESCE(li.original_end_time,   li.end_time),
           'clear', true))
    INTO v_updates
  FROM lesson_instances li
  WHERE li.student_id = v_inst.student_id
    AND li.teacher_id = v_inst.teacher_id
    AND li.original_date IS NOT NULL
    AND (
      (v_inst.shift_group_id IS NOT NULL AND li.shift_group_id = v_inst.shift_group_id)
      OR (v_inst.shift_group_id IS NULL AND li.id = p_instance_id)
    );

  RETURN public.rpc_apply_chain_dates(
    v_inst.student_id, v_inst.teacher_id, v_updates, false, NULL);
END;
$$;

COMMENT ON FUNCTION public.rpc_revert_lesson IS
  'Restores a lesson (or its whole shift group) to its original date and time and clears the override bookkeeping.';

REVOKE EXECUTE ON FUNCTION public.rpc_relayout_chain(uuid[], date, time, boolean, boolean, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rpc_postpone_lesson(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rpc_move_lesson(uuid, date, time, time, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rpc_revert_lesson(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rpc_prev_free_slot(uuid, uuid, date, time, uuid[]) FROM anon;

-- ── 5. Package top-up ───────────────────────────────────────────────────────
--
-- Replaces ensureInstancesForWeek() in the client, which generated lessons
-- from the browser while the admin paged through weeks. That was the source of
-- the "lesson I just moved came back" reports: it asked "does this student have
-- a lesson in the week I'm looking at?" and, if not, created one on the
-- template day — so moving a lesson out of a week and paging back to it
-- conjured a replacement. It was also unguarded against two open tabs.
--
-- The rule here is about the package, not the week: a student's current cycle
-- holds exactly lessons_per_week * 4 lessons. Missing ones are appended after
-- the last one that exists, on free slots. Idempotent, so it is safe to call
-- on every schedule load.

CREATE OR REPLACE FUNCTION public.rpc_ensure_cycle_instances(
  p_teacher_id uuid,
  p_student_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_target integer;
  v_existing integer;
  v_missing integer;
  v_from_date date;
  v_from_time time;
  v_next_num integer;
  v_created integer := 0;
  v_total integer := 0;
BEGIN
  IF NOT public.is_teacher_caller(p_teacher_id) THEN
    RETURN json_build_object('success', false, 'error', 'Bu işlem için yetkiniz yok');
  END IF;

  FOR r IN
    SELECT t.student_id, t.package_cycle, t.lessons_per_week
    FROM student_lesson_tracking t
    JOIN students s
      ON s.student_id = t.student_id AND s.teacher_id = t.teacher_id
     AND s.is_archived = false
    WHERE t.teacher_id = p_teacher_id
      AND (p_student_id IS NULL OR t.student_id = p_student_id)
      AND EXISTS (SELECT 1 FROM student_lessons sl
                   WHERE sl.student_id = t.student_id AND sl.teacher_id = p_teacher_id)
  LOOP
    v_target := r.lessons_per_week * 4;

    SELECT count(*), COALESCE(max(lesson_number), 0)
      INTO v_existing, v_next_num
    FROM lesson_instances
    WHERE student_id = r.student_id AND teacher_id = p_teacher_id
      AND package_cycle = r.package_cycle
      AND status IN ('planned', 'completed');

    v_missing := v_target - v_existing;
    CONTINUE WHEN v_missing <= 0;

    -- Append after the last lesson of this cycle; failing that, after the last
    -- lesson ever taught; failing that, from today.
    SELECT lesson_date, start_time INTO v_from_date, v_from_time
    FROM lesson_instances
    WHERE student_id = r.student_id AND teacher_id = p_teacher_id
      AND package_cycle = r.package_cycle
      AND status IN ('planned', 'completed')
    ORDER BY lesson_date DESC, start_time DESC
    LIMIT 1;

    IF v_from_date IS NULL THEN
      SELECT lesson_date, start_time INTO v_from_date, v_from_time
      FROM lesson_instances
      WHERE student_id = r.student_id AND teacher_id = p_teacher_id
        AND status = 'completed'
      ORDER BY lesson_date DESC, start_time DESC
      LIMIT 1;
    END IF;

    IF v_from_date IS NULL OR v_from_date < CURRENT_DATE THEN
      v_from_date := GREATEST(COALESCE(v_from_date, CURRENT_DATE), CURRENT_DATE);
      v_from_time := NULL;
    END IF;

    INSERT INTO lesson_instances (student_id, teacher_id, lesson_number,
                                  lesson_date, start_time, end_time,
                                  status, package_cycle)
    SELECT r.student_id, p_teacher_id,
           v_next_num + row_number() OVER (ORDER BY fs.lesson_date, fs.start_time),
           fs.lesson_date, fs.start_time, fs.end_time, 'planned', r.package_cycle
    FROM public.free_lesson_slots(r.student_id, p_teacher_id, v_missing,
                                  v_from_date, v_from_time, false) fs;

    GET DIAGNOSTICS v_created = ROW_COUNT;
    v_total := v_total + v_created;

    IF v_created > 0 THEN
      PERFORM public.rpc_resequence_lesson_numbers(r.student_id, p_teacher_id, r.package_cycle);
    END IF;
  END LOOP;

  RETURN json_build_object('success', true, 'created', v_total);
END;
$$;

COMMENT ON FUNCTION public.rpc_ensure_cycle_instances IS
  'Idempotently tops a student''s current package up to lessons_per_week * 4 planned/completed lessons, appending on free slots after the last existing one.';

REVOKE EXECUTE ON FUNCTION public.rpc_ensure_cycle_instances(uuid, uuid) FROM anon;
