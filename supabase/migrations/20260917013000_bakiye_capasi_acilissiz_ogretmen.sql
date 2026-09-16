-- ============================================================================
-- Bakiye görünümü: açılış kaydı olmayan öğretmende ödeme çapası
-- ============================================================================
-- Denetim senaryosu yakaladı: açılış kaydı (teacher_balance_opening) olmayan
-- bir öğretmende ödeme kapatılınca toplam dakika sıfırlanıyor ama ders
-- sayaçları sıfırlanmıyordu — iki ders işlenmiş, ödenmiş, sayaç hâlâ 2.
--
-- İki sebep:
-- 1) Sayaçların çapası (son ödeme anı) `capa` CTE'sinde açılış satırından
--    türetiliyordu. Açılış satırı yoksa çapa da yoktu ve sayaçlar "sonsuzdan
--    beri" sayıyordu. Faz 3'te yedi öğretmenin hepsine açılış yazıldığı için
--    o gün görünmedi; 15 Eylül'den sonra oluşturulan her öğretmende ilk
--    ödemeden sonra ortaya çıkacaktı.
-- 2) Çapadan sonraki kayıtlar `>=` ile alınıyordu; ödemeyle aynı ana denk
--    gelen kayıt (aynı işlem içinde yazılmışsa) yeniden sayılıyordu. Ödeme
--    o anki her şeyi kapatır; sayılacak olan ödemeden *sonraki* kayıtlardır.
--    Gerçek veride ne açılış ne ödeme anına denk gelen kayıt var (doğrulandı).
--
-- Çapa artık ödeme kayıtlarından bağımsız hesaplanıyor; açılış yalnızca
-- varsa devreye giriyor.

CREATE OR REPLACE VIEW public.teacher_balance AS
WITH acilis AS (
  SELECT o.teacher_id, o.minutes, o.regular_lessons, o.trial_lessons, o.created_at
    FROM teacher_balance_opening o
), odeme AS (
  SELECT be.teacher_id, max(be.created_at) AS son
    FROM balance_events be
   WHERE be.event_type = 'payout'::text
   GROUP BY be.teacher_id
), capa AS (
  SELECT p.user_id AS teacher_id,
         GREATEST(COALESCE(a.created_at, '-infinity'::timestamptz),
                  COALESCE(o.son,        '-infinity'::timestamptz)) AS an,
         (o.son IS NOT NULL AND o.son >= COALESCE(a.created_at, '-infinity'::timestamptz)) AS odeme_sonrasi,
         a.minutes, a.regular_lessons, a.trial_lessons,
         a.created_at AS acilis_ani
    FROM profiles p
    LEFT JOIN acilis a ON a.teacher_id = p.user_id
    LEFT JOIN odeme  o ON o.teacher_id = p.user_id
   WHERE p.role = 'teacher'::user_role
)
SELECT p.user_id AS teacher_id,
       COALESCE(c.minutes, 0) + COALESCE((
         SELECT sum(be.amount_minutes) FROM balance_events be
          WHERE be.teacher_id = p.user_id
            AND be.created_at > COALESCE(c.acilis_ani, '-infinity'::timestamptz)), 0::bigint) AS total_minutes,
       CASE WHEN c.odeme_sonrasi THEN 0 ELSE COALESCE(c.regular_lessons, 0) END
       + COALESCE((
         SELECT count(*) FILTER (WHERE be.event_type = 'lesson_complete'::text)
              - count(*) FILTER (WHERE be.event_type = 'lesson_undo'::text)
           FROM balance_events be
          WHERE be.teacher_id = p.user_id AND be.created_at > c.an
            AND be.event_type = ANY (ARRAY['lesson_complete'::text, 'lesson_undo'::text])), 0::bigint) AS completed_regular_lessons,
       CASE WHEN c.odeme_sonrasi THEN 0 ELSE COALESCE(c.trial_lessons, 0) END
       + COALESCE((
         SELECT count(*) FILTER (WHERE be.event_type = 'trial_complete'::text)
              - count(*) FILTER (WHERE be.event_type = 'trial_undo'::text)
           FROM balance_events be
          WHERE be.teacher_id = p.user_id AND be.created_at > c.an
            AND be.event_type = ANY (ARRAY['trial_complete'::text, 'trial_undo'::text])), 0::bigint) AS completed_trial_lessons,
       COALESCE((
         SELECT sum(be.amount_minutes) FROM balance_events be
          WHERE be.teacher_id = p.user_id
            AND be.event_type = ANY (ARRAY['lesson_complete'::text, 'lesson_undo'::text])
            AND be.created_at > c.an), 0::bigint) AS regular_lessons_minutes,
       COALESCE((
         SELECT sum(be.amount_minutes) FROM balance_events be
          WHERE be.teacher_id = p.user_id
            AND be.event_type = ANY (ARRAY['trial_complete'::text, 'trial_undo'::text])
            AND be.created_at > c.an), 0::bigint) AS trial_lessons_minutes,
       COALESCE((
         SELECT sum(be.amount_minutes) FROM balance_events be
          WHERE be.teacher_id = p.user_id
            AND be.event_type = 'manual_adjust'::text
            AND be.created_at > c.an), 0::bigint) AS manual_adjustment_minutes
  FROM profiles p
  JOIN capa c ON c.teacher_id = p.user_id
 WHERE p.role = 'teacher'::user_role;
