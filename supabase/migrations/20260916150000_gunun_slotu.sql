-- Bildirilen ikinci sorun: Pazartesi'deki iki ders Salı'ya alındı ama saatleri
-- 18:40 ve 19:20'de kaldı. Oysa öğrencinin Salı slotu 17:20 — admin dersi "o
-- günün boş slotuna" koyduğunu düşünüyordu.
--
-- Sunucu bunu zaten yapabiliyor: rpc_apply_chain_dates'e saat gönderilmezse
-- öğrencinin o tarihteki şablon slotunu kendisi buluyor. Ama ders paneli her
-- seferinde saat alanlarının içeriğini de gönderdiği için o yol hiç
-- çalışmıyordu.
--
-- Bu işlev paneli o yola sokmak yerine daha görünür bir şey yapıyor: admin
-- yeni tarihi seçtiği anda saat alanları o günün slotuna güncelleniyor.
-- Böylece ne olacağı kaydetmeden önce ekranda görülüyor ve istenirse elle
-- değiştirilebiliyor.
--
-- rpc_next_free_slot bu iş için uygun değil: ileriye doğru arıyor ve
-- gerektiğinde sonraki günlere taşıyor. Burada aranan tek gün.

CREATE OR REPLACE FUNCTION public.rpc_gunun_slotu(
  p_student_id uuid,
  p_teacher_id uuid,
  p_tarih date,
  p_exclude uuid[] DEFAULT '{}'::uuid[])
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_slot record;
BEGIN
  IF NOT public.is_teacher_caller(p_teacher_id) THEN
    RETURN json_build_object('success', false, 'error', 'Bu işlem için yetkiniz yok');
  END IF;

  -- p_inclusive = true, p_max_date = p_tarih: yalnızca o gün.
  SELECT * INTO v_slot
  FROM public.free_lesson_slots(p_student_id, p_teacher_id, 1, p_tarih, NULL, true, p_exclude, p_tarih)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'no_slot');
  END IF;

  RETURN json_build_object('success', true,
                           'lessonDate', v_slot.lesson_date,
                           'startTime', v_slot.start_time,
                           'endTime', v_slot.end_time);
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_gunun_slotu(uuid, uuid, date, uuid[]) FROM public;
REVOKE ALL ON FUNCTION public.rpc_gunun_slotu(uuid, uuid, date, uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_gunun_slotu(uuid, uuid, date, uuid[]) TO authenticated;
