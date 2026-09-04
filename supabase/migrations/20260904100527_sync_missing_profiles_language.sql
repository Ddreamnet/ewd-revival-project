-- ============================================================================
-- Onarım fonksiyonu da dil şubesini yazsın
-- ============================================================================
-- `handle_new_user` şube göçünde güncellendi ama ikizi olan
-- `sync_missing_profiles()` atlanmıştı: yetim bir `auth.users` kaydı
-- onarıldığında kullanıcı, metadata'sında 'fr' yazsa bile İngilizce şubede
-- doğuyordu. İki fonksiyon artık aynı alanları aynı biçimde dolduruyor.
--
-- Not: aynı denetimde çıkan "öğretmen ücreti şube başına ayrılsın" maddesi
-- şema değişikliği gerektirmiyor. Ücret `app_settings` içinde anahtar başına
-- duruyor: İngilizce şube eski `teacher_pay` satırında kalıyor, Fransızca şube
-- `teacher_pay_fr` anahtarını kullanıyor ve satır ilk kaydetmede oluşuyor.

create or replace function public.sync_missing_profiles()
returns json
language plpgsql
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $function$
declare
  sync_count integer := 0;
  user_record record;
begin
  for user_record in
    select au.id, au.email, au.raw_user_meta_data
    from auth.users au
    left join public.profiles p on au.id = p.user_id
    where p.user_id is null
  loop
    insert into public.profiles (user_id, email, full_name, role, language)
    values (
      user_record.id,
      user_record.email,
      coalesce(user_record.raw_user_meta_data->>'full_name', user_record.raw_user_meta_data->>'name', 'User'),
      coalesce((user_record.raw_user_meta_data->>'role')::public.user_role, 'student'),
      coalesce((user_record.raw_user_meta_data->>'language')::public.app_language, 'en')
    );
    sync_count := sync_count + 1;
  end loop;

  return json_build_object('success', true, 'synced_profiles', sync_count,
                           'message', format('Synced %s missing profiles', sync_count));
exception
  when others then
    return json_build_object('error', sqlerrm);
end;
$function$;
