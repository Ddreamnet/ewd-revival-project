-- Step 1: Add recipient_id column as nullable first
ALTER TABLE public.notifications 
ADD COLUMN recipient_id uuid;

-- Step 2: Update existing notifications to set recipient_id to teacher_id
UPDATE public.notifications SET recipient_id = teacher_id;

-- Step 3: Make it NOT NULL now that all rows have values
ALTER TABLE public.notifications 
ALTER COLUMN recipient_id SET NOT NULL;

-- Drop the old trigger and function
DROP TRIGGER IF EXISTS on_homework_uploaded ON public.homework_submissions;
DROP FUNCTION IF EXISTS public.notify_teacher_on_homework_upload();

-- Create new function that correctly sets recipient
CREATE OR REPLACE FUNCTION public.notify_on_homework_upload()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Öğrenci yüklediğinde öğretmene bildirim oluştur
  IF NEW.uploaded_by_user_id = NEW.student_id THEN
    INSERT INTO public.notifications (teacher_id, student_id, homework_id, recipient_id)
    VALUES (NEW.teacher_id, NEW.student_id, NEW.id, NEW.teacher_id);
  END IF;
  
  -- Öğretmen yüklediğinde öğrenciye bildirim oluştur
  IF NEW.uploaded_by_user_id = NEW.teacher_id THEN
    INSERT INTO public.notifications (teacher_id, student_id, homework_id, recipient_id)
    VALUES (NEW.teacher_id, NEW.student_id, NEW.id, NEW.student_id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create new trigger
CREATE TRIGGER on_homework_uploaded
AFTER INSERT ON public.homework_submissions
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_homework_upload();

-- Update RLS policies to use recipient_id
DROP POLICY IF EXISTS "student_view_own_notifications" ON public.notifications;
DROP POLICY IF EXISTS "teacher_view_own_notifications" ON public.notifications;
DROP POLICY IF EXISTS "student_update_own_notifications" ON public.notifications;
DROP POLICY IF EXISTS "teacher_update_own_notifications" ON public.notifications;

-- New policies based on recipient_id
CREATE POLICY "user_view_own_notifications"
ON public.notifications
FOR SELECT
USING (auth.uid() = recipient_id);

CREATE POLICY "user_update_own_notifications"
ON public.notifications
FOR UPDATE
USING (auth.uid() = recipient_id)
WITH CHECK (auth.uid() = recipient_id);