-- ============================================================================
-- Faz 3 · Bakiye artık defterden türetiliyor
-- ============================================================================
-- Sorun: aynı gerçeği iki yer taşıyordu. teacher_balance elle işletilen bir
-- sayaç, balance_events ise yalnızca denetim kaydıydı. Üç ayrı işlem ikisini
-- farklı şekilde değiştirdiği için ayrışabiliyorlardı — Senanur'un "630 dakika
-- doğru ama 24 ders yanlış" durumu tam olarak buydu: ödeme, "bakiyeyi kapat"
-- yerine elle dakika düşülerek yapılmış, dakika düzelmiş, sayaç olduğu yerde
-- kalmıştı.
--
-- Defterin GEÇMİŞİ olduğu gibi toplanamaz:
--   * lesson_undo olayları pozitif yazılmış (57 olay, +9626 dk) — eski bir
--     sürüm işareti ters koymuş.
--   * 39 ödeme kaydı deftere hiç düşmemiş; tablo her ödemede sıfırlanmış,
--     defter toplamaya devam etmiş.
--   * 78 data_repair satırı elle yapılan onarımların izi.
--
-- Bu yüzden geçmiş yeniden kurulmuyor. Muhasebede olduğu gibi çizgi çekiliyor:
-- bugünkü doğrulanmış bakiye "açılış" olarak taşınıyor, bundan sonraki her
-- hareket deftere düşüyor ve bakiye defterden türetiliyor. Eski tablo
-- teacher_balance_eski adıyla dondurulmuş hâlde duruyor.

-- ─────────────────────────────────────────────────────────────────────────
-- 1) Açılış kaydı
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.teacher_balance_opening (
  teacher_id uuid PRIMARY KEY,
  minutes integer NOT NULL DEFAULT 0,
  regular_lessons integer NOT NULL DEFAULT 0,
  trial_lessons integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

COMMENT ON TABLE public.teacher_balance_opening IS
  'Defter düzenine geçiş anındaki bakiye. Bu tarihten öncesi defterden değil buradan okunur; sonrası balance_events''ten türetilir.';

ALTER TABLE public.teacher_balance_opening ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_full_access_balance_opening ON public.teacher_balance_opening;
CREATE POLICY admin_full_access_balance_opening ON public.teacher_balance_opening
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS teacher_view_own_balance_opening ON public.teacher_balance_opening;
CREATE POLICY teacher_view_own_balance_opening ON public.teacher_balance_opening
  FOR SELECT TO authenticated
  USING (teacher_id = auth.uid());

-- Devir: tablo hâlâ tablo iken bugünkü değerler açılışa yazılır.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
              WHERE table_schema='public' AND table_name='teacher_balance'
                AND table_type='BASE TABLE') THEN
    INSERT INTO public.teacher_balance_opening
      (teacher_id, minutes, regular_lessons, trial_lessons, notes)
    SELECT tb.teacher_id, tb.total_minutes, tb.completed_regular_lessons,
           tb.completed_trial_lessons,
           'Defter düzenine geçiş · 15 Eylül 2026 · teacher_balance tablosundan devir'
      FROM public.teacher_balance tb
    ON CONFLICT (teacher_id) DO NOTHING;

    ALTER TABLE public.teacher_balance RENAME TO teacher_balance_eski;
  END IF;
END $$;

COMMENT ON TABLE public.teacher_balance_eski IS
  'Defter düzenine geçmeden önceki sayaç tablosu. 15 Eylül 2026 itibarıyla dondurulmuş; yalnızca geri dönüş gerekirse kullanılır.';

-- Ödeme artık bir defter olayı.
ALTER TABLE public.balance_events DROP CONSTRAINT IF EXISTS balance_events_event_type_check;
ALTER TABLE public.balance_events ADD CONSTRAINT balance_events_event_type_check
  CHECK (event_type = ANY (ARRAY[
    'lesson_complete', 'lesson_undo', 'trial_complete', 'trial_undo',
    'manual_adjust', 'balance_reset', 'data_repair', 'payout']));

