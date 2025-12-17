-- ============================================================================
-- ENGLISH WITH DILARA - TEMİZ VERITABANI ŞEMASI
-- Bu SQL yeni Supabase projesinde çalıştırılmalıdır
-- ============================================================================
-- ÖNEMLİ: Sırayla çalıştırın! İlk önce Enums, sonra Functions, sonra Tables...
-- ============================================================================

-- ============================================================================
-- BÖLÜM 1: ENUM TİPLERİ
-- ============================================================================

-- user_role enum (profiles.role için - legacy)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE public.user_role AS ENUM ('teacher', 'student');
  END IF;
END $$;

-- app_role enum (user_roles için - ana sistem)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'teacher', 'student');
  END IF;
END $$;

-- ============================================================================
-- BÖLÜM 2: TEMEL FONKSİYONLAR (Tablolardan önce oluşturulmalı)
-- ============================================================================

-- Updated_at otomatik güncelleme fonksiyonu
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$ 
BEGIN 
  NEW.updated_at = now(); 
  RETURN NEW; 
END; 
$$;

-- Rol kontrol fonksiyonu (RLS için kritik)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Öğretmen kontrol fonksiyonu
CREATE OR REPLACE FUNCTION public.is_teacher(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'teacher'::app_role
  )
$$;

-- Öğretmen-öğrenci ilişki kontrol fonksiyonu
CREATE OR REPLACE FUNCTION public.teacher_owns_student(_teacher_id uuid, _student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.students
    WHERE teacher_id = _teacher_id
    AND student_id = _student_id
  )
$$;

-- ============================================================================
-- BÖLÜM 3: TABLOLAR
-- ============================================================================

-- 1. user_roles - Kullanıcı rolleri
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 2. profiles - Kullanıcı profilleri
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  role public.user_role NOT NULL DEFAULT 'student',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. students - Öğrenci-öğretmen ilişkisi
CREATE TABLE IF NOT EXISTS public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  student_id uuid NOT NULL,
  about_text text DEFAULT NULL,
  is_archived boolean NOT NULL DEFAULT false,
  archived_at timestamp with time zone DEFAULT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- 4. student_lessons - Haftalık ders programı
CREATE TABLE IF NOT EXISTS public.student_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  teacher_id uuid NOT NULL,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_completed boolean NOT NULL DEFAULT false,
  completed_at timestamp with time zone,
  note text DEFAULT NULL,
  week_start_date date NOT NULL DEFAULT (date_trunc('week', CURRENT_DATE))::date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.student_lessons ENABLE ROW LEVEL SECURITY;

-- 5. student_lesson_tracking - Ders takibi
CREATE TABLE IF NOT EXISTS public.student_lesson_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  teacher_id uuid NOT NULL,
  lessons_per_week integer NOT NULL,
  completed_lessons integer[] DEFAULT ARRAY[]::integer[],
  lesson_dates jsonb DEFAULT '{}'::jsonb,
  month_start_date date NOT NULL DEFAULT (date_trunc('month', CURRENT_DATE))::date,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT unique_student_teacher_tracking UNIQUE (student_id, teacher_id)
);
ALTER TABLE public.student_lesson_tracking ENABLE ROW LEVEL SECURITY;

-- 6. lesson_overrides - Ders erteleme/iptal
CREATE TABLE IF NOT EXISTS public.lesson_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  teacher_id uuid NOT NULL,
  original_date date NOT NULL,
  original_day_of_week integer NOT NULL,
  original_start_time time NOT NULL,
  original_end_time time NOT NULL,
  new_date date,
  new_start_time time,
  new_end_time time,
  is_cancelled boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.lesson_overrides ENABLE ROW LEVEL SECURITY;

