-- ============================================================================
-- Template sync and package reset now place lessons on FREE slots
-- ============================================================================
--
-- Both functions used to walk the calendar day by day and INSERT a lesson on
-- every matching template day, checking nothing. Two consequences:
--
--   * The duplicate trigger only guards (student, date, start_time), so a
--     regenerated lesson could land straight on top of ANOTHER student's
--     lesson. Editing one student's weekly schedule silently double-booked the
--     teacher, and the clash only surfaced later as a "çakışma" when someone
--     tried to move something nearby.
--   * A slot already held by that student's own completed or pinned lesson was
--     skipped only by luck of the date arithmetic.
--
-- Both now draw their dates from free_lesson_slots, the same generator the
-- reschedule operations use, so a regenerated chain flows around whatever is
-- already on the calendar.

CREATE OR REPLACE FUNCTION public.rpc_sync_student_schedule_impl(
  p_student_id uuid,
  p_teacher_id uuid,
  p_slots jsonb,
  p_lessons_per_week integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_cycle integer;
  v_completed_count integer;
  v_pinned_count integer;
  v_total_lessons integer;
  v_needed integer;
  v_from_date date;
  v_from_time time;
  v_next_num integer;
  v_created integer := 0;
BEGIN
  -- 1. Replace the weekly template
  DELETE FROM student_lessons
  WHERE student_id = p_student_id AND teacher_id = p_teacher_id;

  INSERT INTO student_lessons (student_id, teacher_id, day_of_week, start_time, end_time)
  SELECT p_student_id, p_teacher_id,
         (slot->>'dayOfWeek')::integer,
         (slot->>'startTime')::time,
         (slot->>'endTime')::time
  FROM jsonb_array_elements(p_slots) AS slot;

  -- 2. Upsert lessons_per_week
  INSERT INTO student_lesson_tracking (student_id, teacher_id, lessons_per_week)
  VALUES (p_student_id, p_teacher_id, p_lessons_per_week)
  ON CONFLICT (student_id, teacher_id)
  DO UPDATE SET lessons_per_week = p_lessons_per_week, updated_at = now();

  SELECT package_cycle INTO v_current_cycle
  FROM student_lesson_tracking
  WHERE student_id = p_student_id AND teacher_id = p_teacher_id;
  v_current_cycle := COALESCE(v_current_cycle, 1);

  -- 3. Clear the planned lessons that still follow the template. Completed
  --    lessons are history; pinned ones were placed by hand and stay.
  DELETE FROM lesson_instances
  WHERE student_id = p_student_id
    AND teacher_id = p_teacher_id
    AND package_cycle = v_current_cycle
    AND status = 'planned'
    AND is_manual_override = false;

  SELECT count(*) FILTER (WHERE status = 'completed'),
         count(*) FILTER (WHERE status = 'planned' AND is_manual_override)
    INTO v_completed_count, v_pinned_count
  FROM lesson_instances
  WHERE student_id = p_student_id
    AND teacher_id = p_teacher_id
    AND package_cycle = v_current_cycle
    AND status IN ('planned', 'completed');

  v_total_lessons := p_lessons_per_week * 4;
  v_needed := v_total_lessons - v_completed_count - v_pinned_count;

  IF v_needed <= 0 THEN
    PERFORM public.rpc_resequence_lesson_numbers(p_student_id, p_teacher_id, v_current_cycle);
    RETURN json_build_object('success', true, 'instances_created', 0,
                             'completed_count', v_completed_count, 'cycle', v_current_cycle);
  END IF;

  -- 4. Anchor after the last lesson taught in this cycle, never in the past.
  SELECT lesson_date, start_time INTO v_from_date, v_from_time
  FROM lesson_instances
  WHERE student_id = p_student_id AND teacher_id = p_teacher_id
    AND package_cycle = v_current_cycle AND status = 'completed'
  ORDER BY lesson_date DESC, start_time DESC
  LIMIT 1;

  IF v_from_date IS NULL OR v_from_date < CURRENT_DATE THEN
    v_from_date := GREATEST(COALESCE(v_from_date, CURRENT_DATE), CURRENT_DATE);
    v_from_time := NULL;
  END IF;

  SELECT COALESCE(max(lesson_number), 0) INTO v_next_num
  FROM lesson_instances
  WHERE student_id = p_student_id AND teacher_id = p_teacher_id
    AND package_cycle = v_current_cycle;

  INSERT INTO lesson_instances (student_id, teacher_id, lesson_number,
                                lesson_date, start_time, end_time, status, package_cycle)
  SELECT p_student_id, p_teacher_id,
         v_next_num + row_number() OVER (ORDER BY fs.lesson_date, fs.start_time),
         fs.lesson_date, fs.start_time, fs.end_time, 'planned', v_current_cycle
  FROM public.free_lesson_slots(p_student_id, p_teacher_id, v_needed,
                                v_from_date, v_from_time, false) fs;
  GET DIAGNOSTICS v_created = ROW_COUNT;

  PERFORM public.rpc_resequence_lesson_numbers(p_student_id, p_teacher_id, v_current_cycle);

  RETURN json_build_object('success', true, 'instances_created', v_created,
                           'completed_count', v_completed_count, 'cycle', v_current_cycle);
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_reset_package_impl(
  p_student_id uuid,
  p_teacher_id uuid,
  p_template_slots jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_cycle integer;
  v_new_cycle integer;
  v_total_lessons integer;
  v_from_date date;
  v_from_time time;
  v_created integer := 0;
BEGIN
  SELECT package_cycle INTO v_current_cycle
  FROM student_lesson_tracking
  WHERE student_id = p_student_id AND teacher_id = p_teacher_id;
  v_current_cycle := COALESCE(v_current_cycle, 1);
  v_new_cycle := v_current_cycle + 1;
  v_total_lessons := jsonb_array_length(p_template_slots) * 4;

  INSERT INTO balance_events (teacher_id, event_type, amount_minutes, student_id, package_cycle, notes)
  VALUES (p_teacher_id, 'balance_reset', 0, p_student_id, v_current_cycle,
          'Package reset from cycle ' || v_current_cycle || ' to ' || v_new_cycle);

  DELETE FROM lesson_instances
  WHERE student_id = p_student_id
    AND teacher_id = p_teacher_id
    AND package_cycle = v_current_cycle
    AND status = 'planned';

  UPDATE student_lesson_tracking
  SET package_cycle = v_new_cycle, updated_at = now()
  WHERE student_id = p_student_id AND teacher_id = p_teacher_id;

  -- Start after the last lesson ever taught, never in the past.
  SELECT lesson_date, start_time INTO v_from_date, v_from_time
  FROM lesson_instances
  WHERE student_id = p_student_id AND teacher_id = p_teacher_id
    AND status = 'completed'
  ORDER BY lesson_date DESC, start_time DESC
  LIMIT 1;

  IF v_from_date IS NULL OR v_from_date < CURRENT_DATE THEN
    v_from_date := GREATEST(COALESCE(v_from_date, CURRENT_DATE), CURRENT_DATE);
    v_from_time := NULL;
  END IF;

  INSERT INTO lesson_instances (student_id, teacher_id, lesson_number,
                                lesson_date, start_time, end_time, status, package_cycle)
  SELECT p_student_id, p_teacher_id,
         row_number() OVER (ORDER BY fs.lesson_date, fs.start_time),
         fs.lesson_date, fs.start_time, fs.end_time, 'planned', v_new_cycle
  FROM public.free_lesson_slots(p_student_id, p_teacher_id, v_total_lessons,
                                v_from_date, v_from_time, false) fs;
  GET DIAGNOSTICS v_created = ROW_COUNT;

  RETURN json_build_object('success', true, 'new_cycle', v_new_cycle, 'instances_created', v_created);
END;
$$;

COMMENT ON FUNCTION public.rpc_sync_student_schedule_impl IS
  'Rewrites a student''s weekly template and regenerates the non-pinned planned lessons onto free slots.';
COMMENT ON FUNCTION public.rpc_reset_package_impl IS
  'Starts a new package cycle and lays its lessons onto free slots after the last completed one.';