-- ─────────────────────────────────────────────────────────────────────────
-- 2) teacher_balance: tablo değil, görünüm
-- ─────────────────────────────────────────────────────────────────────────
-- Çapa: son ödeme, yoksa açılış. Dakika açılıştan itibaren toplanır (ödeme
-- olayları negatiftir, bakiyeyi kendiliğinden sıfırlarlar); ders sayaçları
-- çapadan itibaren sayılır, çünkü "bu dönemde kaç ders" sorusunun cevabı.
--
-- Karşılaştırma sayaçlarda ">=": ödeme ile aynı damgayı taşıyan bir ders yeni
-- döneme aittir. security_invoker açık, yani öğretmen yalnızca kendi satırını
-- görür (balance_events ve profiles ilkeleri geçerli kalır).
CREATE OR REPLACE VIEW public.teacher_balance
WITH (security_invoker = on) AS
WITH acilis AS (
  SELECT o.teacher_id, o.minutes, o.regular_lessons, o.trial_lessons, o.created_at
    FROM public.teacher_balance_opening o
),
odeme AS (
  SELECT be.teacher_id, max(be.created_at) AS son
    FROM public.balance_events be
   WHERE be.event_type = 'payout'
   GROUP BY be.teacher_id
),
capa AS (
  SELECT a.teacher_id,
         GREATEST(a.created_at, COALESCE(o.son, a.created_at)) AS an,
         (o.son IS NOT NULL AND o.son >= a.created_at) AS odeme_sonrasi,
         a.minutes, a.regular_lessons, a.trial_lessons, a.created_at AS acilis_ani
    FROM acilis a LEFT JOIN odeme o ON o.teacher_id = a.teacher_id
)
SELECT p.user_id AS teacher_id,
       COALESCE(c.minutes, 0)
         + COALESCE((SELECT sum(be.amount_minutes) FROM public.balance_events be
                      WHERE be.teacher_id = p.user_id
                        AND be.created_at > COALESCE(c.acilis_ani, '-infinity'::timestamptz)), 0) AS total_minutes,
       CASE WHEN COALESCE(c.odeme_sonrasi, false) THEN 0 ELSE COALESCE(c.regular_lessons, 0) END
         + COALESCE((SELECT count(*) FILTER (WHERE be.event_type = 'lesson_complete')
                          - count(*) FILTER (WHERE be.event_type = 'lesson_undo')
                       FROM public.balance_events be
                      WHERE be.teacher_id = p.user_id
                        AND be.created_at >= COALESCE(c.an, '-infinity'::timestamptz)
                        AND be.event_type IN ('lesson_complete','lesson_undo')), 0) AS completed_regular_lessons,
       CASE WHEN COALESCE(c.odeme_sonrasi, false) THEN 0 ELSE COALESCE(c.trial_lessons, 0) END
         + COALESCE((SELECT count(*) FILTER (WHERE be.event_type = 'trial_complete')
                          - count(*) FILTER (WHERE be.event_type = 'trial_undo')
                       FROM public.balance_events be
                      WHERE be.teacher_id = p.user_id
                        AND be.created_at >= COALESCE(c.an, '-infinity'::timestamptz)
                        AND be.event_type IN ('trial_complete','trial_undo')), 0) AS completed_trial_lessons,
       COALESCE((SELECT sum(be.amount_minutes) FROM public.balance_events be
                  WHERE be.teacher_id = p.user_id
                    AND be.event_type IN ('lesson_complete','lesson_undo')
                    AND be.created_at >= COALESCE(c.an, '-infinity'::timestamptz)), 0) AS regular_lessons_minutes,
       COALESCE((SELECT sum(be.amount_minutes) FROM public.balance_events be
                  WHERE be.teacher_id = p.user_id
                    AND be.event_type IN ('trial_complete','trial_undo')
                    AND be.created_at >= COALESCE(c.an, '-infinity'::timestamptz)), 0) AS trial_lessons_minutes,
       COALESCE((SELECT sum(be.amount_minutes) FROM public.balance_events be
                  WHERE be.teacher_id = p.user_id
                    AND be.event_type = 'manual_adjust'
                    AND be.created_at >= COALESCE(c.an, '-infinity'::timestamptz)), 0) AS manual_adjustment_minutes
  FROM public.profiles p
  LEFT JOIN capa c ON c.teacher_id = p.user_id
 WHERE p.role = 'teacher';

COMMENT ON VIEW public.teacher_balance IS
  'Bakiye, açılış kaydı + sonraki defter hareketlerinden türetilir. Saklanan bir sayaç yok; ödeme olayı bakiyeyi sıfırlar ve ders sayaçlarının dönemini yeniden başlatır.';

