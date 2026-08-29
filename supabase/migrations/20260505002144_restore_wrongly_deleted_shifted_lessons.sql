-- Restore the lesson_instances that were wrongly deleted in the recent
-- duplicate cleanup. The deleted rows whose `original_date` was set were not
-- duplicates in the bookkeeping sense — they were lessons that had been
-- moved (correctly) FROM their original slot. Cleaning them up was wrong:
-- it cost the student a real lesson and the teacher real minutes.
--
-- Strategy:
--   * For each `data_repair` event from the recent cleanup whose notes
--     contain a non-null `original_date`, recreate the row at its ORIGINAL
--     position (lesson_date = original_date, start_time = original_start
--     OR fall back to the deleted row's start_time when original_start was
--     NULL — that means the original move only changed the date).
--   * Skip rows where the original slot is already occupied (the lesson
--     genuinely existed at the current position too — needs manual review).
--   * Refund the balance for every restored 'completed' row.
--
-- Also moves Yiğit's existing wrongly-shifted lesson 8 (currently
-- 2026-05-18 18:40, original 2026-05-11 19:20) back to its canonical slot,
-- restoring his expected 8-lesson cycle.

DO $$
DECLARE
  r record;
  v_dur_min integer;
  v_max_num integer;
  v_inserted integer := 0;
  v_skipped integer := 0;
  v_minutes_back integer := 0;
  v_l8 record;
