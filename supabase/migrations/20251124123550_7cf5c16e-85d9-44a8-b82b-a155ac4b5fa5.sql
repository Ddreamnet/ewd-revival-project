-- Add missing RLS policies for teachers

-- Teachers can view their assigned students in students table
CREATE POLICY "teacher_view_own_students" ON public.students
FOR SELECT
TO authenticated
USING (teacher_id = auth.uid() OR public.has_role(auth.uid(), 'teacher'::app_role));

-- Teachers can view and update their own notifications
CREATE POLICY "teacher_view_own_notifications" ON public.notifications
FOR SELECT
TO authenticated
USING (teacher_id = auth.uid());

CREATE POLICY "teacher_update_own_notifications" ON public.notifications
FOR UPDATE
TO authenticated
USING (teacher_id = auth.uid())
WITH CHECK (teacher_id = auth.uid());

-- Teachers can view homework submissions from their students
CREATE POLICY "teacher_view_student_homework" ON public.homework_submissions
FOR SELECT
TO authenticated
USING (
  teacher_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.teacher_id = auth.uid()
    AND s.student_id = homework_submissions.student_id
  )
);

-- Teachers can upload homework for their students
CREATE POLICY "teacher_create_homework_for_students" ON public.homework_submissions
FOR INSERT
TO authenticated
WITH CHECK (
  teacher_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.teacher_id = auth.uid()
    AND s.student_id = homework_submissions.student_id
  )
);

-- Teachers can view and manage lesson tracking for their students
CREATE POLICY "teacher_view_student_tracking" ON public.student_lesson_tracking
FOR SELECT
TO authenticated
USING (
  teacher_id = auth.uid() OR
  public.has_role(auth.uid(), 'teacher'::app_role)
);

CREATE POLICY "teacher_manage_student_tracking" ON public.student_lesson_tracking
FOR ALL
TO authenticated
USING (teacher_id = auth.uid())
WITH CHECK (teacher_id = auth.uid());

-- Teachers can view and manage student lessons
CREATE POLICY "teacher_view_student_lessons" ON public.student_lessons
FOR SELECT
TO authenticated
USING (teacher_id = auth.uid());

CREATE POLICY "teacher_manage_student_lessons" ON public.student_lessons
FOR ALL
TO authenticated
USING (teacher_id = auth.uid())
WITH CHECK (teacher_id = auth.uid());