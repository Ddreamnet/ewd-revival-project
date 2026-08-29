-- ============================================================================
-- 1) Close anonymous access to every mutating RPC
-- 2) Add an atomic lesson_number resequencer
-- 3) Lock create_student_relationship to admins / server-side callers
-- ============================================================================
--
-- Background: PostgREST exposes every function in `public` at /rest/v1/rpc/<name>,
-- and Supabase grants EXECUTE to `anon` + `authenticated` by default. Combined
-- with SECURITY DEFINER (which bypasses RLS), that made rpc_delete_student and
-- rpc_manual_balance_adjust callable by anyone holding the publishable anon key
-- — and that key ships inside the web bundle and both store binaries.
--
-- The read-only boolean helpers (has_role, is_teacher, teacher_owns_student) are
-- deliberately LEFT executable by anon: they are referenced from RLS policies
-- that are defined `TO public`, and revoking them would turn anonymous reads
-- into permission errors instead of empty result sets.

-- ── Shared authorization helpers ────────────────────────────────────────────

-- `auth.role()` is 'service_role' for trusted server-side callers (edge
-- functions using the service key), 'authenticated' for signed-in users and
-- 'anon' for the public key. Service role is allowed so existing edge functions
-- keep working.
CREATE OR REPLACE FUNCTION public.is_admin_caller()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(auth.role() = 'service_role', false)
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
$$;

COMMENT ON FUNCTION public.is_admin_caller IS
  'True when the caller is an admin, or a trusted server-side (service_role) caller.';

CREATE OR REPLACE FUNCTION public.is_teacher_caller(_teacher_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(auth.uid() = _teacher_id, false)
      OR public.is_admin_caller()
$$;

COMMENT ON FUNCTION public.is_teacher_caller IS
  'True when the caller owns _teacher_id, or is an admin / service_role caller.';

-- ── Atomic lesson_number resequencing ───────────────────────────────────────
--
-- lesson_instances carries UNIQUE(student_id, teacher_id, lesson_number).
-- The client used to renumber the chain with parallel UPDATEs whose errors were
-- discarded, so any swap (3->2 while 2->1) raised a unique violation, failed
-- silently and left the chain half-renumbered. Numbers are parked in a negative
-- range first, then flipped back — all inside one transaction.
CREATE OR REPLACE FUNCTION public.rpc_resequence_lesson_numbers(
  p_student_id uuid,
  p_teacher_id uuid,
  p_package_cycle integer DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cycle integer;
  v_updated integer := 0;
BEGIN
  IF NOT public.is_teacher_caller(p_teacher_id) THEN
    RETURN json_build_object('success', false, 'error', 'Bu işlem için yetkiniz yok');
  END IF;

  v_cycle := COALESCE(
    p_package_cycle,
    (SELECT package_cycle FROM student_lesson_tracking
      WHERE student_id = p_student_id AND teacher_id = p_teacher_id),
    1
  );

  -- Phase 1: park every row that needs a new number at a negative value.
  WITH ordered AS (
    SELECT id,
           row_number() OVER (ORDER BY lesson_date, start_time, created_at) AS rn
    FROM lesson_instances
    WHERE student_id = p_student_id
      AND teacher_id = p_teacher_id
      AND package_cycle = v_cycle
      AND status IN ('planned', 'completed')
  )
  UPDATE lesson_instances li
  SET lesson_number = -o.rn
  FROM ordered o
  WHERE li.id = o.id
    AND li.lesson_number <> o.rn;

  -- Phase 2: flip the parked rows to their final positive numbers.
  UPDATE lesson_instances
  SET lesson_number = -lesson_number
  WHERE student_id = p_student_id
    AND teacher_id = p_teacher_id
    AND package_cycle = v_cycle
    AND lesson_number < 0;
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN json_build_object('success', true, 'updated', v_updated, 'cycle', v_cycle);
END;
$$;

COMMENT ON FUNCTION public.rpc_resequence_lesson_numbers IS
  'Renumbers a student''s lesson chain by date+time order, atomically.';

-- ── create_student_relationship: admin / service_role only ──────────────────
--
-- This is the escalation step that mattered: it only verified that the *target*
-- was a teacher, never who was calling. Combined with client-supplied signup
-- metadata (handle_new_user trusts raw_user_meta_data->>'role'), a self-service
-- "teacher" could attach themselves to any student and then read that student's
-- profile, homework and progress through the teacher RLS policies.
CREATE OR REPLACE FUNCTION public.create_student_relationship(
  student_user_id uuid,
  teacher_user_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin_caller() THEN
    RETURN json_build_object('error', 'Bu işlem için yetkiniz yok');
  END IF;

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
    RETURN json_build_object('error', SQLERRM);
END;
$$;

-- ── Revoke anonymous EXECUTE on every mutating / privileged function ────────

REVOKE EXECUTE ON FUNCTION public.rpc_complete_lesson(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rpc_undo_complete_lesson(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rpc_complete_trial_lesson(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rpc_undo_trial_lesson(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rpc_reset_package(uuid, uuid, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rpc_archive_student(uuid, uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rpc_delete_student(uuid, uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rpc_restore_student(uuid, uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rpc_manual_balance_adjust(uuid, integer, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rpc_sync_student_schedule(uuid, uuid, jsonb, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rpc_resequence_lesson_numbers(uuid, uuid, integer) FROM anon;

REVOKE EXECUTE ON FUNCTION public.create_student_relationship(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_missing_profiles() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_global_topics_order(jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_global_resources_order(jsonb) FROM anon;

-- Trigger functions are never invoked through PostgREST, but they are exposed
-- as RPC endpoints and flagged by the Supabase security advisor.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_on_homework_upload() FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_admin_last_lesson() FROM anon;
REVOKE EXECUTE ON FUNCTION public.validate_max_lessons_per_week() FROM anon;
REVOKE EXECUTE ON FUNCTION public.complete_topic_resources() FROM anon;
REVOKE EXECUTE ON FUNCTION public.complete_global_topic_resources() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon;
REVOKE EXECUTE ON FUNCTION public.prevent_duplicate_lesson_instance() FROM anon;
