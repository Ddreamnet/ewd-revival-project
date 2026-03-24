
-- Repair: Delete planned instances and regenerate with correct anchor for 4 affected students
-- This is a one-time data repair, not a schema change

DO $$
DECLARE
  v_student RECORD;
  v_result json;
  v_students text[] := ARRAY[
    'ab6741ab-2c3a-4f40-9ceb-f490ed0bf40d', -- Emir
    '62f189ca-1692-459e-a2ca-7ad278f84bb8', -- Koray
    '7454c67c-61e3-4390-aad4-f2e793081a93', -- Sadullah
    '24b96bfc-d77e-4109-b09a-3a4c2ff93b76'  -- Yaren Eylül
  ];
  v_sid uuid;
  v_tid uuid;
  v_cycle integer;
  v_slots jsonb;
  v_lpw integer;
BEGIN
  FOR i IN 1..array_length(v_students, 1) LOOP
    v_sid := v_students[i]::uuid;
    
    -- Get teacher_id and cycle
    SELECT teacher_id, package_cycle, lessons_per_week 
    INTO v_tid, v_cycle, v_lpw
    FROM student_lesson_tracking 
    WHERE student_id = v_sid;
    
    -- Build slots jsonb from template
    SELECT jsonb_agg(jsonb_build_object(
      'dayOfWeek', day_of_week,
      'startTime', start_time::text,
      'endTime', end_time::text
    ) ORDER BY day_of_week, start_time)
    INTO v_slots
    FROM student_lessons
    WHERE student_id = v_sid AND teacher_id = v_tid;
    
    -- Delete current cycle planned instances
    DELETE FROM lesson_instances
    WHERE student_id = v_sid
      AND teacher_id = v_tid
      AND package_cycle = v_cycle
      AND status = 'planned';
    
    -- Regenerate using rpc_sync_student_schedule (which has correct GREATEST anchor)
    SELECT rpc_sync_student_schedule(v_sid, v_tid, v_slots, v_lpw) INTO v_result;
    
    RAISE NOTICE 'Repaired student %: %', v_sid, v_result;
  END LOOP;
END;
$$;
