-- Enable teachers to update topic completion status for their students
CREATE POLICY "teacher_update_student_topics"
ON public.topics
FOR UPDATE
TO authenticated
USING (
  is_teacher(auth.uid()) AND
  EXISTS (
    SELECT 1 FROM public.students
    WHERE students.student_id = topics.student_id
    AND students.teacher_id = auth.uid()
  )
)
WITH CHECK (
  is_teacher(auth.uid()) AND
  EXISTS (
    SELECT 1 FROM public.students
    WHERE students.student_id = topics.student_id
    AND students.teacher_id = auth.uid()
  )
);

-- Enable teachers to insert resource completion records for their students
CREATE POLICY "teacher_insert_student_resource_completion"
ON public.student_resource_completion
FOR INSERT
TO authenticated
WITH CHECK (
  is_teacher(auth.uid()) AND
  EXISTS (
    SELECT 1 FROM public.students
    WHERE students.student_id = student_resource_completion.student_id
    AND students.teacher_id = auth.uid()
  )
);

-- Enable teachers to update resource completion records for their students
CREATE POLICY "teacher_update_student_resource_completion"
ON public.student_resource_completion
FOR UPDATE
TO authenticated
USING (
  is_teacher(auth.uid()) AND
  EXISTS (
    SELECT 1 FROM public.students
    WHERE students.student_id = student_resource_completion.student_id
    AND students.teacher_id = auth.uid()
  )
)
WITH CHECK (
  is_teacher(auth.uid()) AND
  EXISTS (
    SELECT 1 FROM public.students
    WHERE students.student_id = student_resource_completion.student_id
    AND students.teacher_id = auth.uid()
  )
);