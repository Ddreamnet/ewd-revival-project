ALTER TABLE public.push_tokens DROP CONSTRAINT push_tokens_role_check;
ALTER TABLE public.push_tokens ADD CONSTRAINT push_tokens_role_check CHECK (role IN ('teacher', 'student', 'admin'));