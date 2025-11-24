-- Add remaining missing RLS policies for teachers

-- Teachers can view topics for their assigned students
CREATE POLICY "teacher_view_student_topics" ON public.topics
FOR SELECT
TO authenticated
USING (
  teacher_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.teacher_id = auth.uid()
    AND s.student_id = topics.student_id
  )
);

-- Teachers can manage topics for their assigned students (but Prompt 7 says READ-ONLY, so we'll only allow SELECT)
-- Actually according to memory, teachers should NOT be able to create/edit/delete individual topics (Prompt 7)
-- So we don't add INSERT/UPDATE/DELETE policies for teachers on topics

-- Teachers can view resources for their assigned students
CREATE POLICY "teacher_view_student_resources" ON public.resources
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.topics t
    INNER JOIN public.students s ON s.student_id = t.student_id
    WHERE s.teacher_id = auth.uid()
    AND t.id = resources.topic_id
  )
);

-- Teachers can view global topics (read-only access)
CREATE POLICY "teacher_view_global_topics" ON public.global_topics
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'teacher'::app_role) OR teacher_id = auth.uid());

-- Teachers can view global resources (read-only access)
CREATE POLICY "teacher_view_global_resources" ON public.global_topic_resources
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.global_topics gt
    WHERE gt.id = global_topic_resources.global_topic_id
  )
);