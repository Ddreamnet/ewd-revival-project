-- ============================================================================
-- Denetim bulguları (17 Eylül) · dört düzeltme, bir ölçüt
-- ============================================================================
-- Yedi fazın tamamı tek bir kümülatif senaryo setiyle yeniden sınandı
-- (supabase/tests/). Ham istisna çıkmadı; üç gerçek bulgu ve bir sınır durumu:
--
-- 1) ÜST ÜSTE BİNEN KENDİ DERSİ yalnızca uyarı alıyordu. Kural "aynı dakika"
--    diye yazılmıştı: 10:00–10:30 dersi olan öğrenciye 10:15–10:45 ikinci
--    ders konabiliyordu. Öğrenci 10:15'te iki derste olamaz. Kontrol artık
--    aralık kesişimine bakıyor; arka arkaya dersler (10:00–10:30, 10:30–11:00)
--    kesişmez, serbest.
--
-- 2) ÜRETEÇ DOLU SLOTA SESSİZCE ATLIYORDU. Yeni öğrenciye başka öğrencinin
--    saati verilirse yerleştirici o haftaları geçip beş hafta sonrasından
--    başlıyordu; admin nedenini göremiyordu. Şablon slotu öğrencinin kendi
--    saatidir: artık haftalar atlanmıyor, dersler istenen saate yazılıyor ve
--    çakışma UYARI olarak dönüyor (K5, taşımadaki davranışla aynı). Erteleme
--    zincirleri (yerleştiricinin iki geçişli hâli) olduğu gibi kaldı.
--    Bugün hiçbir aktif öğrenci çifti şablon slotu paylaşmıyor; mevcut veri
--    etkilenmez.
--
-- 3) ARŞİVDEN GERİ YÜKLEME eski tarz kendi tarih döngüsünü taşıyordu — Faz 4'te
--    birleştirilen dört üretecin beşincisi gözden kaçmış. Çakışmaya bakmıyor,
--    paket boyunu total_lessons yerine haftalık×4'ten alıyordu. Artık
--    rpc_paketi_tamamla'ya bağlı.
--
-- 4) "GEÇMİŞE DERS ÜRETİLMEZ" yalnızca tarihe bakıyordu: bugün saat 15:00'te
--    oluşturulan öğrenciye bugün 10:00'a ders yazılabiliyordu. Bir de bütün
--    işlevler CURRENT_DATE (UTC) kullanıyor; Türkiye 00:00–03:00 arasında
--    veritabanı hâlâ dünde. Üreteç artık Türkiye saatine göre "şu an"dan
--    sonrasına yazıyor.
--
-- ÖLÇÜT: defter_uyumsuz — işlenmiş görünen ama defterde karşılığı olmayan ya
-- da planlı görünüp defterde işlenmiş yazan ders. Bakiyenin güvenilirliği
-- artık sağlık ekranında sürekli görünür.

-- ─────────────────────────────────────────────────────────────────────────
-- Yerleştirici: öğretmen çakışmasını atlamak artık seçimlik
-- ─────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.free_lesson_slots(uuid, uuid, integer, date, time without time zone, boolean, uuid[], date);

CREATE OR REPLACE FUNCTION public.free_lesson_slots(
  p_student_id uuid, p_teacher_id uuid, p_count integer, p_from_date date,
  p_from_time time without time zone DEFAULT NULL::time without time zone,
  p_inclusive boolean DEFAULT false, p_exclude uuid[] DEFAULT '{}'::uuid[],
  p_max_date date DEFAULT NULL::date,
  p_ogretmen_cakismasini_atla boolean DEFAULT true)
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

        -- Öğretmenin takvimi: erteleme zincirleri dolu saati atlar (1. geçiş),
        -- bulamazsa üstüne yazar (2. geçiş). Paket üreteci ise şablon saatini
        -- olduğu gibi kullanır (p_ogretmen_cakismasini_atla = false) ve
        -- çakışmayı uyarı olarak bildirir.
        IF v_pass = 1 AND p_ogretmen_cakismasini_atla THEN
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

