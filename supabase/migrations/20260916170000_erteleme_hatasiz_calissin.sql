-- ============================================================================
-- Erteleme yüzeyi: adminin karşısına hata çıkmasın
-- ============================================================================
-- 22 senaryo izole bir kurgu üzerinde tek tek koşuldu; dokuzu hata veriyordu.
-- Hepsinin karşılığı burada.
--
--  4  Kendi dersinin üstüne taşıma  → HAM POSTGRES İSTİSNASI. Tetikleyici
--     (prevent_duplicate_lesson_instance) doğru bir kuralı savunuyor — öğrenci
--     aynı dakikada iki derste olamaz — ama RAISE ile bütün işlemi düşürüyor
--     ve istemciye ham 23505 gidiyordu. Artık önceden yakalanıp anlaşılır bir
--     cevap dönüyor; tetikleyici son güvenlik ağı olarak yerinde kalıyor.
--
--  6  Kaydırmalı taşıma, şablonsuz öğrenci  → Hiçbir şey yapılmıyordu.
--     Artık tıklanan ders taşınıyor, sonrakiler de başın gittiği kadar gün
--     ileri kayıyor. Şablona ihtiyaç yok.
--
-- 13  "Bu ders yapılmadı", şablonsuz öğrenci  → Aynı sebep.
-- 19  "Ara ver", şablonsuz öğrenci            → Aynı sebep.
--     rpc_relayout_chain yerleştirici boş dönerse artık pes etmiyor: tüm
--     dersleri tam hafta katı kadar ileri kaydırıyor. Haftalık ritim korunur,
--     gün adları değişmez.
--
-- 10  Taşınmamış derste "Geri Al"      → İstenen durum zaten geçerli.
-- 24  Aynı dersi ikinci kez işaretleme → İstenen durum zaten geçerli.
-- 26  İşlenmemiş dersi geri alma       → İstenen durum zaten geçerli.
--     Üçü de artık başarı dönüyor ve 'not' alanıyla ne olduğunu söylüyor.
--     Kırmızı hata değil; çünkü kullanıcının istediği sonuç zaten sağlanmış.
--
-- 23  Sıradan olmayan dersi işaretleme → Gerçek bir kural (dersler sırayla
--     işlenir), ama mesajı İngilizceydi. Artık Türkçe ve sıradaki dersin
--     tarihini söylüyor.
--
-- 21  İki dersi aynı tarih+saate alma  → Gerçek bir kural (bkz. 4), mesaj
--     hangi tarih/saat olduğunu söylüyor.
--
-- Ayrıca: rpc_gunu_ertele kaydıramadığı öğrencileri sessizce atlıyordu. Artık
-- sayısını ve adlarını döndürüyor.

-- ─────────────────────────────────────────────────────────────────────────
-- 1) Zincir yazıcısı: kendi üstüne binmeyi nazikçe reddet
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_apply_chain_dates(
  p_student_id uuid, p_teacher_id uuid, p_updates jsonb,
  p_mark_override boolean DEFAULT false, p_shift_group_id uuid DEFAULT NULL::uuid)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer := 0; v_cycle integer; v_before jsonb; v_resolved jsonb;
  v_ids uuid[]; v_uyarilar jsonb; v_cakisan jsonb;
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

  -- Aynı gönderimde iki ders aynı yere düşüyor mu?
  SELECT jsonb_build_object('date', e->>'lessonDate', 'time', e->>'startTime')
    INTO v_cakisan
  FROM jsonb_array_elements(v_resolved) e
  GROUP BY e->>'lessonDate', e->>'startTime'
  HAVING count(*) > 1
  LIMIT 1;

  IF v_cakisan IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error',
      to_char((v_cakisan->>'date')::date, 'DD.MM.YYYY') || ' ' ||
      to_char((v_cakisan->>'time')::time, 'HH24:MI') ||
      ' saatine aynı anda iki ders koyamazsınız. Tarihleri tek tek değiştirin.');
  END IF;

  -- Öğrencinin kendi takvimiyle çakışma. Bu bir tercih değil veri kuralı:
  -- bir öğrenci aynı dakikada iki derste olamaz. Tetikleyici de aynı şeyi
  -- söylüyor ama ham istisna fırlatıp bütün işlemi düşürüyordu; burada
  -- önceden yakalanıp anlaşılır bir cevap dönüyor.
  SELECT jsonb_build_object('date', e->>'lessonDate', 'time', e->>'startTime')
    INTO v_cakisan
  FROM jsonb_array_elements(v_resolved) e
  WHERE EXISTS (
    SELECT 1 FROM lesson_instances li2
     WHERE li2.student_id = p_student_id
       AND li2.lesson_date = (e->>'lessonDate')::date
       AND li2.start_time = (e->>'startTime')::time
       AND li2.status IN ('planned', 'completed')
       AND NOT (li2.id = ANY (v_ids)))
  LIMIT 1;

  IF v_cakisan IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error',
      'Bu öğrencinin ' || to_char((v_cakisan->>'date')::date, 'DD.MM.YYYY') || ' ' ||
      to_char((v_cakisan->>'time')::time, 'HH24:MI') ||
      ' saatinde zaten bir dersi var. Aynı anda iki derste olamaz — başka bir saat seçin.');
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

