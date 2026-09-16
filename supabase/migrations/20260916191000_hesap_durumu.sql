-- ============================================================================
-- Bir e-posta kime ait? — hesap oluşturma yolları için
-- ============================================================================
-- Öğrenci silindiğinde veritabanı kayıtları gidiyor ama giriş hesabı kalıyor.
-- 16 Eylül itibarıyla bu durumda 24 hesap var. Bu adreslerden biriyle yeniden
-- öğrenci oluşturmaya çalışmak "bu e-posta zaten kayıtlı" diye düşüyor; admin
-- ise arayüzde yalnızca anlaşılmaz bir hata görüyordu.
--
-- create-student artık bu işlevle önce adresin durumuna bakıyor:
--
--   yok              → yeni hesap açılır
--   oksuz            → hesap yeniden kullanılır (şifre, ad, şube yenilenir)
--   aktif_ogrenci    → hangi öğretmende olduğu söylenir
--   arsivli_ogrenci  → arşivden geri yüklenmesi önerilir
--   ogretmen / admin → o hesabın öğrenci yapılamayacağı söylenir
--
-- auth şemasını okuduğu için yalnızca sunucu (service_role) çağırabilir.

CREATE OR REPLACE FUNCTION public.rpc_hesap_durumu(p_email text)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
  SELECT CASE
    WHEN u.id IS NULL THEN json_build_object('durum', 'yok')
    ELSE json_build_object(
      'id', u.id,
      'durum', CASE
        WHEN EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND r.role = 'admin') THEN 'admin'
        WHEN EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND r.role = 'teacher')
          OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = u.id AND p.role = 'teacher') THEN 'ogretmen'
        WHEN EXISTS (SELECT 1 FROM students s WHERE s.student_id = u.id AND NOT s.is_archived) THEN 'aktif_ogrenci'
        WHEN EXISTS (SELECT 1 FROM students s WHERE s.student_id = u.id AND s.is_archived) THEN 'arsivli_ogrenci'
        ELSE 'oksuz'
      END,
      'ad', (SELECT p.full_name FROM profiles p WHERE p.user_id = u.id),
      'ogretmen', (SELECT tp.full_name FROM students s
                     JOIN profiles tp ON tp.user_id = s.teacher_id
                    WHERE s.student_id = u.id))
  END
  FROM (SELECT 1) AS tek
  LEFT JOIN auth.users u ON lower(u.email) = lower(btrim(p_email));
$function$;

REVOKE ALL ON FUNCTION public.rpc_hesap_durumu(text) FROM public;
REVOKE ALL ON FUNCTION public.rpc_hesap_durumu(text) FROM anon;
REVOKE ALL ON FUNCTION public.rpc_hesap_durumu(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_hesap_durumu(text) TO service_role;
