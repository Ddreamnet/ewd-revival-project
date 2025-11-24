-- Update ownership of all individual topics and resources to admin
-- Admin user_id: 9f017d05-2118-4ec8-9d36-d1b592115841

-- Update topics table - set all topics' teacher_id to admin
UPDATE public.topics
SET teacher_id = '9f017d05-2118-4ec8-9d36-d1b592115841';

-- Update RLS policies for topics table
-- Drop existing policies
DROP POLICY IF EXISTS "teacher_view_student_topics" ON public.topics;
DROP POLICY IF EXISTS "student_view_own_topics" ON public.topics;
DROP POLICY IF EXISTS "admin_full_access_topics" ON public.topics;

-- Create new policies
-- Admin: Full CRUD
CREATE POLICY "admin_full_access_topics"
ON public.topics
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Teacher: Read-only for their students' topics
CREATE POLICY "teacher_view_student_topics"
ON public.topics
FOR SELECT
USING (
  is_teacher(auth.uid()) AND
  EXISTS (
    SELECT 1 FROM public.students
    WHERE students.student_id = topics.student_id
    AND students.teacher_id = auth.uid()
  )
);

-- Student: Read-only for own topics
CREATE POLICY "student_view_own_topics"
ON public.topics
FOR SELECT
USING (auth.uid() = student_id);

-- Update RLS policies for resources table
-- Drop existing policies
DROP POLICY IF EXISTS "teacher_view_student_resources" ON public.resources;
DROP POLICY IF EXISTS "student_view_own_resources" ON public.resources;
DROP POLICY IF EXISTS "admin_full_access_resources" ON public.resources;

-- Create new policies
-- Admin: Full CRUD
CREATE POLICY "admin_full_access_resources"
ON public.resources
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Teacher: Read-only for their students' resources
CREATE POLICY "teacher_view_student_resources"
ON public.resources
FOR SELECT
USING (
  is_teacher(auth.uid()) AND
  EXISTS (
    SELECT 1 FROM public.topics
    JOIN public.students ON students.student_id = topics.student_id
    WHERE topics.id = resources.topic_id
    AND students.teacher_id = auth.uid()
  )
);

-- Student: Read-only for own resources
CREATE POLICY "student_view_own_resources"
ON public.resources
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.topics
    WHERE topics.id = resources.topic_id
    AND topics.student_id = auth.uid()
  )
);