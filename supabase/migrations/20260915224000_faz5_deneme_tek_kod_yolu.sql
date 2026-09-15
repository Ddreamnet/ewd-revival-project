-- ============================================================================
-- Faz 5 (2/2) · Denemeye özel kod yolları kalkıyor
-- ============================================================================
-- Deneme dersleri artık lesson_instances içinde olduğu için, onları ayrıca
-- sorgulayan her yer gereksizleşti: yerleştirici, çakışma taraması ve sağlık
-- ölçütü zaten ders tablosunu tarıyor. İşlendi/geri al da tek yola indi.

-- 1) Yerleştirici: deneme dersleri zaten ders taramasında sayılıyor.
CREATE OR REPLACE FUNCTION public.free_lesson_slots(
  p_student_id uuid, p_teacher_id uuid, p_count integer, p_from_date date,
  p_from_time time without time zone DEFAULT NULL::time without time zone,
  p_inclusive boolean DEFAULT false, p_exclude uuid[] DEFAULT '{}'::uuid[],
  p_max_date date DEFAULT NULL::date)
RETURNS TABLE(lesson_date date, start_time time without time zone, end_time time without time zone)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_slots jsonb; v_slot jsonb; v_day date; v_offset integer; v_found integer := 0;
  v_pass integer; v_taken boolean; v_anahtar text; v_verilen text[] := '{}';
BEGIN
  IF p_count IS NULL OR p_count <= 0 THEN RETURN; END IF;

  SELECT jsonb_agg(jsonb_build_object('d', sl.day_of_week, 's', sl.start_time, 'e', sl.end_time)
                   ORDER BY sl.day_of_week, sl.start_time)
    INTO v_slots
  FROM student_lessons sl
  WHERE sl.student_id = p_student_id AND sl.teacher_id = p_teacher_id;

  IF v_slots IS NULL THEN RETURN; END IF;

  FOR v_pass IN 1..2 LOOP
    EXIT WHEN v_found >= p_count;
    v_offset := 0;

    WHILE v_offset <= 400 AND v_found < p_count LOOP
      v_day := p_from_date + v_offset;
      EXIT WHEN p_max_date IS NOT NULL AND v_day > p_max_date;

      FOR v_slot IN
        SELECT value FROM jsonb_array_elements(v_slots)
        WHERE (value->>'d')::integer = EXTRACT(DOW FROM v_day)::integer
        ORDER BY (value->>'s')::time
      LOOP
        EXIT WHEN v_found >= p_count;

        IF v_offset = 0 AND p_from_time IS NOT NULL THEN
          IF p_inclusive THEN
            CONTINUE WHEN (v_slot->>'s')::time < p_from_time;
          ELSE
            CONTINUE WHEN (v_slot->>'s')::time <= p_from_time;
          END IF;
        END IF;

        v_anahtar := v_day::text || '|' || (v_slot->>'s');
        CONTINUE WHEN v_anahtar = ANY (v_verilen);

        -- Sert kural: öğrencinin kendi dersi. Denemenin öğrencisi olmadığı
        -- için (student_id NULL) bu kontrole hiç takılmaz.
        SELECT EXISTS (
          SELECT 1 FROM lesson_instances li
          WHERE li.student_id = p_student_id AND li.lesson_date = v_day
            AND li.status IN ('planned', 'completed')
            AND NOT (li.id = ANY (COALESCE(p_exclude, '{}'::uuid[])))
            AND li.start_time < (v_slot->>'e')::time
            AND li.end_time   > (v_slot->>'s')::time
        ) INTO v_taken;
        CONTINUE WHEN v_taken;

        IF v_pass = 1 THEN
          -- Öğretmenin takvimi: normal dersler ve deneme dersleri bir arada.
          -- Arşivli öğrencilerin eski kayıtları sayılmaz; denemede öğrenci
          -- satırı olmadığı için LEFT JOIN boş kalır ve dolu sayılır.
          SELECT EXISTS (
            SELECT 1 FROM lesson_instances li
            LEFT JOIN students st ON st.student_id = li.student_id AND st.teacher_id = li.teacher_id
            WHERE li.teacher_id = p_teacher_id AND li.lesson_date = v_day
              AND li.status IN ('planned', 'completed')
              AND NOT (li.id = ANY (COALESCE(p_exclude, '{}'::uuid[])))
              AND COALESCE(st.is_archived, false) = false
              AND li.start_time < (v_slot->>'e')::time
              AND li.end_time   > (v_slot->>'s')::time
          ) INTO v_taken;
          CONTINUE WHEN v_taken;
        END IF;

        lesson_date := v_day;
        start_time  := (v_slot->>'s')::time;
        end_time    := (v_slot->>'e')::time;
        v_found     := v_found + 1;
        v_verilen   := v_verilen || v_anahtar;
        RETURN NEXT;
      END LOOP;

      v_offset := v_offset + 1;
    END LOOP;
  END LOOP;
