DROP POLICY "teacher_view_own_students" ON public.students;
CREATE POLICY "teacher_view_own_students" ON public.students
FOR SELECT TO authenticated
USING (teacher_id = auth.uid());

DROP POLICY "teacher_view_student_tracking" ON public.student_lesson_tracking;
CREATE POLICY "teacher_view_student_tracking" ON public.student_lesson_tracking
FOR SELECT TO authenticated
USING (teacher_id = auth.uid());