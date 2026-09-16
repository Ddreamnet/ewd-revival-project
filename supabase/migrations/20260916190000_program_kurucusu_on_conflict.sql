-- ============================================================================
-- Program kurucusu: Faz 6b'den kalan kırık ON CONFLICT
-- ============================================================================
-- Bildirilen: öğrenci oluşturulurken hata alındı.
--
-- İlk görünen sebep şifreydi (6 karakterden kısa; Auth reddetti). Ama asıl
-- sorun daha derindeydi ve şifre doğru girilse de öğrenci oluşmayacaktı:
--
-- Faz 6b'de student_lesson_tracking üzerindeki UNIQUE (student_id, teacher_id)
-- kısıtı kaldırılıp yerine UNIQUE (student_id) konmuştu. Bu işlev paket
-- kaydını hâlâ
--
--     ON CONFLICT (student_id, teacher_id)
--
-- ile yazıyordu. Postgres, hedefle birebir eşleşen bir kısıt yoksa bu satırda
-- "there is no unique or exclusion constraint matching the ON CONFLICT
-- specification" hatası fırlatır. İşlev iki yerden çağrılıyor ve ikisi de
-- Faz 6b'den beri kırıktı:
--
--   * create-student  → her yeni öğrenci, program kurulumunda düşüp geri
--                        alınıyordu
--   * Öğrenci Ayarları → haftalık programı ya da haftalık ders sayısını
--                        değiştirip kaydetmek
--
-- Faz 6'nın testleri transfer, RLS ve not yolunu kapsıyordu; program kurucusu
-- aynı tabloya yazdığı halde listede yoktu.
--
-- Ek olarak iki girdi denetimi: aynı gün+saate iki slot ya da bitişi
-- başlangıcından önce olan bir slot gelirse, ham bir veritabanı hatası
-- yerine ne yanlış olduğunu söyleyen bir cevap dönüyor.

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

  -- Bitişi başlangıcından önce ya da eşit olan slot
  SELECT slot INTO v_kotu
    FROM jsonb_array_elements(p_slots) AS slot
   WHERE (slot->>'startTime') IS NULL OR (slot->>'endTime') IS NULL
      OR (slot->>'endTime')::time <= (slot->>'startTime')::time
   LIMIT 1;
  IF v_kotu IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error',
      'Bir ders saatinde bitiş, başlangıçtan sonra olmalı.');
  END IF;

  -- Aynı gün ve saate iki slot: öğrenci aynı anda iki derste olamaz.
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

  -- 1. Haftalık şablonu değiştir
  DELETE FROM student_lessons
   WHERE student_id = p_student_id AND teacher_id = p_teacher_id;

  INSERT INTO student_lessons (student_id, teacher_id, day_of_week, start_time, end_time)
  SELECT p_student_id, p_teacher_id,
         (slot->>'dayOfWeek')::integer, (slot->>'startTime')::time, (slot->>'endTime')::time
    FROM jsonb_array_elements(p_slots) AS slot;

  -- 2. Paket boyu tek kaynaktan: gerçekten yazılan slot sayısı × 4.
  v_hedef := GREATEST(jsonb_array_length(p_slots), 1) * 4;

  -- Faz 6b'den beri öğrenci başına tek paket kaydı var; çakışma hedefi o.
  -- Kayıt başka bir öğretmende kalmışsa (olmamalı) güncel eşleşmeye taşınır.
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
