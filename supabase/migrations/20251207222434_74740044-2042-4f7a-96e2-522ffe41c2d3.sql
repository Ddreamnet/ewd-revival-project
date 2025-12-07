-- Add about_text column to students table for storing notes about each student
ALTER TABLE public.students
ADD COLUMN about_text TEXT DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.students.about_text IS 'Admin-editable notes/information about the student';