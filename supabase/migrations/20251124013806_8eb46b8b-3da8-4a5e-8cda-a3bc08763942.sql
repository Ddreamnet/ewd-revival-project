-- Fix RLS policies for global topics and resources to work with admin ownership

-- Update student access to global topics (remove teacher_id filter)
DROP POLICY IF EXISTS "student_view_global_topics" ON public.global_topics;
CREATE POLICY "student_view_global_topics"
ON public.global_topics
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.student_id = auth.uid()
  )
);

-- Update student access to global resources (remove teacher_id filter)
DROP POLICY IF EXISTS "student_view_global_resources" ON public.global_topic_resources;
CREATE POLICY "student_view_global_resources"
ON public.global_topic_resources
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.student_id = auth.uid()
  )
);