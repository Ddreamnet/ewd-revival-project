-- ============================================================================
-- Faz 6b/6c · Bir öğrencinin tek öğretmeni olur; RLS eşleşmeye bakar
-- ============================================================================
-- İki yapısal boşluk vardı.
--
-- BİRİNCİSİ: benzersizlik kısıtları yanlış sütunlardaydı.
--   students             UNIQUE (teacher_id, student_id)
--   student_lesson_tracking  UNIQUE (student_id, teacher_id)
-- Bu, aynı öğrencinin iki öğretmende birden var olmasına izin veriyordu —
-- yani "paket ikiye bölündü" durumu veritabanı tarafından engellenmiyor,
-- her seferinde elle onarılıyordu. Kısıtlar öğrenciye alınıyor: bir öğrenci
-- bir öğretmende, bir paket.
--
-- İKİNCİSİ: öğretmen ilkeleri yalnızca "teacher_id = ben" diyordu, öğrencinin
-- kime ait olduğuna hiç bakmıyordu. Sınandı ve doğrulandı: bir öğretmen,
-- kendi öğrencisi olmayan birine hem ders kaydı hem haftalık şablon satırı
-- yazabiliyordu. Artık kapı eşleşmeden geçiyor.
--
-- Ders kayıtlarında okuma ile yazma ayrışıyor: öğretmen kendi geçmişini
-- (artık başkasına geçmiş bir öğrencinin işlenmiş dersleri dâhil) görmeye
-- devam eder, ama yalnızca bugün kendi öğrencisi olan birine yazabilir.
-- Deneme dersinin öğrencisi yok; o kapıdan öğretmen kimliğiyle geçer.

-- ─────────────────────────────────────────────────────────────────────────
-- 6b · Bir öğrenci, bir öğretmen
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.students
  DROP CONSTRAINT IF EXISTS students_teacher_id_student_id_key;
ALTER TABLE public.students
  ADD CONSTRAINT students_student_id_key UNIQUE (student_id);

ALTER TABLE public.student_lesson_tracking
  DROP CONSTRAINT IF EXISTS unique_student_teacher_tracking;
ALTER TABLE public.student_lesson_tracking
  ADD CONSTRAINT student_lesson_tracking_student_id_key UNIQUE (student_id);

-- ─────────────────────────────────────────────────────────────────────────
-- 6c · Eşleşme kapısı
-- ─────────────────────────────────────────────────────────────────────────
-- SECURITY DEFINER: students üzerindeki okuma ilkesine bağlı kalmasın, ve
-- her ilkede aynı alt sorgu tekrar tekrar planlanmasın. Sızdırdığı bilgi
-- yok — çağıranın yalnızca kendi eşleşmesini sorabildiği bir evet/hayır.
CREATE OR REPLACE FUNCTION public.ogrencim_mi(p_ogrenci uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM students s
     WHERE s.student_id = p_ogrenci AND s.teacher_id = auth.uid()
  )
$function$;

COMMENT ON FUNCTION public.ogrencim_mi(uuid) IS
  'Bu öğrenci şu an çağıran öğretmene mi bağlı? RLS ilkelerinin ortak kapısı.';

REVOKE ALL ON FUNCTION public.ogrencim_mi(uuid) FROM public;
REVOKE ALL ON FUNCTION public.ogrencim_mi(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.ogrencim_mi(uuid) TO authenticated;

-- Haftalık şablon
DROP POLICY IF EXISTS teacher_manage_student_lessons ON public.student_lessons;
DROP POLICY IF EXISTS teacher_view_student_lessons   ON public.student_lessons;
CREATE POLICY teacher_manage_student_lessons ON public.student_lessons
  FOR ALL
  USING (public.ogrencim_mi(student_id))
  WITH CHECK (public.ogrencim_mi(student_id));

-- Paket takibi
DROP POLICY IF EXISTS teacher_manage_student_tracking ON public.student_lesson_tracking;
DROP POLICY IF EXISTS teacher_view_student_tracking   ON public.student_lesson_tracking;
CREATE POLICY teacher_manage_student_tracking ON public.student_lesson_tracking
  FOR ALL
  USING (public.ogrencim_mi(student_id))
  WITH CHECK (public.ogrencim_mi(student_id));

-- Ders kayıtları: okuma geniş, yazma dar
DROP POLICY IF EXISTS teacher_manage_own_lesson_instances ON public.lesson_instances;
CREATE POLICY teacher_manage_own_lesson_instances ON public.lesson_instances
  FOR ALL
  USING (teacher_id = auth.uid() OR public.ogrencim_mi(student_id))
  WITH CHECK (
    teacher_id = auth.uid()
    AND (student_id IS NULL OR public.ogrencim_mi(student_id))
  );

-- ─────────────────────────────────────────────────────────────────────────
-- Öğretmenin öğrenci notu
-- ─────────────────────────────────────────────────────────────────────────
-- StudentAboutDialog öğretmen panelinde de açılıyor ama students tablosunda
-- öğretmenin UPDATE hakkı hiç yoktu: yazdığı not sessizce kayboluyordu
-- (Supabase eşleşmeyen UPDATE'i hata saymaz, 0 satır döner). Tabloya geniş
-- bir UPDATE hakkı vermek yerine tek alanlık bir kapı: öğretmen yalnızca
-- kendi öğrencisinin notunu, yalnızca not alanını değiştirebilir.
CREATE OR REPLACE FUNCTION public.rpc_ogrenci_notu_kaydet(
  p_ogrenci uuid,
  p_metin text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.is_admin_caller() OR public.ogrencim_mi(p_ogrenci)) THEN
    RETURN json_build_object('success', false, 'error', 'Bu işlem için yetkiniz yok');
  END IF;

  UPDATE students
     SET about_text = nullif(btrim(coalesce(p_metin, '')), '')
   WHERE student_id = p_ogrenci;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Öğrenci kaydı bulunamadı');
  END IF;

  RETURN json_build_object('success', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_ogrenci_notu_kaydet(uuid, text) FROM public;
REVOKE ALL ON FUNCTION public.rpc_ogrenci_notu_kaydet(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_ogrenci_notu_kaydet(uuid, text) TO authenticated;
