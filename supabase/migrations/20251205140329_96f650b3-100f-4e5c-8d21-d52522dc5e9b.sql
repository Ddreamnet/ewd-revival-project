-- Add is_archived column to students table
ALTER TABLE public.students ADD COLUMN is_archived boolean NOT NULL DEFAULT false;

-- Add archived_at timestamp to track when student was archived
ALTER TABLE public.students ADD COLUMN archived_at timestamp with time zone DEFAULT NULL;

-- Create index for faster queries filtering archived students
CREATE INDEX idx_students_is_archived ON public.students(is_archived);