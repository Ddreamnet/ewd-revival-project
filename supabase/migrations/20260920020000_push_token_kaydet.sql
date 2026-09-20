-- Bildirim token'ı kaydı: cihaz el değiştirince yeni hesaba geçebilsin.
--
-- 20 Eylül 2026'da canlı günlükte bir iPhone'un `POST /rest/v1/push_tokens
-- ?on_conflict=token` isteği 403 aldı. Bir cihazın FCM token'ı hesap değişse de
-- aynı kalıyor: telefonda önce A hesabı açıldıysa satırın sahibi A'dır. Sonra
-- aynı telefonda B giriş yapınca (kardeşler, veli + çocuk) istemcinin upsert'i
-- A'nın satırını güncellemeye çalışıyor, RLS (`auth.uid() = user_id`) bunu
-- reddediyor ve B o cihazda HİÇ bildirim alamıyor. İstemci, RLS satırı
-- gizlediği için çakışmayı önceden göremiyor da.
--
-- Doğru anlam: token, o an cihazda oturumu açık olan kişiye aittir. RLS'i
-- gevşetmek yerine bu tek işlem SECURITY DEFINER bir işleve alındı:
--   · sahiplik her zaman `auth.uid()` — çağıran başkası adına kayıt açamaz;
--   · `role` istemciden alınmıyor, `user_roles`tan türetiliyor;
--   · başkasının token'ını "ele geçirmek" için o token'ı bilmek gerekir; tablo
--     RLS ile kapalı, token başka hiçbir yerde görünmüyor. Ele geçiren de
--     yalnızca KENDİ bildirimlerini o cihaza yönlendirmiş olur.
--
-- Telefonlardaki eski paket doğrudan upsert etmeye devam ediyor; o yol olduğu
-- gibi duruyor (aynı uç durumda yine 403 alır — gerileme yok).

create or replace function public.rpc_push_token_kaydet(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_role text;
begin
  if v_user is null then
    raise exception 'Oturum gerekli' using errcode = '28000';
  end if;
  if p_token is null or length(p_token) < 20 or length(p_token) > 4096 then
    raise exception 'Geçersiz bildirim kimliği' using errcode = '22023';
  end if;
  if p_platform is null or p_platform not in ('ios', 'android') then
    raise exception 'Geçersiz platform' using errcode = '22023';
  end if;

  v_role := case
    when public.has_role(v_user, 'admin'::app_role) then 'admin'
    when public.has_role(v_user, 'teacher'::app_role) then 'teacher'
    else 'student'
  end;

  insert into public.push_tokens (token, user_id, role, platform, enabled, updated_at)
  values (p_token, v_user, v_role, p_platform, true, now())
  on conflict (token) do update
    set user_id    = excluded.user_id,
        role       = excluded.role,
        platform   = excluded.platform,
        enabled    = true,
        updated_at = now();
end;
$$;

revoke all on function public.rpc_push_token_kaydet(text, text) from public, anon;
grant execute on function public.rpc_push_token_kaydet(text, text) to authenticated;

comment on function public.rpc_push_token_kaydet(text, text) is
  'Cihazın FCM token''ını oturum sahibine kaydeder; token başka hesaptaysa devralır (aynı cihazda hesap değişimi).';
