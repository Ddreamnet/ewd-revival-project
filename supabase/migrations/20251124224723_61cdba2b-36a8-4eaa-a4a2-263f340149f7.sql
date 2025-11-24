-- Ödeme geçmişi tablosu
CREATE TABLE public.payment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_minutes integer NOT NULL,
  completed_regular_lessons integer NOT NULL DEFAULT 0,
  completed_trial_lessons integer NOT NULL DEFAULT 0,
  payment_date timestamp with time zone NOT NULL DEFAULT now(),
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- RLS politikaları
ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;

-- Admin tam erişim
CREATE POLICY "admin_full_access_payment_history" ON public.payment_history
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Öğretmen kendi ödeme geçmişini görebilir
CREATE POLICY "teacher_view_own_payment_history" ON public.payment_history
FOR SELECT
TO authenticated
USING (teacher_id = auth.uid());

-- Index for better performance
CREATE INDEX idx_payment_history_teacher_id ON public.payment_history(teacher_id);
CREATE INDEX idx_payment_history_payment_date ON public.payment_history(payment_date DESC);