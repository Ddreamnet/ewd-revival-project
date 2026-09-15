-- ============================================================================
-- Faz 4 · Paket boyu tek yerde, ders üretimi tek işlevde
-- ============================================================================
-- "Paket = haftalık slot sayısı × 4" kuralı dokuz ayrı yerde elle yazılıydı
-- (5 istemci dosyası + 4 sunucu işlevi). İkisi farklı girdiden hesaplıyordu:
-- biri lessons_per_week'ten, diğeri gönderilen slot dizisinin uzunluğundan.
-- Ayrışırlarsa paket boyu sessizce değişiyordu.
--
-- Artık sayı paket satırında duruyor: bir kez yazılıyor, her yerden okunuyor.
--
-- Üretim tarafında dört ayrı kod yolu vardı: create-student (TypeScript, kendi
-- tarih döngüsü, çakışmaya hiç bakmıyordu), sync, reset ve ensure. Üçü zaten
-- free_lesson_slots kullanıyordu ama "kaç ders eksik, nereden başlanır"
-- hesabını her biri kendi yapıyordu. Hepsi rpc_paketi_tamamla'ya indi.

ALTER TABLE public.student_lesson_tracking
  ADD COLUMN IF NOT EXISTS total_lessons integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.student_lesson_tracking.total_lessons IS
  'Paketteki toplam ders hakkı. Haftalık slot sayısı × 4 olarak yazılır; okuyan hiçbir yer bu çarpımı tekrarlamaz.';

UPDATE public.student_lesson_tracking
   SET total_lessons = GREATEST(lessons_per_week, 1) * 4
 WHERE total_lessons = 0;

