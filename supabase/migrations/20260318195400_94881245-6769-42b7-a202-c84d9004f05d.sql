
-- Phase 6 Final Cleanup: Remove legacy fields and table

-- 1. Update rpc_complete_lesson: remove legacy completed_lessons sync (step 8)
CREATE OR REPLACE FUNCTION public.rpc_complete_lesson(p_instance_id uuid, p_teacher_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_instance lesson_instances%ROWTYPE;
  v_duration_minutes integer;
  v_current_cycle integer;
  v_first_planned_id uuid;
BEGIN
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

  SELECT package_cycle INTO v_current_cycle
  FROM student_lesson_tracking
  WHERE student_id = v_instance.student_id AND teacher_id = p_teacher_id;

  IF v_current_cycle IS NULL THEN
    v_current_cycle := 1;
  END IF;

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

  v_duration_minutes := EXTRACT(EPOCH FROM (v_instance.end_time - v_instance.start_time)) / 60;

  UPDATE lesson_instances
  SET status = 'completed', updated_at = now()
  WHERE id = p_instance_id;

  INSERT INTO teacher_balance (teacher_id, total_minutes, completed_regular_lessons, regular_lessons_minutes)
  VALUES (p_teacher_id, v_duration_minutes, 1, v_duration_minutes)
  ON CONFLICT (teacher_id) DO UPDATE SET
    total_minutes = teacher_balance.total_minutes + v_duration_minutes,
    completed_regular_lessons = teacher_balance.completed_regular_lessons + 1,
    regular_lessons_minutes = teacher_balance.regular_lessons_minutes + v_duration_minutes,
    updated_at = now();

  INSERT INTO balance_events (teacher_id, event_type, amount_minutes, instance_id, student_id, package_cycle)
  VALUES (p_teacher_id, 'lesson_complete', v_duration_minutes, p_instance_id, v_instance.student_id, v_current_cycle);

  RETURN json_build_object('success', true, 'duration_minutes', v_duration_minutes);
END;
$function$;

-- 2. Update rpc_undo_complete_lesson: remove legacy completed_lessons sync
CREATE OR REPLACE FUNCTION public.rpc_undo_complete_lesson(p_instance_id uuid, p_teacher_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_instance lesson_instances%ROWTYPE;
  v_duration_minutes integer;
  v_current_cycle integer;
  v_last_completed_id uuid;
BEGIN
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

  SELECT package_cycle INTO v_current_cycle
  FROM student_lesson_tracking
  WHERE student_id = v_instance.student_id AND teacher_id = p_teacher_id;

  IF v_current_cycle IS NULL THEN
    v_current_cycle := 1;
  END IF;

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

  v_duration_minutes := EXTRACT(EPOCH FROM (v_instance.end_time - v_instance.start_time)) / 60;

  UPDATE lesson_instances
  SET status = 'planned', updated_at = now()
  WHERE id = p_instance_id;

  UPDATE teacher_balance SET
    total_minutes = GREATEST(0, total_minutes - v_duration_minutes),
    completed_regular_lessons = GREATEST(0, completed_regular_lessons - 1),
    regular_lessons_minutes = GREATEST(0, regular_lessons_minutes - v_duration_minutes),
    updated_at = now()
  WHERE teacher_id = p_teacher_id;

  INSERT INTO balance_events (teacher_id, event_type, amount_minutes, instance_id, student_id, package_cycle)
  VALUES (p_teacher_id, 'lesson_undo', -v_duration_minutes, p_instance_id, v_instance.student_id, v_current_cycle);

  RETURN json_build_object('success', true, 'duration_minutes', v_duration_minutes);
END;
$function$;

-- 3. Update rpc_reset_package: remove legacy field clearing
CREATE OR REPLACE FUNCTION public.rpc_reset_package(p_student_id uuid, p_teacher_id uuid, p_template_slots jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current_cycle integer;
  v_new_cycle integer;
  v_weekly_count integer;
  v_total_lessons integer;
  v_slot jsonb;
  v_day_of_week integer;
  v_start_date date;
  v_lesson_num integer := 0;
  v_max_iterations integer := 200;
  v_iter integer := 0;
BEGIN
  SELECT package_cycle INTO v_current_cycle
  FROM student_lesson_tracking
  WHERE student_id = p_student_id AND teacher_id = p_teacher_id;

  IF v_current_cycle IS NULL THEN
    v_current_cycle := 1;
  END IF;

  v_new_cycle := v_current_cycle + 1;
  v_weekly_count := jsonb_array_length(p_template_slots);
  v_total_lessons := v_weekly_count * 4;

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

  v_start_date := CURRENT_DATE;

  WHILE v_lesson_num < v_total_lessons AND v_iter < v_max_iterations LOOP
    v_iter := v_iter + 1;
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
$function$;

-- 4. Update rpc_archive_student: remove lesson_overrides deletion
CREATE OR REPLACE FUNCTION public.rpc_archive_student(p_student_record_id uuid, p_student_user_id uuid, p_teacher_user_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_deleted_planned integer;
BEGIN
  UPDATE students
  SET is_archived = true, archived_at = now()
  WHERE id = p_student_record_id;

  DELETE FROM lesson_instances
  WHERE student_id = p_student_user_id
    AND teacher_id = p_teacher_user_id
    AND status = 'planned';
  GET DIAGNOSTICS v_deleted_planned = ROW_COUNT;

  RETURN json_build_object('success', true, 'deleted_planned_instances', v_deleted_planned);
END;
$function$;

-- 5. Update rpc_delete_student: remove lesson_overrides deletion
CREATE OR REPLACE FUNCTION public.rpc_delete_student(p_student_record_id uuid, p_student_user_id uuid, p_teacher_user_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_topic_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO v_topic_ids
  FROM topics
  WHERE student_id = p_student_user_id AND teacher_id = p_teacher_user_id;

  IF v_topic_ids IS NOT NULL AND array_length(v_topic_ids, 1) > 0 THEN
    DELETE FROM resources WHERE topic_id = ANY(v_topic_ids);
    DELETE FROM topics WHERE id = ANY(v_topic_ids);
  END IF;

  DELETE FROM student_resource_completion WHERE student_id = p_student_user_id;
  DELETE FROM student_lesson_tracking WHERE student_id = p_student_user_id AND teacher_id = p_teacher_user_id;
  DELETE FROM student_lessons WHERE student_id = p_student_user_id AND teacher_id = p_teacher_user_id;
  DELETE FROM homework_submissions WHERE student_id = p_student_user_id AND teacher_id = p_teacher_user_id;
  DELETE FROM lesson_instances WHERE student_id = p_student_user_id AND teacher_id = p_teacher_user_id;
  DELETE FROM notifications WHERE student_id = p_student_user_id AND teacher_id = p_teacher_user_id;
  DELETE FROM admin_notifications WHERE student_id = p_student_user_id AND teacher_id = p_teacher_user_id;

  DELETE FROM students WHERE id = p_student_record_id;
  DELETE FROM profiles WHERE user_id = p_student_user_id;

  RETURN json_build_object('success', true);
EXCEPTION
  WHEN others THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;

-- 6. Update notify_admin_last_lesson to use lesson_instances instead of completed_lessons
CREATE OR REPLACE FUNCTION public.notify_admin_last_lesson()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  total_lessons INTEGER;
  completed_count INTEGER;
  teacher_name TEXT;
  student_name TEXT;
  v_student_id uuid;
  v_teacher_id uuid;
  v_package_cycle integer;
BEGIN
  -- This trigger fires on lesson_instances update (status change to completed)
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    v_student_id := NEW.student_id;
    v_teacher_id := NEW.teacher_id;
    v_package_cycle := NEW.package_cycle;

    -- Total lessons for this package
    SELECT lessons_per_week * 4 INTO total_lessons
    FROM student_lesson_tracking
    WHERE student_id = v_student_id AND teacher_id = v_teacher_id;

    IF total_lessons IS NULL THEN
      RETURN NEW;
    END IF;

    -- Count completed in current cycle
    SELECT count(*) INTO completed_count
    FROM lesson_instances
    WHERE student_id = v_student_id
      AND teacher_id = v_teacher_id
      AND package_cycle = v_package_cycle
      AND status = 'completed';

    -- Notify when second-to-last lesson completed
    IF completed_count = total_lessons - 1 THEN
      SELECT full_name INTO teacher_name FROM profiles WHERE user_id = v_teacher_id;
      SELECT full_name INTO student_name FROM profiles WHERE user_id = v_student_id;

      IF NOT EXISTS (
        SELECT 1 FROM admin_notifications
        WHERE teacher_id = v_teacher_id
        AND student_id = v_student_id
        AND notification_type = 'last_lesson_warning'
        AND created_at > (CURRENT_DATE - INTERVAL '30 days')
      ) THEN
        INSERT INTO admin_notifications (notification_type, teacher_id, student_id, message)
        VALUES (
          'last_lesson_warning',
          v_teacher_id,
          v_student_id,
          COALESCE(teacher_name, 'Öğretmen') || ' öğretmenin ' || COALESCE(student_name, 'Öğrenci') || ' öğrencisinin son bir dersi kaldı!'
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 7. Drop old trigger on student_lesson_tracking and create new one on lesson_instances
DROP TRIGGER IF EXISTS notify_last_lesson_trigger ON student_lesson_tracking;
DROP TRIGGER IF EXISTS notify_last_lesson_trigger ON lesson_instances;
CREATE TRIGGER notify_last_lesson_trigger
  AFTER UPDATE ON lesson_instances
  FOR EACH ROW
  EXECUTE FUNCTION notify_admin_last_lesson();

-- 8. Drop legacy columns from student_lesson_tracking
ALTER TABLE student_lesson_tracking DROP COLUMN IF EXISTS completed_lessons;
ALTER TABLE student_lesson_tracking DROP COLUMN IF EXISTS lesson_dates;

-- 9. Drop lesson_overrides table (RLS policies are dropped automatically)
DROP TABLE IF EXISTS lesson_overrides;
