-- ============================================================================
-- Senaryo testleri · 4/5 · Bakiye ve transfer
-- ============================================================================
-- K7: işlenen dersin ücreti onu işleyen öğretmenindir; transfer, arşiv ve
-- silme buna dokunamaz. Bakiye yalnızca defterden (balance_events) türer.

DO $$
DECLARE
  bol text := 'bakiye';
  t1 uuid := zz_id('t1'); t2 uuid := zz_id('t2'); a uuid := zz_id('a1');
  d date := DATE '2027-01-04';
  j json; id1 uuid; id2 uuid; n int;
BEGIN
  PERFORM zz_admin_ol();

  -- ── Transfer ─────────────────────────────────────────────────────────
  PERFORM zz_sifirla();
  BEGIN
    j := rpc_ogrenciyi_aktar(a, t2);
    PERFORM zz_kaydet(bol, '01 Aktar t1→t2', 'ok', j,
      format('ders %s · şablon %s · takip %s', j->>'ders', j->>'sablon', j->>'takip'));
    PERFORM zz_dogrula(bol, '01a ... her şey t2''de', '8|2|1',
      (SELECT count(*) FROM lesson_instances WHERE student_id = a AND teacher_id = t2) || '|' ||
      (SELECT count(*) FROM student_lessons WHERE student_id = a AND teacher_id = t2) || '|' ||
      (SELECT count(*) FROM student_lesson_tracking WHERE student_id = a AND teacher_id = t2));
    PERFORM zz_kaydet(bol, '02 Aynı yöne tekrar', 'ret', rpc_ogrenciyi_aktar(a, t2));
  EXCEPTION WHEN OTHERS THEN PERFORM zz_istisna(bol, '01-02 Aktar', 'ok', SQLERRM); END;

  -- Öğretmen aktaramaz
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', t2, 'role', 'authenticated')::text, true);
    PERFORM zz_kaydet(bol, '03 Öğretmen aktarmaya çalıştı', 'ret', rpc_ogrenciyi_aktar(a, t1));
    PERFORM zz_admin_ol();
  EXCEPTION WHEN OTHERS THEN PERFORM zz_admin_ol(); PERFORM zz_istisna(bol, '03 Öğretmen aktarmaya çalıştı', 'ret', SQLERRM); END;

  -- t2 bir ders işler: ücret t2'nin
  BEGIN
    id1 := zz_ders('a1', d, '10:00');
    PERFORM zz_kaydet(bol, '04 t2 dersi işledi', 'ok', rpc_complete_lesson(id1, t2));
    PERFORM zz_dogrula(bol, '04a ... t2 bakiyesi 30, t1 0', '30|0',
      (SELECT total_minutes FROM teacher_balance WHERE teacher_id = t2) || '|' ||
      (SELECT total_minutes FROM teacher_balance WHERE teacher_id = t1));
  EXCEPTION WHEN OTHERS THEN PERFORM zz_istisna(bol, '04 t2 dersi işledi', 'ok', SQLERRM); END;

  -- Geri aktar: t2'nin 30 dakikası t2'de kalır (K7)
  BEGIN
    PERFORM zz_kaydet(bol, '05 Geri aktar t2→t1', 'ok', rpc_ogrenciyi_aktar(a, t1));
    PERFORM zz_dogrula(bol, '05a ... t2''nin kazancı t2''de kaldı', '30|0',
      (SELECT total_minutes FROM teacher_balance WHERE teacher_id = t2) || '|' ||
      (SELECT total_minutes FROM teacher_balance WHERE teacher_id = t1));
    PERFORM zz_dogrula(bol, '05b ... işlenmiş ders artık t1''de görünür', 't1',
      (SELECT CASE teacher_id WHEN t1 THEN 't1' ELSE 't2' END FROM lesson_instances WHERE id = id1));
  EXCEPTION WHEN OTHERS THEN PERFORM zz_istisna(bol, '05 Geri aktar', 'ok', SQLERRM); END;

  -- ── Bakiye döngüsü ───────────────────────────────────────────────────
  PERFORM zz_sifirla();
  BEGIN
    id1 := zz_ders('a1', d, '10:00'); id2 := zz_ders('a1', d, '11:00');
    PERFORM rpc_complete_lesson(id1, t1);
    PERFORM rpc_complete_lesson(id2, t1);
    PERFORM zz_dogrula(bol, '06 İki ders işlendi → 60 dk, 2 ders', '60|2',
      (SELECT total_minutes || '|' || completed_regular_lessons FROM teacher_balance WHERE teacher_id = t1));

    PERFORM rpc_manual_balance_adjust(t1, 15, 'test düzeltme');
    PERFORM zz_dogrula(bol, '07 Manuel +15 → 75', '75',
      (SELECT total_minutes::text FROM teacher_balance WHERE teacher_id = t1));

    PERFORM zz_saat_ilerlet(t1);   -- işlenenler ödemeden önce
    j := rpc_close_teacher_payout(t1, 1, 'test ödemesi');
    PERFORM zz_kaydet(bol, '08 Ödeme kapat', 'ok', j);
    PERFORM zz_dogrula(bol, '08a ... bakiye ve sayaçlar sıfırlandı', '0|0',
      (SELECT total_minutes || '|' || completed_regular_lessons FROM teacher_balance WHERE teacher_id = t1));

    PERFORM zz_saat_ilerlet(t1);   -- ödeme geçmişte kaldı
    PERFORM rpc_complete_lesson(zz_ders('a1', d + 7, '10:00'), t1);
    PERFORM zz_dogrula(bol, '09 Ödeme sonrası yeni ders → 30 dk, 1 ders', '30|1',
      (SELECT total_minutes || '|' || completed_regular_lessons FROM teacher_balance WHERE teacher_id = t1));

    -- Ödenmiş dersi geri almak: öğretmen 30 dk borçlanır, sayaç bir eksilir.
    -- Bu bilinçli muhasebe; kırmızıya düşen sayaç yanlış değil.
    PERFORM rpc_undo_complete_lesson(zz_ders('a1', d + 7, '10:00'), t1);
    PERFORM zz_dogrula(bol, '10 Son işleneni geri al → 0|0', '0|0',
      (SELECT total_minutes || '|' || completed_regular_lessons FROM teacher_balance WHERE teacher_id = t1));
  EXCEPTION WHEN OTHERS THEN PERFORM zz_istisna(bol, '06-10 Bakiye döngüsü', 'ok', SQLERRM); END;

  -- ── Defter değişmezleri (kurgudaki iki öğretmen için) ────────────────
  PERFORM zz_sifirla();
  BEGIN
    PERFORM rpc_complete_lesson(zz_ders('a1', d, '10:00'), t1);
    PERFORM rpc_complete_lesson(zz_ders('a1', d, '11:00'), t1);
    PERFORM rpc_undo_complete_lesson(zz_ders('a1', d, '11:00'), t1);
    -- Görünüm = defter toplamı
    PERFORM zz_dogrula(bol, '11 Görünüm = defter toplamı', 'true',
      (SELECT (tb.total_minutes = COALESCE((SELECT sum(amount_minutes) FROM balance_events WHERE teacher_id = t1), 0))::text
         FROM teacher_balance tb WHERE tb.teacher_id = t1));
    -- Her işlenmiş ders için net tam bir defter satırı; planlı için sıfır
    PERFORM zz_dogrula(bol, '12 İşlenmiş = net 1 satır, planlı = net 0', '0',
      (SELECT count(*)::text FROM lesson_instances li
        WHERE li.teacher_id = t1 AND li.tur = 'ders' AND li.status IN ('planned','completed')
          AND (SELECT count(*) FILTER (WHERE event_type = 'lesson_complete') - count(*) FILTER (WHERE event_type = 'lesson_undo')
                 FROM balance_events be WHERE be.instance_id = li.id)
              <> CASE li.status WHEN 'completed' THEN 1 ELSE 0 END));
  EXCEPTION WHEN OTHERS THEN PERFORM zz_istisna(bol, '11-12 Defter değişmezleri', 'ok', SQLERRM); END;

  PERFORM zz_sifirla();
END $$;

SELECT sira, senaryo, beklenen, gerceklesen, LEFT(ayrinti, 90) AS ayrinti
  FROM public.zz_test_sonuc WHERE bolum = 'bakiye' ORDER BY sira;
