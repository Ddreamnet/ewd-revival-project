
-- Phase 0: Schema changes for lesson refactoring

-- 1. Add package_cycle to lesson_instances
ALTER TABLE public.lesson_instances
  ADD COLUMN IF NOT EXISTS package_cycle integer NOT NULL DEFAULT 1;

-- 2. Add package_cycle to student_lesson_tracking
ALTER TABLE public.student_lesson_tracking
  ADD COLUMN IF NOT EXISTS package_cycle integer NOT NULL DEFAULT 1;

-- 3. Add manual_adjustment_minutes to teacher_balance
ALTER TABLE public.teacher_balance
  ADD COLUMN IF NOT EXISTS manual_adjustment_minutes integer NOT NULL DEFAULT 0;

-- 4. Create balance_events audit table
CREATE TABLE IF NOT EXISTS public.balance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('lesson_complete', 'lesson_undo', 'trial_complete', 'trial_undo', 'manual_adjust', 'balance_reset')),
  amount_minutes integer NOT NULL,
  instance_id uuid,
  student_id uuid,
  package_cycle integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

-- 5. Enable RLS on balance_events
ALTER TABLE public.balance_events ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "admin_full_access_balance_events"
  ON public.balance_events
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Teacher view own events
CREATE POLICY "teacher_view_own_balance_events"
  ON public.balance_events
  FOR SELECT
  TO authenticated
  USING (teacher_id = auth.uid());

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_balance_events_teacher_id ON public.balance_events(teacher_id);
CREATE INDEX IF NOT EXISTS idx_lesson_instances_package_cycle ON public.lesson_instances(package_cycle);
CREATE INDEX IF NOT EXISTS idx_lesson_instances_student_teacher_cycle ON public.lesson_instances(student_id, teacher_id, package_cycle);
