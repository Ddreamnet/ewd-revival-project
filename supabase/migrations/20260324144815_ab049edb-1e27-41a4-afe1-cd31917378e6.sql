
CREATE OR REPLACE FUNCTION public.rpc_sync_student_schedule(
  p_student_id uuid,
  p_teacher_id uuid,
  p_slots jsonb,
  p_lessons_per_week integer
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current_cycle integer;
  v_completed_count integer;
  v_total_lessons integer;
  v_planned_count integer;
  v_slot jsonb;
  v_day_of_week integer;
  v_start_date date;
  v_lesson_num integer;
  v_max_iterations integer := 200;
  v_iter integer := 0;
  v_instances_created integer := 0;
BEGIN
  -- 1. Delete old template slots and insert new ones
  DELETE FROM student_lessons
  WHERE student_id = p_student_id AND teacher_id = p_teacher_id;

  INSERT INTO student_lessons (student_id, teacher_id, day_of_week, start_time, end_time)
  SELECT
    p_student_id,
    p_teacher_id,
    (slot->>'dayOfWeek')::integer,
    (slot->>'startTime')::time,
    (slot->>'endTime')::time
  FROM jsonb_array_elements(p_slots) AS slot;

  -- 2. Upsert lessons_per_week in tracking
  INSERT INTO student_lesson_tracking (student_id, teacher_id, lessons_per_week)
  VALUES (p_student_id, p_teacher_id, p_lessons_per_week)
  ON CONFLICT (student_id, teacher_id)
  DO UPDATE SET lessons_per_week = p_lessons_per_week, updated_at = now();

  -- 3. Get current cycle
  SELECT package_cycle INTO v_current_cycle
  FROM student_lesson_tracking
  WHERE student_id = p_student_id AND teacher_id = p_teacher_id;

  IF v_current_cycle IS NULL THEN
    v_current_cycle := 1;
  END IF;

  -- 4. Count completed instances in current cycle
  SELECT count(*) INTO v_completed_count
  FROM lesson_instances
  WHERE student_id = p_student_id
    AND teacher_id = p_teacher_id
    AND package_cycle = v_current_cycle
    AND status = 'completed';

  v_total_lessons := p_lessons_per_week * 4;
  v_planned_count := GREATEST(0, v_total_lessons - v_completed_count);

  -- 5. Delete planned instances that are NOT manual overrides and NOT shifted
  DELETE FROM lesson_instances
  WHERE student_id = p_student_id
    AND teacher_id = p_teacher_id
    AND package_cycle = v_current_cycle
    AND status = 'planned'
    AND is_manual_override = false
    AND shift_group_id IS NULL;

  -- 6. Regenerate planned instances from template
  -- Start from today or day after last completed, whichever is later
  v_start_date := CURRENT_DATE;

  IF v_completed_count > 0 THEN
    SELECT (lesson_date + 1)::date INTO v_start_date
    FROM lesson_instances
    WHERE student_id = p_student_id
      AND teacher_id = p_teacher_id
      AND package_cycle = v_current_cycle
      AND status = 'completed'
    ORDER BY lesson_date DESC, start_time DESC
    LIMIT 1;

    IF v_start_date < CURRENT_DATE THEN
      v_start_date := CURRENT_DATE;
    END IF;
  END IF;

  -- Count preserved override/shift instances to subtract from planned_count
  v_planned_count := v_planned_count - (
    SELECT count(*)
    FROM lesson_instances
    WHERE student_id = p_student_id
      AND teacher_id = p_teacher_id
      AND package_cycle = v_current_cycle
      AND status = 'planned'
      AND (is_manual_override = true OR shift_group_id IS NOT NULL)
  );

  IF v_planned_count <= 0 THEN
    RETURN json_build_object('success', true, 'instances_created', 0, 'completed_count', v_completed_count);
  END IF;

  v_lesson_num := v_completed_count + (
    SELECT count(*)
    FROM lesson_instances
    WHERE student_id = p_student_id
      AND teacher_id = p_teacher_id
      AND package_cycle = v_current_cycle
      AND status = 'planned'
      AND (is_manual_override = true OR shift_group_id IS NOT NULL)
  );

  WHILE v_instances_created < v_planned_count AND v_iter < v_max_iterations LOOP
    v_iter := v_iter + 1;
    FOR v_slot IN SELECT * FROM jsonb_array_elements(p_slots) LOOP
      v_day_of_week := (v_slot->>'dayOfWeek')::integer;
      IF EXTRACT(DOW FROM v_start_date) = v_day_of_week AND v_instances_created < v_planned_count THEN
        v_lesson_num := v_lesson_num + 1;
        v_instances_created := v_instances_created + 1;
        INSERT INTO lesson_instances (
          student_id, teacher_id, lesson_number, lesson_date,
          start_time, end_time, status, package_cycle
        ) VALUES (
          p_student_id, p_teacher_id, v_lesson_num, v_start_date,
          (v_slot->>'startTime')::time, (v_slot->>'endTime')::time,
          'planned', v_current_cycle
        );
      END IF;
    END LOOP;
    v_start_date := v_start_date + 1;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'instances_created', v_instances_created,
    'completed_count', v_completed_count,
    'cycle', v_current_cycle
  );
END;
$$;
