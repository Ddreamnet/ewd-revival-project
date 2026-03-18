
-- RPC: rpc_archive_student
-- Atomically: set archived, delete planned instances, delete overrides (transition)
CREATE OR REPLACE FUNCTION public.rpc_archive_student(
  p_student_record_id uuid,
  p_student_user_id uuid,
  p_teacher_user_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_planned integer;
BEGIN
  -- 1. Set archived
  UPDATE students
  SET is_archived = true, archived_at = now()
  WHERE id = p_student_record_id;

  -- 2. Delete planned instances only (completed preserved for history)
  DELETE FROM lesson_instances
  WHERE student_id = p_student_user_id
    AND teacher_id = p_teacher_user_id
    AND status = 'planned';
  GET DIAGNOSTICS v_deleted_planned = ROW_COUNT;

  -- 3. Delete lesson_overrides (transition-period dependency, remove after Phase 6)
  DELETE FROM lesson_overrides
  WHERE student_id = p_student_user_id
    AND teacher_id = p_teacher_user_id;

  RETURN json_build_object('success', true, 'deleted_planned_instances', v_deleted_planned);
END;
$$;

-- RPC: rpc_manual_balance_adjust
-- Adjusts manual_adjustment_minutes independently from lesson metrics
CREATE OR REPLACE FUNCTION public.rpc_manual_balance_adjust(
  p_teacher_id uuid,
  p_amount_minutes integer,
  p_notes text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update teacher balance
  UPDATE teacher_balance SET
    manual_adjustment_minutes = manual_adjustment_minutes + p_amount_minutes,
    total_minutes = total_minutes + p_amount_minutes,
    updated_at = now()
  WHERE teacher_id = p_teacher_id;

  -- Insert audit event
  INSERT INTO balance_events (teacher_id, event_type, amount_minutes, notes)
  VALUES (p_teacher_id, 'manual_adjust', p_amount_minutes, p_notes);

  RETURN json_build_object('success', true);
END;
$$;

-- RPC: rpc_complete_trial_lesson
-- Atomically: mark trial completed, update balance, insert event
CREATE OR REPLACE FUNCTION public.rpc_complete_trial_lesson(
  p_trial_id uuid,
  p_teacher_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trial trial_lessons%ROWTYPE;
  v_duration_minutes integer;
BEGIN
  SELECT * INTO v_trial
  FROM trial_lessons
  WHERE id = p_trial_id AND teacher_id = p_teacher_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Trial lesson not found');
  END IF;

  IF v_trial.is_completed THEN
    RETURN json_build_object('success', false, 'error', 'Already completed');
  END IF;

  v_duration_minutes := EXTRACT(EPOCH FROM (v_trial.end_time - v_trial.start_time)) / 60;

  -- Mark completed
  UPDATE trial_lessons SET is_completed = true, updated_at = now()
  WHERE id = p_trial_id;

  -- Update balance
  INSERT INTO teacher_balance (teacher_id, total_minutes, completed_trial_lessons, trial_lessons_minutes)
  VALUES (p_teacher_id, v_duration_minutes, 1, v_duration_minutes)
  ON CONFLICT (teacher_id) DO UPDATE SET
    total_minutes = teacher_balance.total_minutes + v_duration_minutes,
    completed_trial_lessons = teacher_balance.completed_trial_lessons + 1,
    trial_lessons_minutes = teacher_balance.trial_lessons_minutes + v_duration_minutes,
    updated_at = now();

  -- Audit event
  INSERT INTO balance_events (teacher_id, event_type, amount_minutes)
  VALUES (p_teacher_id, 'trial_complete', v_duration_minutes);

  RETURN json_build_object('success', true, 'duration_minutes', v_duration_minutes);
END;
$$;
