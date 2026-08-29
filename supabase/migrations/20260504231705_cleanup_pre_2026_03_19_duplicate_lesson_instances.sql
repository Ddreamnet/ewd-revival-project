-- ONE-OFF DATA REPAIR
-- Removes duplicate lesson_instances older than 2026-03-19 (~1.5 months back),
-- and reverses each removed completed lesson out of teacher_balance via a
-- balance_events 'data_repair' entry — so the balance stays consistent with
-- the rows that remain.
--
-- Newer duplicates (>= 2026-03-19) are intentionally left in place — they
-- are reported separately for manual resolution.
--
-- Selection rule per (student_id, package_cycle, lesson_date, start_time)
-- group: keep the row with the lowest lesson_number (the original sequence
-- entry); delete the rest. Ties broken by oldest created_at.

DO $$
DECLARE
  r record;
  v_total_deleted integer := 0;
  v_total_minutes_repaid integer := 0;
BEGIN
  CREATE TEMP TABLE _dup_to_delete ON COMMIT DROP AS
  WITH dup_groups AS (
    SELECT student_id, package_cycle, lesson_date, start_time
    FROM public.lesson_instances
    WHERE lesson_date < DATE '2026-03-19'
    GROUP BY student_id, package_cycle, lesson_date, start_time
    HAVING COUNT(*) > 1
  ),
  ranked AS (
    SELECT li.id,
           li.student_id,
           li.teacher_id,
           li.package_cycle,
           li.lesson_date,
           li.start_time,
           li.end_time,
           li.status,
           (EXTRACT(EPOCH FROM (li.end_time - li.start_time)) / 60)::int AS duration_minutes,
           ROW_NUMBER() OVER (
             PARTITION BY li.student_id, li.package_cycle, li.lesson_date, li.start_time
             ORDER BY li.lesson_number ASC, li.created_at ASC
           ) AS rnk
    FROM public.lesson_instances li
    JOIN dup_groups dg
      ON li.student_id    = dg.student_id
     AND li.package_cycle = dg.package_cycle
     AND li.lesson_date   = dg.lesson_date
     AND li.start_time    = dg.start_time
  )
  SELECT id, student_id, teacher_id, package_cycle, lesson_date, start_time,
         status, duration_minutes
  FROM ranked
  WHERE rnk > 1;

  FOR r IN
    SELECT id, student_id, teacher_id, package_cycle, lesson_date, start_time, status, duration_minutes
    FROM _dup_to_delete
  LOOP
    INSERT INTO public.balance_events (
      teacher_id, event_type, amount_minutes, instance_id, student_id, package_cycle, notes
    )
    VALUES (
      r.teacher_id,
      'data_repair',
      CASE WHEN r.status = 'completed' THEN -r.duration_minutes ELSE 0 END,
      r.id,
      r.student_id,
      r.package_cycle,
      format(
        'Eski duplicate temizliği (1.5 ay öncesi). %s dersi silindi: %s %s. Status=%s.',
        r.lesson_date::text,
        r.lesson_date::text,
        r.start_time::text,
        r.status
      )
    );

    IF r.status = 'completed' THEN
      v_total_minutes_repaid := v_total_minutes_repaid + r.duration_minutes;
    END IF;
    v_total_deleted := v_total_deleted + 1;
  END LOOP;

  UPDATE public.teacher_balance tb
  SET total_minutes              = GREATEST(0, tb.total_minutes              - agg.minutes_to_remove),
      regular_lessons_minutes    = GREATEST(0, tb.regular_lessons_minutes    - agg.minutes_to_remove),
      completed_regular_lessons  = GREATEST(0, tb.completed_regular_lessons  - agg.lessons_to_remove),
      updated_at                 = now()
  FROM (
    SELECT teacher_id,
           SUM(duration_minutes) FILTER (WHERE status = 'completed')::int AS minutes_to_remove,
           COUNT(*) FILTER (WHERE status = 'completed')::int              AS lessons_to_remove
    FROM _dup_to_delete
    GROUP BY teacher_id
  ) agg
  WHERE tb.teacher_id = agg.teacher_id
    AND agg.minutes_to_remove > 0;

  DELETE FROM public.lesson_instances li
  USING _dup_to_delete d
  WHERE li.id = d.id;

  RAISE NOTICE 'Cleanup complete: % rows removed, % minutes refunded across teachers.',
    v_total_deleted, v_total_minutes_repaid;
END $$;
