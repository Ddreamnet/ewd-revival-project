-- ============================================================================
-- Faz 0 · Sistem sağlığı göstergesi
-- ============================================================================
-- Ders sisteminin tutarlılığını tek sorguda ölçer. Amaç, her göçten sonra
-- "bozuldu mu?" sorusunu tek bakışta yanıtlamak ve yeni hasarı aylar sonra
-- değil ertesi gün görmek. Deneme dersi temizlik cron'unun yedi ay boyunca
-- 401 dönüp kimsenin fark etmemesi bu ölçümün yokluğundandı.
--
-- Ölçütler bilinçli olarak dar: yalnızca gerçekten bozuk olan durumlar
-- sayılıyor. Geçmişteki çakışmalar ve eski öğretmende duran *işlenmiş*
-- dersler buraya girmez — birincisi tarih, ikincisi kural gereği doğru
-- (dersi kim işlediyse ücreti onun).

CREATE OR REPLACE FUNCTION public.sistem_sagligi()
RETURNS TABLE(kod text, baslik text, adet bigint, agirlik text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM (
    -- Planlı ders yanlış öğretmende: transferde taşınmamış, yeni öğretmenin
    -- panelinde görünmüyor. İşlenmiş dersler bilerek hariç.
    SELECT 'planli_yanlis_ogretmen'::text, 'Planlı ders eski öğretmende'::text,
           count(*)::bigint, 'kritik'::text
      FROM lesson_instances li
      JOIN students s ON s.student_id = li.student_id
     WHERE li.status = 'planned' AND li.teacher_id <> s.teacher_id

    UNION ALL
    -- Öğretmen profili silinmiş ama ders kaydı duruyor.
    SELECT 'yetim_ders', 'Silinmiş öğretmene bağlı ders kaydı',
           count(*)::bigint, 'kritik'
      FROM lesson_instances li
      LEFT JOIN profiles p ON p.user_id = li.teacher_id
     WHERE p.user_id IS NULL

    UNION ALL
    -- Öğrenci panelinde yabancı ders: panel yalnızca student_id ile
    -- filtrelediği için aynı döngü numarasındaki başka öğretmenin dersleri
    -- de listeye giriyor.
    SELECT 'panelde_yabanci_ders', 'Öğrenci panelinde başka öğretmenin dersi',
           count(*)::bigint, 'kritik'
      FROM students s
      JOIN student_lesson_tracking t
        ON t.student_id = s.student_id AND t.teacher_id = s.teacher_id
      JOIN lesson_instances li
        ON li.student_id = s.student_id
       AND li.package_cycle = t.package_cycle
       AND li.status IN ('planned','completed')
     WHERE s.is_archived = false AND li.teacher_id <> s.teacher_id

    UNION ALL
    -- Tarihi geçmiş ama işaretlenmemiş ders: zincirin başını kilitliyor.
    SELECT 'gecmis_planli_ders', 'Tarihi geçmiş, işlenmemiş ders',
           count(*)::bigint, 'kritik'
      FROM lesson_instances li
      JOIN students s ON s.student_id = li.student_id AND s.teacher_id = li.teacher_id
     WHERE li.status = 'planned'
       AND li.lesson_date < CURRENT_DATE
       AND s.is_archived = false

    UNION ALL
    -- Bugün veya sonrasında çakışan aktif ders (geçmiş çakışmalar tarih).
    SELECT 'gelecek_cakisma', 'Bugün/sonrası çakışan ders çifti',
           count(*)::bigint, 'kritik'
      FROM lesson_instances a
      JOIN lesson_instances b
        ON b.teacher_id = a.teacher_id AND b.lesson_date = a.lesson_date
       AND b.id > a.id AND a.start_time < b.end_time AND a.end_time > b.start_time
     WHERE a.status IN ('planned','completed') AND b.status IN ('planned','completed')
       AND a.lesson_date >= CURRENT_DATE

    UNION ALL
    SELECT 'deneme_cakismasi', 'Bugün/sonrası ders–deneme çakışması',
           count(*)::bigint, 'orta'
      FROM lesson_instances li
      JOIN trial_lessons tl
        ON tl.teacher_id = li.teacher_id AND tl.lesson_date = li.lesson_date
       AND li.start_time < tl.end_time AND li.end_time > tl.start_time
     WHERE li.status IN ('planned','completed') AND li.lesson_date >= CURRENT_DATE

    UNION ALL
    SELECT 'arsivli_planli', 'Arşivli öğrencide duran planlı ders',
           count(*)::bigint, 'orta'
      FROM lesson_instances li
      JOIN students s ON s.student_id = li.student_id AND s.teacher_id = li.teacher_id
     WHERE li.status = 'planned' AND s.is_archived

    UNION ALL
    -- Haftalık ders sayısı ile şablon satır sayısı uyuşmuyor: paket boyu
    -- (slot × 4) hangi sayıdan hesaplanacağı belirsiz hâle geliyor.
    SELECT 'sablon_uyusmazligi', 'Haftalık sayı ile şablon satırı uyuşmuyor',
           count(*)::bigint, 'orta'
      FROM student_lesson_tracking t
      JOIN students s ON s.student_id = t.student_id AND s.teacher_id = t.teacher_id
     WHERE s.is_archived = false
       AND t.lessons_per_week <> (SELECT count(*) FROM student_lessons sl
                                   WHERE sl.student_id = t.student_id
                                     AND sl.teacher_id = t.teacher_id)

    UNION ALL
    SELECT 'tracking_yanlis_ogretmen', 'Takip kaydı eski öğretmende',
           count(*)::bigint, 'orta'
      FROM student_lesson_tracking t
      JOIN students s ON s.student_id = t.student_id
     WHERE t.teacher_id <> s.teacher_id

    UNION ALL
    SELECT 'dersi_olmayan_ogrenci', 'Aktif öğrenci, hiç planlı dersi yok',
           count(*)::bigint, 'orta'
      FROM students s
     WHERE s.is_archived = false
       AND NOT EXISTS (SELECT 1 FROM lesson_instances li
                        WHERE li.student_id = s.student_id
                          AND li.teacher_id = s.teacher_id
                          AND li.status = 'planned')

    UNION ALL
    SELECT 'zoomsuz_ogretmen', 'Öğrencisi olan, Zoom bağlantısı boş öğretmen',
           count(*)::bigint, 'orta'
      FROM profiles p
     WHERE p.role = 'teacher'
       AND nullif(btrim(p.zoom_link), '') IS NULL
       AND EXISTS (SELECT 1 FROM students s
                    WHERE s.teacher_id = p.user_id AND s.is_archived = false)

    UNION ALL
    SELECT 'tekrarli_ders_numarasi', 'Aynı döngüde tekrar eden ders numarası',
           coalesce(sum(x.fazla), 0)::bigint, 'dusuk'
      FROM (SELECT count(*) - 1 AS fazla
              FROM lesson_instances
             WHERE status IN ('planned','completed')
             GROUP BY student_id, teacher_id, package_cycle, lesson_number
            HAVING count(*) > 1) x
  ) t(kod, baslik, adet, agirlik)
  -- Yalnızca admin okur. Sayılar kişisel veri taşımıyor ama kurum geneline
  -- ait; öğretmen çağırırsa boş küme döner. `postgres`/`supabase_admin`
  -- rolleri zaten her satırı görebildiği için SQL düzenleyiciden ve
  -- göç doğrulamasından da okunabilsin. `session_user` kullanılıyor:
  -- SECURITY DEFINER içinde `current_user` her zaman işlevin sahibidir
  -- (postgres), yani o koşul herkese açık olurdu. PostgREST üzerinden gelen
  -- istekte session_user = 'authenticator'.
  WHERE public.is_admin_caller()
     OR session_user IN ('postgres', 'supabase_admin');
$$;

COMMENT ON FUNCTION public.sistem_sagligi() IS
  'Ders sisteminin tutarlılık göstergeleri. Admin panelindeki sağlık kartı ve her göç sonrası doğrulama için.';

REVOKE ALL ON FUNCTION public.sistem_sagligi() FROM public;
REVOKE ALL ON FUNCTION public.sistem_sagligi() FROM anon;
GRANT EXECUTE ON FUNCTION public.sistem_sagligi() TO authenticated;
