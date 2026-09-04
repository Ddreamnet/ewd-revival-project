-- ============================================================================
-- Site içeriğine dört yeni dil: Rusça, İspanyolca, Almanca, Arapça
-- ============================================================================
-- Landing metinleri `site_content.value` içinde JSON olarak durduğu için orada
-- şema değişikliği gerekmiyor; yeni diller yeni anahtarlar olarak yazılır.
-- Yorumlar ve dersten kareler ise dil başına ayrı sütun tuttuğundan her biri
-- için dört sütun ekleniyor.
--
-- Sütunlar boş varsayılanla geliyor: bir dil doldurulmadıysa uygulama katmanı
-- (bkz. `src/lib/siteContent.ts`) Türkçe metne düşer, ziyaretçi boş kutu
-- görmez. Bu yüzden mevcut satırların elle doldurulması gerekmez.

alter table public.site_testimonials
  add column if not exists quote_ru text not null default '',
  add column if not exists quote_es text not null default '',
  add column if not exists quote_de text not null default '',
  add column if not exists quote_ar text not null default '';

alter table public.site_moments
  add column if not exists tag_ru      text not null default '',
  add column if not exists tag_es      text not null default '',
  add column if not exists tag_de      text not null default '',
  add column if not exists tag_ar      text not null default '',
  add column if not exists caption_ru  text not null default '',
  add column if not exists caption_es  text not null default '',
  add column if not exists caption_de  text not null default '',
  add column if not exists caption_ar  text not null default '';

comment on table public.site_content is
  'Landing sayfası metinlerinin admin tarafından değiştirilmiş hâli: key = sözlükteki nokta ayrılmış yol, value = {tr,en,fr,ru,es,de,ar}.';
