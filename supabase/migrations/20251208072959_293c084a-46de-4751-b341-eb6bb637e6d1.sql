-- Ders erteleme/iptal override'ları için tablo
CREATE TABLE public.lesson_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  teacher_id uuid NOT NULL,
  original_date date NOT NULL,
  original_day_of_week integer NOT NULL,
  original_start_time time NOT NULL,
  original_end_time time NOT NULL,
  new_date date, -- null ise iptal edilmiş demek
  new_start_time time,
  new_end_time time,
  is_cancelled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS etkinleştir
ALTER TABLE public.lesson_overrides ENABLE ROW LEVEL SECURITY;

-- Admin tam erişim
CREATE POLICY "admin_full_access_lesson_overrides"
ON public.lesson_overrides
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Öğretmen kendi öğrencilerinin override'larını görebilir
CREATE POLICY "teacher_view_lesson_overrides"
ON public.lesson_overrides
FOR SELECT
TO authenticated
USING (teacher_id = auth.uid());

-- Öğrenci kendi override'larını görebilir
CREATE POLICY "student_view_own_overrides"
ON public.lesson_overrides
FOR SELECT
TO authenticated
USING (student_id = auth.uid());

-- updated_at trigger
CREATE TRIGGER update_lesson_overrides_updated_at
BEFORE UPDATE ON public.lesson_overrides
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for faster lookups
CREATE INDEX idx_lesson_overrides_student_teacher ON public.lesson_overrides(student_id, teacher_id);
CREATE INDEX idx_lesson_overrides_dates ON public.lesson_overrides(original_date, new_date);