-- ─────────────────────────────────────────────────────────────────────────
-- 2) Zincir yerleştirici: şablon yoksa tam hafta kaydır
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_relayout_chain(
  p_instance_ids uuid[], p_from_date date,
  p_from_time time without time zone DEFAULT NULL::time without time zone,
  p_inclusive boolean DEFAULT false, p_mark_override boolean DEFAULT false,
  p_shift_group_id uuid DEFAULT NULL::uuid)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_student uuid; v_teacher uuid; v_distinct integer; v_needed integer; v_updates jsonb;
  v_ilk date; v_gerek integer; v_delta integer;
BEGIN
  IF p_instance_ids IS NULL OR array_length(p_instance_ids, 1) IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Taşınacak ders bulunamadı');
  END IF;

  SELECT count(*), count(DISTINCT student_id) + count(DISTINCT teacher_id)
    INTO v_needed, v_distinct FROM lesson_instances WHERE id = ANY (p_instance_ids);

  IF v_needed <> array_length(p_instance_ids, 1) OR v_distinct <> 2 THEN
    RETURN json_build_object('success', false, 'error', 'Dersler tek bir öğrenciye ait olmalı');
  END IF;

  SELECT student_id, teacher_id INTO v_student, v_teacher
  FROM lesson_instances WHERE id = p_instance_ids[1];

  IF NOT public.is_teacher_caller(v_teacher) THEN
    RETURN json_build_object('success', false, 'error', 'Bu işlem için yetkiniz yok');
  END IF;

  WITH targets AS (
    SELECT id, row_number() OVER (ORDER BY lesson_date, start_time, created_at) AS rn
    FROM lesson_instances WHERE id = ANY (p_instance_ids)
  ),
  slots AS (
    SELECT lesson_date, start_time, end_time, row_number() OVER () AS rn
    FROM public.free_lesson_slots(v_student, v_teacher, v_needed,
                                  p_from_date, p_from_time, p_inclusive, p_instance_ids)
  )
  SELECT jsonb_agg(jsonb_build_object('id', t.id, 'lessonDate', s.lesson_date,
           'startTime', s.start_time, 'endTime', s.end_time,
           'markOverride', p_mark_override, 'manual', false) ORDER BY t.rn)
    INTO v_updates FROM targets t JOIN slots s ON s.rn = t.rn;

  -- Yerleştirici yeterli slot bulamadı: öğrencinin haftalık şablonu yok ya da
  -- eksik. Eskiden burada pes ediliyordu ve admin "haftalık ders programı
  -- tanımlı değil" hatası alıyordu — yani sistem işini yapmayı reddediyordu.
  -- Artık tam hafta katı kadar kaydırıyoruz: gün adları ve saatler korunur,
  -- dersler arası boşluk aynı kalır, şablona ihtiyaç duyulmaz.
  IF v_updates IS NULL OR jsonb_array_length(v_updates) <> v_needed THEN
    SELECT min(lesson_date) INTO v_ilk FROM lesson_instances WHERE id = ANY (p_instance_ids);

    v_gerek := (p_from_date - v_ilk) + CASE WHEN p_inclusive THEN 0 ELSE 1 END;
    v_delta := CASE
                 WHEN v_gerek <= 0 THEN CASE WHEN p_inclusive THEN 0 ELSE 7 END
                 ELSE ceil(v_gerek / 7.0)::integer * 7
               END;

    IF v_delta = 0 THEN
      RETURN json_build_object('success', true, 'updated', 0, 'warnings', '[]'::jsonb,
                               'note', 'Kaydırılacak ders yok');
    END IF;

    SELECT jsonb_agg(jsonb_build_object(
             'id', id,
             'lessonDate', lesson_date + v_delta,
             'startTime', start_time,
             'endTime', end_time,
             'markOverride', p_mark_override,
             'manual', false) ORDER BY lesson_date, start_time)
      INTO v_updates
    FROM lesson_instances WHERE id = ANY (p_instance_ids);
  END IF;

  RETURN public.rpc_apply_chain_dates(v_student, v_teacher, v_updates, false, p_shift_group_id);
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────
-- 3) Taşıma: kaydırma başarısız olursa yine de dersi taşı
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_move_lesson(
  p_instance_id uuid, p_date date, p_start time without time zone,
  p_end time without time zone, p_cascade boolean DEFAULT false)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_inst lesson_instances%ROWTYPE; v_tail uuid[]; v_all uuid[]; v_group uuid;
  v_updates jsonb; v_needed integer; v_delta integer;
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

  -- Şablon yoksa yerleştirici boş döner. Eskiden burada hata verilip hiçbir
  -- şey yapılmıyordu — tıklanan ders bile taşınmıyordu. Artık sonraki dersler
  -- başın gittiği kadar gün ileri kayıyor; şablona ihtiyaç yok.
  IF v_updates IS NULL OR jsonb_array_length(v_updates) <> v_needed THEN
    v_delta := p_date - v_inst.lesson_date;
    SELECT jsonb_agg(jsonb_build_object(
             'id', id, 'lessonDate', lesson_date + v_delta,
             'startTime', start_time, 'endTime', end_time,
             'markOverride', true, 'manual', false) ORDER BY lesson_date, start_time)
      INTO v_updates
    FROM lesson_instances WHERE id = ANY (v_tail);
  END IF;

  RETURN public.rpc_apply_chain_dates(v_inst.student_id, v_inst.teacher_id,
    jsonb_build_array(jsonb_build_object('id', p_instance_id, 'lessonDate', p_date,
      'startTime', p_start, 'endTime', p_end, 'markOverride', true, 'manual', false)) || v_updates,
    false, v_group);
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────
-- 4) Geri alınacak bir şey yoksa bu bir hata değil
-- ─────────────────────────────────────────────────────────────────────────
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
    -- İstenen sonuç zaten geçerli: ders yerinde. Kırmızı hata göstermeye gerek yok.
    RETURN json_build_object('success', true, 'updated', 0, 'warnings', '[]'::jsonb,
                             'note', 'Bu ders zaten yerinde; geri alınacak bir taşıma yok.');
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

