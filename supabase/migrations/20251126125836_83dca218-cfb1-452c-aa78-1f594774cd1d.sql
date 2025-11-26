-- ============================================================================
-- BİLDİRİM SİSTEMİ GÜNCELLEMESİ - ÖĞRENCİ BİLDİRİMLERİ
-- ============================================================================
-- Bu migration öğretmen ödev yüklediğinde öğrencilere bildirim gönderilmesini sağlar

-- RLS Policy - Öğrenci sadece kendi bildirimlerini görebilir
CREATE POLICY "student_view_own_notifications"
ON public.notifications
FOR SELECT
USING (auth.uid() = student_id);

-- RLS Policy - Öğrenci kendi bildirimlerini güncelleyebilir (okundu işareti için)
CREATE POLICY "student_update_own_notifications"
ON public.notifications
FOR UPDATE
USING (auth.uid() = student_id)
WITH CHECK (auth.uid() = student_id);

-- ============================================================================
-- TRİGGER GÜNCELLEMESİ - HEM ÖĞRETMEN HEM ÖĞRENCİ İÇİN BİLDİRİM
-- ============================================================================

-- Trigger fonksiyonu güncelleme
CREATE OR REPLACE FUNCTION public.notify_teacher_on_homework_upload()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Öğrenci yüklediğinde öğretmene bildirim oluştur
  IF NEW.uploaded_by_user_id = NEW.student_id THEN
    INSERT INTO public.notifications (teacher_id, student_id, homework_id)
    VALUES (NEW.teacher_id, NEW.student_id, NEW.id);
  END IF;
  
  -- Öğretmen yüklediğinde öğrenciye bildirim oluştur
  IF NEW.uploaded_by_user_id = NEW.teacher_id THEN
    INSERT INTO public.notifications (teacher_id, student_id, homework_id)
    VALUES (NEW.teacher_id, NEW.student_id, NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$;