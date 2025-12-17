-- ============================================================================
-- ENGLISH WITH DILARA - RLS POLİTİKALARI
-- Bu SQL, 01-clean-schema.sql'den SONRA çalıştırılmalıdır
-- ============================================================================

-- ============================================================================
-- 1. USER_ROLES TABLOSU
-- ============================================================================

CREATE POLICY "users_view_own_roles" ON public.user_roles
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "admin_view_all_roles" ON public.user_roles
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin_manage_all_roles" ON public.user_roles
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================================================
-- 2. PROFILES TABLOSU
-- ============================================================================

CREATE POLICY "users_view_own_profile" ON public.profiles
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "teachers_view_assigned_students" ON public.profiles
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.teacher_id = auth.uid()
    AND s.student_id = profiles.user_id
  )
);

CREATE POLICY "admin_view_all_profiles" ON public.profiles
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin_modify_all_profiles" ON public.profiles
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================================================
-- 3. STUDENTS TABLOSU
-- ============================================================================

CREATE POLICY "admin_full_access_students" ON public.students
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "teacher_view_own_students" ON public.students
FOR SELECT TO authenticated
USING (teacher_id = auth.uid() OR public.has_role(auth.uid(), 'teacher'::app_role));

CREATE POLICY "student_view_teacher_assignment" ON public.students
FOR SELECT TO authenticated
USING (auth.uid() = student_id);

-- ============================================================================
-- 4. STUDENT_LESSONS TABLOSU
-- ============================================================================

CREATE POLICY "admin_full_access_student_lessons" ON public.student_lessons
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "teacher_view_student_lessons" ON public.student_lessons
FOR SELECT TO authenticated
USING (teacher_id = auth.uid());

CREATE POLICY "teacher_manage_student_lessons" ON public.student_lessons
FOR ALL TO authenticated
USING (teacher_id = auth.uid())
WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "student_view_own_lessons" ON public.student_lessons
FOR SELECT TO authenticated
USING (auth.uid() = student_id);

-- ============================================================================
-- 5. STUDENT_LESSON_TRACKING TABLOSU
-- ============================================================================

CREATE POLICY "admin_full_access_lesson_tracking" ON public.student_lesson_tracking
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "teacher_view_student_tracking" ON public.student_lesson_tracking
FOR SELECT TO authenticated
USING (teacher_id = auth.uid() OR public.has_role(auth.uid(), 'teacher'::app_role));

CREATE POLICY "teacher_manage_student_tracking" ON public.student_lesson_tracking
FOR ALL TO authenticated
USING (teacher_id = auth.uid())
WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "student_view_own_tracking" ON public.student_lesson_tracking
FOR SELECT TO authenticated
USING (auth.uid() = student_id);

-- ============================================================================
-- 6. LESSON_OVERRIDES TABLOSU
-- ============================================================================

CREATE POLICY "admin_full_access_lesson_overrides" ON public.lesson_overrides
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "teacher_view_lesson_overrides" ON public.lesson_overrides
FOR SELECT TO authenticated
USING (teacher_id = auth.uid());

CREATE POLICY "student_view_own_overrides" ON public.lesson_overrides
FOR SELECT TO authenticated
USING (student_id = auth.uid());

-- ============================================================================
-- 7. GLOBAL_TOPICS TABLOSU
-- ============================================================================

CREATE POLICY "admin_full_access_global_topics" ON public.global_topics
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "teacher_view_global_topics" ON public.global_topics
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'teacher'::app_role) OR teacher_id = auth.uid());

CREATE POLICY "student_view_global_topics" ON public.global_topics
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.student_id = auth.uid()
  )
);

-- ============================================================================
-- 8. GLOBAL_TOPIC_RESOURCES TABLOSU
-- ============================================================================

CREATE POLICY "admin_full_access_global_resources" ON public.global_topic_resources
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "teacher_view_global_resources" ON public.global_topic_resources
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.global_topics gt
    WHERE gt.id = global_topic_resources.global_topic_id
  )
);

CREATE POLICY "student_view_global_resources" ON public.global_topic_resources
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.student_id = auth.uid()
  )
);

-- ============================================================================
-- 9. TOPICS TABLOSU (Bireysel)
-- ============================================================================

CREATE POLICY "admin_full_access_topics" ON public.topics
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "teacher_view_student_topics" ON public.topics
FOR SELECT TO authenticated
USING (
  teacher_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.teacher_id = auth.uid()
    AND s.student_id = topics.student_id
  )
);

CREATE POLICY "student_view_own_topics" ON public.topics
FOR SELECT TO authenticated
USING (auth.uid() = student_id);

-- ============================================================================
-- 10. RESOURCES TABLOSU (Bireysel)
-- ============================================================================

CREATE POLICY "admin_full_access_resources" ON public.resources
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "teacher_view_student_resources" ON public.resources
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.topics t
    JOIN public.students s ON s.student_id = t.student_id
    WHERE s.teacher_id = auth.uid()
    AND t.id = resources.topic_id
  )
);