-- ─────────────────────────────────────────────────────────────────────────
-- Paket üreteci: şablon saatine yazar, çakışmayı uyarır, geçmişe yazmaz
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_paketi_tamamla(
  p_student_id uuid, p_teacher_id uuid, p_capa text DEFAULT 'son'::text)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_cycle integer; v_hedef integer; v_mevcut integer; v_eksik integer;
  v_from_date date; v_from_time time; v_next_num integer;
  v_yeni uuid[]; v_created integer := 0; v_uyarilar jsonb;
  v_simdi timestamp := (now() AT TIME ZONE 'Europe/Istanbul');
BEGIN
  IF NOT public.is_teacher_caller(p_teacher_id) THEN
    RETURN json_build_object('success', false, 'error', 'Bu işlem için yetkiniz yok');
  END IF;

  SELECT package_cycle, total_lessons INTO v_cycle, v_hedef
    FROM student_lesson_tracking
   WHERE student_id = p_student_id AND teacher_id = p_teacher_id;

  IF v_cycle IS NULL THEN
    RETURN json_build_object('success', true, 'created', 0, 'warnings', '[]'::jsonb, 'note', 'paket kaydı yok');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM student_lessons sl
                  WHERE sl.student_id = p_student_id AND sl.teacher_id = p_teacher_id) THEN
    RETURN json_build_object('success', true, 'created', 0, 'warnings', '[]'::jsonb, 'note', 'haftalık program tanımlı değil');
  END IF;

  -- Faz 4 öncesinden kalan bir kayıtta paket boyu boşsa: haftalık slot × 4.
  IF v_hedef IS NULL THEN
    SELECT count(*) * 4 INTO v_hedef FROM student_lessons
     WHERE student_id = p_student_id AND teacher_id = p_teacher_id;
    UPDATE student_lesson_tracking SET total_lessons = v_hedef
     WHERE student_id = p_student_id AND teacher_id = p_teacher_id;
  END IF;

  SELECT count(*), COALESCE(max(lesson_number), 0)
    INTO v_mevcut, v_next_num
    FROM lesson_instances
   WHERE student_id = p_student_id AND teacher_id = p_teacher_id
     AND package_cycle = v_cycle AND status IN ('planned', 'completed');

  v_eksik := v_hedef - v_mevcut;
  IF v_eksik <= 0 THEN
    RETURN json_build_object('success', true, 'created', 0, 'target', v_hedef, 'existing', v_mevcut, 'warnings', '[]'::jsonb);
  END IF;

  IF p_capa = 'son' THEN
    SELECT lesson_date, start_time INTO v_from_date, v_from_time
      FROM lesson_instances
     WHERE student_id = p_student_id AND teacher_id = p_teacher_id
       AND package_cycle = v_cycle AND status IN ('planned', 'completed')
     ORDER BY lesson_date DESC, start_time DESC LIMIT 1;
  END IF;

  IF v_from_date IS NULL THEN
    SELECT lesson_date, start_time INTO v_from_date, v_from_time
      FROM lesson_instances
     WHERE student_id = p_student_id AND teacher_id = p_teacher_id
       AND status = 'completed'
     ORDER BY lesson_date DESC, start_time DESC LIMIT 1;
  END IF;

  -- Geçmişe ders üretilmez — Türkiye saatine göre, saat dâhil.
  IF v_from_date IS NULL OR v_from_date < v_simdi::date THEN
    v_from_date := v_simdi::date;
    v_from_time := v_simdi::time;
  ELSIF v_from_date = v_simdi::date THEN
    v_from_time := GREATEST(COALESCE(v_from_time, v_simdi::time), v_simdi::time);
  END IF;

  WITH yeni AS (
    INSERT INTO lesson_instances (student_id, teacher_id, lesson_number,
                                  lesson_date, start_time, end_time, status, package_cycle)
    SELECT p_student_id, p_teacher_id,
           v_next_num + row_number() OVER (ORDER BY fs.lesson_date, fs.start_time),
           fs.lesson_date, fs.start_time, fs.end_time, 'planned', v_cycle
      FROM public.free_lesson_slots(p_student_id, p_teacher_id, v_eksik,
                                    v_from_date, v_from_time, false, '{}'::uuid[], NULL, false) fs
    RETURNING id
  )
  SELECT array_agg(id) INTO v_yeni FROM yeni;
  v_created := COALESCE(array_length(v_yeni, 1), 0);

  IF v_created > 0 THEN
    PERFORM public.rpc_resequence_lesson_numbers(p_student_id, p_teacher_id, v_cycle);

    -- Yeni derslerin üstüne bindiği başka dersler: engel değil, uyarı (K5).
    SELECT jsonb_agg(jsonb_build_object(
             'date', y.lesson_date,
             'time', to_char(y.start_time, 'HH24:MI') || ' - ' || to_char(y.end_time, 'HH24:MI'),
             'student', CASE WHEN o.tur = 'deneme' THEN COALESCE(o.aday_adi, 'Deneme Dersi')
                             ELSE COALESCE(pr.full_name, 'Bilinmeyen Öğrenci') END)
             ORDER BY y.lesson_date, y.start_time)
      INTO v_uyarilar
      FROM lesson_instances y
      JOIN lesson_instances o
        ON o.teacher_id = y.teacher_id AND o.lesson_date = y.lesson_date AND o.id <> y.id
       AND o.status IN ('planned', 'completed')
       AND o.start_time < y.end_time AND o.end_time > y.start_time
       AND NOT (o.id = ANY (v_yeni))
      LEFT JOIN students s ON s.student_id = o.student_id AND s.teacher_id = y.teacher_id
      LEFT JOIN profiles pr ON pr.user_id = o.student_id
     WHERE y.id = ANY (v_yeni) AND COALESCE(s.is_archived, false) = false;
  END IF;

  RETURN json_build_object('success', true, 'created', v_created,
                           'target', v_hedef, 'cycle', v_cycle,
                           'warnings', COALESCE(v_uyarilar, '[]'::jsonb));
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────
-- Program kurucusu: üretecin uyarısını taşır
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_sync_student_schedule_impl(
  p_student_id uuid, p_teacher_id uuid, p_slots jsonb, p_lessons_per_week integer)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cycle integer;
  v_hedef integer;
  v_sonuc json;
  v_kotu jsonb;
