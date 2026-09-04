-- ============================================================================
-- Paralel panel sistemi — İngilizce / Fransızca şubeleri
-- ============================================================================
-- Sistem bugüne kadar tek dilliydi: her öğretmen ve öğrenci İngilizce
-- programındaydı. Artık aynı kurulum Fransızca için de çalışacak; iki şube
-- birbirini görmeyecek, admin panelde ikisi arasında geçiş yapacak.
--
-- Tasarım: şube bilgisi tek yerde, `profiles.language` alanında durur.
--   • Öğretmen oluşturulurken admin şubeyi seçer.
--   • Öğrenci, bağlı olduğu öğretmenin şubesini devralır (trigger ile).
--   • Global konular (müfredat) şubeye göre ayrılır — İngilizce müfredatı
--     Fransızca öğrencide görünmez.
--
-- Mevcut kayıtların tamamı 'en' varsayılanını alır; yani bu göç öncesi
-- davranış birebir korunur.

-- ── Şube türü ────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_language') then
    create type public.app_language as enum ('en', 'fr');
  end if;
end $$;

-- ── profiles.language ────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists language public.app_language not null default 'en';

comment on column public.profiles.language is
  'Kullanıcının bağlı olduğu dil şubesi. Öğretmende admin seçer, öğrenci öğretmeninden devralır. Admin için anlamsızdır (iki şubeyi de görür).';

create index if not exists profiles_language_role_idx on public.profiles (language, role);

-- ── global_topics.language ───────────────────────────────────────────────
alter table public.global_topics
  add column if not exists language public.app_language not null default 'en';

comment on column public.global_topics.language is
  'Konunun ait olduğu dil şubesi. Öğretmen ve öğrenci yalnızca kendi şubesinin konularını görür.';

create index if not exists global_topics_language_order_idx on public.global_topics (language, order_index);

-- ── Şube okuma yardımcısı ────────────────────────────────────────────────
-- RLS içinde `profiles` tablosuna doğrudan bakmak politikaların birbirini
-- tetiklemesine yol açardı; SECURITY DEFINER tek satırlık okuma bunu keser.
create or replace function public.user_language(_user_id uuid)
returns public.app_language
language sql
stable
security definer
set search_path to 'public'
as $$
  select language from public.profiles where user_id = _user_id
$$;

revoke all on function public.user_language(uuid) from public;
grant execute on function public.user_language(uuid) to authenticated, service_role;

-- ── Yeni kullanıcı: şube metadata'dan gelsin ─────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $function$
begin
  insert into public.profiles (user_id, email, full_name, role, language)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'User'),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'student'),
    coalesce((new.raw_user_meta_data->>'language')::public.app_language, 'en')
  );
  return new;
exception when others then
  raise warning 'Failed to create profile for user %: %', new.id, sqlerrm;
  return new;
end;
$function$;

-- ── Öğrenci öğretmeninin şubesini devralır ───────────────────────────────
-- Hem yeni öğrenci açılışında hem de öğrenci başka bir öğretmene
-- aktarıldığında çalışır; şube el ile ayarlanmayı gerektirmez.
create or replace function public.sync_student_language()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  teacher_lang public.app_language;
begin
  select language into teacher_lang from public.profiles where user_id = new.teacher_id;
  if teacher_lang is not null then
    update public.profiles
       set language = teacher_lang
     where user_id = new.student_id
       and language is distinct from teacher_lang;
  end if;
  return new;
end;
$function$;

drop trigger if exists students_sync_language on public.students;
create trigger students_sync_language
after insert or update of teacher_id on public.students
for each row execute function public.sync_student_language();

-- ── Öğretmenin şubesi değişirse öğrencileri de taşınır ───────────────────
-- `when new.role = 'teacher'` koşulu, aşağıdaki update'in trigger'ı yeniden
-- tetiklemesini (öğrenci satırları role = 'student') engeller.
create or replace function public.sync_teacher_students_language()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  update public.profiles p
     set language = new.language
    from public.students s
   where s.teacher_id = new.user_id
     and p.user_id = s.student_id
     and p.language is distinct from new.language;
  return new;
end;
$function$;

drop trigger if exists profiles_sync_teacher_students_language on public.profiles;
create trigger profiles_sync_teacher_students_language
after update of language on public.profiles
for each row
when (old.language is distinct from new.language and new.role = 'teacher')
execute function public.sync_teacher_students_language();

-- ── RLS: global müfredat şubeye göre kapansın ────────────────────────────
-- Admin politikaları olduğu gibi kalır (iki şubeyi de yönetir).
drop policy if exists "teacher_view_global_topics" on public.global_topics;
create policy "teacher_view_global_topics"
on public.global_topics
for select
to authenticated
using (
  teacher_id = auth.uid()
  or (has_role(auth.uid(), 'teacher'::app_role) and language = public.user_language(auth.uid()))
);

drop policy if exists "student_view_global_topics" on public.global_topics;
create policy "student_view_global_topics"
on public.global_topics
for select
to authenticated
using (
  exists (select 1 from public.students s where s.student_id = auth.uid())
  and language = public.user_language(auth.uid())
);

drop policy if exists "student_view_global_resources" on public.global_topic_resources;
create policy "student_view_global_resources"
on public.global_topic_resources
for select
to authenticated
using (
  exists (select 1 from public.students s where s.student_id = auth.uid())
  and exists (
    select 1 from public.global_topics gt
     where gt.id = global_topic_resources.global_topic_id
       and gt.language = public.user_language(auth.uid())
  )
);
