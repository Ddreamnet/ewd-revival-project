-- Backfill 4 missing lesson_instances for 3 students whose cycle counts are
-- short of total_rights. Per the user's rule:
--   * past dates  -> status = 'completed' (and credit teacher_balance)
--   * future dates -> status = 'planned'  (no balance impact)
--
-- Slots chosen are the first empty (day_of_week, start_time) entries that
-- match each student's template, taken from the cycle's natural week
-- progression. All four slots happen to be in the past, so they're inserted
-- as 'completed'. The trigger prevents collisions if anything has changed.

DO $$
DECLARE
  v_today date := CURRENT_DATE;
  r record;
  v_status text;
  v_dur_min integer;
  v_max_num integer;
  v_inserted integer := 0;
  v_minutes_credited integer := 0;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      -- Ataberk (İsmail): lesson 4 -> original 03-22 17:00 (free)
      ('a741caf8-6a96-4de7-a972-cbfa96d1226b'::uuid, 'f871f4bd-1a9c-421a-ba7e-a9675c646996'::uuid, 1,
       DATE '2026-03-22', TIME '17:00:00', TIME '17:30:00',
       'Eski cleanup (1.5 ay öncesi) yanlışlıkla silinen lesson 4 orijinal pozisyonuna geri eklendi.'),
      -- Ataberk (İsmail): lesson 2 -> original 03-08 17:00 was full; fallback 03-08 17:40 (template ikinci slot)
      ('a741caf8-6a96-4de7-a972-cbfa96d1226b'::uuid, 'f871f4bd-1a9c-421a-ba7e-a9675c646996'::uuid, 1,
       DATE '2026-03-08', TIME '17:40:00', TIME '18:10:00',
       'Eski cleanup (1.5 ay öncesi) yanlışlıkla silinen lesson 2: orijinal 03-08 17:00 dolu olduğundan template ikinci slot 17:40''a yerleştirildi.'),
      -- Semih (Eren): missing 04-20 20:40 (template second slot of week 1)
      ('8688f89e-8f06-4f6f-95a3-0da237e4b95f'::uuid, '27ea08b6-8b79-4dd3-b3c0-c96d0767e58a'::uuid, 1,
       DATE '2026-04-20', TIME '20:40:00', TIME '21:10:00',
       'Cleanup sırasında yanlışlıkla silinen lesson 2: orijinal 04-27 20:00 dolu olduğundan haftanın template 20:40 slotuna yerleştirildi.'),
      -- Öykü (Hatice): missing Friday 04-24 19:20 (cycle 2 week 1 Friday slot)
      -- NOTE: This row uses the wrong teacher_id; the next migration corrects it.
      ('e620f6d3-ce01-4361-9752-48910c99ffbd'::uuid, '0db38a30-09a5-43d6-bf90-7e15ad7d5c44'::uuid, 2,
       DATE '2026-04-24', TIME '19:20:00', TIME '19:50:00',
       'Duplicate temizliğinde silinen lesson 4 (orig null): cycle 2 hafta 1''in eksik Cuma slotuna yerleştirildi.')
    ) AS s(student_id, teacher_id, package_cycle, lesson_date, start_time, end_time, reason_note)
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.lesson_instances li
      WHERE li.student_id  = r.student_id
        AND li.lesson_date = r.lesson_date
        AND li.start_time  = r.start_time
        AND li.status IN ('planned','completed')
    ) THEN
      RAISE NOTICE 'SKIP (slot already filled): student=% % %', r.student_id, r.lesson_date, r.start_time;
      CONTINUE;
    END IF;

    v_status := CASE WHEN r.lesson_date < v_today THEN 'completed' ELSE 'planned' END;
    v_dur_min := EXTRACT(EPOCH FROM (r.end_time - r.start_time))::int / 60;

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
      r.lesson_date, r.start_time, r.end_time,
      v_status, r.package_cycle,
      false, 0
    );

    INSERT INTO public.balance_events (
      teacher_id, event_type, amount_minutes,
      student_id, package_cycle, notes
    )
    VALUES (
      r.teacher_id, 'data_repair',
      CASE WHEN v_status = 'completed' THEN v_dur_min ELSE 0 END,
      r.student_id, r.package_cycle,
      format('Backfill (%s, kullanıcı kuralı: tarih geçmişse completed): %s. Slot %s %s.',
             v_status, r.reason_note, r.lesson_date::text, r.start_time::text)
    );

    IF v_status = 'completed' THEN
      v_minutes_credited := v_minutes_credited + v_dur_min;
    END IF;
    v_inserted := v_inserted + 1;
  END LOOP;

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
         AND notes LIKE 'Backfill (completed%'
         AND amount_minutes > 0
       GROUP BY teacher_id
    ) agg
   WHERE tb.teacher_id = agg.teacher_id;

  RAISE NOTICE 'Backfill complete: % rows inserted, % minutes credited.',
    v_inserted, v_minutes_credited;
END $$;
