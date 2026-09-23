-- Öğrenci Ayarları'nda "kaçıncı döngü" alanı: admin numarayı elle düzeltebilsin.
--
-- Döngü numarası üç tabloda birden yaşıyor (student_lesson_tracking,
-- lesson_instances, balance_events) ve her ekran "şimdiki döngü" derslerini
-- tracking.package_cycle ile eşleştirerek buluyor. Yalnızca tracking'i değiştirmek
-- öğrencinin bütün derslerini listeden düşürürdü. Bu yüzden numara bir kaydırma
-- olarak uygulanır: bu öğretmendeki bütün pozitif döngüler aynı miktarda kayar,
-- sıraları ve birbirinden ayrılıkları korunur.
--
-- Negatif döngülere dokunulmaz: rpc_ogrenciyi_aktar eski öğretmenden taşınan
-- geçmişi oraya park ediyor.

CREATE OR REPLACE FUNCTION public.rpc_dongu_numarasini_ayarla(
  p_student_id uuid,
  p_teacher_id uuid,
  p_yeni_dongu integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_mevcut integer;
  v_en_kucuk integer;
  v_fark integer;
  -- Geçici park payı: UNIQUE (öğrenci, öğretmen, döngü, ders no) ara adımda
  -- çakışmasın diye satırlar önce bu kadar yukarı alınıp sonra indirilir.
  c_pay constant integer := 1000000;
BEGIN
  IF NOT public.is_admin_caller() THEN
    RETURN json_build_object('success', false, 'error', 'Bu işlem için yetkiniz yok');
  END IF;

  IF p_yeni_dongu IS NULL OR p_yeni_dongu < 1 OR p_yeni_dongu >= c_pay THEN
    RETURN json_build_object('success', false, 'error', 'Döngü numarası 1 veya daha büyük olmalı');
  END IF;

  SELECT package_cycle INTO v_mevcut
  FROM student_lesson_tracking
  WHERE student_id = p_student_id AND teacher_id = p_teacher_id
  FOR UPDATE;

  IF v_mevcut IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Öğrencinin paket kaydı bulunamadı');
  END IF;

  v_fark := p_yeni_dongu - v_mevcut;
  IF v_fark = 0 THEN
    RETURN json_build_object('success', true, 'cycle', v_mevcut);
  END IF;

  SELECT min(c) INTO v_en_kucuk FROM (
    SELECT package_cycle AS c FROM lesson_instances
    WHERE student_id = p_student_id AND teacher_id = p_teacher_id AND package_cycle > 0
    UNION ALL
    SELECT package_cycle FROM balance_events
    WHERE student_id = p_student_id AND teacher_id = p_teacher_id AND package_cycle > 0
    UNION ALL
    SELECT v_mevcut
  ) x;

  IF v_en_kucuk + v_fark < 1 THEN
    RETURN json_build_object(
      'success', false,
      'error', format('Bu öğrencinin %s eski döngüsü var; numara en az %s olabilir',
                      v_mevcut - v_en_kucuk, v_mevcut - v_en_kucuk + 1)
    );
  END IF;

  UPDATE lesson_instances SET package_cycle = package_cycle + v_fark + c_pay
  WHERE student_id = p_student_id AND teacher_id = p_teacher_id AND package_cycle > 0;
  UPDATE lesson_instances SET package_cycle = package_cycle - c_pay
  WHERE student_id = p_student_id AND teacher_id = p_teacher_id AND package_cycle > c_pay;

  UPDATE balance_events SET package_cycle = package_cycle + v_fark
  WHERE student_id = p_student_id AND teacher_id = p_teacher_id AND package_cycle > 0;

  UPDATE student_lesson_tracking SET package_cycle = p_yeni_dongu, updated_at = now()
  WHERE student_id = p_student_id AND teacher_id = p_teacher_id;

  RETURN json_build_object('success', true, 'cycle', p_yeni_dongu);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.rpc_dongu_numarasini_ayarla(uuid, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_dongu_numarasini_ayarla(uuid, uuid, integer) TO authenticated, service_role;