GRANT SELECT ON public.teacher_balance TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 3) RPC'ler yalnızca deftere yazıyor
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_complete_lesson_impl(p_instance_id uuid, p_teacher_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_instance lesson_instances%ROWTYPE;
  v_duration_minutes integer;
  v_current_cycle integer;
  v_first_planned_id uuid;
BEGIN
  SELECT * INTO v_instance FROM lesson_instances
   WHERE id = p_instance_id AND teacher_id = p_teacher_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Instance not found');
  END IF;
  IF v_instance.status = 'completed' THEN
    RETURN json_build_object('success', false, 'error', 'Already completed');
  END IF;

  SELECT package_cycle INTO v_current_cycle FROM student_lesson_tracking
   WHERE student_id = v_instance.student_id AND teacher_id = p_teacher_id;
  v_current_cycle := COALESCE(v_current_cycle, 1);

  SELECT id INTO v_first_planned_id FROM lesson_instances
   WHERE student_id = v_instance.student_id AND teacher_id = p_teacher_id
     AND status = 'planned' AND package_cycle = v_current_cycle
   ORDER BY lesson_date ASC, start_time ASC LIMIT 1;

  IF v_first_planned_id IS NULL OR v_first_planned_id != p_instance_id THEN
    RETURN json_build_object('success', false, 'error', 'Not the next completable lesson');
  END IF;

  v_duration_minutes := EXTRACT(EPOCH FROM (v_instance.end_time - v_instance.start_time)) / 60;

  UPDATE lesson_instances SET status = 'completed', updated_at = now() WHERE id = p_instance_id;

  INSERT INTO balance_events (teacher_id, event_type, amount_minutes, instance_id, student_id, package_cycle)
  VALUES (p_teacher_id, 'lesson_complete', v_duration_minutes, p_instance_id, v_instance.student_id, v_current_cycle);

  RETURN json_build_object('success', true, 'duration_minutes', v_duration_minutes);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_undo_complete_lesson_impl(p_instance_id uuid, p_teacher_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_instance lesson_instances%ROWTYPE;
  v_duration_minutes integer;
  v_current_cycle integer;
  v_last_completed_id uuid;
BEGIN
  SELECT * INTO v_instance FROM lesson_instances
   WHERE id = p_instance_id AND teacher_id = p_teacher_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Instance not found');
  END IF;
  IF v_instance.status != 'completed' THEN
    RETURN json_build_object('success', false, 'error', 'Instance is not completed');
  END IF;

  SELECT package_cycle INTO v_current_cycle FROM student_lesson_tracking
   WHERE student_id = v_instance.student_id AND teacher_id = p_teacher_id;
  v_current_cycle := COALESCE(v_current_cycle, 1);

  SELECT id INTO v_last_completed_id FROM lesson_instances
   WHERE student_id = v_instance.student_id AND teacher_id = p_teacher_id
     AND status = 'completed' AND package_cycle = v_current_cycle
   ORDER BY lesson_date DESC, start_time DESC LIMIT 1;

  IF v_last_completed_id IS NULL OR v_last_completed_id != p_instance_id THEN
    RETURN json_build_object('success', false, 'error', 'Can only undo the most recent completed lesson');
  END IF;

  v_duration_minutes := EXTRACT(EPOCH FROM (v_instance.end_time - v_instance.start_time)) / 60;

  UPDATE lesson_instances SET status = 'planned', updated_at = now() WHERE id = p_instance_id;

  INSERT INTO balance_events (teacher_id, event_type, amount_minutes, instance_id, student_id, package_cycle)
  VALUES (p_teacher_id, 'lesson_undo', -v_duration_minutes, p_instance_id, v_instance.student_id, v_current_cycle);

  DELETE FROM admin_notifications
   WHERE student_id = v_instance.student_id AND teacher_id = p_teacher_id
     AND notification_type = 'last_lesson_warning'
     AND created_at > (CURRENT_DATE - INTERVAL '1 day');

  RETURN json_build_object('success', true, 'duration_minutes', v_duration_minutes);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_complete_trial_lesson_impl(p_trial_id uuid, p_teacher_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_trial trial_lessons%ROWTYPE;
  v_duration_minutes integer;
BEGIN
  SELECT * INTO v_trial FROM trial_lessons
   WHERE id = p_trial_id AND teacher_id = p_teacher_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Trial lesson not found');
  END IF;
  IF v_trial.is_completed THEN
    RETURN json_build_object('success', false, 'error', 'Already completed');
  END IF;

  v_duration_minutes := EXTRACT(EPOCH FROM (v_trial.end_time - v_trial.start_time)) / 60;

  UPDATE trial_lessons SET is_completed = true, updated_at = now() WHERE id = p_trial_id;

  -- Denemenin kimliği nota yazılıyor: eskiden hangi denemeye ait olduğu hiçbir
  -- yerde durmadığı için deneme ücretleri geriye dönük denetlenemiyordu.
  INSERT INTO balance_events (teacher_id, event_type, amount_minutes, notes)
  VALUES (p_teacher_id, 'trial_complete', v_duration_minutes,
          'Deneme dersi ' || p_trial_id::text || ' · ' || v_trial.lesson_date::text);

  RETURN json_build_object('success', true, 'duration_minutes', v_duration_minutes);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_undo_trial_lesson_impl(p_trial_id uuid, p_teacher_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_trial trial_lessons%ROWTYPE;
  v_duration_minutes integer;
BEGIN
  SELECT * INTO v_trial FROM trial_lessons
   WHERE id = p_trial_id AND teacher_id = p_teacher_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Trial lesson not found');
  END IF;
  IF NOT v_trial.is_completed THEN
    RETURN json_build_object('success', false, 'error', 'Trial lesson is not completed');
  END IF;

  v_duration_minutes := EXTRACT(EPOCH FROM (v_trial.end_time - v_trial.start_time)) / 60;

  UPDATE trial_lessons SET is_completed = false, updated_at = now() WHERE id = p_trial_id;

  INSERT INTO balance_events (teacher_id, event_type, amount_minutes, notes)
  VALUES (p_teacher_id, 'trial_undo', -v_duration_minutes,
          'Deneme dersi ' || p_trial_id::text || ' geri alındı');

  RETURN json_build_object('success', true, 'duration_minutes', v_duration_minutes);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_manual_balance_adjust_impl(
  p_teacher_id uuid, p_amount_minutes integer, p_notes text DEFAULT NULL::text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO balance_events (teacher_id, event_type, amount_minutes, notes)
  VALUES (p_teacher_id, 'manual_adjust', p_amount_minutes, p_notes);
  RETURN json_build_object('success', true);
END;
$function$;

-- Ödeme: geçmişe kaydı düş ve deftere negatif satır yaz. Bakiye böylece
-- kendiliğinden sıfırlanır; sayaçları elle sıfırlayan bir yer kalmaz.
CREATE OR REPLACE FUNCTION public.rpc_close_teacher_payout(
  p_teacher_id uuid, p_rate numeric DEFAULT NULL::numeric, p_notes text DEFAULT NULL::text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  b record;
BEGIN
  IF NOT public.is_admin_caller() THEN
    RAISE EXCEPTION 'Bu işlem için yetkiniz yok' USING errcode = '42501';
  END IF;

  -- Görünümde kilitlenecek satır yok; eşzamanlı ikinci çağrı burada bekler.
  PERFORM pg_advisory_xact_lock(hashtext(p_teacher_id::text));

  SELECT * INTO b FROM public.teacher_balance WHERE teacher_id = p_teacher_id;

  IF NOT FOUND OR COALESCE(b.total_minutes, 0) <= 0 THEN
    RETURN jsonb_build_object('success', true, 'paid_minutes', 0, 'skipped', true);
  END IF;

  INSERT INTO public.payment_history (
    teacher_id, amount_minutes, completed_regular_lessons,
    completed_trial_lessons, rate_per_minute, notes
  ) VALUES (
    p_teacher_id, b.total_minutes, b.completed_regular_lessons,
    b.completed_trial_lessons, p_rate, p_notes
  );

  INSERT INTO public.balance_events (teacher_id, event_type, amount_minutes, notes)
  VALUES (p_teacher_id, 'payout', -b.total_minutes,
          COALESCE(p_notes, 'Ödeme kapatıldı') || ' · ' ||
          b.completed_regular_lessons || ' ders, ' ||
          b.completed_trial_lessons || ' deneme');

  RETURN jsonb_build_object('success', true, 'paid_minutes', b.total_minutes);
EXCEPTION
  WHEN others THEN
    RETURN jsonb_build_object('success', false, 'error', sqlerrm);
END;
$function$;