-- ─────────────────────────────────────────────────────────────────────────
-- 5) İşlendi / geri al: Türkçe mesajlar, tekrar eden tıklama hata değil
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_complete_lesson_impl(p_instance_id uuid, p_teacher_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_instance lesson_instances%ROWTYPE;
  v_duration_minutes integer;
  v_current_cycle integer;
  v_first_planned_id uuid;
  v_first_date date;
BEGIN
  SELECT * INTO v_instance FROM lesson_instances
   WHERE id = p_instance_id AND teacher_id = p_teacher_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Bu ders artık yok. Sayfayı yenileyin.');
  END IF;
  IF v_instance.status = 'completed' THEN
    -- İstenen sonuç zaten geçerli. İkinci tıklama hata değil.
    RETURN json_build_object('success', true, 'duration_minutes', 0,
                             'note', 'Bu ders zaten işlenmiş.');
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

  SELECT id, lesson_date INTO v_first_planned_id, v_first_date FROM lesson_instances
   WHERE student_id = v_instance.student_id AND teacher_id = p_teacher_id
     AND status = 'planned' AND package_cycle = v_current_cycle AND tur = 'ders'
   ORDER BY lesson_date ASC, start_time ASC LIMIT 1;

  IF v_first_planned_id IS NULL OR v_first_planned_id != p_instance_id THEN
    RETURN json_build_object('success', false, 'error',
      CASE WHEN v_first_date IS NULL
           THEN 'Bu pakette işaretlenecek başka ders kalmadı.'
           ELSE 'Dersler sırayla işaretlenir. Sıradaki ders: ' ||
                to_char(v_first_date, 'DD.MM.YYYY') || '. Önce onu işaretleyin.' END);
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
  v_last_date date;
BEGIN
  SELECT * INTO v_instance FROM lesson_instances
   WHERE id = p_instance_id AND teacher_id = p_teacher_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Bu ders artık yok. Sayfayı yenileyin.');
  END IF;
  IF v_instance.status != 'completed' THEN
    -- İstenen sonuç zaten geçerli.
    RETURN json_build_object('success', true, 'duration_minutes', 0,
                             'note', 'Bu ders zaten işlenmemiş durumda.');
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

  SELECT id, lesson_date INTO v_last_completed_id, v_last_date FROM lesson_instances
   WHERE student_id = v_instance.student_id AND teacher_id = p_teacher_id
     AND status = 'completed' AND package_cycle = v_current_cycle AND tur = 'ders'
   ORDER BY lesson_date DESC, start_time DESC LIMIT 1;

  IF v_last_completed_id IS NULL OR v_last_completed_id != p_instance_id THEN
    RETURN json_build_object('success', false, 'error',
      'Yalnızca en son işlenen ders geri alınabilir. Sıradaki: ' ||
      to_char(v_last_date, 'DD.MM.YYYY') || '.');
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

-- ─────────────────────────────────────────────────────────────────────────
-- 6) Günü ertele: kaydırılamayanı sessizce atlama, söyle
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_gunu_ertele(p_teacher_id uuid, p_tarih date)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  r record; v_ilk uuid; v_sonuc json;
  v_ogrenci integer := 0; v_ders integer := 0; v_uyarilar jsonb := '[]'::jsonb;
  v_atlanan jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.is_teacher_caller(p_teacher_id) THEN
    RETURN json_build_object('success', false, 'error', 'Bu işlem için yetkiniz yok');
  END IF;
  IF p_tarih IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Tarih gerekli');
  END IF;

  FOR r IN
    SELECT DISTINCT li.student_id, COALESCE(pr.full_name, 'Bilinmeyen Öğrenci') AS ad
    FROM lesson_instances li
    JOIN students s ON s.student_id = li.student_id AND s.teacher_id = li.teacher_id
    LEFT JOIN profiles pr ON pr.user_id = li.student_id
    WHERE li.teacher_id = p_teacher_id
      AND li.lesson_date = p_tarih
      AND li.status = 'planned'
      AND li.is_manual_override = false
      AND s.is_archived = false
  LOOP
    SELECT id INTO v_ilk
    FROM lesson_instances
    WHERE student_id = r.student_id
      AND teacher_id = p_teacher_id
      AND lesson_date = p_tarih
      AND status = 'planned'
      AND is_manual_override = false
    ORDER BY start_time
    LIMIT 1;

    CONTINUE WHEN v_ilk IS NULL;

    v_sonuc := public.rpc_postpone_lesson(v_ilk);

    IF COALESCE((v_sonuc->>'success')::boolean, false) THEN
      v_ogrenci := v_ogrenci + 1;
      v_ders := v_ders + COALESCE((v_sonuc->>'updated')::integer, 0);
      IF jsonb_typeof(COALESCE((v_sonuc->'warnings')::jsonb, 'null'::jsonb)) = 'array' THEN
        v_uyarilar := v_uyarilar || (v_sonuc->'warnings')::jsonb;
      END IF;
    ELSE
      -- Eskiden sessizce atlanıyordu: admin "gün ertelendi" görüyor, o öğrenci
      -- yerinde kalıyordu. Artık sonuçta adı geçiyor.
      v_atlanan := v_atlanan || jsonb_build_object('student', r.ad, 'reason', v_sonuc->>'error');
    END IF;
  END LOOP;

  RETURN json_build_object('success', true, 'students', v_ogrenci,
                           'updated', v_ders, 'warnings', v_uyarilar,
                           'skipped', v_atlanan);
END;
$function$;
