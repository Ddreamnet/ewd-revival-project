-- ============================================================================
-- Bakiye dökümü · bakiyeye yazılan dersler iki panelde canlı liste
-- ============================================================================
-- İstenen: öğretmen ve admin, bakiyeyi oluşturan dersleri tek tek görsün.
-- Ders işlenince satır anında düşsün, geri alınınca kalksın, deneme dersi de
-- görünsün, admin bakiyeyi sıfırlayınca liste de sıfırlansın.
--
-- Yeni bir tablo ya da sayaç yok: liste, bakiyenin kendisi gibi defterden
-- (balance_events) türetiliyor. Dönem sınırı da görünümle aynı yerden geliyor
-- — teacher_balance artık çapasını (period_start) ve açılıştan devreden ders
-- sayısını (opening_lessons) dışarı veriyor; döküm bunları okuyor. Aynı kural
-- iki yerde yazılı olmadığı için liste ile sayaçlar ayrışamaz.
--
-- İnceleme sırasında çıkan iki bulgu da burada kapanıyor:
--
-- 1) GÖRÜNÜM GÜVENLİĞİ. 20260917013000, görünümü `WITH (security_invoker = on)`
--    yazmadan yeniden oluşturdu. CREATE OR REPLACE VIEW seçenek listesini
--    "boş olsa bile" yenisiyle değiştirir; yani görünüm sahibinin yetkisiyle
--    çalışmaya başladı ve RLS'yi atladı: oturum açmış herkes (öğrenci dâhil)
--    bütün öğretmenlerin bakiyesini okuyabilir hâle geldi. Seçenek geri geliyor.
--
-- 2) GERİ ALMA, KAZANCI YAZANDAN DÜŞMELİ. Geri alma eksi satırı "şu anki
--    öğretmene" ve "dersin şu anki süresine" göre yazıyordu. Transferden sonra
--    yeni öğretmen eski öğretmenin işlediği dersi geri alırsa eski öğretmenin
--    kazancı yerinde kalıyor, yeni öğretmen hiç almadığı 30 dakikayı
--    borçlanıyordu (K7'nin tersi). İşlenmiş bir dersin saati sonradan
--    değiştirildiyse de yazılan ile düşülen dakika tutmuyordu. Geri alma artık
--    o dersin son kazanç satırını birebir tersine çeviriyor: kime, kaç dakika
--    yazıldıysa ondan o kadar.

-- ─────────────────────────────────────────────────────────────────────────
-- 1) Görünüm: security_invoker geri geldi, çapa ve devir dışarı açıldı
-- ─────────────────────────────────────────────────────────────────────────
-- Mevcut sütunlar 20260917013000 ile birebir aynı; sona iki sütun eklendi.
CREATE OR REPLACE VIEW public.teacher_balance
WITH (security_invoker = on) AS
WITH acilis AS (
  SELECT o.teacher_id, o.minutes, o.regular_lessons, o.trial_lessons, o.created_at
    FROM teacher_balance_opening o
), odeme AS (
  SELECT be.teacher_id, max(be.created_at) AS son
    FROM balance_events be
   WHERE be.event_type = 'payout'::text
   GROUP BY be.teacher_id
), capa AS (
  SELECT p.user_id AS teacher_id,
         GREATEST(COALESCE(a.created_at, '-infinity'::timestamptz),
                  COALESCE(o.son,        '-infinity'::timestamptz)) AS an,
         (o.son IS NOT NULL AND o.son >= COALESCE(a.created_at, '-infinity'::timestamptz)) AS odeme_sonrasi,
         a.minutes, a.regular_lessons, a.trial_lessons,
         a.created_at AS acilis_ani
    FROM profiles p
    LEFT JOIN acilis a ON a.teacher_id = p.user_id
    LEFT JOIN odeme  o ON o.teacher_id = p.user_id
   WHERE p.role = 'teacher'::user_role
)
SELECT p.user_id AS teacher_id,
       COALESCE(c.minutes, 0) + COALESCE((
         SELECT sum(be.amount_minutes) FROM balance_events be
          WHERE be.teacher_id = p.user_id
            AND be.created_at > COALESCE(c.acilis_ani, '-infinity'::timestamptz)), 0::bigint) AS total_minutes,
       CASE WHEN c.odeme_sonrasi THEN 0 ELSE COALESCE(c.regular_lessons, 0) END
       + COALESCE((
         SELECT count(*) FILTER (WHERE be.event_type = 'lesson_complete'::text)
              - count(*) FILTER (WHERE be.event_type = 'lesson_undo'::text)
           FROM balance_events be
          WHERE be.teacher_id = p.user_id AND be.created_at > c.an
            AND be.event_type = ANY (ARRAY['lesson_complete'::text, 'lesson_undo'::text])), 0::bigint) AS completed_regular_lessons,
       CASE WHEN c.odeme_sonrasi THEN 0 ELSE COALESCE(c.trial_lessons, 0) END
       + COALESCE((
         SELECT count(*) FILTER (WHERE be.event_type = 'trial_complete'::text)
              - count(*) FILTER (WHERE be.event_type = 'trial_undo'::text)
           FROM balance_events be
          WHERE be.teacher_id = p.user_id AND be.created_at > c.an
            AND be.event_type = ANY (ARRAY['trial_complete'::text, 'trial_undo'::text])), 0::bigint) AS completed_trial_lessons,
       COALESCE((
         SELECT sum(be.amount_minutes) FROM balance_events be
          WHERE be.teacher_id = p.user_id
            AND be.event_type = ANY (ARRAY['lesson_complete'::text, 'lesson_undo'::text])
            AND be.created_at > c.an), 0::bigint) AS regular_lessons_minutes,
       COALESCE((
         SELECT sum(be.amount_minutes) FROM balance_events be
          WHERE be.teacher_id = p.user_id
            AND be.event_type = ANY (ARRAY['trial_complete'::text, 'trial_undo'::text])
            AND be.created_at > c.an), 0::bigint) AS trial_lessons_minutes,
       COALESCE((
         SELECT sum(be.amount_minutes) FROM balance_events be
          WHERE be.teacher_id = p.user_id
            AND be.event_type = 'manual_adjust'::text
            AND be.created_at > c.an), 0::bigint) AS manual_adjustment_minutes,
       -- Dönemin başladığı an: son ödeme, yoksa açılış. Döküm bundan sonrasını listeler.
       c.an AS period_start,
       -- Açılıştan devreden, defterde satırı olmayan ders sayısı. İlk ödemeyle sıfırlanır.
       CASE WHEN c.odeme_sonrasi THEN 0
            ELSE COALESCE(c.regular_lessons, 0) + COALESCE(c.trial_lessons, 0) END AS opening_lessons
  FROM profiles p
  JOIN capa c ON c.teacher_id = p.user_id
 WHERE p.role = 'teacher'::user_role;