-- ─────────────────────────────────────────────────────────────────────────
-- Tek üreteç
-- ─────────────────────────────────────────────────────────────────────────
-- Paketi hedefine tamamlar. Fazla ders üretmez, eksikse boş slotlara ekler,
-- idempotenttir — aynı çağrı iki kez yapılsa ikinci sefer hiçbir şey olmaz.
--
-- Çapa iki türlü olabilir:
--   'son'     paketteki en son dersin ardına ekler (üstüne ekleme)
--   'islenen' en son işlenen dersten sonrasını doldurur; aradaki elle
--             sabitlenmiş dersler yerinde kalır ve zincir onların etrafından
--             akar (şablon değişimi ve paket sıfırlama böyle davranmalı)
CREATE OR REPLACE FUNCTION public.rpc_paketi_tamamla(
  p_student_id uuid,
  p_teacher_id uuid,
  p_capa text DEFAULT 'son'::text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cycle integer;
  v_hedef integer;
  v_mevcut integer;
  v_eksik integer;
  v_from_date date;
  v_from_time time;
  v_next_num integer;
  v_created integer := 0;
BEGIN
  IF NOT public.is_teacher_caller(p_teacher_id) THEN
    RETURN json_build_object('success', false, 'error', 'Bu işlem için yetkiniz yok');
  END IF;

  SELECT package_cycle, total_lessons INTO v_cycle, v_hedef
    FROM student_lesson_tracking
   WHERE student_id = p_student_id AND teacher_id = p_teacher_id;

  IF v_cycle IS NULL THEN
    RETURN json_build_object('success', true, 'created', 0, 'note', 'paket kaydı yok');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM student_lessons sl
                  WHERE sl.student_id = p_student_id AND sl.teacher_id = p_teacher_id) THEN
    RETURN json_build_object('success', true, 'created', 0, 'note', 'haftalık program tanımlı değil');
  END IF;

  SELECT count(*), COALESCE(max(lesson_number), 0)
    INTO v_mevcut, v_next_num
    FROM lesson_instances
   WHERE student_id = p_student_id AND teacher_id = p_teacher_id
     AND package_cycle = v_cycle AND status IN ('planned', 'completed');

  v_eksik := COALESCE(v_hedef, 0) - v_mevcut;
  IF v_eksik <= 0 THEN
    RETURN json_build_object('success', true, 'created', 0, 'target', v_hedef, 'existing', v_mevcut);
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

  -- Geçmişe ders üretilmez.
  IF v_from_date IS NULL OR v_from_date < CURRENT_DATE THEN
    v_from_date := GREATEST(COALESCE(v_from_date, CURRENT_DATE), CURRENT_DATE);
    v_from_time := NULL;
  END IF;

  INSERT INTO lesson_instances (student_id, teacher_id, lesson_number,
                                lesson_date, start_time, end_time, status, package_cycle)
  SELECT p_student_id, p_teacher_id,
         v_next_num + row_number() OVER (ORDER BY fs.lesson_date, fs.start_time),
         fs.lesson_date, fs.start_time, fs.end_time, 'planned', v_cycle
    FROM public.free_lesson_slots(p_student_id, p_teacher_id, v_eksik,
                                  v_from_date, v_from_time, false) fs;
  GET DIAGNOSTICS v_created = ROW_COUNT;

  IF v_created > 0 THEN
    PERFORM public.rpc_resequence_lesson_numbers(p_student_id, p_teacher_id, v_cycle);
  END IF;

  RETURN json_build_object('success', true, 'created', v_created,
                           'target', v_hedef, 'cycle', v_cycle);
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_paketi_tamamla(uuid, uuid, text) FROM public;
REVOKE ALL ON FUNCTION public.rpc_paketi_tamamla(uuid, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_paketi_tamamla(uuid, uuid, text) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- Üç çağıran da aynı üretece bağlanıyor
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_ensure_cycle_instances(
  p_teacher_id uuid, p_student_id uuid DEFAULT NULL::uuid)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  r record;
  v_sonuc json;
  v_total integer := 0;
BEGIN
  IF NOT public.is_teacher_caller(p_teacher_id) THEN
    RETURN json_build_object('success', false, 'error', 'Bu işlem için yetkiniz yok');
  END IF;

  FOR r IN
    SELECT t.student_id
      FROM student_lesson_tracking t
      JOIN students s ON s.student_id = t.student_id AND s.teacher_id = t.teacher_id
       AND s.is_archived = false
     WHERE t.teacher_id = p_teacher_id
       AND (p_student_id IS NULL OR t.student_id = p_student_id)
  LOOP
    v_sonuc := public.rpc_paketi_tamamla(r.student_id, p_teacher_id, 'son');
    v_total := v_total + COALESCE((v_sonuc->>'created')::integer, 0);
  END LOOP;

  RETURN json_build_object('success', true, 'created', v_total);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_sync_student_schedule_impl(
  p_student_id uuid, p_teacher_id uuid, p_slots jsonb, p_lessons_per_week integer)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_cycle integer;
  v_hedef integer;
  v_sonuc json;
BEGIN
  -- 1. Haftalık şablonu değiştir
  DELETE FROM student_lessons
   WHERE student_id = p_student_id AND teacher_id = p_teacher_id;

  INSERT INTO student_lessons (student_id, teacher_id, day_of_week, start_time, end_time)
  SELECT p_student_id, p_teacher_id,
         (slot->>'dayOfWeek')::integer, (slot->>'startTime')::time, (slot->>'endTime')::time
    FROM jsonb_array_elements(p_slots) AS slot;

  -- 2. Paket boyu tek kaynaktan: gerçekten yazılan slot sayısı × 4.
  v_hedef := GREATEST(jsonb_array_length(p_slots), 1) * 4;

  INSERT INTO student_lesson_tracking (student_id, teacher_id, lessons_per_week, total_lessons)
  VALUES (p_student_id, p_teacher_id, p_lessons_per_week, v_hedef)
  ON CONFLICT (student_id, teacher_id)
  DO UPDATE SET lessons_per_week = p_lessons_per_week,
                total_lessons = v_hedef,
                updated_at = now();

  SELECT package_cycle INTO v_cycle FROM student_lesson_tracking
   WHERE student_id = p_student_id AND teacher_id = p_teacher_id;
  v_cycle := COALESCE(v_cycle, 1);

  -- 3. Şablonu izleyen planlı dersleri temizle. İşlenmişler tarih, elle
  --    sabitlenmişler bilinçli yerleştirme — ikisi de kalır.
  DELETE FROM lesson_instances
   WHERE student_id = p_student_id AND teacher_id = p_teacher_id
     AND package_cycle = v_cycle AND status = 'planned' AND is_manual_override = false;

  -- 4. Eksiği tek üreteç tamamlasın; sabitlenmiş derslerin etrafından aksın.
  v_sonuc := public.rpc_paketi_tamamla(p_student_id, p_teacher_id, 'islenen');

  PERFORM public.rpc_resequence_lesson_numbers(p_student_id, p_teacher_id, v_cycle);

  RETURN json_build_object('success', true,
                           'instances_created', COALESCE((v_sonuc->>'created')::integer, 0),
                           'total_lessons', v_hedef, 'cycle', v_cycle);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_reset_package_impl(
  p_student_id uuid, p_teacher_id uuid, p_template_slots jsonb)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_current_cycle integer;
  v_new_cycle integer;
  v_hedef integer;
  v_sonuc json;
BEGIN
  SELECT package_cycle INTO v_current_cycle FROM student_lesson_tracking
   WHERE student_id = p_student_id AND teacher_id = p_teacher_id;
  v_current_cycle := COALESCE(v_current_cycle, 1);
  v_new_cycle := v_current_cycle + 1;
  v_hedef := GREATEST(jsonb_array_length(p_template_slots), 1) * 4;

  INSERT INTO balance_events (teacher_id, event_type, amount_minutes, student_id, package_cycle, notes)
  VALUES (p_teacher_id, 'balance_reset', 0, p_student_id, v_current_cycle,
          'Package reset from cycle ' || v_current_cycle || ' to ' || v_new_cycle);

  DELETE FROM lesson_instances
   WHERE student_id = p_student_id AND teacher_id = p_teacher_id
     AND package_cycle = v_current_cycle AND status = 'planned';

  UPDATE student_lesson_tracking
     SET package_cycle = v_new_cycle, total_lessons = v_hedef, updated_at = now()
   WHERE student_id = p_student_id AND teacher_id = p_teacher_id;

  v_sonuc := public.rpc_paketi_tamamla(p_student_id, p_teacher_id, 'islenen');

  RETURN json_build_object('success', true, 'new_cycle', v_new_cycle,
                           'instances_created', COALESCE((v_sonuc->>'created')::integer, 0),
                           'total_lessons', v_hedef);
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────
-- Transferle bölünmüş paket
-- ─────────────────────────────────────────────────────────────────────────
-- Defne paketinin 4 dersini eski öğretmeninde işledi; o dersler yeni
-- eşleşmede sayılmadığı için üreteç eksik sanıp 4 ders daha üretecekti.
-- Bu eşleşmedeki hak, kalan ders sayısıdır.
UPDATE public.student_lesson_tracking t
   SET total_lessons = 4, updated_at = now()
  FROM public.profiles sp, public.profiles tp
 WHERE sp.user_id = t.student_id AND sp.full_name = 'Defne'
   AND tp.user_id = t.teacher_id AND tp.full_name = 'Senanur Teacher'
   AND t.total_lessons <> 4;
