-- ============================================
-- RLS POLICY RESET AND RECREATION
-- Admin: Full CRUD on all tables
-- Teacher: Limited read-only access, only for their students
-- Student: Read-only access to their own data
-- ============================================

-- ============================================
-- 1. PROFILES TABLE
-- ============================================
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Teachers can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Admin: full CRUD
CREATE POLICY "admin_full_access_profiles"
ON public.profiles
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Teacher: view their own students' profiles
CREATE POLICY "teacher_view_student_profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  is_teacher(auth.uid()) AND (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.teacher_id = auth.uid() AND s.student_id = profiles.user_id
    )
  )
);

-- Student: view only their own profile
CREATE POLICY "student_view_own_profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id AND NOT is_teacher(auth.uid()) AND NOT has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- 2. STUDENTS TABLE
-- ============================================
DROP POLICY IF EXISTS "Students can view their teacher assignment" ON public.students;
DROP POLICY IF EXISTS "Teachers can manage their students" ON public.students;

-- Admin: full CRUD
CREATE POLICY "admin_full_access_students"
ON public.students
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Teacher: view only their own students
CREATE POLICY "teacher_view_own_students"
ON public.students
FOR SELECT
TO authenticated
USING (is_teacher(auth.uid()) AND auth.uid() = teacher_id);

-- Student: view their teacher assignment
CREATE POLICY "student_view_teacher_assignment"
ON public.students
FOR SELECT
TO authenticated
USING (auth.uid() = student_id);

-- ============================================
-- 3. STUDENT_LESSONS TABLE
-- ============================================
DROP POLICY IF EXISTS "Students can view their lessons" ON public.student_lessons;
DROP POLICY IF EXISTS "Teachers can manage lessons for their students" ON public.student_lessons;

-- Admin: full CRUD
CREATE POLICY "admin_full_access_student_lessons"
ON public.student_lessons
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Teacher: read-only for their students' lessons
CREATE POLICY "teacher_view_student_lessons"
ON public.student_lessons
FOR SELECT
TO authenticated
USING (is_teacher(auth.uid()) AND auth.uid() = teacher_id);

-- Student: view their own lessons
CREATE POLICY "student_view_own_lessons"
ON public.student_lessons
FOR SELECT
TO authenticated
USING (auth.uid() = student_id);

-- ============================================
-- 4. STUDENT_LESSON_TRACKING TABLE
-- ============================================
DROP POLICY IF EXISTS "Students can view their own lesson tracking" ON public.student_lesson_tracking;
DROP POLICY IF EXISTS "Teachers can manage lesson tracking for their students" ON public.student_lesson_tracking;

-- Admin: full CRUD
CREATE POLICY "admin_full_access_lesson_tracking"
ON public.student_lesson_tracking
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Teacher: view their students' tracking
CREATE POLICY "teacher_view_lesson_tracking"
ON public.student_lesson_tracking
FOR SELECT
TO authenticated
USING (is_teacher(auth.uid()) AND auth.uid() = teacher_id);

-- Teacher: update only completed_lessons array (not dates)
CREATE POLICY "teacher_update_completed_lessons"
ON public.student_lesson_tracking
FOR UPDATE
TO authenticated
USING (is_teacher(auth.uid()) AND auth.uid() = teacher_id)
WITH CHECK (is_teacher(auth.uid()) AND auth.uid() = teacher_id);

-- Student: view their own tracking
CREATE POLICY "student_view_own_tracking"
ON public.student_lesson_tracking
FOR SELECT
TO authenticated
USING (auth.uid() = student_id);

-- ============================================
-- 5. GLOBAL_TOPICS TABLE
-- ============================================
DROP POLICY IF EXISTS "all_teachers_insert_global_topics" ON public.global_topics;
DROP POLICY IF EXISTS "all_teachers_view_global_topics" ON public.global_topics;
DROP POLICY IF EXISTS "owner_teacher_delete_global_topics" ON public.global_topics;
DROP POLICY IF EXISTS "owner_teacher_update_global_topics" ON public.global_topics;
DROP POLICY IF EXISTS "students_view_global_topics" ON public.global_topics;

