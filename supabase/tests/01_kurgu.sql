-- ============================================================================
-- Senaryo testleri · 1/5 · Kurgu
-- ============================================================================
-- Bu dizindeki dosyalar sırayla, Supabase SQL editöründe (postgres rolüyle)
-- çalıştırılır. Gerçek öğrencilere dokunmaz: kendi öğretmenini ve
-- öğrencilerini kurar, sonunda 99_temizlik.sql hepsini siler.
--
-- Neden var: Faz 6b'de bir UNIQUE kısıtı değişince program kurucusunun
-- ON CONFLICT'i kırıldı ve bir gün boyunca hiç öğrenci eklenemedi. Faz 1'de
-- "çakışma engel değil" denirken bir tetikleyici gözden kaçtı. İkisi de faz
-- bazlı testlerle yakalanamadı; çünkü her faz yalnızca kendi değiştirdiğini
-- sınıyordu. Bu set kümülatif: her değişiklikten sonra tamamı koşulur.
--
-- Kimlikler sabit ve tanınabilir (dead-beef-...-0000-0000000000xx).

-- Sonuç tablosu (kalıcı; temizlikte düşer)
DROP TABLE IF EXISTS public.zz_test_sonuc;
CREATE TABLE public.zz_test_sonuc (
  sira serial PRIMARY KEY,
  bolum text NOT NULL,
  senaryo text NOT NULL,
  beklenen text NOT NULL,          -- 'ok' | 'ret' | 'uyari'
  gerceklesen text NOT NULL,       -- 'ok' | 'ret' | 'uyari' | 'HAM ISTISNA' | 'YANLIS SONUC'
  ayrinti text
);

-- ─── Kimlikler ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.zz_id(p_ek text) RETURNS uuid
LANGUAGE sql IMMUTABLE AS $$
  SELECT ('00000000-dead-beef-0000-0000000000' || CASE p_ek
    WHEN 't1' THEN '01' WHEN 't2' THEN '02'
    WHEN 'a1' THEN '0a' WHEN 'b1' THEN '0b' WHEN 'c1' THEN '0c' WHEN 'd1' THEN '0d' END)::uuid
$$;
-- zz_id('t1') öğretmen 1 · zz_id('t2') öğretmen 2 · zz_id('a1') şablonlu ·
-- zz_id('b1') şablonsuz · zz_id('c1') çakışma kurbanı · zz_id('d1') yaşam döngüsü

-- ─── Admin kimliğiyle çağır ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.zz_admin_ol() RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_adm uuid;
BEGIN
  SELECT user_id INTO v_adm FROM user_roles WHERE role = 'admin' LIMIT 1;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_adm, 'role', 'authenticated')::text, true);
END $$;

