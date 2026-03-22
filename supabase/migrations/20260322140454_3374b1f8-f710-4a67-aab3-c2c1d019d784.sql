CREATE INDEX IF NOT EXISTS idx_lesson_instances_teacher_status_date 
ON public.lesson_instances (teacher_id, status, lesson_date);