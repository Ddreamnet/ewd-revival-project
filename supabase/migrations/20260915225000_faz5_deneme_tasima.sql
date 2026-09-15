-- Deneme dersinin öğrencisi ve paketi yok, dolayısıyla zinciri de yok:
-- rpc_apply_chain_dates tek öğrenci üzerine kurulu olduğu için denemeyi
-- "bu öğrenciye ait değil" diye reddediyordu. Taşıma denemede tek satırlık
-- bir iş; kendi yolunu alıyor ama aynı uyarı sözleşmesini döndürüyor.
CREATE OR REPLACE FUNCTION public.rpc_deneme_tasi(
  p_instance_id uuid, p_tarih date, p_bas time, p_bitis time)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_inst lesson_instances%ROWTYPE;
  v_uyarilar jsonb;
BEGIN
  SELECT * INTO v_inst FROM lesson_instances WHERE id = p_instance_id AND tur = 'deneme';
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Deneme dersi bulunamadı');
  END IF;
  IF NOT public.is_teacher_caller(v_inst.teacher_id) THEN
    RETURN json_build_object('success', false, 'error', 'Bu işlem için yetkiniz yok');
  END IF;
  IF p_tarih IS NULL OR p_bas IS NULL OR p_bitis IS NULL OR p_bitis <= p_bas THEN
    RETURN json_build_object('success', false, 'error', 'Geçersiz tarih veya saat');
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
           'date', li.lesson_date,
           'time', to_char(li.start_time,'HH24:MI') || ' - ' || to_char(li.end_time,'HH24:MI'),
           'student', CASE WHEN li.tur = 'deneme'
                           THEN COALESCE(li.aday_adi, 'Deneme Dersi')
                           ELSE COALESCE(pr.full_name, 'Bilinmeyen Öğrenci') END))
    INTO v_uyarilar
    FROM lesson_instances li
    LEFT JOIN students s ON s.student_id = li.student_id AND s.teacher_id = v_inst.teacher_id
    LEFT JOIN profiles pr ON pr.user_id = li.student_id
   WHERE li.teacher_id = v_inst.teacher_id AND li.lesson_date = p_tarih
     AND li.status IN ('planned','completed') AND li.id <> p_instance_id
     AND li.start_time < p_bitis AND li.end_time > p_bas
     AND COALESCE(s.is_archived, false) = false;

  UPDATE lesson_instances
     SET lesson_date = p_tarih,
         start_time = p_bas,
         end_time = p_bitis,
         original_date = COALESCE(original_date, v_inst.lesson_date),
         original_start_time = COALESCE(original_start_time, v_inst.start_time),
         original_end_time = COALESCE(original_end_time, v_inst.end_time),
         rescheduled_count = rescheduled_count + 1,
         is_manual_override = true,
         updated_at = now()
   WHERE id = p_instance_id;

  RETURN json_build_object('success', true, 'updated', 1,
                           'warnings', COALESCE(v_uyarilar, '[]'::jsonb));
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_deneme_tasi(uuid, date, time, time) FROM public;
REVOKE ALL ON FUNCTION public.rpc_deneme_tasi(uuid, date, time, time) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_deneme_tasi(uuid, date, time, time) TO authenticated;

-- Taşıma, geri alma ve erteleme: deneme dalını tanısınlar.
CREATE OR REPLACE FUNCTION public.rpc_move_lesson(
  p_instance_id uuid, p_date date, p_start time without time zone,
  p_end time without time zone, p_cascade boolean DEFAULT false)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_inst lesson_instances%ROWTYPE; v_tail uuid[]; v_all uuid[]; v_group uuid;
  v_updates jsonb; v_needed integer;
