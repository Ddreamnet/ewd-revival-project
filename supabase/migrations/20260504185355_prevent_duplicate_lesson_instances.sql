-- Prevents new duplicate lesson_instances from being created.
-- Existing duplicates are NOT affected (they remain editable until manually resolved).
--
-- Rules:
--   * INSERT: blocks if another active (planned/completed) row already exists at the
--     same (student_id, lesson_date, start_time).
--   * UPDATE: only checks when the slot identifiers (student_id, lesson_date,
--     start_time) actually change. Status-only changes (e.g. planned -> completed)
--     pass through, so existing duplicates can still be completed/undone normally.
--
-- Rationale: a hard partial UNIQUE INDEX would reject any UPDATE on the existing
-- duplicate rows. The trigger lets historical data stay editable while preventing
-- the bug from spreading further.

CREATE OR REPLACE FUNCTION public.prevent_duplicate_lesson_instance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_slot_changed boolean;
  v_status_activated boolean;
BEGIN
  IF NEW.status NOT IN ('planned', 'completed') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF EXISTS (
      SELECT 1
      FROM public.lesson_instances
      WHERE student_id = NEW.student_id
        AND lesson_date = NEW.lesson_date
        AND start_time = NEW.start_time
        AND status IN ('planned', 'completed')
    ) THEN
      RAISE EXCEPTION
        'Bu öğrencinin % tarihinde % saatinde zaten bir dersi var. Aynı slotta birden fazla aktif ders olamaz.',
        NEW.lesson_date, NEW.start_time
        USING ERRCODE = 'unique_violation';
    END IF;
    RETURN NEW;
  END IF;

  v_slot_changed :=
       NEW.student_id  IS DISTINCT FROM OLD.student_id
    OR NEW.lesson_date IS DISTINCT FROM OLD.lesson_date
    OR NEW.start_time  IS DISTINCT FROM OLD.start_time;

  v_status_activated :=
       (OLD.status NOT IN ('planned', 'completed'))
   AND (NEW.status IN ('planned', 'completed'));

  IF NOT (v_slot_changed OR v_status_activated) THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.lesson_instances
    WHERE student_id = NEW.student_id
      AND lesson_date = NEW.lesson_date
      AND start_time = NEW.start_time
      AND status IN ('planned', 'completed')
      AND id <> NEW.id
  ) THEN
    RAISE EXCEPTION
      'Bu öğrencinin % tarihinde % saatinde zaten bir dersi var. Aynı slotta birden fazla aktif ders olamaz.',
      NEW.lesson_date, NEW.start_time
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_prevent_duplicate_lesson_instance ON public.lesson_instances;

CREATE TRIGGER trg_prevent_duplicate_lesson_instance
BEFORE INSERT OR UPDATE
ON public.lesson_instances
FOR EACH ROW
EXECUTE FUNCTION public.prevent_duplicate_lesson_instance();

COMMENT ON FUNCTION public.prevent_duplicate_lesson_instance IS
  'Blocks new (student_id, lesson_date, start_time) duplicates among active (planned/completed) lesson_instances. Status-only updates on existing rows are allowed so historical duplicates remain editable until manually cleaned.';
