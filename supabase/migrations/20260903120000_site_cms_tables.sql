-- ============================================================================
-- Site içerik yönetimi — landing sayfası admin panelinden düzenlensin
-- ============================================================================
-- Üç tablo eklenir:
--   site_content      landing metinlerinin değiştirilmiş hâli (yol → {tr,en,fr})
--   site_testimonials veli yorumları
--   site_moments      ders içi fotoğraf ve videolar
--
-- Üçü de ziyaretçiye açık okunur (landing girişsiz açılır), yalnızca admin
-- yazabilir. Yorum ve kareler `is_published` ile gizlenebilir; site_content'te
-- böyle bir alan yok, çünkü bir satırın silinmesi zaten "varsayılana dön"
-- anlamına geliyor.
--
-- Yüklenen medya için herkese açık `site-media` deposu açılır.

create table public.site_content (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id) on delete set null
);
comment on table public.site_content is 'Landing sayfası metinlerinin admin tarafından değiştirilmiş hâli: key = sözlükteki nokta ayrılmış yol, value = {tr,en,fr}.';
alter table public.site_content enable row level security;
revoke all on public.site_content from public;
grant select on public.site_content to anon, authenticated;
grant insert, update, delete on public.site_content to authenticated;
create policy site_content_public_read on public.site_content for select to anon, authenticated using (true);
create policy site_content_admin_write on public.site_content for all to authenticated
  using (has_role(auth.uid(), 'admin'::app_role)) with check (has_role(auth.uid(), 'admin'::app_role));
create trigger site_content_set_updated_at before update on public.site_content
  for each row execute function public.update_updated_at_column();

create table public.site_testimonials (
  id           uuid primary key default gen_random_uuid(),
  quote_tr     text not null,
  quote_en     text not null default '',
  quote_fr     text not null default '',
  tags         jsonb not null default '[]'::jsonb,
  author_label text,
  order_index  int not null default 0,
  is_published boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
comment on table public.site_testimonials is 'Landing sayfasındaki veli yorumları.';
alter table public.site_testimonials enable row level security;
revoke all on public.site_testimonials from public;
grant select on public.site_testimonials to anon, authenticated;
grant insert, update, delete on public.site_testimonials to authenticated;
create index site_testimonials_order_idx on public.site_testimonials (is_published, order_index);
create policy site_testimonials_public_read on public.site_testimonials for select to anon, authenticated using (is_published);
create policy site_testimonials_admin_all on public.site_testimonials for all to authenticated
  using (has_role(auth.uid(), 'admin'::app_role)) with check (has_role(auth.uid(), 'admin'::app_role));
create trigger site_testimonials_set_updated_at before update on public.site_testimonials
  for each row execute function public.update_updated_at_column();

create table public.site_moments (
  id           uuid primary key default gen_random_uuid(),
  media_type   text not null check (media_type in ('photo','video')),
  media_url    text not null,
  poster_url   text,
  tag_tr       text not null default '',
  tag_en       text not null default '',
  tag_fr       text not null default '',
  caption_tr   text not null default '',
  caption_en   text not null default '',
  caption_fr   text not null default '',
  order_index  int not null default 0,
  is_published boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
comment on table public.site_moments is 'Landing sayfasındaki ders içi fotoğraf ve videolar.';
alter table public.site_moments enable row level security;
revoke all on public.site_moments from public;
grant select on public.site_moments to anon, authenticated;
grant insert, update, delete on public.site_moments to authenticated;
create index site_moments_order_idx on public.site_moments (media_type, is_published, order_index);
create policy site_moments_public_read on public.site_moments for select to anon, authenticated using (is_published);
create policy site_moments_admin_all on public.site_moments for all to authenticated
  using (has_role(auth.uid(), 'admin'::app_role)) with check (has_role(auth.uid(), 'admin'::app_role));
create trigger site_moments_set_updated_at before update on public.site_moments
  for each row execute function public.update_updated_at_column();

insert into storage.buckets (id, name, public) values ('site-media', 'site-media', true);
create policy public_read_site_media on storage.objects for select using (bucket_id = 'site-media');
create policy admin_manage_site_media on storage.objects for all to authenticated
  using (bucket_id = 'site-media' and has_role(auth.uid(), 'admin'::app_role))
  with check (bucket_id = 'site-media' and has_role(auth.uid(), 'admin'::app_role));
