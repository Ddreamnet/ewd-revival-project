-- Admin bildirimleri için yeni tablo
CREATE TABLE public.admin_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notification_type TEXT NOT NULL DEFAULT 'last_lesson_warning',
  teacher_id UUID NOT NULL,
  student_id UUID NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS aktif et
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

-- Admin tüm bildirimleri görebilir ve yönetebilir
CREATE POLICY "admin_full_access_admin_notifications" 
ON public.admin_notifications 
FOR ALL 
TO authenticated 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger function: Sondan bir önceki ders işlendiğinde admin'e bildirim gönder
CREATE OR REPLACE FUNCTION public.notify_admin_last_lesson()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  total_lessons INTEGER;
  completed_count INTEGER;
  teacher_name TEXT;
  student_name TEXT;
BEGIN
  -- Toplam ders sayısını hesapla (lessons_per_week * 4)
  total_lessons := NEW.lessons_per_week * 4;
  
  -- Tamamlanan ders sayısını hesapla
  completed_count := COALESCE(array_length(NEW.completed_lessons, 1), 0);
  
  -- Sadece sondan bir önceki ders işlendiğinde bildirim gönder
  -- Yani completed_count = total_lessons - 1 olduğunda
  IF completed_count = total_lessons - 1 THEN
    -- Öğretmen ve öğrenci adlarını al
    SELECT full_name INTO teacher_name FROM public.profiles WHERE user_id = NEW.teacher_id;
    SELECT full_name INTO student_name FROM public.profiles WHERE user_id = NEW.student_id;
    
    -- Bildirim oluştur (sadece bu ay için bu öğrenci-öğretmen çifti için bir bildirim yoksa)
    IF NOT EXISTS (
      SELECT 1 FROM public.admin_notifications
      WHERE teacher_id = NEW.teacher_id
      AND student_id = NEW.student_id
      AND notification_type = 'last_lesson_warning'
      AND created_at > (CURRENT_DATE - INTERVAL '30 days')
    ) THEN
      INSERT INTO public.admin_notifications (notification_type, teacher_id, student_id, message)
      VALUES (
        'last_lesson_warning',
        NEW.teacher_id,
        NEW.student_id,
        COALESCE(teacher_name, 'Öğretmen') || ' öğretmenin ' || COALESCE(student_name, 'Öğrenci') || ' öğrencisinin son bir dersi kaldı!'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger oluştur
CREATE TRIGGER on_lesson_tracking_update_notify_admin
AFTER UPDATE ON public.student_lesson_tracking
FOR EACH ROW
EXECUTE FUNCTION public.notify_admin_last_lesson();

-- Realtime için tabloyu ayarla
ALTER TABLE public.admin_notifications REPLICA IDENTITY FULL;