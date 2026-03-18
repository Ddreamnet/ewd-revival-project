
-- RPC: rpc_undo_complete_lesson
-- Atomically: revert instance to planned, subtract balance, insert undo event, update legacy tracking
CREATE OR REPLACE FUNCTION public.rpc_undo_complete_lesson(
  p_instance_id uuid,
  p_teacher_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_instance lesson_instances%ROWTYPE;
  v_duration_minutes integer;
  v_current_cycle integer;
  v_last_completed_id uuid;
  v_tracking_id uuid;
  v_completed_arr integer[];
BEGIN
  -- 1. Lock and fetch instance
  SELECT * INTO v_instance
  FROM lesson_instances
  WHERE id = p_instance_id AND teacher_id = p_teacher_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Instance not found');
  END IF;

  IF v_instance.status != 'completed' THEN
    RETURN json_build_object('success', false, 'error', 'Instance is not completed');
  END IF;

  -- 2. Get current cycle
  SELECT package_cycle INTO v_current_cycle
  FROM student_lesson_tracking
  WHERE student_id = v_instance.student_id AND teacher_id = p_teacher_id;

  IF v_current_cycle IS NULL THEN
    v_current_cycle := 1;
  END IF;

  -- 3. Enforce: can only undo the chronologically LAST completed instance in current cycle
  SELECT id INTO v_last_completed_id
  FROM lesson_instances
  WHERE student_id = v_instance.student_id
    AND teacher_id = p_teacher_id
    AND status = 'completed'
    AND package_cycle = v_current_cycle
  ORDER BY lesson_date DESC, start_time DESC
  LIMIT 1;

  IF v_last_completed_id IS NULL OR v_last_completed_id != p_instance_id THEN
    RETURN json_build_object('success', false, 'error', 'Can only undo the most recent completed lesson');
  END IF;

  -- 4. Calculate duration
  v_duration_minutes := EXTRACT(EPOCH FROM (v_instance.end_time - v_instance.start_time)) / 60;

  -- 5. Revert instance status
  UPDATE lesson_instances
  SET status = 'planned', updated_at = now()
  WHERE id = p_instance_id;

  -- 6. Subtract from teacher balance
  UPDATE teacher_balance SET
    total_minutes = GREATEST(0, total_minutes - v_duration_minutes),
    completed_regular_lessons = GREATEST(0, completed_regular_lessons - 1),
    regular_lessons_minutes = GREATEST(0, regular_lessons_minutes - v_duration_minutes),
    updated_at = now()
  WHERE teacher_id = p_teacher_id;

  -- 7. Insert undo balance event
  INSERT INTO balance_events (teacher_id, event_type, amount_minutes, instance_id, student_id, package_cycle)
  VALUES (p_teacher_id, 'lesson_undo', -v_duration_minutes, p_instance_id, v_instance.student_id, v_current_cycle);

  -- 8. Legacy compat: remove from completed_lessons array
  SELECT id, completed_lessons INTO v_tracking_id, v_completed_arr
  FROM student_lesson_tracking
  WHERE student_id = v_instance.student_id AND teacher_id = p_teacher_id;

  IF v_tracking_id IS NOT NULL AND v_completed_arr IS NOT NULL THEN
    v_completed_arr := array_remove(v_completed_arr, v_instance.lesson_number);
    UPDATE student_lesson_tracking
    SET completed_lessons = v_completed_arr, updated_at = now()
    WHERE id = v_tracking_id;
  END IF;

  RETURN json_build_object('success', true, 'duration_minutes', v_duration_minutes);
END;
$$;

-- RPC: rpc_reset_package
-- Non-destructive: increment cycle, delete old planned, generate new planned instances
CREATE OR REPLACE FUNCTION public.rpc_reset_package(
  p_student_id uuid,
  p_teacher_id uuid,
  p_template_slots jsonb  -- array of {dayOfWeek, startTime, endTime}
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_cycle integer;
  v_new_cycle integer;
  v_weekly_count integer;
  v_total_lessons integer;
  v_slot jsonb;
  v_day_of_week integer;
  v_start_date date;
  v_lesson_date date;
  v_lesson_num integer := 0;
  v_max_iterations integer := 200;
  v_iter integer := 0;
BEGIN
  -- 1. Get current cycle
  SELECT package_cycle INTO v_current_cycle
  FROM student_lesson_tracking
  WHERE student_id = p_student_id AND teacher_id = p_teacher_id;

  IF v_current_cycle IS NULL THEN
    v_current_cycle := 1;
  END IF;

  v_new_cycle := v_current_cycle + 1;
  v_weekly_count := jsonb_array_length(p_template_slots);
  v_total_lessons := v_weekly_count * 4;

  -- 2. Insert balance_reset event
  INSERT INTO balance_events (teacher_id, event_type, amount_minutes, student_id, package_cycle, notes)
  VALUES (p_teacher_id, 'balance_reset', 0, p_student_id, v_current_cycle,
          'Package reset from cycle ' || v_current_cycle || ' to ' || v_new_cycle);

  -- 3. Delete only PLANNED instances from old cycle (completed preserved)
  DELETE FROM lesson_instances
  WHERE student_id = p_student_id
    AND teacher_id = p_teacher_id
    AND package_cycle = v_current_cycle
    AND status = 'planned';

  -- 4. Update tracking to new cycle, clear legacy fields
  UPDATE student_lesson_tracking
  SET package_cycle = v_new_cycle,
      completed_lessons = ARRAY[]::integer[],
      lesson_dates = '{}'::jsonb,
      updated_at = now()
  WHERE student_id = p_student_id AND teacher_id = p_teacher_id;

  -- 5. Generate new planned instances from today
  v_start_date := CURRENT_DATE;

  WHILE v_lesson_num < v_total_lessons AND v_iter < v_max_iterations LOOP
    v_iter := v_iter + 1;
    -- Check if this date matches any template slot
    FOR v_slot IN SELECT * FROM jsonb_array_elements(p_template_slots) LOOP
      v_day_of_week := (v_slot->>'dayOfWeek')::integer;
      IF EXTRACT(DOW FROM v_start_date) = v_day_of_week AND v_lesson_num < v_total_lessons THEN
        v_lesson_num := v_lesson_num + 1;
        INSERT INTO lesson_instances (student_id, teacher_id, lesson_number, lesson_date, start_time, end_time, status, package_cycle)
        VALUES (p_student_id, p_teacher_id, v_lesson_num, v_start_date,
                (v_slot->>'startTime')::time, (v_slot->>'endTime')::time, 'planned', v_new_cycle);
      END IF;
    END LOOP;
    v_start_date := v_start_date + 1;
  END LOOP;

  RETURN json_build_object('success', true, 'new_cycle', v_new_cycle, 'instances_created', v_lesson_num);
END;
$$;

-- Ensure teacher_balance has unique constraint on teacher_id for upsert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'teacher_balance_teacher_id_key'
  ) THEN
    ALTER TABLE public.teacher_balance ADD CONSTRAINT teacher_balance_teacher_id_key UNIQUE (teacher_id);
  END IF;
END $$;
