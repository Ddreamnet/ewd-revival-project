-- The previous backfill migration used a guessed teacher_id (0db38a30…) for
-- Öykü, who has since switched to teacher a012bfff… (Hatice Teacher). The
-- guessed id happens to exist in lesson_instances (Öykü's PREVIOUS teacher),
-- so the row inserted but with the wrong teacher and an out-of-range
-- lesson_number=1. This migration:
--   * removes the wrong row + its balance_events entry
--   * reverses any teacher_balance update that landed on the wrong account
--   * re-inserts the row under the correct teacher with the right
--     lesson_number, and credits Hatice's balance.

DO $$
DECLARE
  v_correct_teacher uuid := 'a012bfff-ddb0-439c-8022-c95633483042';
  v_wrong_teacher   uuid := '0db38a30-09a5-43d6-bf90-7e15ad7d5c44';
  v_oyku            uuid := 'e620f6d3-ce01-4361-9752-48910c99ffbd';
  v_wrong_row_id    uuid := '6b221739-ca98-4e41-b279-0eca6b2e07c8';
  v_dur_min         integer := 30;
  v_max_num         integer;
BEGIN
  UPDATE public.teacher_balance
     SET total_minutes              = GREATEST(0, total_minutes              - v_dur_min),
         regular_lessons_minutes    = GREATEST(0, regular_lessons_minutes    - v_dur_min),
         completed_regular_lessons  = GREATEST(0, completed_regular_lessons  - 1),
         updated_at                 = now()
   WHERE teacher_id = v_wrong_teacher;

  DELETE FROM public.balance_events
   WHERE instance_id = v_wrong_row_id
      OR (event_type = 'data_repair'
          AND student_id = v_oyku
          AND teacher_id = v_wrong_teacher
          AND notes LIKE 'Backfill (completed%');

  DELETE FROM public.lesson_instances WHERE id = v_wrong_row_id;

  SELECT COALESCE(MAX(lesson_number), 0) + 1
    INTO v_max_num
    FROM public.lesson_instances
   WHERE student_id    = v_oyku
     AND teacher_id    = v_correct_teacher
     AND package_cycle = 2;

  INSERT INTO public.lesson_instances (
    student_id, teacher_id, lesson_number,
    lesson_date, start_time, end_time,
    status, package_cycle,
    is_manual_override, rescheduled_count
  )
  VALUES (
    v_oyku, v_correct_teacher, v_max_num,
    DATE '2026-04-24', TIME '19:20:00', TIME '19:50:00',
    'completed', 2,
    false, 0
  );

  INSERT INTO public.balance_events (
    teacher_id, event_type, amount_minutes,
    student_id, package_cycle, notes
  )
  VALUES (
    v_correct_teacher, 'data_repair', v_dur_min,
    v_oyku, 2,
    'Düzeltme (yanlış teacher_id ile yapılan backfill geri alındı): Öykü cycle 2 hafta 1 Cuma slotu 04-24 19:20 doğru öğretmene (Hatice) atfedildi, completed.'
  );

  UPDATE public.teacher_balance
     SET total_minutes              = total_minutes              + v_dur_min,
         regular_lessons_minutes    = regular_lessons_minutes    + v_dur_min,
         completed_regular_lessons  = completed_regular_lessons  + 1,
         updated_at                 = now()
   WHERE teacher_id = v_correct_teacher;

  RAISE NOTICE 'Öykü backfill fixed: re-inserted under teacher % with lesson_number %.',
    v_correct_teacher, v_max_num;
END $$;
