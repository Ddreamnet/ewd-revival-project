
-- Fix rpc_restore_student: use MAX(lesson_number) instead of COUNT(completed)
CREATE OR REPLACE FUNCTION public.rpc_restore_student(p_student_record_id uuid, p_student_user_id uuid, p_teacher_user_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_slot record;
  v_slots jsonb := '[]'::jsonb;
  v_weekly_count integer := 0;
  v_total_lessons integer;
  v_completed_count integer;
  v_remaining integer;
  v_current_cycle integer;
  v_start_date date;
  v_last_completed_date date;
  v_last_completed_time time;
  v_lesson_num integer;
  v_day_of_week integer;
  v_max_iterations integer := 200;
  v_iter integer := 0;
  v_json_slot jsonb;
  v_instances_created integer := 0;
BEGIN
  -- 1. Unarchive
  UPDATE students
  SET is_archived = false, archived_at = null
  WHERE id = p_student_record_id;

  -- 2. Get template slots (ordered)
  FOR v_slot IN
    SELECT day_of_week, start_time, end_time
    FROM student_lessons
    WHERE student_id = p_student_user_id AND teacher_id = p_teacher_user_id
    ORDER BY day_of_week, start_time
  LOOP
    v_weekly_count := v_weekly_count + 1;
    v_slots := v_slots || jsonb_build_object(
      'dayOfWeek', v_slot.day_of_week,
      'startTime', v_slot.start_time::text,
      'endTime', v_slot.end_time::text
    );
  END LOOP;

  IF v_weekly_count = 0 THEN
    RETURN json_build_object('success', true, 'instances_created', 0, 'message', 'No template slots');
  END IF;

  -- 3. Get current cycle and completed count
  SELECT package_cycle INTO v_current_cycle
  FROM student_lesson_tracking
  WHERE student_id = p_student_user_id AND teacher_id = p_teacher_user_id;

  IF v_current_cycle IS NULL THEN
    v_current_cycle := 1;
  END IF;

  SELECT count(*) INTO v_completed_count
  FROM lesson_instances
  WHERE student_id = p_student_user_id
    AND teacher_id = p_teacher_user_id
    AND status = 'completed'
    AND package_cycle = v_current_cycle;

  v_total_lessons := v_weekly_count * 4;
  v_remaining := v_total_lessons - v_completed_count;

  IF v_remaining <= 0 THEN
    RETURN json_build_object('success', true, 'instances_created', 0, 'message', 'All lessons already completed');
  END IF;

  -- 4. Anchor: get last completed date AND time (cross-cycle for safety)
  v_start_date := CURRENT_DATE;
  v_last_completed_date := NULL;
  v_last_completed_time := NULL;

  SELECT lesson_date, start_time
  INTO v_last_completed_date, v_last_completed_time
  FROM lesson_instances
  WHERE student_id = p_student_user_id
    AND teacher_id = p_teacher_user_id
    AND status = 'completed'
  ORDER BY lesson_date DESC, start_time DESC
  LIMIT 1;

  IF v_last_completed_date IS NOT NULL THEN
    v_start_date := GREATEST(CURRENT_DATE, v_last_completed_date);
  END IF;

  -- FIX: Use MAX(lesson_number) instead of COUNT(completed) to avoid duplicate key constraint violation
  SELECT COALESCE(MAX(lesson_number), 0) INTO v_lesson_num
  FROM lesson_instances
  WHERE student_id = p_student_user_id
    AND teacher_id = p_teacher_user_id
    AND package_cycle = v_current_cycle;

  WHILE v_instances_created < v_remaining AND v_iter < v_max_iterations LOOP
    v_iter := v_iter + 1;
    FOR v_json_slot IN
      SELECT s.value FROM jsonb_array_elements(v_slots) AS s(value)
      ORDER BY (s.value->>'dayOfWeek')::integer, (s.value->>'startTime')
    LOOP
      v_day_of_week := (v_json_slot->>'dayOfWeek')::integer;
      IF EXTRACT(DOW FROM v_start_date) = v_day_of_week AND v_instances_created < v_remaining THEN
        IF v_start_date = v_last_completed_date
           AND v_last_completed_time IS NOT NULL
           AND (v_json_slot->>'startTime')::time <= v_last_completed_time THEN
          CONTINUE;
        END IF;
        v_lesson_num := v_lesson_num + 1;
        v_instances_created := v_instances_created + 1;
        INSERT INTO lesson_instances (student_id, teacher_id, lesson_number, lesson_date, start_time, end_time, status, package_cycle)
        VALUES (p_student_user_id, p_teacher_user_id, v_lesson_num, v_start_date,
                (v_json_slot->>'startTime')::time, (v_json_slot->>'endTime')::time, 'planned', v_current_cycle);
      END IF;
    END LOOP;
    v_start_date := v_start_date + 1;
  END LOOP;

  RETURN json_build_object('success', true, 'instances_created', v_instances_created);
END;
$function$;

-- Fix rpc_sync_student_schedule: use MAX(lesson_number) for safety
CREATE OR REPLACE FUNCTION public.rpc_sync_student_schedule(p_student_id uuid, p_teacher_id uuid, p_slots jsonb, p_lessons_per_week integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current_cycle integer;
  v_completed_count integer;
  v_total_lessons integer;
  v_planned_count integer;
  v_slot jsonb;
  v_day_of_week integer;
  v_start_date date;
  v_last_completed_date date;
  v_last_completed_time time;
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
  v_start_date := CURRENT_DATE;
  v_last_completed_date := NULL;
  v_last_completed_time := NULL;

  IF v_completed_count > 0 THEN
    SELECT lesson_date, start_time
    INTO v_last_completed_date, v_last_completed_time
    FROM lesson_instances
    WHERE student_id = p_student_id
      AND teacher_id = p_teacher_id
      AND package_cycle = v_current_cycle
      AND status = 'completed'
    ORDER BY lesson_date DESC, start_time DESC
    LIMIT 1;

    v_start_date := GREATEST(CURRENT_DATE, COALESCE(v_last_completed_date, CURRENT_DATE));
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

  -- FIX: Use MAX(lesson_number) instead of count-based calculation to avoid duplicate key
  SELECT COALESCE(MAX(lesson_number), 0) INTO v_lesson_num
  FROM lesson_instances
  WHERE student_id = p_student_id
    AND teacher_id = p_teacher_id
    AND package_cycle = v_current_cycle;

  WHILE v_instances_created < v_planned_count AND v_iter < v_max_iterations LOOP
    v_iter := v_iter + 1;
    FOR v_slot IN
      SELECT s.value FROM jsonb_array_elements(p_slots) AS s(value)
      ORDER BY (s.value->>'dayOfWeek')::integer, (s.value->>'startTime')
    LOOP
      v_day_of_week := (v_slot->>'dayOfWeek')::integer;
      IF EXTRACT(DOW FROM v_start_date) = v_day_of_week AND v_instances_created < v_planned_count THEN
        IF v_start_date = v_last_completed_date
           AND v_last_completed_time IS NOT NULL
           AND (v_slot->>'startTime')::time <= v_last_completed_time THEN
          CONTINUE;
        END IF;
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
$function$;
