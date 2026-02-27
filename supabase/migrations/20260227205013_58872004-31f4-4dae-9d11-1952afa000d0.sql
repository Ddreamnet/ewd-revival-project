
-- Phase 1: Create lesson_instances table
CREATE TABLE public.lesson_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  teacher_id uuid NOT NULL,
  lesson_number integer NOT NULL,
  lesson_date date NOT NULL,
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  status text NOT NULL DEFAULT 'planned',
  original_date date,
  original_start_time time without time zone,
  original_end_time time without time zone,
  rescheduled_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(student_id, teacher_id, lesson_number)
);

-- Indexes for conflict detection and lookups
CREATE INDEX idx_lesson_instances_teacher_date
  ON public.lesson_instances (teacher_id, lesson_date, start_time, end_time);

CREATE INDEX idx_lesson_instances_student
  ON public.lesson_instances (student_id, teacher_id, status);

-- Enable RLS
ALTER TABLE public.lesson_instances ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY "admin_full_access_lesson_instances"
  ON public.lesson_instances
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Teacher: full access on own records
CREATE POLICY "teacher_manage_own_lesson_instances"
  ON public.lesson_instances
  FOR ALL
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

-- Student: view own records
CREATE POLICY "student_view_own_lesson_instances"
  ON public.lesson_instances
  FOR SELECT
  USING (student_id = auth.uid());

-- Updated_at trigger
CREATE TRIGGER update_lesson_instances_updated_at
  BEFORE UPDATE ON public.lesson_instances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Phase 2: Data migration - populate lesson_instances from existing data
INSERT INTO public.lesson_instances (student_id, teacher_id, lesson_number, lesson_date, start_time, end_time, status)
SELECT
  slt.student_id,
  slt.teacher_id,
  (kv.key)::integer AS lesson_number,
  (kv.value #>> '{}')::date AS lesson_date,
  COALESCE(sl.start_time, '09:00'::time) AS start_time,
  COALESCE(sl.end_time, '09:30'::time) AS end_time,
  CASE
    WHEN (kv.key)::integer = ANY(COALESCE(slt.completed_lessons, ARRAY[]::integer[]))
    THEN 'completed'
    ELSE 'planned'
  END AS status
FROM public.student_lesson_tracking slt
CROSS JOIN LATERAL jsonb_each(COALESCE(slt.lesson_dates, '{}'::jsonb)) AS kv
LEFT JOIN LATERAL (
  SELECT sl2.start_time, sl2.end_time
  FROM public.student_lessons sl2
  WHERE sl2.student_id = slt.student_id
    AND sl2.teacher_id = slt.teacher_id
    AND sl2.day_of_week = EXTRACT(DOW FROM (kv.value #>> '{}')::date)::integer
  LIMIT 1
) sl ON true
WHERE kv.value #>> '{}' IS NOT NULL
  AND (kv.value #>> '{}') ~ '^\d{4}-\d{2}-\d{2}$'
ON CONFLICT (student_id, teacher_id, lesson_number) DO NOTHING;

-- Apply overrides to lesson_instances
UPDATE public.lesson_instances li
SET
  lesson_date = COALESCE(lo.new_date, li.lesson_date),
  start_time = COALESCE(lo.new_start_time, li.start_time),
  end_time = COALESCE(lo.new_end_time, li.end_time),
  original_date = li.lesson_date,
  original_start_time = li.start_time,
  original_end_time = li.end_time,
  rescheduled_count = 1,
  status = CASE WHEN lo.is_cancelled THEN 'cancelled' ELSE li.status END
FROM public.lesson_overrides lo
WHERE lo.student_id = li.student_id
  AND lo.teacher_id = li.teacher_id
  AND lo.original_date = li.lesson_date
  AND lo.original_start_time = li.start_time
  AND li.original_date IS NULL;
