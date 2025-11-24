-- ============================================================================
-- BİLDİRİM SİSTEMİ - ÖDEV YÜKLENME BİLDİRİMLERİ
-- ============================================================================

-- Bildirimler tablosu
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  student_id uuid NOT NULL,
  homework_id uuid NOT NULL REFERENCES public.homework_submissions(id) ON DELETE CASCADE,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index'ler - performans için
CREATE INDEX IF NOT EXISTS idx_notifications_teacher_id ON public.notifications(teacher_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- RLS aktif et
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Öğretmen sadece kendi bildirimlerini görebilir
CREATE POLICY "teacher_view_own_notifications"
ON public.notifications
FOR SELECT
USING (is_teacher(auth.uid()) AND auth.uid() = teacher_id);

-- Öğretmen kendi bildirimlerini güncelleyebilir (okundu işareti için)
CREATE POLICY "teacher_update_own_notifications"
ON public.notifications
FOR UPDATE
USING (is_teacher(auth.uid()) AND auth.uid() = teacher_id)
WITH CHECK (is_teacher(auth.uid()) AND auth.uid() = teacher_id);

-- Admin tüm bildirimleri görebilir
CREATE POLICY "admin_view_all_notifications"
ON public.notifications
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin tüm bildirimleri silebilir
CREATE POLICY "admin_delete_notifications"
ON public.notifications
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================================
-- TRİGGER - ÖĞRENCİ ÖDEV YÜKLEDİĞİNDE BİLDİRİM OLUŞTUR
-- ============================================================================

-- Trigger fonksiyonu
CREATE OR REPLACE FUNCTION public.notify_teacher_on_homework_upload()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Sadece öğrenci yüklediğinde bildirim oluştur (öğretmen yüklediğinde değil)
  IF NEW.uploaded_by_user_id = NEW.student_id THEN
    INSERT INTO public.notifications (teacher_id, student_id, homework_id)
    VALUES (NEW.teacher_id, NEW.student_id, NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger
DROP TRIGGER IF EXISTS on_homework_uploaded ON public.homework_submissions;
CREATE TRIGGER on_homework_uploaded
AFTER INSERT ON public.homework_submissions
FOR EACH ROW
EXECUTE FUNCTION public.notify_teacher_on_homework_upload();

-- ============================================================================
-- REALTIME İÇİN AYARLAR
-- ============================================================================

-- Realtime için replica identity
ALTER TABLE public.notifications REPLICA IDENTITY FULL;