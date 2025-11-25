-- ============================================================================
-- FIX 1: Update admin profile name to "Admin"
-- ============================================================================
UPDATE public.profiles 
SET full_name = 'Admin' 
WHERE user_id = '9f017d05-2118-4ec8-9d36-d1b592115841';

-- ============================================================================
-- FIX 5: Modify notification trigger to create only ONE notification per batch_id
-- ============================================================================

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS on_homework_uploaded ON public.homework_submissions;
DROP FUNCTION IF EXISTS public.notify_teacher_on_homework_upload();

-- Create new trigger function that creates notification only for first file in batch
CREATE OR REPLACE FUNCTION public.notify_teacher_on_homework_upload()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Sadece öğrenci yüklediğinde ve bu batch_id için ilk kayıtsa bildirim oluştur
  IF NEW.uploaded_by_user_id = NEW.student_id THEN
    -- Check if this is the first submission with this batch_id
    IF NOT EXISTS (
      SELECT 1 
      FROM public.homework_submissions 
      WHERE batch_id = NEW.batch_id 
      AND id != NEW.id
    ) THEN
      -- This is the first file in the batch, create notification
      INSERT INTO public.notifications (teacher_id, student_id, homework_id)
      VALUES (NEW.teacher_id, NEW.student_id, NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Recreate trigger
CREATE TRIGGER on_homework_uploaded
AFTER INSERT ON public.homework_submissions
FOR EACH ROW
EXECUTE FUNCTION public.notify_teacher_on_homework_upload();