END;
$function$;

-- 2) Çakışma uyarısı: tek tarama, denemeler adıyla görünüyor.
CREATE OR REPLACE FUNCTION public.rpc_apply_chain_dates(
  p_student_id uuid, p_teacher_id uuid, p_updates jsonb,
  p_mark_override boolean DEFAULT false, p_shift_group_id uuid DEFAULT NULL::uuid)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer := 0; v_cycle integer; v_before jsonb; v_resolved jsonb;
  v_ids uuid[]; v_uyarilar jsonb;
BEGIN
  IF NOT public.is_teacher_caller(p_teacher_id) THEN
    RETURN json_build_object('success', false, 'error', 'Bu işlem için yetkiniz yok');
  END IF;
  IF p_updates IS NULL OR jsonb_array_length(p_updates) = 0 THEN
    RETURN json_build_object('success', false, 'error', 'Taşınacak ders bulunamadı');
  END IF;

  SELECT array_agg((e->>'id')::uuid) INTO v_ids FROM jsonb_array_elements(p_updates) e;

  PERFORM 1 FROM lesson_instances
   WHERE teacher_id = p_teacher_id AND student_id = p_student_id FOR UPDATE;

  SELECT jsonb_object_agg(li.id::text, jsonb_build_object(
           'd', li.lesson_date, 's', li.start_time, 'e', li.end_time,
           'od', li.original_date, 'os', li.original_start_time,
           'oe', li.original_end_time, 'rc', li.rescheduled_count))
    INTO v_before
  FROM lesson_instances li
  WHERE li.id = ANY (v_ids) AND li.student_id = p_student_id AND li.teacher_id = p_teacher_id;

  IF v_before IS NULL OR (SELECT count(*) FROM jsonb_object_keys(v_before)) <> array_length(v_ids, 1) THEN
    RETURN json_build_object('success', false, 'error', 'Ders bulunamadı veya bu öğrenciye ait değil');
  END IF;

  SELECT jsonb_agg(
           CASE
             WHEN e ? 'startTime' AND e->>'startTime' IS NOT NULL THEN e
             ELSE e || COALESCE(
               (SELECT jsonb_build_object('startTime', fs.start_time, 'endTime', fs.end_time)
                  FROM public.free_lesson_slots(p_student_id, p_teacher_id, 1,
                         (e->>'lessonDate')::date, NULL, true, v_ids, (e->>'lessonDate')::date) fs
                 LIMIT 1),
               jsonb_build_object('startTime', v_before->(e->>'id')->>'s',
                                  'endTime',   v_before->(e->>'id')->>'e'))
           END ORDER BY ord)
    INTO v_resolved
  FROM jsonb_array_elements(p_updates) WITH ORDINALITY AS t(e, ord);

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_resolved) e
    GROUP BY e->>'lessonDate', e->>'startTime' HAVING count(*) > 1
  ) THEN
    RETURN json_build_object('success', false, 'error',
      'Aynı tarih ve saate birden fazla ders atanamaz. Tarihleri tek tek değiştirin.');
  END IF;

  WITH cakisan AS (
    SELECT DISTINCT (e->>'lessonDate')::date AS tarih,
           to_char((e->>'startTime')::time, 'HH24:MI') || ' - ' ||
           to_char((e->>'endTime')::time, 'HH24:MI') AS saat,
           CASE WHEN li.tur = 'deneme'
                THEN COALESCE(li.aday_adi, 'Deneme Dersi')
                ELSE COALESCE(pr.full_name, 'Bilinmeyen Öğrenci') END AS kim
      FROM jsonb_array_elements(v_resolved) e
      JOIN lesson_instances li
        ON li.teacher_id = p_teacher_id AND li.lesson_date = (e->>'lessonDate')::date
       AND li.status IN ('planned', 'completed')
       AND li.start_time < (e->>'endTime')::time AND li.end_time > (e->>'startTime')::time
       AND NOT (li.id = ANY (v_ids))
      LEFT JOIN students s ON s.student_id = li.student_id AND s.teacher_id = p_teacher_id
      LEFT JOIN profiles pr ON pr.user_id = li.student_id
     WHERE COALESCE(s.is_archived, false) = false
  )
  SELECT jsonb_agg(jsonb_build_object('date', tarih, 'time', saat, 'student', kim)
                   ORDER BY tarih, saat)
    INTO v_uyarilar FROM cakisan;

  UPDATE lesson_instances li
  SET lesson_date = DATE '9999-01-01' + (u.ord - 1)::integer
  FROM (SELECT (e->>'id')::uuid AS id, row_number() OVER () AS ord
          FROM jsonb_array_elements(v_resolved) e) u
  WHERE li.id = u.id AND li.student_id = p_student_id AND li.teacher_id = p_teacher_id;

  UPDATE lesson_instances li
  SET lesson_date = (e->>'lessonDate')::date,
      start_time  = (e->>'startTime')::time,
      end_time    = (e->>'endTime')::time,
      original_date = CASE
        WHEN COALESCE((e->>'clear')::boolean, false) THEN NULL
        WHEN COALESCE((e->>'markOverride')::boolean, p_mark_override)
          THEN COALESCE((v_before->(li.id::text)->>'od')::date, (v_before->(li.id::text)->>'d')::date)
        ELSE li.original_date END,
      original_start_time = CASE
        WHEN COALESCE((e->>'clear')::boolean, false) THEN NULL
        WHEN COALESCE((e->>'markOverride')::boolean, p_mark_override)
          THEN COALESCE((v_before->(li.id::text)->>'os')::time, (v_before->(li.id::text)->>'s')::time)
        ELSE li.original_start_time END,
      original_end_time = CASE
        WHEN COALESCE((e->>'clear')::boolean, false) THEN NULL
        WHEN COALESCE((e->>'markOverride')::boolean, p_mark_override)
          THEN COALESCE((v_before->(li.id::text)->>'oe')::time, (v_before->(li.id::text)->>'e')::time)
        ELSE li.original_end_time END,
      rescheduled_count = CASE
        WHEN COALESCE((e->>'clear')::boolean, false) THEN 0
        WHEN COALESCE((e->>'markOverride')::boolean, p_mark_override)
          THEN COALESCE((v_before->(li.id::text)->>'rc')::integer, 0) + 1
        ELSE li.rescheduled_count END,
      is_manual_override = CASE
        WHEN COALESCE((e->>'clear')::boolean, false) THEN false
        WHEN e ? 'manual' THEN (e->>'manual')::boolean
        ELSE li.is_manual_override END,
      shift_group_id = p_shift_group_id,
      updated_at = now()
  FROM jsonb_array_elements(v_resolved) e
  WHERE li.id = (e->>'id')::uuid AND li.student_id = p_student_id AND li.teacher_id = p_teacher_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  SELECT package_cycle INTO v_cycle FROM student_lesson_tracking
   WHERE student_id = p_student_id AND teacher_id = p_teacher_id;
  v_cycle := COALESCE(v_cycle, 1);

  WITH ordered AS (
    SELECT id, row_number() OVER (ORDER BY lesson_date, start_time, created_at) AS rn
    FROM lesson_instances
    WHERE student_id = p_student_id AND teacher_id = p_teacher_id
      AND package_cycle = v_cycle AND status IN ('planned', 'completed')
  )
  UPDATE lesson_instances li SET lesson_number = -o.rn
  FROM ordered o WHERE li.id = o.id AND li.lesson_number <> o.rn;

  UPDATE lesson_instances SET lesson_number = -lesson_number
  WHERE student_id = p_student_id AND teacher_id = p_teacher_id
    AND package_cycle = v_cycle AND lesson_number < 0;

  RETURN json_build_object('success', true, 'updated', v_count, 'cycle', v_cycle,
                           'placements', v_resolved,
                           'warnings', COALESCE(v_uyarilar, '[]'::jsonb));
