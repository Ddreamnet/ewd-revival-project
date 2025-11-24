-- Öğretmen bakiye tablosu
CREATE TABLE public.teacher_balance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_minutes integer NOT NULL DEFAULT 0,
  completed_regular_lessons integer NOT NULL DEFAULT 0,
  completed_trial_lessons integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(teacher_id)
);

-- RLS politikaları
ALTER TABLE public.teacher_balance ENABLE ROW LEVEL SECURITY;

-- Admin tam erişim
CREATE POLICY "admin_full_access_teacher_balance" ON public.teacher_balance
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Öğretmen kendi bakiyesini görebilir
CREATE POLICY "teacher_view_own_balance" ON public.teacher_balance
FOR SELECT
TO authenticated
USING (teacher_id = auth.uid());

-- Öğretmen kendi bakiyesini güncelleyebilir (ders işaretleme için)
CREATE POLICY "teacher_update_own_balance" ON public.teacher_balance
FOR UPDATE
TO authenticated
USING (teacher_id = auth.uid())
WITH CHECK (teacher_id = auth.uid());

-- Öğretmen kendi bakiyesini oluşturabilir (ilk ders işaretlemede)
CREATE POLICY "teacher_insert_own_balance" ON public.teacher_balance
FOR INSERT
TO authenticated
WITH CHECK (teacher_id = auth.uid());

-- Updated_at trigger
CREATE TRIGGER update_teacher_balance_updated_at
BEFORE UPDATE ON public.teacher_balance
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();