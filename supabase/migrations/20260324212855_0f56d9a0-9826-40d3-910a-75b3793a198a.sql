
-- Direct repair for 3 students whose completed lessons are in old cycle
-- rpc_sync_student_schedule can't see cross-cycle completions, so manual repair needed

DO $$
DECLARE
  v_students text[] := ARRAY[
    'ab6741ab-2c3a-4f40-9ceb-f490ed0bf40d',  -- Emir (completed cycle 1, planned cycle 2)
    '7454c67c-61e3-4390-aad4-f2e793081a93',  -- Sadullah
    '24b96bfc-d77e-4109-b09a-3a4c2ff93b76'   -- Yaren Eylül
  ];
  v_sid uuid;
  v_tid uuid;
  v_cycle integer;
  v_lpw integer;
  v_total integer;
  v_last_completed date;
  v_start_date date;
  v_slot RECORD;
  v_lesson_num integer;
  v_iter integer;
  v_instances_created integer;
BEGIN
  FOR i IN 1..array_length(v_students, 1) LOOP
    v_sid := v_students[i]::uuid;
    
    SELECT teacher_id, package_cycle, lessons_per_week 
    INTO v_tid, v_cycle, v_lpw
    FROM student_lesson_tracking WHERE student_id = v_sid;
    
    v_total := v_lpw * 4;
    
    -- Get last completed date across ALL cycles
    SELECT MAX(lesson_date) INTO v_last_completed
    FROM lesson_instances
    WHERE student_id = v_sid AND teacher_id = v_tid AND status = 'completed';
    
    -- GREATEST anchor
    v_start_date := GREATEST(CURRENT_DATE, v_last_completed + 1);
    
    -- Delete current cycle planned
    DELETE FROM lesson_instances
    WHERE student_id = v_sid AND teacher_id = v_tid 
      AND package_cycle = v_cycle AND status = 'planned';
    
    -- Regenerate
    v_lesson_num := 0;
    v_iter := 0;
    v_instances_created := 0;
    
    WHILE v_instances_created < v_total AND v_iter < 200 LOOP
      v_iter := v_iter + 1;
      FOR v_slot IN 
        SELECT day_of_week, start_time, end_time 
        FROM student_lessons 
        WHERE student_id = v_sid AND teacher_id = v_tid 
        ORDER BY day_of_week, start_time
      LOOP
        IF EXTRACT(DOW FROM v_start_date) = v_slot.day_of_week AND v_instances_created < v_total THEN
          v_instances_created := v_instances_created + 1;
          INSERT INTO lesson_instances (student_id, teacher_id, lesson_number, lesson_date, start_time, end_time, status, package_cycle)
          VALUES (v_sid, v_tid, v_instances_created, v_start_date, v_slot.start_time, v_slot.end_time, 'planned', v_cycle);
        END IF;
      END LOOP;
      v_start_date := v_start_date + 1;
    END LOOP;
    
    RAISE NOTICE 'Repaired %: start=%, instances=%', v_sid, GREATEST(CURRENT_DATE, v_last_completed + 1), v_instances_created;
  END LOOP;
END;
$$;
