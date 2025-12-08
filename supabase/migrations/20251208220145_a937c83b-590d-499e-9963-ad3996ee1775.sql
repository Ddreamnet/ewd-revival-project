
-- Hatice öğretmen için user_roles kaydı ekle
INSERT INTO public.user_roles (user_id, role)
VALUES ('947349f1-e9ea-4693-9cb1-538d43dba68c', 'teacher')
ON CONFLICT (user_id, role) DO NOTHING;
