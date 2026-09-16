-- ============================================================================
-- Senaryo testleri · 3/5 · Öğrenci yaşam döngüsü
-- ============================================================================
-- Oluştur → programı değiştir → hatalı girdi → işle → paketi sıfırla →
-- arşivle → geri yükle → sil. Öğrenci d1 bu dosyada doğar ve ölür.
-- Ayrıca üretecin (rpc_paketi_tamamla) iki sınır durumu: dolu slota atama ve
-- geçmişe ders üretmeme.

DO $$
DECLARE
  bol text := 'yasam';
  t uuid := zz_id('t1'); s uuid := zz_id('d1');
  rec uuid; j json; n1 int; n2 int; n3 int; id1 uuid;
  bugun_dow int := EXTRACT(DOW FROM CURRENT_DATE)::int;
BEGIN
  PERFORM zz_admin_ol();
  PERFORM zz_sifirla();
  -- Önceki koşuda 12. adım profili sildi; öğrenci burada yeniden doğar.
  INSERT INTO profiles (user_id, email, full_name, role, language)
    VALUES (s, 'zz-d1@test.invalid', 'ZZ Yasam', 'student', 'en') ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO user_roles (user_id, role) VALUES (s, 'student') ON CONFLICT DO NOTHING;
  DELETE FROM students WHERE student_id = s;

  -- ── 0) Taze öğrenci, bugünün geçmiş saatine şablon: geçmişe ders yok ────
  --     (Türkiye saatine göre; DB UTC'de olduğu için gün adı da oradan alınır)
  BEGIN
    INSERT INTO students (student_id, teacher_id) VALUES (s, t);
    j := rpc_sync_student_schedule(s, t, jsonb_build_array(
           jsonb_build_object('dayOfWeek', EXTRACT(DOW FROM (now() AT TIME ZONE 'Europe/Istanbul'))::int,
                              'startTime', '00:01', 'endTime', '00:31')), 1);
    PERFORM zz_kaydet(bol, '00 Taze öğrenci, bugünün geçmiş saatine şablon', 'ok', j);
    PERFORM zz_dogrula(bol, '00a ... şu andan önceye ders yok', 'true',
      (SELECT (min(lesson_date + start_time) > (now() AT TIME ZONE 'Europe/Istanbul'))::text
         FROM lesson_instances WHERE student_id = s AND status = 'planned'));
  EXCEPTION WHEN OTHERS THEN PERFORM zz_istisna(bol, '00 Taze öğrenci geçmiş saat', 'ok', SQLERRM); END;

  -- ── 1) Oluştur (create-student'in veritabanı adımları) ──────────────
  BEGIN
    j := rpc_sync_student_schedule(s, t, jsonb_build_array(
           jsonb_build_object('dayOfWeek', 1, 'startTime', '15:00', 'endTime', '15:30'),
           jsonb_build_object('dayOfWeek', 3, 'startTime', '15:00', 'endTime', '15:30')), 2);
    SELECT count(*) INTO n1 FROM student_lessons WHERE student_id = s;
    SELECT total_lessons INTO n2 FROM student_lesson_tracking WHERE student_id = s;
    SELECT count(*) INTO n3 FROM lesson_instances WHERE student_id = s AND status = 'planned';
    PERFORM zz_kaydet(bol, '01 Öğrenci oluştur (2 slot)', 'ok', j, format('şablon %s · paket %s · planlı %s', n1, n2, n3));
    PERFORM zz_dogrula(bol, '01a ... 8 planlı ders', '8', n3::text);
    PERFORM zz_dogrula(bol, '01b ... hiçbiri bugünden önce değil', 'true',
      (SELECT (min(lesson_date) >= CURRENT_DATE)::text FROM lesson_instances WHERE student_id = s));
  EXCEPTION WHEN OTHERS THEN PERFORM zz_istisna(bol, '01 Öğrenci oluştur', 'ok', SQLERRM); END;

  -- ── 2) Programı değiştir: 3 slot ────────────────────────────────────
  BEGIN
    j := rpc_sync_student_schedule(s, t, jsonb_build_array(
           jsonb_build_object('dayOfWeek', 1, 'startTime', '15:00', 'endTime', '15:30'),
           jsonb_build_object('dayOfWeek', 3, 'startTime', '15:00', 'endTime', '15:30'),
           jsonb_build_object('dayOfWeek', 5, 'startTime', '15:00', 'endTime', '15:30')), 3);
    SELECT count(*) INTO n3 FROM lesson_instances WHERE student_id = s AND status = 'planned';
    PERFORM zz_kaydet(bol, '02 Programı değiştir (3 slot)', 'ok', j, format('planlı %s', n3));
    PERFORM zz_dogrula(bol, '02a ... 12 planlı ders', '12', n3::text);
  EXCEPTION WHEN OTHERS THEN PERFORM zz_istisna(bol, '02 Programı değiştir', 'ok', SQLERRM); END;

  -- ── 3-4) Hatalı girdi: nazik ret, program bozulmaz ──────────────────
  BEGIN
    PERFORM zz_kaydet(bol, '03 Aynı gün+saate iki slot', 'ret', rpc_sync_student_schedule(s, t, jsonb_build_array(
      jsonb_build_object('dayOfWeek', 1, 'startTime', '15:00', 'endTime', '15:30'),
      jsonb_build_object('dayOfWeek', 1, 'startTime', '15:00:00', 'endTime', '15:30')), 2));
    PERFORM zz_kaydet(bol, '04 Bitiş başlangıçtan önce', 'ret', rpc_sync_student_schedule(s, t, jsonb_build_array(
      jsonb_build_object('dayOfWeek', 2, 'startTime', '12:00', 'endTime', '11:30')), 1));
    SELECT count(*) INTO n3 FROM lesson_instances WHERE student_id = s AND status = 'planned';
    PERFORM zz_dogrula(bol, '05 Hatalı girdiden sonra program sağlam', '12', n3::text);
  EXCEPTION WHEN OTHERS THEN PERFORM zz_istisna(bol, '03-05 Hatalı girdi', 'ret', SQLERRM); END;

  -- ── 6) İlk dersi işle, programı yeniden kaydet: işlenen kalır ───────
  BEGIN
    SELECT id INTO id1 FROM lesson_instances WHERE student_id = s AND status = 'planned' ORDER BY lesson_date, start_time LIMIT 1;
    PERFORM rpc_complete_lesson(id1, t);
    j := rpc_sync_student_schedule(s, t, jsonb_build_array(
           jsonb_build_object('dayOfWeek', 1, 'startTime', '15:00', 'endTime', '15:30'),
           jsonb_build_object('dayOfWeek', 3, 'startTime', '15:00', 'endTime', '15:30'),
           jsonb_build_object('dayOfWeek', 5, 'startTime', '15:00', 'endTime', '15:30')), 3);
    SELECT count(*) FILTER (WHERE status = 'completed'), count(*) INTO n1, n3
      FROM lesson_instances WHERE student_id = s AND status IN ('planned','completed');
    PERFORM zz_kaydet(bol, '06 İşledikten sonra programı kaydet', 'ok', j);
    PERFORM zz_dogrula(bol, '06a ... işlenen 1, toplam 12', '1|12', n1 || '|' || n3);
  EXCEPTION WHEN OTHERS THEN PERFORM zz_istisna(bol, '06 İşledikten sonra kaydet', 'ok', SQLERRM); END;

  -- ── 7) Paketi sıfırla ───────────────────────────────────────────────
  BEGIN
    j := rpc_reset_package(s, t, (SELECT jsonb_agg(jsonb_build_object('dayOfWeek', day_of_week,
           'startTime', start_time, 'endTime', end_time)) FROM student_lessons WHERE student_id = s));
    SELECT package_cycle INTO n1 FROM student_lesson_tracking WHERE student_id = s;
    SELECT count(*) INTO n3 FROM lesson_instances WHERE student_id = s AND status = 'planned' AND package_cycle = n1;
    SELECT count(*) INTO n2 FROM lesson_instances WHERE student_id = s AND status = 'completed' AND package_cycle = 1;
    PERFORM zz_kaydet(bol, '07 Paketi sıfırla', 'ok', j);
    PERFORM zz_dogrula(bol, '07a ... döngü 2, 12 planlı, eski döngünün işleneni duruyor', '2|12|1', n1 || '|' || n3 || '|' || n2);
  EXCEPTION WHEN OTHERS THEN PERFORM zz_istisna(bol, '07 Paketi sıfırla', 'ok', SQLERRM); END;

  -- ── 8) Arşivle: planlılar gider, defter değişmez ────────────────────
  SELECT id INTO rec FROM students WHERE student_id = s;
  BEGIN
    SELECT COALESCE(sum(amount_minutes),0) INTO n2 FROM balance_events WHERE teacher_id = t;
    j := rpc_archive_student(rec, s, t);
    SELECT count(*) INTO n1 FROM lesson_instances WHERE student_id = s AND status = 'planned';
    SELECT COALESCE(sum(amount_minutes),0) INTO n3 FROM balance_events WHERE teacher_id = t;
    PERFORM zz_kaydet(bol, '08 Arşivle', 'ok', j);
    PERFORM zz_dogrula(bol, '08a ... planlı 0, defter aynı', '0|' || n2, n1 || '|' || n3);
  EXCEPTION WHEN OTHERS THEN PERFORM zz_istisna(bol, '08 Arşivle', 'ok', SQLERRM); END;

  -- ── 9) Geri yükle: paket boyu kadar, çakışmasız, kopyasız ───────────
  BEGIN
    j := rpc_restore_student(rec, s, t);
    SELECT package_cycle, total_lessons INTO n1, n2 FROM student_lesson_tracking WHERE student_id = s;
    SELECT count(*) INTO n3 FROM lesson_instances WHERE student_id = s AND status IN ('planned','completed') AND package_cycle = n1;
    PERFORM zz_kaydet(bol, '09 Arşivden geri yükle', 'ok', j);
    PERFORM zz_dogrula(bol, '09a ... döngüdeki ders sayısı = paket boyu', n2::text, n3::text);
    PERFORM zz_dogrula(bol, '09b ... aynı slotta iki ders yok', '0',
      (SELECT count(*)::text FROM (SELECT 1 FROM lesson_instances WHERE student_id = s AND status IN ('planned','completed')
                                    GROUP BY lesson_date, start_time HAVING count(*) > 1) x));
    PERFORM zz_dogrula(bol, '09c ... arşiv bayrağı kalktı', 'false', (SELECT is_archived::text FROM students WHERE student_id = s));
  EXCEPTION WHEN OTHERS THEN PERFORM zz_istisna(bol, '09 Arşivden geri yükle', 'ok', SQLERRM); END;

  -- ── 10) Üreteç, DOLU slota atama: dersler yine yazılır, UYARI döner ───
  --     c1'e önümüzdeki 6 Pazartesi 10:00'a ders konur; d1'e aynı slot
  --     verilince çakışma engel değil (K5) ama admin bilmeli.
  BEGIN
    INSERT INTO lesson_instances (student_id, teacher_id, lesson_number, lesson_date, start_time, end_time, status, package_cycle, tur)
    SELECT zz_id('c1'), t, 100 + g, pzt, '10:00', '10:30', 'planned', 1, 'ders'
      FROM (SELECT g, ((now() AT TIME ZONE 'Europe/Istanbul')::date
                       + ((8 - EXTRACT(DOW FROM (now() AT TIME ZONE 'Europe/Istanbul'))::int) % 7) + 7 * g) AS pzt
              FROM generate_series(0, 5) g) x;
    j := rpc_sync_student_schedule(s, t, jsonb_build_array(
           jsonb_build_object('dayOfWeek', 1, 'startTime', '10:00', 'endTime', '10:30')), 1);
    PERFORM zz_kaydet(bol, '10 Başka öğrencinin slotuna program', 'uyari', j);
    SELECT count(*) INTO n3 FROM lesson_instances WHERE student_id = s AND status = 'planned';
    PERFORM zz_dogrula(bol, '10a ... 4 ders yine de üretildi, ilk ders bu haftaki Pazartesi', '4|true',
      n3 || '|' || (SELECT (min(lesson_date) <= (now() AT TIME ZONE 'Europe/Istanbul')::date + 7)::text
                      FROM lesson_instances WHERE student_id = s AND status = 'planned'));
    PERFORM zz_dogrula(bol, '10b ... dört çakışma uyarısı', '4', jsonb_array_length((j->'warnings')::jsonb)::text);
  EXCEPTION WHEN OTHERS THEN PERFORM zz_istisna(bol, '10 Dolu slota program', 'uyari', SQLERRM); END;

  -- ── 12) Sil: kayıtlar gider, öğretmenin kazancı kalır ───────────────
  BEGIN
    SELECT COALESCE(sum(amount_minutes),0) INTO n2 FROM balance_events WHERE teacher_id = t;
    j := rpc_delete_student(rec, s, t);
    SELECT count(*) INTO n1 FROM lesson_instances WHERE student_id = s;
    SELECT COALESCE(sum(amount_minutes),0) INTO n3 FROM balance_events WHERE teacher_id = t;
    PERFORM zz_kaydet(bol, '12 Öğrenciyi sil', 'ok', j);
    PERFORM zz_dogrula(bol, '12a ... ders 0, defter aynı', '0|' || n2, n1 || '|' || n3);
  EXCEPTION WHEN OTHERS THEN PERFORM zz_istisna(bol, '12 Öğrenciyi sil', 'ok', SQLERRM); END;

  PERFORM zz_sifirla();
END $$;

SELECT sira, senaryo, beklenen, gerceklesen, LEFT(ayrinti, 90) AS ayrinti
  FROM public.zz_test_sonuc WHERE bolum = 'yasam' ORDER BY sira;
