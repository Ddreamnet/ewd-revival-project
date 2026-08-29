-- ============================================================================
-- Caller authorization for every business RPC
-- ============================================================================
--
-- Before this migration none of the rpc_* functions checked who was calling.
-- They are all SECURITY DEFINER (so they bypass RLS) and take p_teacher_id /
-- p_student_id as caller-supplied parameters. Migration 20260828120000 removed
-- anonymous EXECUTE, which closed the internet-facing hole; this one closes the
-- authenticated-but-wrong-user case — a signed-in teacher could still have
-- called rpc_delete_student or rpc_manual_balance_adjust for anybody.
--
-- Technique: rename each function to *_impl (its body is left completely
-- untouched, so there is no chance of transcribing 100+ lines of PL/pgSQL
-- incorrectly), revoke all access to the impl, and publish a same-signature
-- wrapper that authorizes first and then delegates. The client needs no change.
--
-- Split:
--   admin-only        — destructive and financial operations, all of which are
--                       reached only from the admin panel.
--   teacher-or-admin  — lesson and trial completion, which teachers perform for
--                       their own students.
--
-- is_admin_caller() also accepts service_role so existing edge functions keep
-- working.

-- ── Admin-only ──────────────────────────────────────────────────────────────
ALTER FUNCTION public.rpc_delete_student(uuid,uuid,uuid) RENAME TO rpc_delete_student_impl;
REVOKE ALL ON FUNCTION public.rpc_delete_student_impl(uuid,uuid,uuid) FROM public, anon, authenticated;
CREATE OR REPLACE FUNCTION public.rpc_delete_student(p_student_record_id uuid, p_student_user_id uuid, p_teacher_user_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin_caller() THEN
    RETURN json_build_object('success', false, 'error', 'Bu işlem için yetkiniz yok');
  END IF;
  RETURN public.rpc_delete_student_impl(p_student_record_id, p_student_user_id, p_teacher_user_id);
END; $$;

ALTER FUNCTION public.rpc_archive_student(uuid,uuid,uuid) RENAME TO rpc_archive_student_impl;
REVOKE ALL ON FUNCTION public.rpc_archive_student_impl(uuid,uuid,uuid) FROM public, anon, authenticated;
CREATE OR REPLACE FUNCTION public.rpc_archive_student(p_student_record_id uuid, p_student_user_id uuid, p_teacher_user_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin_caller() THEN
    RETURN json_build_object('success', false, 'error', 'Bu işlem için yetkiniz yok');
  END IF;
  RETURN public.rpc_archive_student_impl(p_student_record_id, p_student_user_id, p_teacher_user_id);
END; $$;

ALTER FUNCTION public.rpc_restore_student(uuid,uuid,uuid) RENAME TO rpc_restore_student_impl;
REVOKE ALL ON FUNCTION public.rpc_restore_student_impl(uuid,uuid,uuid) FROM public, anon, authenticated;
CREATE OR REPLACE FUNCTION public.rpc_restore_student(p_student_record_id uuid, p_student_user_id uuid, p_teacher_user_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin_caller() THEN
    RETURN json_build_object('success', false, 'error', 'Bu işlem için yetkiniz yok');
  END IF;
  RETURN public.rpc_restore_student_impl(p_student_record_id, p_student_user_id, p_teacher_user_id);
END; $$;

ALTER FUNCTION public.rpc_reset_package(uuid,uuid,jsonb) RENAME TO rpc_reset_package_impl;
REVOKE ALL ON FUNCTION public.rpc_reset_package_impl(uuid,uuid,jsonb) FROM public, anon, authenticated;
CREATE OR REPLACE FUNCTION public.rpc_reset_package(p_student_id uuid, p_teacher_id uuid, p_template_slots jsonb)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin_caller() THEN
    RETURN json_build_object('success', false, 'error', 'Bu işlem için yetkiniz yok');
  END IF;
  RETURN public.rpc_reset_package_impl(p_student_id, p_teacher_id, p_template_slots);
END; $$;

ALTER FUNCTION public.rpc_sync_student_schedule(uuid,uuid,jsonb,integer) RENAME TO rpc_sync_student_schedule_impl;
REVOKE ALL ON FUNCTION public.rpc_sync_student_schedule_impl(uuid,uuid,jsonb,integer) FROM public, anon, authenticated;
CREATE OR REPLACE FUNCTION public.rpc_sync_student_schedule(p_student_id uuid, p_teacher_id uuid, p_slots jsonb, p_lessons_per_week integer)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin_caller() THEN
    RETURN json_build_object('success', false, 'error', 'Bu işlem için yetkiniz yok');
  END IF;
  RETURN public.rpc_sync_student_schedule_impl(p_student_id, p_teacher_id, p_slots, p_lessons_per_week);
END; $$;

ALTER FUNCTION public.rpc_manual_balance_adjust(uuid,integer,text) RENAME TO rpc_manual_balance_adjust_impl;
REVOKE ALL ON FUNCTION public.rpc_manual_balance_adjust_impl(uuid,integer,text) FROM public, anon, authenticated;
CREATE OR REPLACE FUNCTION public.rpc_manual_balance_adjust(p_teacher_id uuid, p_amount_minutes integer, p_notes text DEFAULT NULL)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin_caller() THEN
    RETURN json_build_object('success', false, 'error', 'Bu işlem için yetkiniz yok');
  END IF;
  RETURN public.rpc_manual_balance_adjust_impl(p_teacher_id, p_amount_minutes, p_notes);
END; $$;

-- ── Teacher-or-admin ────────────────────────────────────────────────────────
ALTER FUNCTION public.rpc_complete_lesson(uuid,uuid) RENAME TO rpc_complete_lesson_impl;
REVOKE ALL ON FUNCTION public.rpc_complete_lesson_impl(uuid,uuid) FROM public, anon, authenticated;
CREATE OR REPLACE FUNCTION public.rpc_complete_lesson(p_instance_id uuid, p_teacher_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_teacher_caller(p_teacher_id) THEN
    RETURN json_build_object('success', false, 'error', 'Bu işlem için yetkiniz yok');
  END IF;
  RETURN public.rpc_complete_lesson_impl(p_instance_id, p_teacher_id);
END; $$;

ALTER FUNCTION public.rpc_undo_complete_lesson(uuid,uuid) RENAME TO rpc_undo_complete_lesson_impl;
REVOKE ALL ON FUNCTION public.rpc_undo_complete_lesson_impl(uuid,uuid) FROM public, anon, authenticated;
CREATE OR REPLACE FUNCTION public.rpc_undo_complete_lesson(p_instance_id uuid, p_teacher_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_teacher_caller(p_teacher_id) THEN
    RETURN json_build_object('success', false, 'error', 'Bu işlem için yetkiniz yok');
  END IF;
  RETURN public.rpc_undo_complete_lesson_impl(p_instance_id, p_teacher_id);
END; $$;

ALTER FUNCTION public.rpc_complete_trial_lesson(uuid,uuid) RENAME TO rpc_complete_trial_lesson_impl;
REVOKE ALL ON FUNCTION public.rpc_complete_trial_lesson_impl(uuid,uuid) FROM public, anon, authenticated;
CREATE OR REPLACE FUNCTION public.rpc_complete_trial_lesson(p_trial_id uuid, p_teacher_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_teacher_caller(p_teacher_id) THEN
    RETURN json_build_object('success', false, 'error', 'Bu işlem için yetkiniz yok');
  END IF;
  RETURN public.rpc_complete_trial_lesson_impl(p_trial_id, p_teacher_id);
END; $$;

ALTER FUNCTION public.rpc_undo_trial_lesson(uuid,uuid) RENAME TO rpc_undo_trial_lesson_impl;
REVOKE ALL ON FUNCTION public.rpc_undo_trial_lesson_impl(uuid,uuid) FROM public, anon, authenticated;
CREATE OR REPLACE FUNCTION public.rpc_undo_trial_lesson(p_trial_id uuid, p_teacher_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_teacher_caller(p_teacher_id) THEN
    RETURN json_build_object('success', false, 'error', 'Bu işlem için yetkiniz yok');
  END IF;
  RETURN public.rpc_undo_trial_lesson_impl(p_trial_id, p_teacher_id);
END; $$;

-- Wrappers must not be anon-callable either.
REVOKE EXECUTE ON FUNCTION public.rpc_delete_student(uuid,uuid,uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rpc_archive_student(uuid,uuid,uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rpc_restore_student(uuid,uuid,uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rpc_reset_package(uuid,uuid,jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rpc_sync_student_schedule(uuid,uuid,jsonb,integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rpc_manual_balance_adjust(uuid,integer,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rpc_complete_lesson(uuid,uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rpc_undo_complete_lesson(uuid,uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rpc_complete_trial_lesson(uuid,uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rpc_undo_trial_lesson(uuid,uuid) FROM anon;
