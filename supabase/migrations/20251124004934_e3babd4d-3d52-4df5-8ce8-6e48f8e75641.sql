-- Add lesson_dates column to student_lesson_tracking table
-- This will store the date for each completed lesson
ALTER TABLE public.student_lesson_tracking
ADD COLUMN IF NOT EXISTS lesson_dates JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.student_lesson_tracking.lesson_dates IS 'Stores dates for each lesson number, e.g., {"1": "2024-11-17", "2": "2024-11-19"}';
