-- First, consolidate duplicate records: keep only the most recent one per student-teacher pair
-- that has completed_lessons data, or the most recently updated if none have data

-- Step 1: Create a temporary table to hold the records to keep
CREATE TEMP TABLE records_to_keep AS
SELECT DISTINCT ON (student_id, teacher_id) 
  id
FROM student_lesson_tracking
ORDER BY 
  student_id, 
  teacher_id,
  -- Prioritize records that have completed lessons data
  CASE WHEN array_length(completed_lessons, 1) > 0 THEN 0 ELSE 1 END,
  -- Then prioritize records with lesson_dates
  CASE WHEN lesson_dates != '{}'::jsonb THEN 0 ELSE 1 END,
  -- Finally, order by updated_at descending
  updated_at DESC;

-- Step 2: Delete all records that are not in our keep list
DELETE FROM student_lesson_tracking
WHERE id NOT IN (SELECT id FROM records_to_keep);

-- Step 3: Drop the temporary table
DROP TABLE records_to_keep;

-- Step 4: Add unique constraint to prevent future duplicates
ALTER TABLE student_lesson_tracking
ADD CONSTRAINT unique_student_teacher_tracking UNIQUE (student_id, teacher_id);