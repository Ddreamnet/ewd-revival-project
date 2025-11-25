-- Allow teachers to update their own trial lessons (mark as complete/incomplete)
CREATE POLICY "teacher_update_own_trial_lessons" 
ON public.trial_lessons 
FOR UPDATE 
TO authenticated
USING (teacher_id = auth.uid())
WITH CHECK (teacher_id = auth.uid());

-- Allow teachers to insert their own trial lessons
CREATE POLICY "teacher_insert_own_trial_lessons" 
ON public.trial_lessons 
FOR INSERT 
TO authenticated
WITH CHECK (teacher_id = auth.uid());

-- Allow teachers to delete their own trial lessons
CREATE POLICY "teacher_delete_own_trial_lessons" 
ON public.trial_lessons 
FOR DELETE 
TO authenticated
USING (teacher_id = auth.uid());