-- ─── Sonuç yaz ──────────────────────────────────────────────────────────
-- p_j: RPC'nin döndürdüğü json. Beklenen 'ok' ise success=true ve uyarı yok;
-- 'uyari' ise success=true ve warnings dolu; 'ret' ise success=false.
CREATE OR REPLACE FUNCTION public.zz_kaydet(p_bolum text, p_ad text, p_beklenen text, p_j json, p_ek text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_g text; v_uyari text;
BEGIN
  v_uyari := NULLIF(p_j->>'warnings', '[]');
  v_g := CASE
    WHEN COALESCE((p_j->>'success')::boolean, false) AND v_uyari IS NOT NULL THEN 'uyari'
    WHEN COALESCE((p_j->>'success')::boolean, false) THEN 'ok'
    ELSE 'ret' END;
  INSERT INTO public.zz_test_sonuc (bolum, senaryo, beklenen, gerceklesen, ayrinti)
  VALUES (p_bolum, p_ad, p_beklenen, v_g,
          COALESCE(p_ek, p_j->>'error', p_j->>'note', LEFT(v_uyari, 80)));
END $$;

CREATE OR REPLACE FUNCTION public.zz_istisna(p_bolum text, p_ad text, p_beklenen text, p_hata text)
RETURNS void LANGUAGE sql AS $$
  INSERT INTO public.zz_test_sonuc (bolum, senaryo, beklenen, gerceklesen, ayrinti)
  VALUES (p_bolum, p_ad, p_beklenen, 'HAM ISTISNA', LEFT(p_hata, 120));
$$;

-- Bir ölçümün doğruluğu (tarih listesi, sayı vb.)
CREATE OR REPLACE FUNCTION public.zz_dogrula(p_bolum text, p_ad text, p_beklenen text, p_gercek text)
RETURNS void LANGUAGE sql AS $$
  INSERT INTO public.zz_test_sonuc (bolum, senaryo, beklenen, gerceklesen, ayrinti)
  VALUES (p_bolum, p_ad, 'ok', CASE WHEN p_beklenen = p_gercek THEN 'ok' ELSE 'YANLIS SONUC' END,
          CASE WHEN p_beklenen = p_gercek THEN p_gercek ELSE 'beklenen: ' || p_beklenen || ' · gelen: ' || p_gercek END);
$$;

-- ─── Fikstür ────────────────────────────────────────────────────────────
-- Referans haftası: 2027-01-04 Pazartesi. Bugünden uzak olsun ki üreteç
-- "geçmişe ders üretilmez" kuralına takılmasın ve gerçek takvimle çakışmasın.
CREATE OR REPLACE FUNCTION public.zz_kur() RETURNS void LANGUAGE plpgsql AS $$
DECLARE d date := DATE '2027-01-04'; i int;
BEGIN
  PERFORM public.zz_yik();

  INSERT INTO auth.users (id, email) VALUES
    (zz_id('t1'), 'zz-t1@test.invalid'), (zz_id('t2'), 'zz-t2@test.invalid'),
    (zz_id('a1'), 'zz-a1@test.invalid'), (zz_id('b1'), 'zz-b1@test.invalid'),
    (zz_id('c1'), 'zz-c1@test.invalid'), (zz_id('d1'), 'zz-d1@test.invalid');
  -- handle_new_user profilleri 'User' adıyla açar; düzelt.
  UPDATE profiles SET full_name = 'ZZ Ogretmen Bir', role = 'teacher' WHERE user_id = zz_id('t1');
  UPDATE profiles SET full_name = 'ZZ Ogretmen Iki', role = 'teacher' WHERE user_id = zz_id('t2');
  UPDATE profiles SET full_name = 'ZZ Sablonlu'      WHERE user_id = zz_id('a1');
  UPDATE profiles SET full_name = 'ZZ Sablonsuz'     WHERE user_id = zz_id('b1');
  UPDATE profiles SET full_name = 'ZZ Cakisma'       WHERE user_id = zz_id('c1');
  UPDATE profiles SET full_name = 'ZZ Yasam'         WHERE user_id = zz_id('d1');
  INSERT INTO user_roles (user_id, role) VALUES
    (zz_id('t1'),'teacher'), (zz_id('t2'),'teacher'),
    (zz_id('a1'),'student'), (zz_id('b1'),'student'), (zz_id('c1'),'student'), (zz_id('d1'),'student')
  ON CONFLICT DO NOTHING;

  INSERT INTO students (teacher_id, student_id) VALUES
    (zz_id('t1'), zz_id('a1')), (zz_id('t1'), zz_id('b1')), (zz_id('t1'), zz_id('c1'));

  -- A: Pazartesi 10:00 + 11:00 (haftada 2), 8 ders, 4 hafta
  INSERT INTO student_lessons (student_id, teacher_id, day_of_week, start_time, end_time) VALUES
    (zz_id('a1'), zz_id('t1'), 1, '10:00', '10:30'), (zz_id('a1'), zz_id('t1'), 1, '11:00', '11:30');
  INSERT INTO student_lesson_tracking (student_id, teacher_id, lessons_per_week, package_cycle, total_lessons)
    VALUES (zz_id('a1'), zz_id('t1'), 2, 1, 8);
  FOR i IN 0..3 LOOP
    INSERT INTO lesson_instances (student_id, teacher_id, lesson_number, lesson_date, start_time, end_time, status, package_cycle, tur)
    VALUES (zz_id('a1'), zz_id('t1'), i*2+1, d + i*7, '10:00', '10:30', 'planned', 1, 'ders'),
           (zz_id('a1'), zz_id('t1'), i*2+2, d + i*7, '11:00', '11:30', 'planned', 1, 'ders');
  END LOOP;

  -- B: şablonu yok, 4 planlı Salı dersi var (gerçekte olabilen bozuk durum)
  INSERT INTO student_lesson_tracking (student_id, teacher_id, lessons_per_week, package_cycle, total_lessons)
    VALUES (zz_id('b1'), zz_id('t1'), 1, 1, 4);
  FOR i IN 0..3 LOOP
    INSERT INTO lesson_instances (student_id, teacher_id, lesson_number, lesson_date, start_time, end_time, status, package_cycle, tur)
    VALUES (zz_id('b1'), zz_id('t1'), i+1, d + 1 + i*7, '14:00', '14:30', 'planned', 1, 'ders');
  END LOOP;

  -- C: Çarşamba 10:00 tek ders — A'nın taşınabileceği "başkasının dersi"
  INSERT INTO student_lessons (student_id, teacher_id, day_of_week, start_time, end_time)
    VALUES (zz_id('c1'), zz_id('t1'), 3, '10:00', '10:30');
  INSERT INTO student_lesson_tracking (student_id, teacher_id, lessons_per_week, package_cycle, total_lessons)
    VALUES (zz_id('c1'), zz_id('t1'), 1, 1, 4);
  INSERT INTO lesson_instances (student_id, teacher_id, lesson_number, lesson_date, start_time, end_time, status, package_cycle, tur)
    VALUES (zz_id('c1'), zz_id('t1'), 1, d + 2, '10:00', '10:30', 'planned', 1, 'ders');

  -- Anlık görüntü: sıfırlama buna döner
  DROP TABLE IF EXISTS public.zz_test_snap;
  CREATE TABLE public.zz_test_snap AS
    SELECT id, student_id, teacher_id, lesson_number, lesson_date, start_time, end_time, status,
           original_date, original_start_time, original_end_time, rescheduled_count,
           is_manual_override, shift_group_id, package_cycle
      FROM lesson_instances WHERE teacher_id = zz_id('t1');
END $$;

-- ─── Sıfırla: dersleri anlık görüntüye döndür ───────────────────────────
CREATE OR REPLACE FUNCTION public.zz_sifirla() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM lesson_instances WHERE teacher_id IN (zz_id('t1'), zz_id('t2'))
     AND id NOT IN (SELECT id FROM public.zz_test_snap);
  UPDATE lesson_instances SET lesson_number = -abs(lesson_number) - 500
   WHERE teacher_id IN (zz_id('t1'), zz_id('t2'));
  UPDATE lesson_instances li
     SET lesson_number = s.lesson_number, lesson_date = s.lesson_date, teacher_id = s.teacher_id,
         start_time = s.start_time, end_time = s.end_time, status = s.status,
         original_date = s.original_date, original_start_time = s.original_start_time,
         original_end_time = s.original_end_time, rescheduled_count = s.rescheduled_count,
         is_manual_override = s.is_manual_override, shift_group_id = s.shift_group_id,
         package_cycle = s.package_cycle
    FROM public.zz_test_snap s WHERE li.id = s.id;
  DELETE FROM balance_events WHERE teacher_id IN (zz_id('t1'), zz_id('t2'));
  UPDATE student_lesson_tracking SET package_cycle = 1, teacher_id = zz_id('t1')
   WHERE student_id IN (zz_id('a1'), zz_id('b1'), zz_id('c1'));
  UPDATE students SET teacher_id = zz_id('t1'), is_archived = false
   WHERE student_id IN (zz_id('a1'), zz_id('b1'), zz_id('c1'));
  UPDATE student_lessons SET teacher_id = zz_id('t1') WHERE student_id IN (zz_id('a1'), zz_id('c1'));
END $$;

-- ─── Yık ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.zz_yik() RETURNS void LANGUAGE plpgsql AS $$
DECLARE ids uuid[] := ARRAY[zz_id('t1'), zz_id('t2'), zz_id('a1'), zz_id('b1'), zz_id('c1'), zz_id('d1')];
BEGIN
  DELETE FROM balance_events WHERE teacher_id = ANY(ids) OR student_id = ANY(ids);
  DELETE FROM lesson_instances WHERE teacher_id = ANY(ids) OR student_id = ANY(ids);
  DELETE FROM student_lessons WHERE teacher_id = ANY(ids) OR student_id = ANY(ids);
  DELETE FROM student_lesson_tracking WHERE teacher_id = ANY(ids) OR student_id = ANY(ids);
  DELETE FROM students WHERE teacher_id = ANY(ids) OR student_id = ANY(ids);
  DELETE FROM notifications WHERE teacher_id = ANY(ids) OR student_id = ANY(ids) OR recipient_id = ANY(ids);
  DELETE FROM admin_notifications WHERE teacher_id = ANY(ids) OR student_id = ANY(ids);
  DELETE FROM teacher_balance_opening WHERE teacher_id = ANY(ids);
  DELETE FROM user_roles WHERE user_id = ANY(ids);
  DELETE FROM profiles WHERE user_id = ANY(ids);
  DELETE FROM auth.users WHERE id = ANY(ids);
  DROP TABLE IF EXISTS public.zz_test_snap;
END $$;

-- Ders kimliği (tarih + saat ile)
CREATE OR REPLACE FUNCTION public.zz_ders(p_ogr text, p_tarih date, p_saat time) RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT id FROM lesson_instances WHERE student_id = zz_id(p_ogr) AND lesson_date = p_tarih AND start_time = p_saat LIMIT 1
$$;

-- Öğrencinin programı tek satırda: "05.01 10:00 | 05.01 11:00 | ..."
CREATE OR REPLACE FUNCTION public.zz_program(p_ogr text) RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT string_agg(to_char(lesson_date,'DD.MM') || ' ' || to_char(start_time,'HH24:MI'), ' | ' ORDER BY lesson_date, start_time)
    FROM lesson_instances WHERE student_id = zz_id(p_ogr) AND status IN ('planned','completed')
$$;

SELECT public.zz_kur();
SELECT 'kurgu hazır' AS durum, count(*) AS ders FROM lesson_instances WHERE teacher_id = zz_id('t1');

-- Gerçekte her RPC ayrı işlemdir ve ayrı saniyede damgalanır; test tek işlem
-- olduğu için now() hep aynı kalır ve "ödemeden önce / sonra" ayrımı yapılamaz.
-- Bu yardımcı öğretmenin mevcut defter kayıtlarını bir saniye geriye çeker:
-- "saat ilerledi, bundan sonraki kayıt daha sonra" etkisi.
CREATE OR REPLACE FUNCTION public.zz_saat_ilerlet(p_ogretmen uuid) RETURNS void LANGUAGE sql AS $$
  UPDATE public.balance_events SET created_at = created_at - interval '1 second' WHERE teacher_id = p_ogretmen;
$$;
