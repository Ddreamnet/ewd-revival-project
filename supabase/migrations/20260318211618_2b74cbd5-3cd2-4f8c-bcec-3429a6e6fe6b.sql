
-- Fix misattached trigger
DROP TRIGGER IF EXISTS on_lesson_tracking_update_notify_admin ON student_lesson_tracking;

-- Temporarily drop unique constraint on lesson_number for renumbering
ALTER TABLE lesson_instances DROP CONSTRAINT IF EXISTS lesson_instances_student_id_teacher_id_lesson_number_key;

-- Data Repair
DO $$
DECLARE
  v_student RECORD;
  v_tracking RECORD;
  v_max_completed_date date;
  v_deleted_count integer;
  v_total_rights integer;
  v_completed_count integer;
  v_planned_count integer;
  v_needed integer;
  v_last_date date;
  v_slot RECORD;
  v_lesson_num integer;
  v_iter integer;
  v_max_iterations integer := 200;
  v_inst RECORD;
  v_new_num integer;
BEGIN
  -- STEP 1: Sync lessons_per_week
  UPDATE student_lesson_tracking slt
  SET lessons_per_week = sub.cnt, updated_at = now()
  FROM (
    SELECT student_id, teacher_id, count(*)::integer as cnt
    FROM student_lessons
    GROUP BY student_id, teacher_id
  ) sub
  WHERE slt.student_id = sub.student_id 
    AND slt.teacher_id = sub.teacher_id
    AND slt.lessons_per_week <> sub.cnt;

  -- STEP 2: Delete planned instances before last completed
  FOR v_student IN 
    SELECT DISTINCT s.student_id, s.teacher_id FROM students s WHERE s.is_archived = false
  LOOP
    SELECT package_cycle, lessons_per_week INTO v_tracking
    FROM student_lesson_tracking
    WHERE student_id = v_student.student_id AND teacher_id = v_student.teacher_id;
    IF v_tracking IS NULL THEN CONTINUE; END IF;

    SELECT max(lesson_date) INTO v_max_completed_date
    FROM lesson_instances
    WHERE student_id = v_student.student_id AND teacher_id = v_student.teacher_id
      AND package_cycle = v_tracking.package_cycle AND status = 'completed';
    IF v_max_completed_date IS NULL THEN CONTINUE; END IF;

    DELETE FROM lesson_instances
    WHERE student_id = v_student.student_id AND teacher_id = v_student.teacher_id
      AND package_cycle = v_tracking.package_cycle AND status = 'planned'
      AND lesson_date <= v_max_completed_date;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    IF v_deleted_count > 0 THEN
      INSERT INTO balance_events (teacher_id, event_type, amount_minutes, student_id, package_cycle, notes)
      VALUES (v_student.teacher_id, 'data_repair', 0, v_student.student_id, v_tracking.package_cycle,
              'Deleted ' || v_deleted_count || ' planned before completed date ' || v_max_completed_date);
    END IF;
  END LOOP;

  -- STEP 3: Regenerate missing planned instances
  FOR v_student IN 
    SELECT DISTINCT s.student_id, s.teacher_id FROM students s WHERE s.is_archived = false
  LOOP
    SELECT package_cycle, lessons_per_week INTO v_tracking
    FROM student_lesson_tracking
    WHERE student_id = v_student.student_id AND teacher_id = v_student.teacher_id;
    IF v_tracking IS NULL THEN CONTINUE; END IF;

    v_total_rights := v_tracking.lessons_per_week * 4;

    SELECT count(*) INTO v_completed_count FROM lesson_instances
    WHERE student_id = v_student.student_id AND teacher_id = v_student.teacher_id
      AND package_cycle = v_tracking.package_cycle AND status = 'completed';

    SELECT count(*) INTO v_planned_count FROM lesson_instances
    WHERE student_id = v_student.student_id AND teacher_id = v_student.teacher_id
      AND package_cycle = v_tracking.package_cycle AND status = 'planned';

    v_needed := v_total_rights - v_completed_count - v_planned_count;
    IF v_needed <= 0 THEN CONTINUE; END IF;

    SELECT max(lesson_date) INTO v_last_date FROM lesson_instances
    WHERE student_id = v_student.student_id AND teacher_id = v_student.teacher_id
      AND package_cycle = v_tracking.package_cycle;
    IF v_last_date IS NULL THEN v_last_date := CURRENT_DATE - 1; END IF;

    SELECT COALESCE(max(lesson_number), 0) INTO v_lesson_num FROM lesson_instances
    WHERE student_id = v_student.student_id AND teacher_id = v_student.teacher_id;

    v_last_date := v_last_date + 1;
    v_iter := 0;

    WHILE v_needed > 0 AND v_iter < v_max_iterations LOOP
      v_iter := v_iter + 1;
      FOR v_slot IN
        SELECT day_of_week, start_time, end_time FROM student_lessons
        WHERE student_id = v_student.student_id AND teacher_id = v_student.teacher_id
        ORDER BY day_of_week, start_time
      LOOP
        IF v_needed <= 0 THEN EXIT; END IF;
        IF EXTRACT(DOW FROM v_last_date) = v_slot.day_of_week THEN
          v_lesson_num := v_lesson_num + 1;
          INSERT INTO lesson_instances (student_id, teacher_id, lesson_number, lesson_date, start_time, end_time, status, package_cycle)
          VALUES (v_student.student_id, v_student.teacher_id, v_lesson_num, v_last_date,
                  v_slot.start_time, v_slot.end_time, 'planned', v_tracking.package_cycle);
          v_needed := v_needed - 1;
        END IF;
      END LOOP;
      v_last_date := v_last_date + 1;
    END LOOP;
  END LOOP;

  -- STEP 4: Renumber lesson_number chronologically (constraint already dropped)
  FOR v_student IN
    SELECT DISTINCT s.student_id, s.teacher_id FROM students s WHERE s.is_archived = false
  LOOP
    SELECT package_cycle INTO v_tracking FROM student_lesson_tracking
    WHERE student_id = v_student.student_id AND teacher_id = v_student.teacher_id;
    IF v_tracking IS NULL THEN CONTINUE; END IF;

    v_new_num := 0;
    FOR v_inst IN
      SELECT id FROM lesson_instances
      WHERE student_id = v_student.student_id AND teacher_id = v_student.teacher_id
        AND package_cycle = v_tracking.package_cycle
      ORDER BY lesson_date ASC, start_time ASC
    LOOP
      v_new_num := v_new_num + 1;
      UPDATE lesson_instances SET lesson_number = v_new_num WHERE id = v_inst.id;
    END LOOP;
  END LOOP;
END $$;

-- Re-add unique constraint (now with package_cycle for correctness)
ALTER TABLE lesson_instances 
  ADD CONSTRAINT lesson_instances_student_teacher_cycle_lesson_number_key 
  UNIQUE (student_id, teacher_id, package_cycle, lesson_number);
