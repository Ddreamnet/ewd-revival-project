-- ============================================================================
-- Faz 6a · Transfer tek işlem
-- ============================================================================
-- Öğrenci transferi tarayıcıda sekiz ardışık UPDATE'ti. İşlem yoktu: üçüncü
-- adımdan sonra sekme kapanırsa öğrenci yarı taşınmış kalıyordu — ders
-- kayıtları eski öğretmende, şablonu yenisinde. Üstelik sekizin altısının
-- hatası hiç kontrol edilmiyordu, yani yarım kalma sessizdi. Kullanıcının
-- "öğrenci başka öğretmene verilince dersleri hâlâ eskisindeymiş gibi"
-- şikâyetinin kaynağı buydu.
--
-- Artık tek RPC, tek işlem: ya hepsi olur ya hiçbiri.
--
-- Neyin taşındığı, neyin taşınmadığı (K7):
--
--   TAŞINIR    students.teacher_id          eşleşmenin kendisi
--              student_lessons              haftalık şablon güncel eşleşmenin
--              student_lesson_tracking      paket öğrenciyle gider
--              lesson_instances             yeni öğretmen dersleri görmeli
--              notifications.recipient_id   bildirim yeni öğretmene düşsün
--
--   KALIR      balance_events               işlenen dersin ücreti işleyenindir
--              payment_history              ödeme geçmişi
--              topics.teacher_id            konuyu kim yazdıysa o (admin de olabilir)
--              homework_submissions.teacher_id  ödevi kim verdiyse o
--              notifications.teacher_id     olayın o günkü öğretmeni
--
-- Eski kod son üçünü de taşıyordu; bu, geçmişi yeniden yazmaktı. Yeni
-- öğretmenin onları görmesi zaten eşleşme üzerinden sağlanıyor: topics ve
-- homework_submissions'ın okuma ilkeleri "bu öğrenci benimse" diyor.

CREATE OR REPLACE FUNCTION public.rpc_ogrenciyi_aktar(
  p_ogrenci uuid,
  p_yeni_ogretmen uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_eski uuid;
  v_ders integer := 0;
  v_sablon integer := 0;
  v_takip integer := 0;
  v_bildirim integer := 0;
BEGIN
  IF NOT public.is_admin_caller() THEN
    RETURN json_build_object('success', false, 'error', 'Bu işlem için yetkiniz yok');
  END IF;

  SELECT teacher_id INTO v_eski FROM students WHERE student_id = p_ogrenci FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Öğrenci kaydı bulunamadı');
  END IF;

  IF v_eski = p_yeni_ogretmen THEN
    RETURN json_build_object('success', false, 'error', 'Öğrenci zaten bu öğretmende');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE user_id = p_yeni_ogretmen AND role = 'teacher') THEN
    RETURN json_build_object('success', false, 'error', 'Hedef öğretmen bulunamadı');
  END IF;

  -- Hedefte bu öğrenciye ait bir kayıt zaten varsa, taşımak benzersizlik
  -- kısıtına çarpar ve paket ikiye bölünür. Faz 6b bunu yapısal olarak
  -- imkânsız kılıyor; bugün için açık bir hata daha iyi.
  IF EXISTS (SELECT 1 FROM students WHERE student_id = p_ogrenci AND teacher_id = p_yeni_ogretmen) THEN
    RETURN json_build_object('success', false, 'error',
      'Bu öğrencinin hedef öğretmende zaten bir kaydı var; önce o kaydı temizleyin.');
  END IF;
  IF EXISTS (SELECT 1 FROM student_lesson_tracking
              WHERE student_id = p_ogrenci AND teacher_id = p_yeni_ogretmen) THEN
    RETURN json_build_object('success', false, 'error',
      'Bu öğrencinin hedef öğretmende zaten bir paket kaydı var; önce o kaydı temizleyin.');
  END IF;

  -- students tablosunda updated_at sütunu yok; yalnızca created_at var.
  UPDATE students SET teacher_id = p_yeni_ogretmen
   WHERE student_id = p_ogrenci;

  UPDATE student_lessons SET teacher_id = p_yeni_ogretmen
   WHERE student_id = p_ogrenci AND teacher_id = v_eski;
  GET DIAGNOSTICS v_sablon = ROW_COUNT;

  UPDATE student_lesson_tracking SET teacher_id = p_yeni_ogretmen, updated_at = now()
   WHERE student_id = p_ogrenci AND teacher_id = v_eski;
  GET DIAGNOSTICS v_takip = ROW_COUNT;

  UPDATE lesson_instances SET teacher_id = p_yeni_ogretmen, updated_at = now()
   WHERE student_id = p_ogrenci AND teacher_id = v_eski;
  GET DIAGNOSTICS v_ders = ROW_COUNT;

  UPDATE notifications SET recipient_id = p_yeni_ogretmen
   WHERE student_id = p_ogrenci AND recipient_id = v_eski;
  GET DIAGNOSTICS v_bildirim = ROW_COUNT;

  RETURN json_build_object(
    'success', true,
    'eski_ogretmen', v_eski,
    'yeni_ogretmen', p_yeni_ogretmen,
    'ders', v_ders,
    'sablon', v_sablon,
    'takip', v_takip,
    'bildirim', v_bildirim);
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_ogrenciyi_aktar(uuid, uuid) FROM public;
REVOKE ALL ON FUNCTION public.rpc_ogrenciyi_aktar(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_ogrenciyi_aktar(uuid, uuid) TO authenticated;
