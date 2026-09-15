-- ============================================================================
-- Faz 2 · Toplu erteleme işlemleri
-- ============================================================================
-- Bugün iki senaryo tek tek taşımayla çözülüyor:
--
--   "Öğrenci iki hafta tatile çıkıyor"  → 4–6 ayrı taşıma
--   "Öğretmen bugün hasta"              → o günkü her öğrenci için ayrı ayrı
--
-- İkisi de tek işleme iniyor. Her ikisi de rpc_relayout_chain üstünde duruyor,
-- yani yerleştirme, çakışma uyarısı ve yeniden numaralama aynı yoldan geçiyor.

-- ─────────────────────────────────────────────────────────────────────────
-- Ara ver (tatil)
-- ─────────────────────────────────────────────────────────────────────────
-- Aralıktaki dersler aralığın ötesine kayar. Aralıktan sonraki dersler de
-- birlikte kayar — yoksa taşınanlar onların slotlarına çarpardı. Hak sayısı
-- değişmez, paket yalnızca uzar.
--
-- Elle sabitlenmiş dersler (telafi) yerinde kalır: admin onları bilerek
-- oraya koymuştur.
CREATE OR REPLACE FUNCTION public.rpc_ara_ver(
  p_student_id uuid,
  p_teacher_id uuid,
  p_baslangic date,
  p_bitis date)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ids uuid[];
BEGIN
  IF NOT public.is_teacher_caller(p_teacher_id) THEN
    RETURN json_build_object('success', false, 'error', 'Bu işlem için yetkiniz yok');
  END IF;
  IF p_baslangic IS NULL OR p_bitis IS NULL OR p_bitis < p_baslangic THEN
    RETURN json_build_object('success', false, 'error', 'Geçersiz tarih aralığı');
  END IF;

  SELECT array_agg(id ORDER BY lesson_date, start_time, created_at) INTO v_ids
  FROM lesson_instances
  WHERE student_id = p_student_id
    AND teacher_id = p_teacher_id
    AND status = 'planned'
    AND is_manual_override = false
    AND lesson_date >= p_baslangic;

  IF v_ids IS NULL THEN
    RETURN json_build_object('success', true, 'updated', 0,
                             'warnings', '[]'::jsonb,
                             'note', 'Bu tarihten sonra kaydırılacak planlı ders yok');
  END IF;

  RETURN public.rpc_relayout_chain(
    v_ids, p_bitis + 1, NULL, true, true, gen_random_uuid());
END;
$function$;

COMMENT ON FUNCTION public.rpc_ara_ver(uuid, uuid, date, date) IS
  'Verilen tarih aralığını boşaltır: aralıktaki ve sonrasındaki planlı dersler, aralığın bitiminden itibaren ilk uygun slotlara sırasını bozmadan kayar.';

REVOKE ALL ON FUNCTION public.rpc_ara_ver(uuid, uuid, date, date) FROM public;
REVOKE ALL ON FUNCTION public.rpc_ara_ver(uuid, uuid, date, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_ara_ver(uuid, uuid, date, date) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- Bu günü ertele (öğretmen bazlı)
-- ─────────────────────────────────────────────────────────────────────────
-- O gün dersi olan her öğrencinin dersleri birer slot kayar. Öğrenci başına
-- bir kez erteleme yetiyor: rpc_postpone_lesson zaten o dersten sonrasının
-- tamamını kaydırıyor, aynı gün ikinci ders varsa o da kuyruğun içinde.
CREATE OR REPLACE FUNCTION public.rpc_gunu_ertele(
  p_teacher_id uuid,
  p_tarih date)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r record;
  v_ilk uuid;
  v_sonuc json;
  v_ogrenci integer := 0;
  v_ders integer := 0;
  v_uyarilar jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.is_teacher_caller(p_teacher_id) THEN
    RETURN json_build_object('success', false, 'error', 'Bu işlem için yetkiniz yok');
  END IF;
  IF p_tarih IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Tarih gerekli');
  END IF;

  FOR r IN
    SELECT DISTINCT li.student_id
    FROM lesson_instances li
    JOIN students s ON s.student_id = li.student_id AND s.teacher_id = li.teacher_id
    WHERE li.teacher_id = p_teacher_id
      AND li.lesson_date = p_tarih
      AND li.status = 'planned'
      AND li.is_manual_override = false
      AND s.is_archived = false
  LOOP
    -- Liste başta alındığı için, önceki erteleme bu öğrencinin dersini
    -- çoktan taşımış olabilir; her turda yeniden bak.
    SELECT id INTO v_ilk
    FROM lesson_instances
    WHERE student_id = r.student_id
      AND teacher_id = p_teacher_id
      AND lesson_date = p_tarih
      AND status = 'planned'
      AND is_manual_override = false
    ORDER BY start_time
    LIMIT 1;

    CONTINUE WHEN v_ilk IS NULL;

    v_sonuc := public.rpc_postpone_lesson(v_ilk);

    IF COALESCE((v_sonuc->>'success')::boolean, false) THEN
      v_ogrenci := v_ogrenci + 1;
      v_ders := v_ders + COALESCE((v_sonuc->>'updated')::integer, 0);
      IF jsonb_typeof(COALESCE((v_sonuc->'warnings')::jsonb, 'null'::jsonb)) = 'array' THEN
        v_uyarilar := v_uyarilar || (v_sonuc->'warnings')::jsonb;
      END IF;
    END IF;
  END LOOP;

  RETURN json_build_object('success', true, 'students', v_ogrenci,
                           'updated', v_ders, 'warnings', v_uyarilar);
END;
$function$;

COMMENT ON FUNCTION public.rpc_gunu_ertele(uuid, date) IS
  'Bir günün tamamını erteler: o gün planlı dersi olan her öğrencinin dersleri birer boş slot ileri kayar.';

REVOKE ALL ON FUNCTION public.rpc_gunu_ertele(uuid, date) FROM public;
REVOKE ALL ON FUNCTION public.rpc_gunu_ertele(uuid, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_gunu_ertele(uuid, date) TO authenticated;
