-- Add separate minute tracking columns for regular and trial lessons
ALTER TABLE public.teacher_balance
ADD COLUMN IF NOT EXISTS regular_lessons_minutes integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS trial_lessons_minutes integer NOT NULL DEFAULT 0;