-- 7. global_topics - Global konular (Admin'e ait)
CREATE TABLE IF NOT EXISTS public.global_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL DEFAULT auth.uid(),
  title text NOT NULL,
  description text,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.global_topics ENABLE ROW LEVEL SECURITY;

-- 8. global_topic_resources - Global kaynaklar
CREATE TABLE IF NOT EXISTS public.global_topic_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  global_topic_id uuid NOT NULL REFERENCES public.global_topics(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  resource_type text NOT NULL,
  resource_url text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  is_completed boolean,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.global_topic_resources ENABLE ROW LEVEL SECURITY;

-- 9. topics - Bireysel konular (öğrenciye özel)
CREATE TABLE IF NOT EXISTS public.topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  teacher_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  is_completed boolean NOT NULL DEFAULT false,
  completed_at timestamp with time zone,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;

-- 10. resources - Bireysel kaynaklar
CREATE TABLE IF NOT EXISTS public.resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  resource_type text NOT NULL,
  resource_url text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  is_completed boolean DEFAULT false,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

-- 11. student_resource_completion - Kaynak tamamlama durumu
CREATE TABLE IF NOT EXISTS public.student_resource_completion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  resource_id uuid NOT NULL,
  is_completed boolean NOT NULL DEFAULT false,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (student_id, resource_id)
);
ALTER TABLE public.student_resource_completion ENABLE ROW LEVEL SECURITY;

-- 12. homework_submissions - Ödev gönderimleri
CREATE TABLE IF NOT EXISTS public.homework_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  teacher_id uuid NOT NULL,
  uploaded_by_user_id uuid NOT NULL DEFAULT auth.uid(),
  batch_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  file_url text NOT NULL,
  file_type text NOT NULL,
  file_name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.homework_submissions ENABLE ROW LEVEL SECURITY;

-- 13. notifications - Bildirimler
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  student_id uuid NOT NULL,
  homework_id uuid NOT NULL REFERENCES public.homework_submissions(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 14. admin_notifications - Admin bildirimleri
CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type text NOT NULL DEFAULT 'last_lesson_warning',
  teacher_id uuid NOT NULL,
  student_id uuid NOT NULL,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

-- 15. teacher_balance - Öğretmen bakiyesi
CREATE TABLE IF NOT EXISTS public.teacher_balance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  total_minutes integer NOT NULL DEFAULT 0,
  regular_lessons_minutes integer NOT NULL DEFAULT 0,
  trial_lessons_minutes integer NOT NULL DEFAULT 0,
  completed_regular_lessons integer NOT NULL DEFAULT 0,
  completed_trial_lessons integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.teacher_balance ENABLE ROW LEVEL SECURITY;

-- 16. payment_history - Ödeme geçmişi
CREATE TABLE IF NOT EXISTS public.payment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_minutes integer NOT NULL,
  completed_regular_lessons integer NOT NULL DEFAULT 0,
  completed_trial_lessons integer NOT NULL DEFAULT 0,
  payment_date timestamp with time zone NOT NULL DEFAULT now(),
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;

-- 17. trial_lessons - Deneme dersleri
CREATE TABLE IF NOT EXISTS public.trial_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_completed boolean NOT NULL DEFAULT false,
  lesson_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.trial_lessons ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- BÖLÜM 4: İNDEKSLER
-- ============================================================================

-- profiles
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);

-- students
CREATE INDEX IF NOT EXISTS idx_students_is_archived ON public.students(is_archived);

-- student_lessons
CREATE INDEX IF NOT EXISTS idx_student_lessons_student_id ON public.student_lessons(student_id);
CREATE INDEX IF NOT EXISTS idx_student_lessons_teacher_id ON public.student_lessons(teacher_id);
CREATE INDEX IF NOT EXISTS idx_student_lessons_week ON public.student_lessons(week_start_date);

-- lesson_overrides
CREATE INDEX IF NOT EXISTS idx_lesson_overrides_student_teacher ON public.lesson_overrides(student_id, teacher_id);
CREATE INDEX IF NOT EXISTS idx_lesson_overrides_dates ON public.lesson_overrides(original_date, new_date);

-- global_topics
CREATE INDEX IF NOT EXISTS idx_global_topics_teacher_id ON public.global_topics(teacher_id);

-- global_topic_resources
CREATE INDEX IF NOT EXISTS idx_gtr_topic ON public.global_topic_resources(global_topic_id);

-- resources
CREATE INDEX IF NOT EXISTS idx_resources_topic ON public.resources(topic_id);

-- homework_submissions
CREATE INDEX IF NOT EXISTS idx_homework_submissions_batch_id ON public.homework_submissions(batch_id);
CREATE INDEX IF NOT EXISTS idx_homework_submissions_student_teacher ON public.homework_submissions(student_id, teacher_id, created_at DESC);

-- notifications
CREATE INDEX IF NOT EXISTS idx_notifications_teacher_id ON public.notifications(teacher_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- payment_history
CREATE INDEX IF NOT EXISTS idx_payment_history_teacher_id ON public.payment_history(teacher_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_payment_date ON public.payment_history(payment_date DESC);

-- trial_lessons
CREATE INDEX IF NOT EXISTS idx_trial_lessons_teacher_date ON public.trial_lessons(teacher_id, lesson_date);
CREATE INDEX IF NOT EXISTS idx_trial_lessons_date ON public.trial_lessons(lesson_date);

-- ============================================================================
-- BÖLÜM 5: TETİKLEYİCİ FONKSİYONLARI
-- ============================================================================

-- Yeni kullanıcı profil oluşturma
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$ 
BEGIN 
  INSERT INTO public.profiles (user_id, email, full_name, role) 
  VALUES ( 
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'User'), 
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'student') 
  ); 
  RETURN NEW; 
EXCEPTION 
  WHEN OTHERS THEN 
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM; 
    RETURN NEW; 
END; 
$$;

-- Ödev yüklendiğinde bildirim
CREATE OR REPLACE FUNCTION public.notify_on_homework_upload()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Son ders uyarısı (Admin bildirimi)
CREATE OR REPLACE FUNCTION public.notify_admin_last_lesson()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_lessons INTEGER;
  completed_count INTEGER;
  teacher_name TEXT;
  student_name TEXT;
BEGIN
  total_lessons := NEW.lessons_per_week * 4;
  completed_count := COALESCE(array_length(NEW.completed_lessons, 1), 0);
  
  IF completed_count = total_lessons - 1 THEN
    SELECT full_name INTO teacher_name FROM public.profiles WHERE user_id = NEW.teacher_id;
    SELECT full_name INTO student_name FROM public.profiles WHERE user_id = NEW.student_id;
    
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

-- Maksimum ders sayısı kontrolü
CREATE OR REPLACE FUNCTION public.validate_max_lessons_per_week()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$ 
BEGIN 
  IF (SELECT COUNT(*) FROM public.student_lessons WHERE student_id = NEW.student_id AND week_start_date = NEW.week_start_date) >= 6 THEN 
    RAISE EXCEPTION 'Student cannot have more than 6 lessons per week'; 
  END IF; 
  RETURN NEW; 
END; 
$$;

-- Konu tamamlandığında kaynakları tamamla
CREATE OR REPLACE FUNCTION public.complete_topic_resources()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$ 
BEGIN 
  IF NEW.is_completed = true AND (OLD IS NULL OR OLD.is_completed = false) THEN 
    INSERT INTO public.student_resource_completion (student_id, resource_id, is_completed, completed_at) 
    SELECT NEW.student_id, r.id, true, now() 
    FROM public.resources r 
    WHERE r.topic_id = NEW.id 
    ON CONFLICT (student_id, resource_id) 
    DO UPDATE SET is_completed = true, completed_at = now(), updated_at = now(); 
  ELSIF NEW.is_completed = false AND OLD.is_completed = true THEN 
    UPDATE public.student_resource_completion 
    SET is_completed = false, completed_at = null, updated_at = now() 
    WHERE student_id = NEW.student_id 
    AND resource_id IN (SELECT r.id FROM public.resources r WHERE r.topic_id = NEW.id); 
  END IF;
  RETURN NEW; 
END; 
$$;

-- Global konu tamamlandığında kaynakları tamamla
CREATE OR REPLACE FUNCTION public.complete_global_topic_resources()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.is_completed = true THEN
    INSERT INTO public.student_resource_completion (student_id, resource_id, is_completed, completed_at)
    SELECT NEW.student_id, gtr.id, true, now()
    FROM public.global_topic_resources gtr
    JOIN public.global_topics gt ON gt.id = gtr.global_topic_id
    WHERE gt.title = NEW.title AND gt.teacher_id = NEW.teacher_id
    ON CONFLICT (student_id, resource_id)
      DO UPDATE SET is_completed = true, completed_at = now(), updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

-- Öğrenci ilişkisi oluşturma
CREATE OR REPLACE FUNCTION public.create_student_relationship(student_user_id uuid, teacher_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = teacher_user_id AND role = 'teacher'
  ) THEN
    RETURN json_build_object('error','Only teachers can create student relationships');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.students
    WHERE teacher_id = teacher_user_id AND student_id = student_user_id
  ) THEN
    RETURN json_build_object('error','Student relationship already exists');
  END IF;

  INSERT INTO public.students (teacher_id, student_id)
  VALUES (teacher_user_id, student_user_id);

  RETURN json_build_object('success',true,'message','Student relationship created successfully');
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('error', sqlerrm);
END;
$$;

