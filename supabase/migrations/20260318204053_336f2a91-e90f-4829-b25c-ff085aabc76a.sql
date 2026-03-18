
-- Phase B: Safe auto-repair of excess planned instances
-- Rules:
--   1. OVER_COMPLETED students (completed > total_rights): delete ALL planned in current cycle
--   2. EXCESS_PLANNED students (completed + planned > total_rights): keep earliest N planned, delete rest
--   3. Never touch completed instances
--   4. Never touch teacher_balance
--   5. Log deletions to balance_events with event_type = 'data_repair'

DO $$
DECLARE
  rec RECORD;
  v_total_rights integer;
  v_excess integer;
  v_keep_count integer;
  v_deleted_ids uuid[];
  v_deleted_count integer;
BEGIN
  FOR rec IN
    SELECT
      s.student_id,
      s.teacher_id,
      slt.package_cycle AS current_cycle,
      slt.lessons_per_week,
      slt.lessons_per_week * 4 AS total_rights,
      (SELECT count(*) FROM lesson_instances li
       WHERE li.student_id = s.student_id AND li.teacher_id = s.teacher_id
         AND li.status = 'completed' AND li.package_cycle = slt.package_cycle
      ) AS completed_in_cycle,
      (SELECT count(*) FROM lesson_instances li
       WHERE li.student_id = s.student_id AND li.teacher_id = s.teacher_id
         AND li.status = 'planned' AND li.package_cycle = slt.package_cycle
      ) AS planned_in_cycle,
      p.full_name AS student_name
    FROM students s
    JOIN profiles p ON p.user_id = s.student_id
    JOIN student_lesson_tracking slt ON slt.student_id = s.student_id AND slt.teacher_id = s.teacher_id
    WHERE s.is_archived = false
  LOOP
    v_total_rights := rec.total_rights;

    IF rec.completed_in_cycle > v_total_rights THEN
      -- OVER_COMPLETED: delete ALL planned in current cycle
      WITH deleted AS (
        DELETE FROM lesson_instances
        WHERE student_id = rec.student_id
          AND teacher_id = rec.teacher_id
          AND package_cycle = rec.current_cycle
          AND status = 'planned'
        RETURNING id
      )
      SELECT array_agg(id), count(*) INTO v_deleted_ids, v_deleted_count FROM deleted;

      IF v_deleted_count > 0 THEN
        INSERT INTO balance_events (teacher_id, event_type, amount_minutes, student_id, package_cycle, notes)
        VALUES (rec.teacher_id, 'data_repair', 0, rec.student_id, rec.current_cycle,
          format('OVER_COMPLETED repair: %s — deleted %s planned instances (completed=%s, rights=%s). MANUAL REVIEW REQUIRED.',
            rec.student_name, v_deleted_count, rec.completed_in_cycle, v_total_rights));
      END IF;

      RAISE NOTICE 'OVER_COMPLETED [MANUAL REVIEW]: % — completed=%, rights=%, deleted % planned',
        rec.student_name, rec.completed_in_cycle, v_total_rights, COALESCE(v_deleted_count, 0);

    ELSIF rec.completed_in_cycle + rec.planned_in_cycle > v_total_rights THEN
      -- EXCESS_PLANNED: keep earliest N planned, delete rest
      v_keep_count := v_total_rights - rec.completed_in_cycle;
      v_excess := rec.planned_in_cycle - v_keep_count;

      IF v_excess > 0 THEN
        WITH ranked_planned AS (
          SELECT id, ROW_NUMBER() OVER (ORDER BY lesson_date ASC, start_time ASC) AS rn
          FROM lesson_instances
          WHERE student_id = rec.student_id
            AND teacher_id = rec.teacher_id
            AND package_cycle = rec.current_cycle
            AND status = 'planned'
        ),
        deleted AS (
          DELETE FROM lesson_instances
          WHERE id IN (SELECT id FROM ranked_planned WHERE rn > v_keep_count)
          RETURNING id
        )
        SELECT array_agg(id), count(*) INTO v_deleted_ids, v_deleted_count FROM deleted;

        IF v_deleted_count > 0 THEN
          INSERT INTO balance_events (teacher_id, event_type, amount_minutes, student_id, package_cycle, notes)
          VALUES (rec.teacher_id, 'data_repair', 0, rec.student_id, rec.current_cycle,
            format('EXCESS_PLANNED repair: %s — deleted %s excess planned (kept %s, completed=%s, rights=%s)',
              rec.student_name, v_deleted_count, v_keep_count, rec.completed_in_cycle, v_total_rights));
        END IF;

        RAISE NOTICE 'EXCESS_PLANNED fixed: % — deleted % excess planned, kept %, completed=%, rights=%',
          rec.student_name, v_deleted_count, v_keep_count, rec.completed_in_cycle, v_total_rights;
      END IF;
    ELSE
      RAISE NOTICE 'OK: % — completed=%, planned=%, rights=%',
        rec.student_name, rec.completed_in_cycle, rec.planned_in_cycle, v_total_rights;
    END IF;
  END LOOP;
END $$;
