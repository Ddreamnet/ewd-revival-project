-- ============================================================================
-- "Geri Al" son hareketi geri alsın, en baştaki yeri değil
-- ============================================================================
-- Bildirilen hata: 14.09'daki iki ders bir gün öteye alındı, sonra "Geri Al"
-- dendiğinde ders 21.09'a gitmeye çalıştı ve "o saatte başka ders de var"
-- uyarısı çıktı. Elle 14.09'a geri konunca da "21.09 tarihinden taşındı"
-- rozeti duruyordu — oysa o derse 11 Eylül'den beri dokunulmamıştı.
--
-- Sebep: original_date "en baştaki yer" olarak davranıyordu. Taşıma sırasında
--
--     original_date = COALESCE(eski original_date, şu anki tarih)
--
-- yazıldığı için bir kez dolduktan sonra bir daha değişmiyordu. Yiğit'in
-- derslerinde o değer 11 Eylül'deki toplu kaydırmadan kalmaydı; bugünkü
-- taşımayla hiç ilgisi yoktu. Arayüzde ise aynı alan iki şey iddia ediyor:
-- rozette "bu ders şuradan taşındı", düğmede "Geri Al". İkisi de son hareketi
-- kastediyor, veri ise ilk hareketi tutuyordu.
--
-- İki değişiklik:
--
--   1. original_date artık bu taşımadan hemen önceki yeri tutuyor. Böylece
--      "Geri Al" tam olarak son hareketi geri alıyor. Arka arkaya iki taşıma
--      yapıldıysa iki kez geri almak gerekir — beklenen davranış bu.
--
--   2. Bir ders kendi kayıtlı çıkış noktasına geri konursa iz tamamen
--      siliniyor: rozet kalkar, sayaç sıfırlanır, elle sabitleme kalkar.
--      Götürüp geri getirmek artık hiçbir artık bırakmıyor.

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

  -- Ders, kayıtlı çıkış noktasına geri mi dönüyor? Öyleyse taşınma izi
  -- tamamen silinir; "götür-getir" hiçbir artık bırakmasın.
  SELECT jsonb_agg(
           e || jsonb_build_object('geriDonus',
             (v_before->(e->>'id')->>'od') IS NOT NULL
             AND (e->>'lessonDate')::date = (v_before->(e->>'id')->>'od')::date
             AND (e->>'startTime')::time = COALESCE(
                   (v_before->(e->>'id')->>'os')::time,
                   (v_before->(e->>'id')->>'s')::time))
           ORDER BY ord)
    INTO v_resolved
  FROM jsonb_array_elements(v_resolved) WITH ORDINALITY AS t(e, ord);

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
        WHEN COALESCE((e->>'clear')::boolean, false)
          OR COALESCE((e->>'geriDonus')::boolean, false) THEN NULL
        WHEN COALESCE((e->>'markOverride')::boolean, p_mark_override)
          THEN (v_before->(li.id::text)->>'d')::date
        ELSE li.original_date END,
      original_start_time = CASE
        WHEN COALESCE((e->>'clear')::boolean, false)
          OR COALESCE((e->>'geriDonus')::boolean, false) THEN NULL
        WHEN COALESCE((e->>'markOverride')::boolean, p_mark_override)
          THEN (v_before->(li.id::text)->>'s')::time
        ELSE li.original_start_time END,
      original_end_time = CASE
        WHEN COALESCE((e->>'clear')::boolean, false)
          OR COALESCE((e->>'geriDonus')::boolean, false) THEN NULL
        WHEN COALESCE((e->>'markOverride')::boolean, p_mark_override)
          THEN (v_before->(li.id::text)->>'e')::time
        ELSE li.original_end_time END,
      rescheduled_count = CASE
        WHEN COALESCE((e->>'clear')::boolean, false)
          OR COALESCE((e->>'geriDonus')::boolean, false) THEN 0
        WHEN COALESCE((e->>'markOverride')::boolean, p_mark_override)
          THEN COALESCE((v_before->(li.id::text)->>'rc')::integer, 0) + 1
        ELSE li.rescheduled_count END,
      is_manual_override = CASE
        WHEN COALESCE((e->>'clear')::boolean, false)
          OR COALESCE((e->>'geriDonus')::boolean, false) THEN false
        WHEN e ? 'manual' THEN (e->>'manual')::boolean
        ELSE li.is_manual_override END,
      shift_group_id = CASE
        WHEN COALESCE((e->>'geriDonus')::boolean, false) THEN NULL
        ELSE p_shift_group_id END,
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
