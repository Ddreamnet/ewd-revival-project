-- Faz 6c'den sonra öğretmen ilkeleri artık eşleşmeye bakıyor: "bu öğrenci
-- benim mi". Dolayısıyla student_lessons.teacher_id erişim için kullanılmıyor
-- ama admin panelinin sorgularında hâlâ okunuyor. İkisi ayrışırsa sessiz bir
-- tutarsızlık olur — ders kayıtları ve paket için zaten ölçüt var, şablon için
-- yoktu. Üçüncüsü de ekleniyor.
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
     WHERE li.status = 'planned' AND li.lesson_date < CURRENT_DATE AND s.is_archived = false
    UNION ALL
    SELECT 'gelecek_cakisma', 'Bugün/sonrası çakışan ders çifti', count(*)::bigint, 'kritik'
      FROM lesson_instances a JOIN lesson_instances b
        ON b.teacher_id = a.teacher_id AND b.lesson_date = a.lesson_date AND b.id > a.id
       AND a.start_time < b.end_time AND a.end_time > b.start_time
     WHERE a.status IN ('planned','completed') AND b.status IN ('planned','completed')
       AND a.lesson_date >= CURRENT_DATE
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
