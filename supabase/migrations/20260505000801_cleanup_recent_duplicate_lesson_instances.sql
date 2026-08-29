-- ONE-OFF DATA REPAIR (recent duplicates, post-2026-03-19)
-- Removes the duplicate row in each (student_id, package_cycle, lesson_date,
-- start_time) group while preserving the most authoritative one.
--
-- Selection (ORDER BY for ROW_NUMBER):
--   1. status='completed' wins over status='planned'  (don't lose recorded work)
--   2. original_date IS NULL wins over NOT NULL       (keep the canonical row,
--      drop the wrongly-shifted copy that caused the duplicate)
--   3. lowest lesson_number, then earliest created_at (tie-break)
--
-- For every row removed, a balance_events 'data_repair' entry is written
-- (negative minutes if the row was 'completed') and teacher_balance is
-- decremented to match — the kept row keeps its original lesson_date /
-- start_time, so the schedule that admins/teachers see does NOT shift.

DO $$
DECLARE
  r record;
  v_total_deleted integer := 0;
  v_total_minutes_repaid integer := 0;
BEGIN
  CREATE TEMP TABLE _recent_dup_to_delete ON COMMIT DROP AS
  WITH dup_groups AS (
    SELECT student_id, package_cycle, lesson_date, start_time
    FROM public.lesson_instances
    WHERE lesson_date >= DATE '2026-03-19'
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
           li.original_date,
           li.original_start_time,
           (EXTRACT(EPOCH FROM (li.end_time - li.start_time)) / 60)::int AS duration_minutes,
           ROW_NUMBER() OVER (
             PARTITION BY li.student_id, li.package_cycle, li.lesson_date, li.start_time
             ORDER BY
               (li.status = 'completed') DESC,
               (li.original_date IS NULL)  DESC,
               li.lesson_number ASC,
               li.created_at ASC
           ) AS rnk
    FROM public.lesson_instances li
    JOIN dup_groups dg
      ON li.student_id    = dg.student_id
     AND li.package_cycle = dg.package_cycle
     AND li.lesson_date   = dg.lesson_date
     AND li.start_time    = dg.start_time
  )
  SELECT id, student_id, teacher_id, package_cycle, lesson_date, start_time,
         status, original_date, original_start_time, duration_minutes
  FROM ranked
  WHERE rnk > 1;

  FOR r IN
    SELECT id, student_id, teacher_id, package_cycle, lesson_date, start_time,
           status, original_date, original_start_time, duration_minutes
    FROM _recent_dup_to_delete
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
        'Duplicate temizliği (1.5 ay içi). Silinen kayıt: %s %s, status=%s, original_date=%s, original_start=%s. Tutulan kayıt aynı slotta kaldı.',
        r.lesson_date::text,
        r.start_time::text,
        r.status,
        COALESCE(r.original_date::text, 'NULL'),
        COALESCE(r.original_start_time::text, 'NULL')
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
           COUNT(*)              FILTER (WHERE status = 'completed')::int AS lessons_to_remove
    FROM _recent_dup_to_delete
    GROUP BY teacher_id
  ) agg
  WHERE tb.teacher_id = agg.teacher_id
    AND agg.minutes_to_remove > 0;

  DELETE FROM public.lesson_instances li
  USING _recent_dup_to_delete d
  WHERE li.id = d.id;

  RAISE NOTICE 'Recent duplicate cleanup complete: % rows removed, % completed-minutes refunded.',
    v_total_deleted, v_total_minutes_repaid;
END $$;
