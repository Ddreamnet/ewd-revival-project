-- Add batch_id to homework_submissions for grouping multiple files
ALTER TABLE public.homework_submissions
ADD COLUMN batch_id UUID;

-- Set batch_id for existing records (each existing record is its own batch)
UPDATE public.homework_submissions
SET batch_id = id
WHERE batch_id IS NULL;

-- Make batch_id NOT NULL after setting existing values
ALTER TABLE public.homework_submissions
ALTER COLUMN batch_id SET NOT NULL;

-- Add index for better query performance
CREATE INDEX idx_homework_submissions_batch_id ON public.homework_submissions(batch_id);

-- Add index for querying by student and teacher
CREATE INDEX idx_homework_submissions_student_teacher ON public.homework_submissions(student_id, teacher_id, created_at DESC);