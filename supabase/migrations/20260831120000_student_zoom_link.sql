-- ============================================================================
-- Öğrencinin ders bağlantısı (Zoom)
-- ============================================================================
-- Öğrenci panelinde ders saatlerinin yanında "Zoom'a katıl" düğmesi çıkabilsin
-- diye students tablosuna bağlantı alanı ekleniyor.
--
-- Yetki: students üzerinde admin'in FOR ALL politikası zaten var (alanı admin
-- paneli yazar) ve öğrencinin kendi satırını okumasına izin veren
-- "student_view_teacher_assignment" SELECT politikası da mevcut. Bu yüzden yeni
-- bir politika gerekmiyor.

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS zoom_link text;

COMMENT ON COLUMN public.students.zoom_link IS
  'Öğrencinin derslerine katıldığı Zoom bağlantısı. Boşsa panelde düğme gösterilmez.';
