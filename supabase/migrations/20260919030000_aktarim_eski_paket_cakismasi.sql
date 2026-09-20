-- ============================================================================
-- Aktarım: hedef öğretmende duran eski paket, taşımayı düşürmesin
-- ============================================================================
-- 18 Eylül'de admin bir öğrenciyi aktarırken iki kez ham hata aldı (HTTP 409):
--   duplicate key value violates unique constraint
--   "lesson_instances_student_teacher_cycle_lesson_number_key"
--
-- Sebep Faz 6a'dan eski. O günkü transfer kodu işlenmiş dersleri eski öğretmende
-- bırakıyor, yeni öğretmende ise AYNI döngü numarasıyla taze bir paket açıyordu.
-- Bugün beş öğrencide böyle "eskide kalmış" dersler duruyor (sağlık ekranındaki
-- eski_ogretmende_islenmis / yetim_ders kalemleri). Öğrenci o eski öğretmene
-- geri aktarılmak istenince iki paket tek anahtarda buluşuyor:
-- (öğrenci, öğretmen, döngü, ders no) → taşıma düşüyor, öğrenci yerinden
-- oynamıyor. Senaryo seti bunu göremedi çünkü kurguda eskide kalan ders yoktu;
-- 04_bakiye_transfer.sql'e eklendi.
--
-- Çözüm taşımanın içinde ve yalnızca gerektiğinde: hedefte bekleyen eski paket
-- canlı paketle aynı döngü numarasını taşıyorsa, o eski paket kullanılmayan bir
-- arşiv döngüsüne (negatif) alınır. Satırlar silinmez, kazanç defterde olduğu
-- gibi durur (K7); paneller zaten yalnızca güncel döngüyü çizdiği ve döngü
-- numarası hiçbir ekranda yazmadığı için görünür bir değişiklik olmaz. Faz 6a'dan
-- beri bütün ders kayıtları öğrenciyle birlikte taşındığından yeni "eskide kalan"
-- üretilmiyor; bu dal yalnızca o tarihten önceki artıklar için çalışır.

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
  v_dongu integer;
  v_arsiv integer := 0;
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

  -- Hedefte 6a öncesinden kalan, gelen kayıtlarla aynı (döngü, ders no) anahtarını
  -- taşıyan eski paketler: paket bütün olarak, öğrencinin hiçbir kaydında
  -- kullanılmayan bir arşiv döngüsüne alınır (her biri ayrı numaraya).
  FOR v_dongu IN
    SELECT DISTINCT h.package_cycle
      FROM lesson_instances h
     WHERE h.student_id = p_ogrenci AND h.teacher_id = p_yeni_ogretmen
       AND EXISTS (SELECT 1 FROM lesson_instances k
                    WHERE k.student_id = p_ogrenci AND k.teacher_id = v_eski
                      AND k.package_cycle = h.package_cycle
                      AND k.lesson_number = h.lesson_number)
     ORDER BY 1
  LOOP
    UPDATE lesson_instances
       SET package_cycle = (SELECT LEAST(0, min(package_cycle)) - 1
                              FROM lesson_instances WHERE student_id = p_ogrenci)
     WHERE student_id = p_ogrenci AND teacher_id = p_yeni_ogretmen AND package_cycle = v_dongu;
    v_arsiv := v_arsiv + 1;
  END LOOP;

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
    'bildirim', v_bildirim,
    'arsivlenen_paket', v_arsiv);
END;
$function$;
