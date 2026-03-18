
-- RPC: Permanently delete a student and all associated data
CREATE OR REPLACE FUNCTION public.rpc_delete_student(
  p_student_record_id uuid,
  p_student_user_id uuid,
  p_teacher_user_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_topic_ids uuid[];
BEGIN
  -- 1. Get topic IDs
  SELECT array_agg(id) INTO v_topic_ids
  FROM topics
  WHERE student_id = p_student_user_id AND teacher_id = p_teacher_user_id;

  -- 2. Delete resources for those topics
  IF v_topic_ids IS NOT NULL AND array_length(v_topic_ids, 1) > 0 THEN
    DELETE FROM resources WHERE topic_id = ANY(v_topic_ids);
    DELETE FROM topics WHERE id = ANY(v_topic_ids);
  END IF;

  -- 3. Delete related data
  DELETE FROM student_resource_completion WHERE student_id = p_student_user_id;
  DELETE FROM student_lesson_tracking WHERE student_id = p_student_user_id AND teacher_id = p_teacher_user_id;
  DELETE FROM student_lessons WHERE student_id = p_student_user_id AND teacher_id = p_teacher_user_id;
  DELETE FROM homework_submissions WHERE student_id = p_student_user_id AND teacher_id = p_teacher_user_id;
  DELETE FROM lesson_instances WHERE student_id = p_student_user_id AND teacher_id = p_teacher_user_id;
  DELETE FROM lesson_overrides WHERE student_id = p_student_user_id AND teacher_id = p_teacher_user_id;
  DELETE FROM notifications WHERE student_id = p_student_user_id AND teacher_id = p_teacher_user_id;
  DELETE FROM admin_notifications WHERE student_id = p_student_user_id AND teacher_id = p_teacher_user_id;

  -- 4. Delete student record
  DELETE FROM students WHERE id = p_student_record_id;

  -- 5. Delete profile
  DELETE FROM profiles WHERE user_id = p_student_user_id;

  RETURN json_build_object('success', true);
EXCEPTION
  WHEN others THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- RPC: Restore an archived student and regenerate planned instances
CREATE OR REPLACE FUNCTION public.rpc_restore_student(
  p_student_record_id uuid,
  p_student_user_id uuid,
  p_teacher_user_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_slot record;
  v_slots jsonb := '[]'::jsonb;
  v_weekly_count integer := 0;
  v_total_lessons integer;
  v_completed_count integer;
  v_remaining integer;
  v_current_cycle integer;
  v_start_date date;
  v_lesson_date date;
  v_lesson_num integer;
  v_day_of_week integer;
  v_max_iterations integer := 200;
  v_iter integer := 0;
BEGIN
  -- 1. Unarchive
  UPDATE students
  SET is_archived = false, archived_at = null
  WHERE id = p_student_record_id;

  -- 2. Get template slots
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

  -- 4. Generate planned instances from today
  v_start_date := CURRENT_DATE;
  v_lesson_num := v_completed_count;

  WHILE v_lesson_num < v_total_lessons AND v_iter < v_max_iterations LOOP
    v_iter := v_iter + 1;
    FOR v_slot IN SELECT * FROM jsonb_array_elements(v_slots) AS s LOOP
      v_day_of_week := (v_slot.s->>'dayOfWeek')::integer;
      IF EXTRACT(DOW FROM v_start_date) = v_day_of_week AND v_lesson_num < v_total_lessons THEN
        v_lesson_num := v_lesson_num + 1;
        INSERT INTO lesson_instances (student_id, teacher_id, lesson_number, lesson_date, start_time, end_time, status, package_cycle)
        VALUES (p_student_user_id, p_teacher_user_id, v_lesson_num, v_start_date,
                (v_slot.s->>'startTime')::time, (v_slot.s->>'endTime')::time, 'planned', v_current_cycle);
      END IF;
    END LOOP;
    v_start_date := v_start_date + 1;
  END LOOP;

  RETURN json_build_object('success', true, 'instances_created', v_lesson_num - v_completed_count);
END;
$$;
