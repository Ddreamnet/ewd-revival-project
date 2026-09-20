-- Kaynak ödevi: öğretmen bir kaynağı "işlendi" yerine "ödev" olarak
-- işaretleyebilsin.
--
-- Ayrı bir tablo açılmadı: ödev satırı `homework_submissions`a yazılınca
-- mevcut boru hattı olduğu gibi çalışıyor — `on_homework_uploaded` tetikleyicisi
-- öğrenciye bildirim satırı açıyor, `notification_webhook` da anlık bildirimi
-- gönderiyor. Öğrenci kaynağı "Konularım"da değil "Ödevlerim"de görüyor.
--
-- `resource_id` hem `resources` hem `global_topic_resources` satırını
-- gösterebildiği için yabancı anahtar yok (`student_resource_completion`
-- ile aynı durum).
--
-- Dosyasız ödev için sütunlar NULL yapılmadı: telefonlardaki eski paket
-- `file_type.startsWith(...)` çağırıyor, NULL gelirse ödev listesi çöker.
-- Dosyasız ödev `file_url = ''` ile yazılır; yeni istemci boş olanı çizmez.

alter table public.homework_submissions
  add column if not exists resource_id uuid;

comment on column public.homework_submissions.resource_id is
  'Doluysa bu satır yüklenmiş bir dosya değil, ödev olarak verilmiş bir kaynaktır (resources / global_topic_resources).';

-- Aynı kaynak aynı öğrenciye iki kez ödev verilmesin (çift tıklama, iki sekme).
create unique index if not exists homework_submissions_kaynak_odevi_key
  on public.homework_submissions (student_id, teacher_id, resource_id)
  where resource_id is not null;