-- Eksik profilleri senkronize et
CREATE OR REPLACE FUNCTION public.sync_missing_profiles()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  sync_count integer := 0;
  user_record record;
BEGIN
  FOR user_record IN
    SELECT au.id, au.email, au.raw_user_meta_data
    FROM auth.users au
    LEFT JOIN public.profiles p ON au.id = p.user_id
    WHERE p.user_id IS NULL
  LOOP
    INSERT INTO public.profiles (user_id, email, full_name, role)
    VALUES (
      user_record.id,
      user_record.email,
      COALESCE(user_record.raw_user_meta_data->>'full_name', user_record.raw_user_meta_data->>'name', 'User'),
      COALESCE((user_record.raw_user_meta_data->>'role')::public.user_role, 'student')
    );
    sync_count := sync_count + 1;
  END LOOP;

  RETURN json_build_object('success',true,'synced_profiles',sync_count,'message',format('Synced %s missing profiles', sync_count));
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('error', sqlerrm);
END;
$$;

-- Global topics sıralama güncelleme
CREATE OR REPLACE FUNCTION public.update_global_topics_order(topic_orders jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  topic_order jsonb;
BEGIN
  FOR topic_order IN SELECT * FROM jsonb_array_elements(topic_orders)
  LOOP
    UPDATE global_topics
    SET order_index = (topic_order->>'order_index')::integer
    WHERE id = (topic_order->>'id')::uuid;
  END LOOP;
END;
$$;

-- Global resources sıralama güncelleme
CREATE OR REPLACE FUNCTION public.update_global_resources_order(resource_orders jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  resource_order jsonb;
BEGIN
  FOR resource_order IN SELECT * FROM jsonb_array_elements(resource_orders)
  LOOP
    UPDATE global_topic_resources
    SET order_index = (resource_order->>'order_index')::integer
    WHERE id = (resource_order->>'id')::uuid;
  END LOOP;
END;
$$;

-- ============================================================================
-- BÖLÜM 6: TRİGGER'LAR
-- ============================================================================

-- Auth trigger (yeni kullanıcı profil oluşturma)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- profiles updated_at
DROP TRIGGER IF EXISTS trg_set_updated_at_profiles ON public.profiles;
CREATE TRIGGER trg_set_updated_at_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- student_lessons updated_at
DROP TRIGGER IF EXISTS trg_set_updated_at_lessons ON public.student_lessons;
CREATE TRIGGER trg_set_updated_at_lessons
  BEFORE UPDATE ON public.student_lessons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- student_lessons validation
DROP TRIGGER IF EXISTS trg_validate_max_lessons ON public.student_lessons;
CREATE TRIGGER trg_validate_max_lessons
  BEFORE INSERT ON public.student_lessons
  FOR EACH ROW EXECUTE FUNCTION public.validate_max_lessons_per_week();

-- student_lesson_tracking updated_at
DROP TRIGGER IF EXISTS update_student_lesson_tracking_updated_at ON public.student_lesson_tracking;
CREATE TRIGGER update_student_lesson_tracking_updated_at
  BEFORE UPDATE ON public.student_lesson_tracking
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- student_lesson_tracking admin notification
DROP TRIGGER IF EXISTS on_lesson_tracking_update_notify_admin ON public.student_lesson_tracking;
CREATE TRIGGER on_lesson_tracking_update_notify_admin
  AFTER UPDATE ON public.student_lesson_tracking
  FOR EACH ROW EXECUTE FUNCTION public.notify_admin_last_lesson();

-- lesson_overrides updated_at
DROP TRIGGER IF EXISTS update_lesson_overrides_updated_at ON public.lesson_overrides;
CREATE TRIGGER update_lesson_overrides_updated_at
  BEFORE UPDATE ON public.lesson_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- global_topics updated_at
DROP TRIGGER IF EXISTS trg_set_updated_at_global_topics ON public.global_topics;
CREATE TRIGGER trg_set_updated_at_global_topics
  BEFORE UPDATE ON public.global_topics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- global_topic_resources updated_at
DROP TRIGGER IF EXISTS trg_set_updated_at_global_topic_resources ON public.global_topic_resources;
CREATE TRIGGER trg_set_updated_at_global_topic_resources
  BEFORE UPDATE ON public.global_topic_resources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- topics updated_at
DROP TRIGGER IF EXISTS trg_set_updated_at_topics ON public.topics;
CREATE TRIGGER trg_set_updated_at_topics
  BEFORE UPDATE ON public.topics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- topics complete resources
DROP TRIGGER IF EXISTS trg_complete_topic_resources ON public.topics;
CREATE TRIGGER trg_complete_topic_resources
  AFTER UPDATE ON public.topics
  FOR EACH ROW EXECUTE FUNCTION public.complete_topic_resources();

DROP TRIGGER IF EXISTS trg_complete_topic_resources_ins ON public.topics;
CREATE TRIGGER trg_complete_topic_resources_ins
  AFTER INSERT ON public.topics
  FOR EACH ROW EXECUTE FUNCTION public.complete_topic_resources();

DROP TRIGGER IF EXISTS trg_complete_topic_resources_upd ON public.topics;
CREATE TRIGGER trg_complete_topic_resources_upd
  AFTER UPDATE ON public.topics
  FOR EACH ROW EXECUTE FUNCTION public.complete_topic_resources();

-- topics complete global topic resources
DROP TRIGGER IF EXISTS trg_complete_global_topic_resources_ins ON public.topics;
CREATE TRIGGER trg_complete_global_topic_resources_ins
  AFTER INSERT ON public.topics
  FOR EACH ROW EXECUTE FUNCTION public.complete_global_topic_resources();

DROP TRIGGER IF EXISTS trg_complete_global_topic_resources_upd ON public.topics;
CREATE TRIGGER trg_complete_global_topic_resources_upd
  AFTER UPDATE ON public.topics
  FOR EACH ROW EXECUTE FUNCTION public.complete_global_topic_resources();

-- resources updated_at
DROP TRIGGER IF EXISTS trg_set_updated_at_resources ON public.resources;
CREATE TRIGGER trg_set_updated_at_resources
  BEFORE UPDATE ON public.resources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- student_resource_completion updated_at
DROP TRIGGER IF EXISTS trg_set_updated_at_src ON public.student_resource_completion;
CREATE TRIGGER trg_set_updated_at_src
  BEFORE UPDATE ON public.student_resource_completion
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- homework_submissions updated_at
DROP TRIGGER IF EXISTS update_homework_submissions_updated_at ON public.homework_submissions;
CREATE TRIGGER update_homework_submissions_updated_at
  BEFORE UPDATE ON public.homework_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- homework_submissions notification
DROP TRIGGER IF EXISTS on_homework_uploaded ON public.homework_submissions;
CREATE TRIGGER on_homework_uploaded
  AFTER INSERT ON public.homework_submissions
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_homework_upload();

-- teacher_balance updated_at
DROP TRIGGER IF EXISTS update_teacher_balance_updated_at ON public.teacher_balance;
CREATE TRIGGER update_teacher_balance_updated_at
  BEFORE UPDATE ON public.teacher_balance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- trial_lessons updated_at
DROP TRIGGER IF EXISTS update_trial_lessons_updated_at ON public.trial_lessons;
CREATE TRIGGER update_trial_lessons_updated_at
  BEFORE UPDATE ON public.trial_lessons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- BÖLÜM 7: REALTIME AYARLARI
-- ============================================================================

ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.admin_notifications REPLICA IDENTITY FULL;
ALTER TABLE public.trial_lessons REPLICA IDENTITY FULL;

-- Realtime publication'a tablolar ekle (varsa)
DO $$ 
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.trial_lessons;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
