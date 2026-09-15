-- ============================================================================
-- Faz 5 (1/2) · Deneme dersleri ders takvimine taşınıyor
-- ============================================================================
-- Deneme dersi beşinci bir ders türü olarak ayrı bir dünyada yaşıyordu:
-- öğrenci bağlantısı yok, taşınamıyor, geri alınamıyor, aday adı tutulmuyor.
-- Ama normal derslerin slotunu bloke ediyordu, yani takvimin parçasıydı.
--
-- Artık aynı tabloda: tur = 'deneme'. Aynı taşıma, aynı işlendi, aynı defter
-- yolu. Öğrenci bağlantısı boş kalıyor (aday henüz kayıtlı değil, K6), yerine
-- aday adı yazılabiliyor.
--
-- Yayındaki eski arayüz hâlâ `trial_lessons` tablosunu okuyup yazıyor. Tabloyu
-- doğrudan kaldırmak, deploy edilene kadar deneme derslerini bozardı; bu yüzden
-- aynı adla bir görünüm bırakılıyor ve yazma işlemleri INSTEAD OF tetikleyicisi
-- ile yeni tabloya yönlendiriliyor. Arayüz geçtikten sonra görünüm kalkacak.

ALTER TABLE public.lesson_instances
  ADD COLUMN IF NOT EXISTS tur text NOT NULL DEFAULT 'ders',
  ADD COLUMN IF NOT EXISTS aday_adi text;

ALTER TABLE public.lesson_instances DROP CONSTRAINT IF EXISTS lesson_instances_tur_check;
ALTER TABLE public.lesson_instances
  ADD CONSTRAINT lesson_instances_tur_check CHECK (tur IN ('ders', 'deneme'));

COMMENT ON COLUMN public.lesson_instances.tur IS
  'ders | deneme. Deneme dersinin öğrencisi yoktur (aday henüz kayıtlı değil); adı aday_adi alanında durur.';

-- Denemenin öğrencisi yok.
ALTER TABLE public.lesson_instances ALTER COLUMN student_id DROP NOT NULL;

-- Veriyi taşı (yalnızca bir kez).
INSERT INTO public.lesson_instances
  (student_id, teacher_id, lesson_number, lesson_date, start_time, end_time,
   status, package_cycle, tur, created_at, updated_at)
SELECT NULL, t.teacher_id, 0, t.lesson_date, t.start_time, t.end_time,
       CASE WHEN t.is_completed THEN 'completed' ELSE 'planned' END,
       1, 'deneme', t.created_at, t.updated_at
  FROM public.trial_lessons t
 WHERE NOT EXISTS (
   SELECT 1 FROM public.lesson_instances li
    WHERE li.tur = 'deneme' AND li.teacher_id = t.teacher_id
      AND li.lesson_date = t.lesson_date AND li.start_time = t.start_time);

ALTER TABLE public.trial_lessons RENAME TO trial_lessons_eski;
COMMENT ON TABLE public.trial_lessons_eski IS
  'Deneme dersleri ders takvimine taşınmadan önceki tablo. 15 Eylül 2026 itibarıyla dondurulmuş.';

-- ─────────────────────────────────────────────────────────────────────────
-- Geçiş köprüsü: eski arayüz için aynı adla görünüm
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.trial_lessons
WITH (security_invoker = on) AS
SELECT li.id,
       li.teacher_id,
       EXTRACT(DOW FROM li.lesson_date)::integer AS day_of_week,
       li.start_time,
       li.end_time,
       (li.status = 'completed') AS is_completed,
       li.lesson_date,
       li.created_at,
       li.updated_at
  FROM public.lesson_instances li
 WHERE li.tur = 'deneme';

COMMENT ON VIEW public.trial_lessons IS
  'Geçiş köprüsü: deneme dersleri artık lesson_instances içinde (tur = deneme). Arayüz yeni sürüme geçtikten sonra bu görünüm kaldırılacak.';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trial_lessons TO authenticated;

CREATE OR REPLACE FUNCTION public.trial_lessons_kopru()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO lesson_instances
      (student_id, teacher_id, lesson_number, lesson_date, start_time, end_time,
       status, package_cycle, tur)
    VALUES (NULL, NEW.teacher_id, 0, NEW.lesson_date, NEW.start_time, NEW.end_time,
            CASE WHEN COALESCE(NEW.is_completed, false) THEN 'completed' ELSE 'planned' END,
            1, 'deneme')
    RETURNING id INTO NEW.id;
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE lesson_instances
       SET lesson_date = NEW.lesson_date,
           start_time  = NEW.start_time,
           end_time    = NEW.end_time,
           status      = CASE WHEN COALESCE(NEW.is_completed, false) THEN 'completed' ELSE 'planned' END,
           updated_at  = now()
     WHERE id = OLD.id AND tur = 'deneme';
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM lesson_instances WHERE id = OLD.id AND tur = 'deneme';
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_trial_lessons_kopru ON public.trial_lessons;
CREATE TRIGGER trg_trial_lessons_kopru
  INSTEAD OF INSERT OR UPDATE OR DELETE ON public.trial_lessons
  FOR EACH ROW EXECUTE FUNCTION public.trial_lessons_kopru();
