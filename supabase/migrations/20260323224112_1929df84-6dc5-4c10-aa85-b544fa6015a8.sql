
-- Phase 3: Create rpc_undo_trial_lesson for atomic trial lesson undo
CREATE OR REPLACE FUNCTION public.rpc_undo_trial_lesson(p_trial_id uuid, p_teacher_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  IF NOT v_trial.is_completed THEN
    RETURN json_build_object('success', false, 'error', 'Trial lesson is not completed');
  END IF;

  v_duration_minutes := EXTRACT(EPOCH FROM (v_trial.end_time - v_trial.start_time)) / 60;

  UPDATE trial_lessons SET is_completed = false, updated_at = now()
  WHERE id = p_trial_id;

  UPDATE teacher_balance SET
    total_minutes = GREATEST(0, total_minutes - v_duration_minutes),
    completed_trial_lessons = GREATEST(0, completed_trial_lessons - 1),
    trial_lessons_minutes = GREATEST(0, trial_lessons_minutes - v_duration_minutes),
    updated_at = now()
  WHERE teacher_id = p_teacher_id;

  INSERT INTO balance_events (teacher_id, event_type, amount_minutes)
  VALUES (p_teacher_id, 'trial_undo', -v_duration_minutes);

  RETURN json_build_object('success', true, 'duration_minutes', v_duration_minutes);
END;
$function$;