-- ─────────────────────────────────────────────────────────────────────────
-- 2) Döküm: bakiye özeti + bu dönemde bakiyeye yazılan dersler
-- ─────────────────────────────────────────────────────────────────────────
-- Tek çağrı, tek anlık görüntü: özet ile liste aynı andan okunur, ekranda
-- biri ötekinden bayat kalamaz.
--
-- Satır kuralı: bir dersin dönem içindeki net'i (işlendi − geri alındı).
--   net > 0  → bakiyeye yazılı; `sira` = kaçıncı ders (devir + 1'den başlar)
--   net = 0  → görünmez (işlenip geri alınmış, ya da tersi)
--   net < 0  → önceki dönemde ödenmiş bir ders bu dönemde geri alınmış;
--              `sira` boş, satır eksi olarak görünür. Böylece
--              devir + artılar − eksiler = görünümdeki ders sayaçları, her zaman.
--
-- SECURITY DEFINER: ad, transferle giden ya da silinen öğrenci için de
-- çözülebilsin diye (K7: geçmiş kazanç eski öğretmende kalır, listesinde de
-- adıyla görünmeli). Yetki girişte sınanıyor.
CREATE OR REPLACE FUNCTION public.rpc_bakiye_dokumu(p_teacher_id uuid)
RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_b teacher_balance%ROWTYPE;
  v_dersler json;
BEGIN
  IF NOT public.is_teacher_caller(p_teacher_id) THEN
    RETURN json_build_object('success', false, 'error', 'Bu işlem için yetkiniz yok');
  END IF;

  SELECT * INTO v_b FROM teacher_balance WHERE teacher_id = p_teacher_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Öğretmen bulunamadı');
  END IF;

  WITH olay AS (
    SELECT be.instance_id, be.student_id, be.event_type, be.amount_minutes, be.created_at,
           -- Faz 5 öncesi deneme satırlarında ders kimliği yok; her biri kendi satırı.
           COALESCE(be.instance_id, be.id) AS ders_id,
           sum(CASE WHEN be.event_type IN ('lesson_complete', 'trial_complete') THEN 1 ELSE -1 END)
             OVER (PARTITION BY COALESCE(be.instance_id, be.id)) AS net,
           row_number() OVER (PARTITION BY COALESCE(be.instance_id, be.id)
                              ORDER BY be.created_at DESC) AS rn
      FROM balance_events be
     WHERE be.teacher_id = p_teacher_id
       AND be.created_at > v_b.period_start
       AND be.event_type IN ('lesson_complete', 'lesson_undo', 'trial_complete', 'trial_undo')
  ), satir AS (
    -- Dersin dönem içindeki son hareketi: net > 0 ise bakiyeye yazıldığı an.
    SELECT o.*,
           CASE WHEN o.net > 0 THEN v_b.opening_lessons
                + row_number() OVER (PARTITION BY (o.net > 0) ORDER BY o.created_at, o.ders_id) END AS sira
      FROM olay o
     WHERE o.rn = 1 AND o.net <> 0
  )
  SELECT json_agg(json_build_object(
           'id',     s.ders_id,
           'sira',   s.sira,
           'tur',    CASE WHEN s.event_type IN ('trial_complete', 'trial_undo') THEN 'deneme' ELSE 'ders' END,
           'ad',     CASE WHEN s.event_type IN ('trial_complete', 'trial_undo')
                          THEN nullif(btrim(li.aday_adi), '') ELSE pr.full_name END,
           -- Ders kaydı silinmişse (ör. işlenmiş deneme takvimden kaldırıldı)
           -- kazanç yerinde durur; gün olarak yazıldığı gün gösterilir.
           'tarih',  COALESCE(li.lesson_date, (s.created_at AT TIME ZONE 'Europe/Istanbul')::date),
           'bas',    to_char(li.start_time, 'HH24:MI'),
           'bit',    to_char(li.end_time, 'HH24:MI'),
           'dakika', s.amount_minutes)
         ORDER BY s.created_at DESC, s.ders_id DESC)
    INTO v_dersler
    FROM satir s
    LEFT JOIN lesson_instances li ON li.id = s.instance_id
    LEFT JOIN profiles pr ON pr.user_id = COALESCE(li.student_id, s.student_id);

  RETURN json_build_object(
    'success', true,
    'bakiye', json_build_object(
      'total_minutes',             v_b.total_minutes,
      'completed_regular_lessons', v_b.completed_regular_lessons,
      'completed_trial_lessons',   v_b.completed_trial_lessons,
      'regular_lessons_minutes',   v_b.regular_lessons_minutes,
      'trial_lessons_minutes',     v_b.trial_lessons_minutes),
    'devir', v_b.opening_lessons,
    'dersler', COALESCE(v_dersler, '[]'::json));
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_bakiye_dokumu(uuid) FROM public;
REVOKE ALL ON FUNCTION public.rpc_bakiye_dokumu(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_bakiye_dokumu(uuid) TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- 3) Geri alma: son kazanç satırını birebir tersine çevirir
-- ─────────────────────────────────────────────────────────────────────────
-- 20260916170000'daki gövdeyle aynı; tek fark eksi satırın kime ve kaç dakika
-- yazıldığı. Kazanç satırı bulunamazsa (defter öncesinden kalma işlenmiş ders)
-- eski davranış geçerli: çağrıdaki öğretmen, dersin süresi.
CREATE OR REPLACE FUNCTION public.rpc_undo_complete_lesson_impl(p_instance_id uuid, p_teacher_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_instance lesson_instances%ROWTYPE;
  v_duration_minutes integer;
  v_kazanan uuid;
  v_current_cycle integer;
  v_last_completed_id uuid;
  v_last_date date;
BEGIN
  SELECT * INTO v_instance FROM lesson_instances
   WHERE id = p_instance_id AND teacher_id = p_teacher_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Bu ders artık yok. Sayfayı yenileyin.');
  END IF;
  IF v_instance.status != 'completed' THEN
    -- İstenen sonuç zaten geçerli.
    RETURN json_build_object('success', true, 'duration_minutes', 0,
                             'note', 'Bu ders zaten işlenmemiş durumda.');
  END IF;

  SELECT be.teacher_id, be.amount_minutes INTO v_kazanan, v_duration_minutes
    FROM balance_events be
   WHERE be.instance_id = p_instance_id
     AND be.event_type IN ('lesson_complete', 'trial_complete')
   ORDER BY be.created_at DESC LIMIT 1;

  v_kazanan := COALESCE(v_kazanan, p_teacher_id);
  v_duration_minutes := COALESCE(v_duration_minutes,
    (EXTRACT(EPOCH FROM (v_instance.end_time - v_instance.start_time)) / 60)::integer);

  IF v_instance.tur = 'deneme' THEN
    UPDATE lesson_instances SET status = 'planned', updated_at = now() WHERE id = p_instance_id;

    INSERT INTO balance_events (teacher_id, event_type, amount_minutes, instance_id, notes)
    VALUES (v_kazanan, 'trial_undo', -v_duration_minutes, p_instance_id,
            'Deneme dersi geri alındı · ' || v_instance.lesson_date::text);

    RETURN json_build_object('success', true, 'duration_minutes', v_duration_minutes, 'tur', 'deneme');
  END IF;

  SELECT package_cycle INTO v_current_cycle FROM student_lesson_tracking
   WHERE student_id = v_instance.student_id AND teacher_id = p_teacher_id;
  v_current_cycle := COALESCE(v_current_cycle, 1);

  SELECT id, lesson_date INTO v_last_completed_id, v_last_date FROM lesson_instances
   WHERE student_id = v_instance.student_id AND teacher_id = p_teacher_id
     AND status = 'completed' AND package_cycle = v_current_cycle AND tur = 'ders'
   ORDER BY lesson_date DESC, start_time DESC LIMIT 1;

  IF v_last_completed_id IS NULL OR v_last_completed_id != p_instance_id THEN
    RETURN json_build_object('success', false, 'error',
      'Yalnızca en son işlenen ders geri alınabilir. Sıradaki: ' ||
      to_char(v_last_date, 'DD.MM.YYYY') || '.');
  END IF;

  UPDATE lesson_instances SET status = 'planned', updated_at = now() WHERE id = p_instance_id;

  INSERT INTO balance_events (teacher_id, event_type, amount_minutes, instance_id, student_id, package_cycle)
  VALUES (v_kazanan, 'lesson_undo', -v_duration_minutes, p_instance_id, v_instance.student_id, v_current_cycle);

  DELETE FROM admin_notifications
   WHERE student_id = v_instance.student_id AND teacher_id = p_teacher_id
     AND notification_type = 'last_lesson_warning'
     AND created_at > (CURRENT_DATE - INTERVAL '1 day');

  RETURN json_build_object('success', true, 'duration_minutes', v_duration_minutes);
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────
-- 4) Canlı yayın: defter satırı düşünce açık paneller haber alsın
-- ─────────────────────────────────────────────────────────────────────────
-- Defter yalnızca ekleme alır; INSERT olayı yeter, REPLICA IDENTITY gerekmez.
-- Yayın RLS'ye tabidir: öğretmen yalnızca kendi satırlarını, admin hepsini alır.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                  WHERE pubname = 'supabase_realtime'
                    AND schemaname = 'public' AND tablename = 'balance_events') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.balance_events;
  END IF;
END $$;