END;
$function$;

-- 3) İşlendi / geri al: tek yol, türe göre dallanıyor.
CREATE OR REPLACE FUNCTION public.rpc_complete_lesson_impl(p_instance_id uuid, p_teacher_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_instance lesson_instances%ROWTYPE;
  v_duration_minutes integer;
  v_current_cycle integer;
  v_first_planned_id uuid;
BEGIN
  SELECT * INTO v_instance FROM lesson_instances
   WHERE id = p_instance_id AND teacher_id = p_teacher_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Instance not found');
  END IF;
  IF v_instance.status = 'completed' THEN
    RETURN json_build_object('success', false, 'error', 'Already completed');
  END IF;

  v_duration_minutes := EXTRACT(EPOCH FROM (v_instance.end_time - v_instance.start_time)) / 60;

  -- Deneme dersinin paketi ve sırası yok: doğrudan işaretlenir.
  IF v_instance.tur = 'deneme' THEN
    UPDATE lesson_instances SET status = 'completed', updated_at = now() WHERE id = p_instance_id;

    INSERT INTO balance_events (teacher_id, event_type, amount_minutes, instance_id, notes)
    VALUES (p_teacher_id, 'trial_complete', v_duration_minutes, p_instance_id,
            'Deneme dersi · ' || v_instance.lesson_date::text ||
            COALESCE(' · ' || v_instance.aday_adi, ''));

    RETURN json_build_object('success', true, 'duration_minutes', v_duration_minutes, 'tur', 'deneme');
  END IF;

  SELECT package_cycle INTO v_current_cycle FROM student_lesson_tracking
   WHERE student_id = v_instance.student_id AND teacher_id = p_teacher_id;
  v_current_cycle := COALESCE(v_current_cycle, 1);

  SELECT id INTO v_first_planned_id FROM lesson_instances
   WHERE student_id = v_instance.student_id AND teacher_id = p_teacher_id
     AND status = 'planned' AND package_cycle = v_current_cycle AND tur = 'ders'
   ORDER BY lesson_date ASC, start_time ASC LIMIT 1;

  IF v_first_planned_id IS NULL OR v_first_planned_id != p_instance_id THEN
    RETURN json_build_object('success', false, 'error', 'Not the next completable lesson');
  END IF;

  UPDATE lesson_instances SET status = 'completed', updated_at = now() WHERE id = p_instance_id;

  INSERT INTO balance_events (teacher_id, event_type, amount_minutes, instance_id, student_id, package_cycle)
  VALUES (p_teacher_id, 'lesson_complete', v_duration_minutes, p_instance_id, v_instance.student_id, v_current_cycle);

  RETURN json_build_object('success', true, 'duration_minutes', v_duration_minutes);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_undo_complete_lesson_impl(p_instance_id uuid, p_teacher_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_instance lesson_instances%ROWTYPE;
  v_duration_minutes integer;
  v_current_cycle integer;
  v_last_completed_id uuid;
BEGIN
  SELECT * INTO v_instance FROM lesson_instances
   WHERE id = p_instance_id AND teacher_id = p_teacher_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Instance not found');
  END IF;
  IF v_instance.status != 'completed' THEN
    RETURN json_build_object('success', false, 'error', 'Instance is not completed');
  END IF;

  v_duration_minutes := EXTRACT(EPOCH FROM (v_instance.end_time - v_instance.start_time)) / 60;

  IF v_instance.tur = 'deneme' THEN
    UPDATE lesson_instances SET status = 'planned', updated_at = now() WHERE id = p_instance_id;

    INSERT INTO balance_events (teacher_id, event_type, amount_minutes, instance_id, notes)
    VALUES (p_teacher_id, 'trial_undo', -v_duration_minutes, p_instance_id,
            'Deneme dersi geri alındı · ' || v_instance.lesson_date::text);

    RETURN json_build_object('success', true, 'duration_minutes', v_duration_minutes, 'tur', 'deneme');
  END IF;

  SELECT package_cycle INTO v_current_cycle FROM student_lesson_tracking
   WHERE student_id = v_instance.student_id AND teacher_id = p_teacher_id;
  v_current_cycle := COALESCE(v_current_cycle, 1);

  SELECT id INTO v_last_completed_id FROM lesson_instances
   WHERE student_id = v_instance.student_id AND teacher_id = p_teacher_id
     AND status = 'completed' AND package_cycle = v_current_cycle AND tur = 'ders'
   ORDER BY lesson_date DESC, start_time DESC LIMIT 1;

  IF v_last_completed_id IS NULL OR v_last_completed_id != p_instance_id THEN
    RETURN json_build_object('success', false, 'error', 'Can only undo the most recent completed lesson');
  END IF;

  UPDATE lesson_instances SET status = 'planned', updated_at = now() WHERE id = p_instance_id;

  INSERT INTO balance_events (teacher_id, event_type, amount_minutes, instance_id, student_id, package_cycle)
  VALUES (p_teacher_id, 'lesson_undo', -v_duration_minutes, p_instance_id, v_instance.student_id, v_current_cycle);

  DELETE FROM admin_notifications
   WHERE student_id = v_instance.student_id AND teacher_id = p_teacher_id
     AND notification_type = 'last_lesson_warning'
     AND created_at > (CURRENT_DATE - INTERVAL '1 day');

  RETURN json_build_object('success', true, 'duration_minutes', v_duration_minutes);
END;
$function$;

-- Eski istemci hâlâ bu adları çağırıyor; artık ikisi de aynı yola giriyor.
CREATE OR REPLACE FUNCTION public.rpc_complete_trial_lesson_impl(p_trial_id uuid, p_teacher_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  RETURN public.rpc_complete_lesson_impl(p_trial_id, p_teacher_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_undo_trial_lesson_impl(p_trial_id uuid, p_teacher_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  RETURN public.rpc_undo_complete_lesson_impl(p_trial_id, p_teacher_id);
END;
$function$;

-- 4) Deneme dersi ekleme: artık istemci doğrudan tabloya yazmıyor.
CREATE OR REPLACE FUNCTION public.rpc_deneme_ekle(
  p_teacher_id uuid, p_tarih date, p_bas time, p_bitis time, p_aday_adi text DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
  v_uyarilar jsonb;
BEGIN
  IF NOT public.is_teacher_caller(p_teacher_id) THEN
    RETURN json_build_object('success', false, 'error', 'Bu işlem için yetkiniz yok');
  END IF;
  IF p_tarih IS NULL OR p_bas IS NULL OR p_bitis IS NULL OR p_bitis <= p_bas THEN
    RETURN json_build_object('success', false, 'error', 'Geçersiz tarih veya saat');
  END IF;

  -- Çakışma engel değil, uyarı (K5).
  SELECT jsonb_agg(jsonb_build_object(
           'date', li.lesson_date,
           'time', to_char(li.start_time,'HH24:MI') || ' - ' || to_char(li.end_time,'HH24:MI'),
           'student', CASE WHEN li.tur = 'deneme'
                           THEN COALESCE(li.aday_adi, 'Deneme Dersi')
                           ELSE COALESCE(pr.full_name, 'Bilinmeyen Öğrenci') END))
    INTO v_uyarilar
    FROM lesson_instances li
    LEFT JOIN students s ON s.student_id = li.student_id AND s.teacher_id = p_teacher_id
    LEFT JOIN profiles pr ON pr.user_id = li.student_id
   WHERE li.teacher_id = p_teacher_id AND li.lesson_date = p_tarih
     AND li.status IN ('planned','completed')
     AND li.start_time < p_bitis AND li.end_time > p_bas
     AND COALESCE(s.is_archived, false) = false;

  INSERT INTO lesson_instances
    (student_id, teacher_id, lesson_number, lesson_date, start_time, end_time,
     status, package_cycle, tur, aday_adi)
  VALUES (NULL, p_teacher_id, 0, p_tarih, p_bas, p_bitis, 'planned', 1, 'deneme',
          nullif(btrim(p_aday_adi), ''))
  RETURNING id INTO v_id;

  RETURN json_build_object('success', true, 'id', v_id,
                           'warnings', COALESCE(v_uyarilar, '[]'::jsonb));
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_deneme_ekle(uuid, date, time, time, text) FROM public;
REVOKE ALL ON FUNCTION public.rpc_deneme_ekle(uuid, date, time, time, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_deneme_ekle(uuid, date, time, time, text) TO authenticated;
