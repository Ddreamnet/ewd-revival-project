
-- RPC: rpc_complete_lesson
-- Atomically: mark instance completed, update teacher balance, insert balance_event, update legacy tracking
CREATE OR REPLACE FUNCTION public.rpc_complete_lesson(
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
  v_completed_count integer;
  v_total_rights integer;
  v_template_count integer;
  v_first_planned_id uuid;
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

  IF v_instance.status = 'completed' THEN
    RETURN json_build_object('success', false, 'error', 'Already completed');
  END IF;

  -- 2. Get current cycle for this student
  SELECT package_cycle INTO v_current_cycle
  FROM student_lesson_tracking
  WHERE student_id = v_instance.student_id AND teacher_id = p_teacher_id;

  IF v_current_cycle IS NULL THEN
    v_current_cycle := 1;
  END IF;

  -- 3. Enforce sequential completion: this must be the chronologically first planned instance in current cycle
  SELECT id INTO v_first_planned_id
  FROM lesson_instances
  WHERE student_id = v_instance.student_id
    AND teacher_id = p_teacher_id
    AND status = 'planned'
    AND package_cycle = v_current_cycle
  ORDER BY lesson_date ASC, start_time ASC
  LIMIT 1;

  IF v_first_planned_id IS NULL OR v_first_planned_id != p_instance_id THEN
    RETURN json_build_object('success', false, 'error', 'Not the next completable lesson');
  END IF;

  -- 4. Calculate duration
  v_duration_minutes := EXTRACT(EPOCH FROM (v_instance.end_time - v_instance.start_time)) / 60;

  -- 5. Update instance status
  UPDATE lesson_instances
  SET status = 'completed', updated_at = now()
  WHERE id = p_instance_id;

  -- 6. Update teacher balance (upsert)
  INSERT INTO teacher_balance (teacher_id, total_minutes, completed_regular_lessons, regular_lessons_minutes)
  VALUES (p_teacher_id, v_duration_minutes, 1, v_duration_minutes)
  ON CONFLICT (teacher_id) DO UPDATE SET
    total_minutes = teacher_balance.total_minutes + v_duration_minutes,
    completed_regular_lessons = teacher_balance.completed_regular_lessons + 1,
    regular_lessons_minutes = teacher_balance.regular_lessons_minutes + v_duration_minutes,
    updated_at = now();

  -- 7. Insert balance event
  INSERT INTO balance_events (teacher_id, event_type, amount_minutes, instance_id, student_id, package_cycle)
  VALUES (p_teacher_id, 'lesson_complete', v_duration_minutes, p_instance_id, v_instance.student_id, v_current_cycle);

  -- 8. Legacy compat: update completed_lessons array in student_lesson_tracking
  SELECT id, completed_lessons INTO v_tracking_id, v_completed_arr
  FROM student_lesson_tracking
  WHERE student_id = v_instance.student_id AND teacher_id = p_teacher_id;

  IF v_tracking_id IS NOT NULL THEN
    IF v_completed_arr IS NULL THEN
      v_completed_arr := ARRAY[]::integer[];
    END IF;
    IF NOT (v_instance.lesson_number = ANY(v_completed_arr)) THEN
      v_completed_arr := array_append(v_completed_arr, v_instance.lesson_number);
    END IF;
    UPDATE student_lesson_tracking
    SET completed_lessons = v_completed_arr, updated_at = now()
    WHERE id = v_tracking_id;
  END IF;

  RETURN json_build_object('success', true, 'duration_minutes', v_duration_minutes);
END;
$$;