-- Admin: full CRUD
CREATE POLICY "admin_full_access_global_topics"
ON public.global_topics
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Teacher: read-only
CREATE POLICY "teacher_view_global_topics"
ON public.global_topics
FOR SELECT
TO authenticated
USING (is_teacher(auth.uid()));

-- Student: view global topics assigned to their teacher
CREATE POLICY "student_view_global_topics"
ON public.global_topics
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.student_id = auth.uid() AND s.teacher_id = global_topics.teacher_id
  )
);

-- ============================================
-- 6. GLOBAL_TOPIC_RESOURCES TABLE
-- ============================================
DROP POLICY IF EXISTS "all_teachers_insert_global_resources" ON public.global_topic_resources;
DROP POLICY IF EXISTS "all_teachers_view_global_resources" ON public.global_topic_resources;
DROP POLICY IF EXISTS "owner_teacher_delete_global_resources" ON public.global_topic_resources;
DROP POLICY IF EXISTS "owner_teacher_update_global_resources" ON public.global_topic_resources;
DROP POLICY IF EXISTS "students_view_global_resources" ON public.global_topic_resources;

-- Admin: full CRUD
CREATE POLICY "admin_full_access_global_resources"
ON public.global_topic_resources
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Teacher: read-only
CREATE POLICY "teacher_view_global_resources"
ON public.global_topic_resources
FOR SELECT
TO authenticated
USING (
  is_teacher(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.global_topics gt
    WHERE gt.id = global_topic_resources.global_topic_id
  )
);

-- Student: view resources for their teacher's global topics
CREATE POLICY "student_view_global_resources"
ON public.global_topic_resources
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.global_topics gt
    JOIN public.students s ON s.teacher_id = gt.teacher_id
    WHERE gt.id = global_topic_resources.global_topic_id AND s.student_id = auth.uid()
  )
);

-- ============================================
-- 7. TOPICS TABLE (Individual)
-- ============================================
DROP POLICY IF EXISTS "Students can view their topics" ON public.topics;
DROP POLICY IF EXISTS "Teachers can manage topics for their students" ON public.topics;

-- Admin: full CRUD
CREATE POLICY "admin_full_access_topics"
ON public.topics
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Teacher: read-only for their students
CREATE POLICY "teacher_view_student_topics"
ON public.topics
FOR SELECT
TO authenticated
USING (is_teacher(auth.uid()) AND auth.uid() = teacher_id);

-- Student: view their own topics
CREATE POLICY "student_view_own_topics"
ON public.topics
FOR SELECT
TO authenticated
USING (auth.uid() = student_id);

-- ============================================
-- 8. RESOURCES TABLE (Individual)
-- ============================================
DROP POLICY IF EXISTS "Students can view resources for their topics" ON public.resources;
DROP POLICY IF EXISTS "Teachers can manage resources for their topics" ON public.resources;

-- Admin: full CRUD
CREATE POLICY "admin_full_access_resources"
ON public.resources
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Teacher: read-only for their students' resources
CREATE POLICY "teacher_view_student_resources"
ON public.resources
FOR SELECT
TO authenticated
USING (
  is_teacher(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.topics t
    WHERE t.id = resources.topic_id AND t.teacher_id = auth.uid()
  )
);

-- Student: view resources for their topics
CREATE POLICY "student_view_own_resources"
ON public.resources
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.topics t
    WHERE t.id = resources.topic_id AND t.student_id = auth.uid()
  )
);

-- ============================================
-- 9. STUDENT_RESOURCE_COMPLETION TABLE
-- ============================================
DROP POLICY IF EXISTS "students_manage_own_completion" ON public.student_resource_completion;
DROP POLICY IF EXISTS "teachers_manage_all_student_completion" ON public.student_resource_completion;

-- Admin: full CRUD
CREATE POLICY "admin_full_access_resource_completion"
ON public.student_resource_completion
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Teacher: read-only for their students
CREATE POLICY "teacher_view_student_completion"
ON public.student_resource_completion
FOR SELECT
TO authenticated
USING (teacher_owns_student(auth.uid(), student_id));

-- Student: read-only for their own completion
CREATE POLICY "student_view_own_completion"
ON public.student_resource_completion
FOR SELECT
TO authenticated
USING (auth.uid() = student_id);