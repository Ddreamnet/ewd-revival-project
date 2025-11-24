-- CRITICAL FIX: Remove recursive RLS policies causing "Failed to fetch" error
-- Run this SQL in Supabase Dashboard > SQL Editor

-- Step 1: Drop ALL existing policies from profiles table
DROP POLICY IF EXISTS "users_view_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "admin_full_access_profiles" ON public.profiles;
DROP POLICY IF EXISTS "teachers_view_assigned_students" ON public.profiles;
DROP POLICY IF EXISTS "admin_can_view_all_profiles" ON public.profiles;
DROP POLICY IF EXISTS "admin_can_modify_all_profiles" ON public.profiles;

-- Step 2: Drop ALL existing policies from user_roles table
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "admin_can_view_all_roles" ON public.user_roles;
DROP POLICY IF EXISTS "admin_can_manage_all_roles" ON public.user_roles;

-- Step 3: Create SIMPLE policies for user_roles (NO recursive checks)
-- Users can view their own roles
CREATE POLICY "users_view_own_roles" ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Step 4: Create SIMPLE policies for profiles (NO has_role function, NO recursive checks)
-- Users can view their own profile
CREATE POLICY "users_view_own_profile" ON public.profiles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Teachers can view profiles of their assigned students
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

-- Admin can view all profiles (using direct subquery, NOT has_role function)
CREATE POLICY "admin_view_all_profiles" ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'admin'::app_role
  )
);

-- Admin can modify all profiles (INSERT, UPDATE, DELETE)
CREATE POLICY "admin_modify_all_profiles" ON public.profiles
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'admin'::app_role
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'admin'::app_role
  )
);

-- Admin can view all user roles
CREATE POLICY "admin_view_all_roles" ON public.user_roles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'admin'::app_role
  )
);

-- Admin can manage all user roles  
CREATE POLICY "admin_manage_all_roles" ON public.user_roles
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'admin'::app_role
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'admin'::app_role
  )
);