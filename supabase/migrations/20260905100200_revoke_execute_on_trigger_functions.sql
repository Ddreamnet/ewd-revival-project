-- ============================================================================
-- Trigger fonksiyonlarından EXECUTE yetkisini al
-- ============================================================================
-- Bunlar SECURITY DEFINER ve hepsi yazma yapıyor. PostgREST `returns trigger`
-- fonksiyonları RPC olarak yayımlamıyor, dolayısıyla doğrudan sömürülebilir
-- değiller; ama varsayılan PUBLIC grant'ı advisor'da 8 uyarı üretiyor ve
-- gereksiz bir yüzey bırakıyor.
--
-- Güvenli olduğu ampirik olarak doğrulandı: PostgreSQL trigger fonksiyonunun
-- EXECUTE yetkisini CREATE TRIGGER anında denetler, ateşleme anında değil.
-- Geçici bir tabloda authenticated rolüyle test edildi — yetki alındıktan
-- sonra trigger ateşlemeye devam etti.
--
-- Bilerek DOKUNULMAYANLAR: has_role, is_admin_caller, is_teacher,
-- is_teacher_caller, teacher_owns_student, user_language. Bunlar RLS politika
-- ifadelerinin içinde çağrılıyor ve politikalar sorguyu atan rolün yetkisiyle
-- değerlendiriliyor; anon'dan EXECUTE alınırsa blog/site tablolarının herkese
-- açık okuması "permission denied for function has_role" ile patlar.

revoke execute on function public.update_updated_at_column()            from public, anon, authenticated;
revoke execute on function public.handle_new_user()                     from public, anon, authenticated;
revoke execute on function public.notify_on_homework_upload()           from public, anon, authenticated;
revoke execute on function public.notify_admin_last_lesson()            from public, anon, authenticated;
revoke execute on function public.validate_max_lessons_per_week()       from public, anon, authenticated;
revoke execute on function public.complete_topic_resources()            from public, anon, authenticated;
revoke execute on function public.complete_global_topic_resources()     from public, anon, authenticated;
revoke execute on function public.prevent_duplicate_lesson_instance()   from public, anon, authenticated;
revoke execute on function public.sync_student_language()               from public, anon, authenticated;
revoke execute on function public.sync_teacher_students_language()      from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Yedek tablosu public şemasından çıksın
-- ---------------------------------------------------------------------------
-- RLS açık ama 0 politika: kimse okuyamıyor, yani güvenli. Yine de üretim
-- şemasında bir yedek tablosu durmamalı; PostgREST'in şema önbelleğinde ve
-- tip üretiminde gereksiz yer kaplıyor.
create schema if not exists backup;
revoke all on schema backup from public, anon, authenticated;

do $$
begin
  if to_regclass('public._backup_lesson_numbers_20260828') is not null then
    alter table public._backup_lesson_numbers_20260828 set schema backup;
  end if;
end $$;

comment on table public.lesson_reminder_log is
  'Yalnızca service_role yazar/okur (cron + edge function). RLS açık ve politika yok: bu kasıtlı deny-all.';
