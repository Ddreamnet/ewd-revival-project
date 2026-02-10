
-- push_tokens tablosu
CREATE TABLE public.push_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id uuid,
  role text NOT NULL CHECK (role IN ('teacher', 'student', 'parent')),
  platform text NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
  token text NOT NULL,
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(token)
);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own tokens"
  ON public.push_tokens FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin full access push_tokens"
  ON public.push_tokens FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- lesson_reminder_log dedup tablosu
CREATE TABLE public.lesson_reminder_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_user_id uuid NOT NULL,
  lesson_key text NOT NULL,
  lesson_date date NOT NULL,
  reminder_type text NOT NULL DEFAULT 'before_10min',
  sent_at timestamptz DEFAULT now(),
  UNIQUE(recipient_user_id, lesson_key, lesson_date, reminder_type)
);

ALTER TABLE public.lesson_reminder_log ENABLE ROW LEVEL SECURITY;
-- No user-facing policies needed; only service_role (edge functions) access this table

-- Updated_at trigger for push_tokens
CREATE TRIGGER update_push_tokens_updated_at
  BEFORE UPDATE ON public.push_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
