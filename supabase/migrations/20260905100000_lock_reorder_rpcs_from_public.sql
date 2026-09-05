-- ============================================================================
-- Sıralama RPC'lerini PUBLIC'ten kilitle + döngüyü tek UPDATE'e indir
-- ============================================================================
-- 20260828120000 göçü bu fonksiyonlar için "REVOKE ... FROM anon" yazmıştı ama
-- Postgres yeni fonksiyona EXECUTE'u PUBLIC'e verir ve anon PUBLIC üyesidir;
-- anon'a özel grant'ı almak yetmiyor, PUBLIC grant'ı ayakta kaldığı için
-- has_function_privilege('anon', ...) hâlâ true dönüyordu. Doğru hedef PUBLIC.
--
-- Kanıt (düzeltmeden önceki ACL'ler):
--   rpc_delete_student         : postgres=X | authenticated=X | service_role=X      → anon yok
--   update_global_topics_order : =X/postgres | postgres=X | authenticated=X | ...   → baştaki "=X" PUBLIC
--
-- Ayrıca iki fonksiyon da yetki kontrolü içermiyordu: anon key JS paketinde
-- açık olduğu için siteyi açan herkes global konu/kaynak sıralamasını
-- değiştirebiliyordu.
--
-- Üçüncü değişiklik performans: jsonb dizisi üzerinde plpgsql döngüsü yerine
-- tek, küme tabanlı UPDATE. 40 konuluk sıralamada 40 plan yerine 1 plan.

create or replace function public.update_global_topics_order(topic_orders jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not public.is_admin_caller() then
    raise exception 'Bu işlem için yetkiniz yok' using errcode = '42501';
  end if;

  update public.global_topics gt
     set order_index = (t.value->>'order_index')::integer
    from jsonb_array_elements(topic_orders) as t(value)
   where gt.id = (t.value->>'id')::uuid;
end;
$function$;

create or replace function public.update_global_resources_order(resource_orders jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not public.is_admin_caller() then
    raise exception 'Bu işlem için yetkiniz yok' using errcode = '42501';
  end if;

  update public.global_topic_resources gtr
     set order_index = (r.value->>'order_index')::integer
    from jsonb_array_elements(resource_orders) as r(value)
   where gtr.id = (r.value->>'id')::uuid;
end;
$function$;

-- Onarım fonksiyonu: gövde aynı, başına yetki kontrolü eklendi.
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
  if not public.is_admin_caller() then
    raise exception 'Bu işlem için yetkiniz yok' using errcode = '42501';
  end if;

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

-- ---- Asıl düzeltme: PUBLIC'ten al, sadece authenticated'a ver ----
-- (create or replace ACL'i korur; bu yüzden revoke fonksiyonlardan SONRA.)
revoke execute on function public.update_global_topics_order(jsonb)    from public, anon;
revoke execute on function public.update_global_resources_order(jsonb) from public, anon;
revoke execute on function public.sync_missing_profiles()              from public, anon;

grant execute on function public.update_global_topics_order(jsonb)    to authenticated, service_role;
grant execute on function public.update_global_resources_order(jsonb) to authenticated, service_role;
grant execute on function public.sync_missing_profiles()              to authenticated, service_role;
