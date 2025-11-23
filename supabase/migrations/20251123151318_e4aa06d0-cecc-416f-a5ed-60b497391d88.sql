-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'teacher', 'student');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles table
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Migrate existing roles from profiles table to user_roles
-- Convert user_role enum to app_role enum via text
INSERT INTO public.user_roles (user_id, role)
SELECT 
    user_id, 
    CASE 
        WHEN role::text = 'teacher' THEN 'teacher'::public.app_role
        WHEN role::text = 'student' THEN 'student'::public.app_role
        ELSE 'student'::public.app_role
    END as role
FROM public.profiles
ON CONFLICT (user_id, role) DO NOTHING;

-- Assign admin role to specified user_id
INSERT INTO public.user_roles (user_id, role)
VALUES ('9f017d05-2118-4ec8-9d36-d1b592115841', 'admin'::public.app_role)
ON CONFLICT (user_id, role) DO NOTHING;

-- Basic RLS policies for user_roles table
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));