BEGIN
  ----------------------------------------------------------------------
  -- 1) Re-create rows whose original_date is set
  ----------------------------------------------------------------------
  FOR r IN
    WITH parsed AS (
      SELECT
        be.teacher_id,
        be.student_id,
        be.package_cycle,
        be.amount_minutes,
        (regexp_match(be.notes, 'original_date=(\d{4}-\d{2}-\d{2})'))[1]::date AS orig_date,
        NULLIF((regexp_match(be.notes, 'original_start=(\d{2}:\d{2}:\d{2}|NULL)'))[1], 'NULL')::time AS orig_start,
        (regexp_match(be.notes, 'Silinen kayıt: (\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})'))[2]::time AS deleted_start,
        (regexp_match(be.notes, 'status=(planned|completed)'))[1] AS orig_status
      FROM public.balance_events be
      WHERE be.event_type = 'data_repair'
        AND be.notes LIKE 'Duplicate temizliği (1.5 ay içi)%'
        AND be.notes !~ 'original_date=NULL'
    )
    SELECT
      p.teacher_id, p.student_id, p.package_cycle, p.amount_minutes,
      p.orig_date,
      COALESCE(p.orig_start, p.deleted_start) AS effective_start,
      p.orig_status
    FROM parsed p
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.lesson_instances li
      WHERE li.student_id  = r.student_id
        AND li.lesson_date = r.orig_date
        AND li.start_time  = r.effective_start
        AND li.status IN ('planned', 'completed')
    ) THEN
      v_skipped := v_skipped + 1;
      RAISE NOTICE 'SKIP (orig slot occupied): student=% % %',
        r.student_id, r.orig_date, r.effective_start;
      CONTINUE;
    END IF;

    v_dur_min := COALESCE(NULLIF(ABS(r.amount_minutes), 0), 30);

    SELECT COALESCE(MAX(lesson_number), 0) + 1
      INTO v_max_num
      FROM public.lesson_instances
     WHERE student_id    = r.student_id
       AND teacher_id    = r.teacher_id
       AND package_cycle = r.package_cycle;

    INSERT INTO public.lesson_instances (
      student_id, teacher_id, lesson_number,
      lesson_date, start_time, end_time,
      status, package_cycle,
      is_manual_override, rescheduled_count
    )
    VALUES (
      r.student_id, r.teacher_id, v_max_num,
      r.orig_date, r.effective_start,
      r.effective_start + (v_dur_min * INTERVAL '1 minute'),
      r.orig_status, r.package_cycle,
      false, 0
    );

    INSERT INTO public.balance_events (
      teacher_id, event_type, amount_minutes,
      student_id, package_cycle, notes
    )
    VALUES (
      r.teacher_id, 'data_repair',
      CASE WHEN r.orig_status = 'completed' THEN v_dur_min ELSE 0 END,
      r.student_id, r.package_cycle,
      format(
        'Geri yerleştirme: yanlışlıkla silinen shifted kayıt orijinal pozisyonuna (%s %s, status=%s) yeniden oluşturuldu.',
        r.orig_date::text, r.effective_start::text, r.orig_status
      )
    );

    IF r.orig_status = 'completed' THEN
      v_minutes_back := v_minutes_back + v_dur_min;
    END IF;
    v_inserted := v_inserted + 1;
  END LOOP;

  ----------------------------------------------------------------------
  -- 2) Yiğit's lesson 8: move back to its canonical position
  ----------------------------------------------------------------------
  SELECT li.id, li.teacher_id, li.student_id, li.package_cycle,
         li.lesson_date, li.start_time, li.end_time,
         li.original_date, li.original_start_time, li.original_end_time
    INTO v_l8
    FROM public.lesson_instances li
   WHERE li.student_id           = 'dabfdf47-a24a-4e20-aacd-fa6b7587d6fb'
     AND li.lesson_date          = DATE '2026-05-18'
     AND li.start_time           = TIME '18:40:00'
     AND li.original_start_time  = TIME '19:20:00'
     AND li.original_date        = DATE '2026-05-11'
     AND li.status               = 'planned'
   LIMIT 1;

  IF v_l8.id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.lesson_instances li2
      WHERE li2.student_id  = v_l8.student_id
        AND li2.lesson_date = v_l8.original_date
        AND li2.start_time  = v_l8.original_start_time
        AND li2.status IN ('planned', 'completed')
        AND li2.id <> v_l8.id
    ) THEN
      UPDATE public.lesson_instances
         SET lesson_date          = v_l8.original_date,
             start_time           = v_l8.original_start_time,
             end_time             = COALESCE(v_l8.original_end_time,
                                             v_l8.original_start_time + INTERVAL '30 minutes'),
             original_date        = NULL,
             original_start_time  = NULL,
             original_end_time    = NULL,
             rescheduled_count    = 0,
             is_manual_override   = false,
             updated_at           = now()
       WHERE id = v_l8.id;

      INSERT INTO public.balance_events (
        teacher_id, event_type, amount_minutes,
        instance_id, student_id, package_cycle, notes
      )
      VALUES (
        v_l8.teacher_id, 'data_repair', 0,
        v_l8.id, v_l8.student_id, v_l8.package_cycle,
        'Yanlış shifted düzeltmesi: Yiğit lesson 8 satırı orijinal pozisyonuna (2026-05-11 19:20) geri taşındı.'
      );
    END IF;
  END IF;

  ----------------------------------------------------------------------
  -- 3) Re-credit teacher_balance for the restored completed rows
  ----------------------------------------------------------------------
  UPDATE public.teacher_balance tb
     SET total_minutes              = tb.total_minutes              + agg.minutes_back,
         regular_lessons_minutes    = tb.regular_lessons_minutes    + agg.minutes_back,
         completed_regular_lessons  = tb.completed_regular_lessons  + agg.lessons_back,
         updated_at                 = now()
    FROM (
      SELECT teacher_id,
             SUM(amount_minutes)::int AS minutes_back,
             COUNT(*)::int            AS lessons_back
        FROM public.balance_events
       WHERE event_type = 'data_repair'
         AND notes LIKE 'Geri yerleştirme%'
         AND amount_minutes > 0
       GROUP BY teacher_id
    ) agg
   WHERE tb.teacher_id = agg.teacher_id;

  RAISE NOTICE 'Restored % rows (% skipped because original slot was occupied), refunded % minutes total.',
    v_inserted, v_skipped, v_minutes_back;
END $$;
