-- ============================================================================
-- İstanbul gezisi — kişisel, yalnızca admin
-- ============================================================================
-- Panelin geri kalanıyla ilgisi olmayan, admin dışında kimsenin göremediği
-- bir günlük: 25 Ağustos – 3 Eylül 2026 arası her gün için başlık, o gün
-- yapılanların listesi ve fotoğraflar.
--
-- Site tablolarının aksine burada anon okuma YOK: üç tablo da yalnızca
-- admin'e açık. Fotoğraflar da kapalı `trip-media` deposunda durur, sayfa
-- onları imzalı adreslerle gösterir — dosya adresi elden ele dolaşmasın.

create table public.trip_days (
  day        date primary key,
  title      text not null default '',
  updated_at timestamptz not null default now()
);
comment on table public.trip_days is 'İstanbul gezisi günlüğü: gün başına serbest başlık (ör. "Sultanahmet turu").';

create table public.trip_activities (
  id          uuid primary key default gen_random_uuid(),
  day         date not null,
  text        text not null default '',
  order_index int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.trip_activities is 'İstanbul gezisi günlüğü: bir günde yapılanlar, sıralı liste.';
create index trip_activities_day_idx on public.trip_activities (day, order_index);

create table public.trip_photos (
  id           uuid primary key default gen_random_uuid(),
  day          date not null,
  storage_path text not null,
  caption      text not null default '',
  order_index  int  not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
comment on table public.trip_photos is 'İstanbul gezisi günlüğü: kapalı `trip-media` deposundaki fotoğrafların yolu — herkese açık adres tutulmaz.';
create index trip_photos_day_idx on public.trip_photos (day, order_index);

-- ── Erişim: yalnızca admin ──────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['trip_days', 'trip_activities', 'trip_photos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (has_role(auth.uid(), ''admin''::app_role))
         with check (has_role(auth.uid(), ''admin''::app_role))',
      t || '_admin_all', t);
    execute format(
      'create trigger %I before update on public.%I
         for each row execute function public.update_updated_at_column()',
      t || '_set_updated_at', t);
  end loop;
end $$;

-- ── Depo: kapalı, yalnızca admin ────────────────────────────────────────
insert into storage.buckets (id, name, public) values ('trip-media', 'trip-media', false);
create policy admin_manage_trip_media on storage.objects for all to authenticated
  using (bucket_id = 'trip-media' and has_role(auth.uid(), 'admin'::app_role))
  with check (bucket_id = 'trip-media' and has_role(auth.uid(), 'admin'::app_role));