BEGIN
  SELECT * INTO v_inst FROM lesson_instances WHERE id = p_instance_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Ders bulunamadı');
  END IF;
  IF NOT public.is_teacher_caller(v_inst.teacher_id) THEN
    RETURN json_build_object('success', false, 'error', 'Bu işlem için yetkiniz yok');
  END IF;
  IF p_date IS NULL OR p_start IS NULL OR p_end IS NULL OR p_end <= p_start THEN
    RETURN json_build_object('success', false, 'error', 'Geçersiz tarih veya saat');
  END IF;

  -- Denemenin zinciri yok; kaydırma bayrağı anlamsız.
  IF v_inst.tur = 'deneme' THEN
    RETURN public.rpc_deneme_tasi(p_instance_id, p_date, p_start, p_end);
  END IF;

  IF NOT p_cascade THEN
    RETURN public.rpc_apply_chain_dates(v_inst.student_id, v_inst.teacher_id,
      jsonb_build_array(jsonb_build_object('id', p_instance_id, 'lessonDate', p_date,
        'startTime', p_start, 'endTime', p_end, 'markOverride', true, 'manual', true)),
      false, NULL);
  END IF;

  SELECT array_agg(id ORDER BY lesson_date, start_time, created_at) INTO v_tail
  FROM lesson_instances
  WHERE student_id = v_inst.student_id AND teacher_id = v_inst.teacher_id
    AND package_cycle = v_inst.package_cycle AND status = 'planned' AND tur = 'ders'
    AND id <> p_instance_id AND is_manual_override = false
    AND (lesson_date, start_time) > (v_inst.lesson_date, v_inst.start_time);

  v_tail := COALESCE(v_tail, '{}'::uuid[]);
  v_all := p_instance_id || v_tail;
  v_group := gen_random_uuid();
  v_needed := array_length(v_tail, 1);

  IF v_needed IS NULL THEN
    RETURN public.rpc_apply_chain_dates(v_inst.student_id, v_inst.teacher_id,
      jsonb_build_array(jsonb_build_object('id', p_instance_id, 'lessonDate', p_date,
        'startTime', p_start, 'endTime', p_end, 'markOverride', true, 'manual', false)),
      false, v_group);
  END IF;

  WITH targets AS (
    SELECT id, row_number() OVER (ORDER BY lesson_date, start_time, created_at) AS rn
    FROM lesson_instances WHERE id = ANY (v_tail)
  ),
  slots AS (
    SELECT lesson_date, start_time, end_time, row_number() OVER () AS rn
    FROM public.free_lesson_slots(v_inst.student_id, v_inst.teacher_id, v_needed,
                                  p_date, p_start, false, v_all)
  )
  SELECT jsonb_agg(jsonb_build_object('id', t.id, 'lessonDate', s.lesson_date,
           'startTime', s.start_time, 'endTime', s.end_time,
           'markOverride', true, 'manual', false) ORDER BY t.rn)
    INTO v_updates FROM targets t JOIN slots s ON s.rn = t.rn;

  IF v_updates IS NULL OR jsonb_array_length(v_updates) <> v_needed THEN
    RETURN json_build_object('success', false, 'error',
      'Öğrencinin haftalık ders programı tanımlı değil, sonraki dersler kaydırılamadı.');
  END IF;

  RETURN public.rpc_apply_chain_dates(v_inst.student_id, v_inst.teacher_id,
    jsonb_build_array(jsonb_build_object('id', p_instance_id, 'lessonDate', p_date,
      'startTime', p_start, 'endTime', p_end, 'markOverride', true, 'manual', false)) || v_updates,
    false, v_group);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_revert_lesson(p_instance_id uuid)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_inst lesson_instances%ROWTYPE;
  v_updates jsonb;
BEGIN
  SELECT * INTO v_inst FROM lesson_instances WHERE id = p_instance_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Ders bulunamadı');
  END IF;
  IF NOT public.is_teacher_caller(v_inst.teacher_id) THEN
    RETURN json_build_object('success', false, 'error', 'Bu işlem için yetkiniz yok');
  END IF;
  IF v_inst.original_date IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Geri alınacak bir değişiklik yok');
  END IF;

  IF v_inst.tur = 'deneme' THEN
    UPDATE lesson_instances
       SET lesson_date = v_inst.original_date,
           start_time = COALESCE(v_inst.original_start_time, start_time),
           end_time = COALESCE(v_inst.original_end_time, end_time),
           original_date = NULL, original_start_time = NULL, original_end_time = NULL,
           rescheduled_count = 0, is_manual_override = false, updated_at = now()
     WHERE id = p_instance_id;
    RETURN json_build_object('success', true, 'updated', 1, 'warnings', '[]'::jsonb);
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
           'id', li.id,
           'lessonDate', li.original_date,
           'startTime',  COALESCE(li.original_start_time, li.start_time),
           'endTime',    COALESCE(li.original_end_time,   li.end_time),
           'clear', true))
    INTO v_updates
  FROM lesson_instances li
  WHERE li.student_id = v_inst.student_id
    AND li.teacher_id = v_inst.teacher_id
    AND li.original_date IS NOT NULL
    AND (
      (v_inst.shift_group_id IS NOT NULL AND li.shift_group_id = v_inst.shift_group_id)
      OR (v_inst.shift_group_id IS NULL AND li.id = p_instance_id)
    );

  RETURN public.rpc_apply_chain_dates(
    v_inst.student_id, v_inst.teacher_id, v_updates, false, NULL);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_postpone_lesson(p_instance_id uuid)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_inst lesson_instances%ROWTYPE; v_ids uuid[];
BEGIN
  SELECT * INTO v_inst FROM lesson_instances WHERE id = p_instance_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Ders bulunamadı');
  END IF;
  IF NOT public.is_teacher_caller(v_inst.teacher_id) THEN
    RETURN json_build_object('success', false, 'error', 'Bu işlem için yetkiniz yok');
  END IF;
  IF v_inst.tur = 'deneme' THEN
    RETURN json_build_object('success', false, 'error',
      'Deneme dersinin zinciri yok; tarihini doğrudan değiştirin.');
  END IF;
  IF v_inst.status <> 'planned' AND NOT public.is_admin_caller() THEN
    RETURN json_build_object('success', false, 'error', 'İşlenmiş bir ders ertelenemez');
  END IF;

  SELECT array_agg(id ORDER BY lesson_date, start_time, created_at) INTO v_ids
  FROM lesson_instances
  WHERE student_id = v_inst.student_id AND teacher_id = v_inst.teacher_id
    AND package_cycle = v_inst.package_cycle AND tur = 'ders'
    AND (lesson_date, start_time) >= (v_inst.lesson_date, v_inst.start_time)
    AND (id = p_instance_id OR (status = 'planned' AND is_manual_override = false));

  RETURN public.rpc_relayout_chain(v_ids, v_inst.lesson_date, v_inst.start_time,
                                   false, true, gen_random_uuid());
END;
$function$;
