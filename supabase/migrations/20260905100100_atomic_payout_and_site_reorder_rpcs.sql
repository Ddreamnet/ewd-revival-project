-- ============================================================================
-- 1) Bakiye kapatma tek işlemde ve kilitli
-- ============================================================================
-- Önceki hâli istemcide iki ayrı sorguydu: önce payment_history INSERT, sonra
-- teacher_balance UPDATE. İkisinin arasında hata olursa öğretmenin bakiyesi
-- durur ama "ödendi" kaydı düşer — hayalet ödeme. Ayrıca butonda disabled
-- yoktu; hızlı iki tık aynı bakiyeyi iki kez kaydediyordu.
--
-- FOR UPDATE kilidi ikinci çağrıyı birincinin bitmesini beklemeye zorluyor;
-- beklemesi bittiğinde total_minutes 0 olduğu için ikinci kayıt düşmüyor.
-- Yani çift tık koruması artık istemcinin insafına bırakılmadı.
create or replace function public.rpc_close_teacher_payout(
  p_teacher_id uuid,
  p_rate numeric default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  b public.teacher_balance%rowtype;
begin
  if not public.is_admin_caller() then
    raise exception 'Bu işlem için yetkiniz yok' using errcode = '42501';
  end if;

  select * into b
    from public.teacher_balance
   where teacher_id = p_teacher_id
   for update;                                  -- eşzamanlı ikinci çağrı burada bekler

  if not found then
    insert into public.teacher_balance (
      teacher_id, total_minutes, completed_regular_lessons, completed_trial_lessons,
      regular_lessons_minutes, trial_lessons_minutes
    ) values (p_teacher_id, 0, 0, 0, 0, 0);
    return jsonb_build_object('success', true, 'paid_minutes', 0, 'created', true);
  end if;

  if coalesce(b.total_minutes, 0) <= 0 then
    -- Bakiye zaten sıfır: kayıt düşmüyoruz (çift tıkta ikinci çağrı buraya düşer).
    return jsonb_build_object('success', true, 'paid_minutes', 0, 'skipped', true);
  end if;

  insert into public.payment_history (
    teacher_id, amount_minutes, completed_regular_lessons,
    completed_trial_lessons, rate_per_minute, notes
  ) values (
    p_teacher_id, b.total_minutes, b.completed_regular_lessons,
    b.completed_trial_lessons, p_rate, p_notes
  );

  update public.teacher_balance
     set total_minutes = 0,
         completed_regular_lessons = 0,
         completed_trial_lessons = 0,
         regular_lessons_minutes = 0,
         trial_lessons_minutes = 0
   where teacher_id = p_teacher_id;

  return jsonb_build_object('success', true, 'paid_minutes', b.total_minutes);
exception
  when others then
    return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$function$;

-- ============================================================================
-- 2) Site sıralaması tek sorguda
-- ============================================================================
-- İstemci 20 öğelik listede bir öğeyi kaydırmak için 20 ayrı UPDATE atıyordu
-- (Promise.all). Yarısı düşerse sıralama bozuk kalıyor ve geri alma yok.
create or replace function public.rpc_reorder_site_moments(p_orders jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not public.is_admin_caller() then
    raise exception 'Bu işlem için yetkiniz yok' using errcode = '42501';
  end if;

  update public.site_moments m
     set order_index = (o.value->>'order_index')::integer
    from jsonb_array_elements(p_orders) as o(value)
   where m.id = (o.value->>'id')::uuid;
end;
$function$;

create or replace function public.rpc_reorder_site_testimonials(p_orders jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not public.is_admin_caller() then
    raise exception 'Bu işlem için yetkiniz yok' using errcode = '42501';
  end if;

  update public.site_testimonials t
     set order_index = (o.value->>'order_index')::integer
    from jsonb_array_elements(p_orders) as o(value)
   where t.id = (o.value->>'id')::uuid;
end;
$function$;

-- Yeni fonksiyonlarda EXECUTE varsayılan olarak PUBLIC'e verilir; alıyoruz.
revoke execute on function public.rpc_close_teacher_payout(uuid, numeric, text)  from public, anon;
revoke execute on function public.rpc_reorder_site_moments(jsonb)                from public, anon;
revoke execute on function public.rpc_reorder_site_testimonials(jsonb)           from public, anon;

grant execute on function public.rpc_close_teacher_payout(uuid, numeric, text)  to authenticated, service_role;
grant execute on function public.rpc_reorder_site_moments(jsonb)                to authenticated, service_role;
grant execute on function public.rpc_reorder_site_testimonials(jsonb)           to authenticated, service_role;