CREATE POLICY "student_view_own_resources" ON public.resources
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.topics t
    WHERE t.id = resources.topic_id
    AND t.student_id = auth.uid()
  )
);

-- ============================================================================
-- 11. STUDENT_RESOURCE_COMPLETION TABLOSU
-- ============================================================================

CREATE POLICY "admin_full_access_resource_completion" ON public.student_resource_completion
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "teacher_view_student_completion" ON public.student_resource_completion
FOR SELECT TO authenticated
USING (public.teacher_owns_student(auth.uid(), student_id));

CREATE POLICY "teacher_manage_student_completion" ON public.student_resource_completion
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.teacher_id = auth.uid()
    AND s.student_id = student_resource_completion.student_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.teacher_id = auth.uid()
    AND s.student_id = student_resource_completion.student_id
  )
);

CREATE POLICY "student_view_own_completion" ON public.student_resource_completion
FOR SELECT TO authenticated
USING (auth.uid() = student_id);

-- ============================================================================
-- 12. HOMEWORK_SUBMISSIONS TABLOSU
-- ============================================================================

CREATE POLICY "admin_full_access_homework" ON public.homework_submissions
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "student_view_own_homework" ON public.homework_submissions
FOR SELECT
USING (auth.uid() = student_id);

CREATE POLICY "student_create_own_homework" ON public.homework_submissions
FOR INSERT
WITH CHECK (auth.uid() = student_id);

CREATE POLICY "teacher_view_student_homework" ON public.homework_submissions
FOR SELECT TO authenticated
USING (
  teacher_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.teacher_id = auth.uid()
    AND s.student_id = homework_submissions.student_id
  )
);

CREATE POLICY "teacher_create_homework_for_students" ON public.homework_submissions
FOR INSERT TO authenticated
WITH CHECK (
  teacher_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.teacher_id = auth.uid()
    AND s.student_id = homework_submissions.student_id
  )
);

CREATE POLICY "user_update_own_uploaded_homework" ON public.homework_submissions
FOR UPDATE
USING (auth.uid() = uploaded_by_user_id)
WITH CHECK (auth.uid() = uploaded_by_user_id);

CREATE POLICY "user_delete_own_uploaded_homework" ON public.homework_submissions
FOR DELETE
USING (auth.uid() = uploaded_by_user_id);

-- ============================================================================
-- 13. NOTIFICATIONS TABLOSU
-- ============================================================================

CREATE POLICY "user_view_own_notifications" ON public.notifications
FOR SELECT
USING (auth.uid() = recipient_id);

CREATE POLICY "user_update_own_notifications" ON public.notifications
FOR UPDATE
USING (auth.uid() = recipient_id)
WITH CHECK (auth.uid() = recipient_id);

CREATE POLICY "admin_view_all_notifications" ON public.notifications
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin_delete_notifications" ON public.notifications
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================================================
-- 14. ADMIN_NOTIFICATIONS TABLOSU
-- ============================================================================

CREATE POLICY "admin_full_access_admin_notifications" ON public.admin_notifications
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================================================
-- 15. TEACHER_BALANCE TABLOSU
-- ============================================================================

CREATE POLICY "admin_full_access_teacher_balance" ON public.teacher_balance
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "teacher_view_own_balance" ON public.teacher_balance
FOR SELECT TO authenticated
USING (teacher_id = auth.uid());

CREATE POLICY "teacher_update_own_balance" ON public.teacher_balance
FOR UPDATE TO authenticated
USING (teacher_id = auth.uid())
WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "teacher_insert_own_balance" ON public.teacher_balance
FOR INSERT TO authenticated
WITH CHECK (teacher_id = auth.uid());

-- ============================================================================
-- 16. PAYMENT_HISTORY TABLOSU
-- ============================================================================

CREATE POLICY "admin_full_access_payment_history" ON public.payment_history
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "teacher_view_own_payment_history" ON public.payment_history
FOR SELECT TO authenticated
USING (teacher_id = auth.uid());

-- ============================================================================
-- 17. TRIAL_LESSONS TABLOSU
-- ============================================================================

CREATE POLICY "admin_full_access_trial_lessons" ON public.trial_lessons
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "teacher_view_own_trial_lessons" ON public.trial_lessons
FOR SELECT TO authenticated
USING (teacher_id = auth.uid());

CREATE POLICY "teacher_insert_own_trial_lessons" ON public.trial_lessons
FOR INSERT TO authenticated
WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "teacher_update_own_trial_lessons" ON public.trial_lessons
FOR UPDATE TO authenticated
USING (teacher_id = auth.uid())
WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "teacher_delete_own_trial_lessons" ON public.trial_lessons
FOR DELETE TO authenticated
USING (teacher_id = auth.uid());
