-- Teacher'ın kendi öğrencileri için resource completion oluşturma/güncelleme yetkisi
CREATE POLICY "teacher_manage_student_completion" ON public.student_resource_completion
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.teacher_id = auth.uid()
    AND s.student_id = student_resource_completion.student_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.teacher_id = auth.uid()
    AND s.student_id = student_resource_completion.student_id
  )
);