BEGIN
  IF p_slots IS NULL OR jsonb_typeof(p_slots) <> 'array' OR jsonb_array_length(p_slots) = 0 THEN
    RETURN json_build_object('success', false, 'error', 'En az bir ders saati girin.');
  END IF;

  SELECT slot INTO v_kotu
    FROM jsonb_array_elements(p_slots) AS slot
   WHERE (slot->>'startTime') IS NULL OR (slot->>'endTime') IS NULL
      OR (slot->>'endTime')::time <= (slot->>'startTime')::time
   LIMIT 1;
  IF v_kotu IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error',
      'Bir ders saatinde bitiş, başlangıçtan sonra olmalı.');
  END IF;

  SELECT jsonb_build_object('d', slot->>'dayOfWeek', 's', min(slot->>'startTime')) INTO v_kotu
    FROM jsonb_array_elements(p_slots) AS slot
   GROUP BY slot->>'dayOfWeek', (slot->>'startTime')::time
  HAVING count(*) > 1
   LIMIT 1;
  IF v_kotu IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error',
      'Aynı gün ve saate iki ders girilmiş (' ||
      (ARRAY['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'])[(v_kotu->>'d')::integer + 1] ||
      ' ' || to_char((v_kotu->>'s')::time, 'HH24:MI') || '). Birini değiştirin.');
  END IF;

  DELETE FROM student_lessons
   WHERE student_id = p_student_id AND teacher_id = p_teacher_id;

  INSERT INTO student_lessons (student_id, teacher_id, day_of_week, start_time, end_time)
  SELECT p_student_id, p_teacher_id,
         (slot->>'dayOfWeek')::integer, (slot->>'startTime')::time, (slot->>'endTime')::time
    FROM jsonb_array_elements(p_slots) AS slot;

  v_hedef := GREATEST(jsonb_array_length(p_slots), 1) * 4;

  INSERT INTO student_lesson_tracking (student_id, teacher_id, lessons_per_week, total_lessons)
  VALUES (p_student_id, p_teacher_id, p_lessons_per_week, v_hedef)
  ON CONFLICT (student_id)
  DO UPDATE SET teacher_id = p_teacher_id,
                lessons_per_week = p_lessons_per_week,
                total_lessons = v_hedef,
                updated_at = now();

  SELECT package_cycle INTO v_cycle FROM student_lesson_tracking
   WHERE student_id = p_student_id AND teacher_id = p_teacher_id;
  v_cycle := COALESCE(v_cycle, 1);

  DELETE FROM lesson_instances
   WHERE student_id = p_student_id AND teacher_id = p_teacher_id
     AND package_cycle = v_cycle AND status = 'planned' AND is_manual_override = false;

  v_sonuc := public.rpc_paketi_tamamla(p_student_id, p_teacher_id, 'islenen');

  PERFORM public.rpc_resequence_lesson_numbers(p_student_id, p_teacher_id, v_cycle);

  RETURN json_build_object('success', true,
                           'instances_created', COALESCE((v_sonuc->>'created')::integer, 0),
                           'total_lessons', v_hedef, 'cycle', v_cycle,
                           'warnings', COALESCE((v_sonuc->'warnings')::jsonb, '[]'::jsonb));
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────
-- Arşivden geri yükleme: beşinci üreteç kalkıyor
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_restore_student_impl(
  p_student_record_id uuid, p_student_user_id uuid, p_teacher_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sonuc json;
BEGIN
  UPDATE students
     SET is_archived = false, archived_at = NULL
   WHERE id = p_student_record_id;

  -- Paket boyu, işlenmişlerin sayısı, çakışma ve "geçmişe yazma" kuralları
  -- hepsi tek üreteçte. Arşivdeyken ders kalmadığı için son işlenenden
  -- itibaren doldurur.
  v_sonuc := public.rpc_paketi_tamamla(p_student_user_id, p_teacher_user_id, 'islenen');

  RETURN json_build_object('success', true,
                           'instances_created', COALESCE((v_sonuc->>'created')::integer, 0),
                           'warnings', COALESCE((v_sonuc->'warnings')::jsonb, '[]'::jsonb),
                           'note', v_sonuc->>'note');
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────
-- Zincir yazıcısı: kendi dersine üst üste binmek de reddedilir
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

  -- Aynı gönderimde iki ders üst üste biniyor mu?
  SELECT jsonb_build_object('date', e1->>'lessonDate', 'time', e1->>'startTime')
    INTO v_cakisan
  FROM jsonb_array_elements(v_resolved) WITH ORDINALITY AS a(e1, o1)
  JOIN jsonb_array_elements(v_resolved) WITH ORDINALITY AS b(e2, o2) ON o2 > o1
  WHERE (e1->>'lessonDate')::date = (e2->>'lessonDate')::date
    AND (e1->>'startTime')::time < (e2->>'endTime')::time
    AND (e1->>'endTime')::time   > (e2->>'startTime')::time
  LIMIT 1;

  IF v_cakisan IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error',
      to_char((v_cakisan->>'date')::date, 'DD.MM.YYYY') || ' ' ||
      to_char((v_cakisan->>'time')::time, 'HH24:MI') ||
      ' civarına üst üste binen iki ders koyamazsınız. Tarihleri tek tek değiştirin.');
  END IF;

  -- Öğrencinin kendi takvimiyle kesişme. Veri kuralı, tercih değil: bir
  -- öğrenci aynı anda iki derste olamaz. "Aynı dakika" yetmiyordu —
  -- 10:00–10:30 dersi olan öğrenciye 10:15–10:45 konabiliyordu. Artık
  -- aralık kesişimi; arka arkaya dersler (10:30 biten, 10:30 başlayan)
  -- kesişmez.
  SELECT jsonb_build_object('date', e->>'lessonDate',
                            'time', (SELECT to_char(li2.start_time, 'HH24:MI') || ' - ' || to_char(li2.end_time, 'HH24:MI')
                                       FROM lesson_instances li2
                                      WHERE li2.student_id = p_student_id
                                        AND li2.lesson_date = (e->>'lessonDate')::date
                                        AND li2.status IN ('planned', 'completed')
                                        AND NOT (li2.id = ANY (v_ids))
                                        AND li2.start_time < (e->>'endTime')::time
                                        AND li2.end_time   > (e->>'startTime')::time
                                      ORDER BY li2.start_time LIMIT 1))
    INTO v_cakisan
  FROM jsonb_array_elements(v_resolved) e
  WHERE EXISTS (
    SELECT 1 FROM lesson_instances li2
     WHERE li2.student_id = p_student_id
       AND li2.lesson_date = (e->>'lessonDate')::date
       AND li2.status IN ('planned', 'completed')
       AND NOT (li2.id = ANY (v_ids))
       AND li2.start_time < (e->>'endTime')::time
       AND li2.end_time   > (e->>'startTime')::time)
  LIMIT 1;

  IF v_cakisan IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error',
      'Bu öğrencinin ' || to_char((v_cakisan->>'date')::date, 'DD.MM.YYYY') || ' ' ||
      (v_cakisan->>'time') ||
      ' dersiyle üst üste biniyor. Aynı anda iki derste olamaz — başka bir saat seçin.');
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
-- Sağlık: defter ile ders durumu uyuşuyor mu?
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sistem_sagligi()
 RETURNS TABLE(kod text, baslik text, adet bigint, agirlik text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT * FROM (
    SELECT 'planli_yanlis_ogretmen'::text, 'Planlı ders eski öğretmende'::text,
           count(*)::bigint, 'kritik'::text
      FROM lesson_instances li JOIN students s ON s.student_id = li.student_id
     WHERE li.status = 'planned' AND li.teacher_id <> s.teacher_id
    UNION ALL
    SELECT 'defter_uyumsuz', 'Ders durumu ile bakiye defteri uyuşmuyor', count(*)::bigint, 'kritik'
      FROM lesson_instances li
      LEFT JOIN teacher_balance_opening o ON o.teacher_id = li.teacher_id
     WHERE li.tur = 'ders' AND li.status IN ('planned', 'completed')
       AND li.lesson_date >= COALESCE(o.created_at::date, DATE '1900-01-01')
       AND (SELECT count(*) FILTER (WHERE be.event_type = 'lesson_complete')
                 - count(*) FILTER (WHERE be.event_type = 'lesson_undo')
              FROM balance_events be WHERE be.instance_id = li.id)
           <> CASE li.status WHEN 'completed' THEN 1 ELSE 0 END
    UNION ALL
    SELECT 'yetim_ders', 'Silinmiş öğretmene bağlı ders kaydı', count(*)::bigint, 'orta'
      FROM lesson_instances li LEFT JOIN profiles p ON p.user_id = li.teacher_id
     WHERE p.user_id IS NULL
    UNION ALL
    SELECT 'eski_ogretmende_islenmis', 'Eski öğretmende kalan işlenmiş ders (panelde gizli)', count(*)::bigint, 'dusuk'
      FROM students s
      JOIN student_lesson_tracking t ON t.student_id = s.student_id AND t.teacher_id = s.teacher_id
      JOIN lesson_instances li ON li.student_id = s.student_id AND li.package_cycle = t.package_cycle
       AND li.status IN ('planned','completed')
     WHERE s.is_archived = false AND li.teacher_id <> s.teacher_id
    UNION ALL
    SELECT 'gecmis_planli_ders', 'Tarihi geçmiş, işlenmemiş ders', count(*)::bigint, 'orta'
      FROM lesson_instances li JOIN students s ON s.student_id = li.student_id AND s.teacher_id = li.teacher_id
     WHERE li.status = 'planned' AND li.lesson_date < (now() AT TIME ZONE 'Europe/Istanbul')::date AND s.is_archived = false
    UNION ALL
    SELECT 'gelecek_cakisma', 'Bugün/sonrası çakışan ders çifti', count(*)::bigint, 'kritik'
      FROM lesson_instances a JOIN lesson_instances b
        ON b.teacher_id = a.teacher_id AND b.lesson_date = a.lesson_date AND b.id > a.id
       AND a.start_time < b.end_time AND a.end_time > b.start_time
     WHERE a.status IN ('planned','completed') AND b.status IN ('planned','completed')
       AND a.lesson_date >= (now() AT TIME ZONE 'Europe/Istanbul')::date
    UNION ALL
    SELECT 'arsivli_planli', 'Arşivli öğrencide duran planlı ders', count(*)::bigint, 'kritik'
      FROM lesson_instances li JOIN students s ON s.student_id = li.student_id
     WHERE li.status = 'planned' AND s.is_archived
    UNION ALL
    SELECT 'sablon_uyusmazligi', 'Haftalık sayı ile şablon satırı uyuşmuyor', count(*)::bigint, 'orta'
      FROM student_lesson_tracking t JOIN students s ON s.student_id = t.student_id AND s.teacher_id = t.teacher_id
     WHERE s.is_archived = false
       AND t.lessons_per_week <> (SELECT count(*) FROM student_lessons sl
                                   WHERE sl.student_id = t.student_id AND sl.teacher_id = t.teacher_id)
    UNION ALL
    SELECT 'tracking_yanlis_ogretmen', 'Takip kaydı eski öğretmende', count(*)::bigint, 'orta'
      FROM student_lesson_tracking t JOIN students s ON s.student_id = t.student_id
     WHERE t.teacher_id <> s.teacher_id
    UNION ALL
    SELECT 'sablon_yanlis_ogretmen', 'Haftalık şablon eski öğretmende', count(*)::bigint, 'orta'
      FROM student_lessons sl JOIN students s ON s.student_id = sl.student_id
     WHERE sl.teacher_id <> s.teacher_id
    UNION ALL
    SELECT 'dersi_olmayan_ogrenci', 'Aktif öğrenci, hiç planlı dersi yok', count(*)::bigint, 'orta'
      FROM students s WHERE s.is_archived = false
       AND NOT EXISTS (SELECT 1 FROM lesson_instances li WHERE li.student_id = s.student_id
                          AND li.teacher_id = s.teacher_id AND li.status = 'planned')
    UNION ALL
    SELECT 'zoomsuz_ogretmen', 'Öğrencisi olan, Zoom bağlantısı boş öğretmen', count(*)::bigint, 'orta'
      FROM profiles p WHERE p.role = 'teacher' AND nullif(btrim(p.zoom_link), '') IS NULL
       AND EXISTS (SELECT 1 FROM students s WHERE s.teacher_id = p.user_id AND s.is_archived = false)
    UNION ALL
    SELECT 'tekrarli_ders_numarasi', 'Aynı döngüde tekrar eden ders numarası', coalesce(sum(x.fazla),0)::bigint, 'dusuk'
      FROM (SELECT count(*) - 1 AS fazla FROM lesson_instances
             WHERE status IN ('planned','completed') AND tur = 'ders'
             GROUP BY student_id, teacher_id, package_cycle, lesson_number HAVING count(*) > 1) x
  ) t(kod, baslik, adet, agirlik)
  WHERE public.is_admin_caller() OR session_user IN ('postgres','supabase_admin');
$function$;
