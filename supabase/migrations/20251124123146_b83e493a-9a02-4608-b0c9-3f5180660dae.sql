-- CRITICAL FIX: Remove recursive RLS by using has_role() SECURITY DEFINER function
-- The has_role() function bypasses RLS, preventing infinite recursion

-- Step 1: Drop ALL existing policies from profiles table
DROP POLICY IF EXISTS "users_view_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "admin_full_access_profiles" ON public.profiles;
DROP POLICY IF EXISTS "teachers_view_assigned_students" ON public.profiles;
DROP POLICY IF EXISTS "admin_can_view_all_profiles" ON public.profiles;
DROP POLICY IF EXISTS "admin_can_modify_all_profiles" ON public.profiles;
DROP POLICY IF EXISTS "admin_view_all_profiles" ON public.profiles;
DROP POLICY IF EXISTS "admin_modify_all_profiles" ON public.profiles;

-- Step 2: Drop ALL existing policies from user_roles table
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "admin_can_view_all_roles" ON public.user_roles;
DROP POLICY IF EXISTS "admin_can_manage_all_roles" ON public.user_roles;
DROP POLICY IF EXISTS "admin_view_all_roles" ON public.user_roles;
DROP POLICY IF EXISTS "admin_manage_all_roles" ON public.user_roles;
DROP POLICY IF EXISTS "users_view_own_roles" ON public.user_roles;

-- Step 3: Create policies for user_roles using has_role() function (NO RECURSION!)
CREATE POLICY "users_view_own_roles" ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "admin_view_all_roles" ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin_manage_all_roles" ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Step 4: Create policies for profiles using has_role() function (NO RECURSION!)
CREATE POLICY "users_view_own_profile" ON public.profiles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "teachers_view_assigned_students" ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.teacher_id = auth.uid()
    AND s.student_id = profiles.user_id
  )
);

CREATE POLICY "admin_view_all_profiles" ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin_modify_all_profiles" ON public.profiles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));