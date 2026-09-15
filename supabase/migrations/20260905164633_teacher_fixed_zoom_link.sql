-- ============================================================================
-- Zoom bağlantısı öğrenciden öğretmene taşındı
-- ============================================================================
-- Her öğretmenin tek bir sabit ders odası var; bağlantı öğrenci başına
-- girilince aynı adres her öğrenci için tekrar tekrar yazılıyor, biri
-- unutulunca o öğrenci derse giremiyordu. Artık adres öğretmenin profilinde
-- duruyor, bütün öğrencilerine o gösteriliyor.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS zoom_link text;

COMMENT ON COLUMN public.profiles.zoom_link IS
  'Öğretmenin sabit Zoom bağlantısı; öğrencilerine bu adres gösterilir.';

-- Eldeki öğrenci bazlı bağlantıları öğretmene taşı (en son eklenen kayıt).
WITH picked AS (
  SELECT DISTINCT ON (s.teacher_id) s.teacher_id, s.zoom_link
    FROM public.students s
   WHERE s.zoom_link IS NOT NULL
     AND btrim(s.zoom_link) <> ''
   ORDER BY s.teacher_id, s.created_at DESC
)
UPDATE public.profiles p
   SET zoom_link = picked.zoom_link
  FROM picked
 WHERE p.user_id = picked.teacher_id
   AND (p.zoom_link IS NULL OR btrim(p.zoom_link) = '');

-- Öğrenci, öğretmeninin profil satırını göremez (RLS). Yeni bir SELECT ilkesi
-- açmak adını ve e-postasını da açardı; bu yüzden yalnızca bağlantıyı döndüren
-- tanımlayıcı-güvenlikli bir işlev veriyoruz.
CREATE OR REPLACE FUNCTION public.my_teacher_zoom_link()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT nullif(btrim(p.zoom_link), '')
    FROM public.students s
    JOIN public.profiles p ON p.user_id = s.teacher_id
   WHERE s.student_id = auth.uid()
     AND s.is_archived = false
   ORDER BY s.created_at DESC
   LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.my_teacher_zoom_link() FROM public;
GRANT EXECUTE ON FUNCTION public.my_teacher_zoom_link() TO authenticated;
