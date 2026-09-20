-- Sürüm kapısı: mağaza uygulaması eski kaldığında kullanıcıya "Güncelle" ekranı.
--
-- iOS/Android uygulaması web paketini içinde taşıyor; cPanel'e yeni sürüm
-- yüklemek telefonları güncellemiyor. Eylül 2026'da telefonlardaki paket aylar
-- öncesindendi ve kaldırılmış tabloları sorguluyordu; uygulamanın bunu
-- kullanıcıya söylemesinin bir yolu yoktu. 2.0.0'dan itibaren uygulama açılışta
-- bu satırı okuyor (src/lib/appRelease.ts):
--
--   minBuild    — altındaki derlemeler KİLİTLENİR (kapatılamayan ekran).
--   latestBuild — altındakilere kapatılabilir "yeni sürüm çıktı" kartı çıkar.
--
-- Sayılar mağaza derleme numarasıdır (Android versionCode = iOS CFBundleVersion;
-- 2.0.0 için ikisi de 6). KURAL: bir sayıyı, o derleme İKİ mağazada da yayına
-- girmeden yükseltme — yoksa "Güncelle" düğmesi güncelleme olmayan bir mağaza
-- sayfasına götürür ve kullanıcı kilitli kalır.
--
-- Ayrı tablo açılmadı: `app_settings` zaten admin yazımına açık bir anahtar/değer
-- tablosu. Okuma politikası yalnızca bu anahtarı herkese açıyor; `teacher_pay`
-- eskisi gibi yalnızca admin ve öğretmene görünür. Giriş ekranında da
-- çalışabilmesi için `anon` dahil.

insert into public.app_settings (key, value)
values (
  'app_release',
  '{"ios": {"minBuild": 1, "latestBuild": 6}, "android": {"minBuild": 1, "latestBuild": 6}}'::jsonb
)
on conflict (key) do nothing;

drop policy if exists app_settings_release_public_read on public.app_settings;
create policy app_settings_release_public_read
  on public.app_settings
  for select
  to anon, authenticated
  using (key = 'app_release');
