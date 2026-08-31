-- ============================================================================
-- Actually close anonymous access to the mutating RPCs
-- ============================================================================
--
-- Migration 20260828120000 revoked EXECUTE from `anon`, but Supabase's default
-- privileges grant EXECUTE on public functions to PUBLIC — and `anon` inherits
-- from PUBLIC, so the revoke was a no-op. The ACL still showed the PUBLIC grant
-- on every one of these:
--
--   proacl: =X/postgres | postgres=X/postgres | authenticated=X/postgres | ...
--            ^^^^^^^^^^ this is PUBLIC, and it is what anon was using
--
-- The caller-authorization wrappers (20260828122000) do reject an anonymous
-- caller, so this was defence-in-depth rather than an open door — but the grant
-- should match the intent. Revoking from PUBLIC and granting the two roles that
-- legitimately call these leaves anon with nothing.
--
-- The read-only boolean helpers (has_role, is_teacher, teacher_owns_student)
-- are deliberately untouched: RLS policies defined `TO public` call them, and
-- revoking would turn anonymous reads into permission errors rather than empty
-- result sets.

DO $$
DECLARE
  fn text;
  sig text;
BEGIN
  FOR fn, sig IN
    SELECT p.proname, p.oid::regprocedure::text
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND (p.proname LIKE 'rpc\_%' OR p.proname IN ('create_student_relationship', 'free_lesson_slots'))
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', sig);
    -- The *_impl bodies stay locked to the owner; only the authorizing
    -- wrappers are reachable from the API.
    IF fn NOT LIKE '%\_impl' AND fn <> 'free_lesson_slots' THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', sig);
    END IF;
  END LOOP;
END $$;
