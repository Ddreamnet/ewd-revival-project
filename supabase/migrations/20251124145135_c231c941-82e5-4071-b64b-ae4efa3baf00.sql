-- Trial lessons table for temporary demo lessons
CREATE TABLE IF NOT EXISTS public.trial_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_completed boolean NOT NULL DEFAULT false,
  lesson_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS policies
ALTER TABLE public.trial_lessons ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "admin_full_access_trial_lessons"
ON public.trial_lessons
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Teacher can view own trial lessons
CREATE POLICY "teacher_view_own_trial_lessons"
ON public.trial_lessons
FOR SELECT
TO authenticated
USING (teacher_id = auth.uid());

-- Update trigger
CREATE TRIGGER update_trial_lessons_updated_at
BEFORE UPDATE ON public.trial_lessons
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for performance
CREATE INDEX idx_trial_lessons_teacher_date ON public.trial_lessons(teacher_id, lesson_date);
CREATE INDEX idx_trial_lessons_date ON public.trial_lessons(lesson_date);