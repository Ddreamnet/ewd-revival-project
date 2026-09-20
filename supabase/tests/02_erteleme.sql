-- ============================================================================
-- Senaryo testleri · 2/6 · Erteleme
-- ============================================================================
-- Her senaryo kendi BEGIN/EXCEPTION bloğunda: biri ham istisna fırlatırsa
-- diğerleri yine koşar ve o istisna sonuç tablosuna "HAM ISTISNA" olarak
-- yazılır. Adminin karşısına asla ham istisna çıkmamalı; 'ret' yalnızca
-- gerçek bir kural ihlalinde kabul edilir.
--
-- Referans programı (A, şablonlu): 04.01 10:00 | 04.01 11:00 | 11.01 10:00 |
-- 11.01 11:00 | 18.01 10:00 | 18.01 11:00 | 25.01 10:00 | 25.01 11:00
-- B (şablonsuz): 05.01 | 12.01 | 19.01 | 26.01 14:00 · C: 06.01 10:00

DO $$
DECLARE
  bol text := 'erteleme';
  t uuid := zz_id('t1'); a uuid := zz_id('a1'); b uuid := zz_id('b1');
  d date := DATE '2027-01-04';
  j json; id1 uuid; id2 uuid; g uuid;
BEGIN
  PERFORM zz_admin_ol();

  -- ── Tek ders taşıma ──────────────────────────────────────────────────
  PERFORM zz_sifirla();
  BEGIN
    PERFORM zz_kaydet(bol, '01 Tek ders ileri tarihe', 'ok',
      rpc_move_lesson(zz_ders('a1', d, '10:00'), d + 9, '10:00', '10:30', false));
  EXCEPTION WHEN OTHERS THEN PERFORM zz_istisna(bol, '01 Tek ders ileri tarihe', 'ok', SQLERRM); END;

  PERFORM zz_sifirla();
  BEGIN
    PERFORM zz_kaydet(bol, '02 Geçmişe taşıma', 'ok',
      rpc_move_lesson(zz_ders('a1', d + 14, '10:00'), DATE '2026-09-01', '10:00', '10:30', false));
  EXCEPTION WHEN OTHERS THEN PERFORM zz_istisna(bol, '02 Geçmişe taşıma', 'ok', SQLERRM); END;

  PERFORM zz_sifirla();
  BEGIN
    PERFORM zz_kaydet(bol, '03 Başka öğrencinin dersi üstüne', 'uyari',
      rpc_move_lesson(zz_ders('a1', d, '10:00'), d + 2, '10:00', '10:30', false));
  EXCEPTION WHEN OTHERS THEN PERFORM zz_istisna(bol, '03 Başka öğrencinin dersi üstüne', 'uyari', SQLERRM); END;

  PERFORM zz_sifirla();
  BEGIN
    PERFORM zz_kaydet(bol, '04 Kendi dersinin üstüne (aynı dakika)', 'ret',
      rpc_move_lesson(zz_ders('a1', d, '10:00'), d, '11:00', '11:30', false));
  EXCEPTION WHEN OTHERS THEN PERFORM zz_istisna(bol, '04 Kendi dersinin üstüne (aynı dakika)', 'ret', SQLERRM); END;

  -- Aynı dakika değil ama üst üste biniyor: öğrenci 10:15'te iki derste olamaz.
  PERFORM zz_sifirla();
  BEGIN
    PERFORM zz_kaydet(bol, '23 Kendi dersine ÜST ÜSTE BİNEN (10:45–11:15)', 'ret',
      rpc_move_lesson(zz_ders('a1', d, '10:00'), d, '10:45', '11:15', false));
  EXCEPTION WHEN OTHERS THEN PERFORM zz_istisna(bol, '23 Kendi dersine ÜST ÜSTE BİNEN (10:45–11:15)', 'ret', SQLERRM); END;

  -- Arka arkaya (10:30–11:00) çakışma değildir; izin verilmeli.
  PERFORM zz_sifirla();
  BEGIN
    PERFORM zz_kaydet(bol, '32 Kendi dersine ARKA ARKAYA (10:30–11:00)', 'ok',
      rpc_move_lesson(zz_ders('a1', d + 7, '11:00'), d, '10:30', '11:00', false));
  EXCEPTION WHEN OTHERS THEN PERFORM zz_istisna(bol, '32 Kendi dersine ARKA ARKAYA (10:30–11:00)', 'ok', SQLERRM); END;

  -- ── Kaydırmalı taşıma ────────────────────────────────────────────────
  PERFORM zz_sifirla();
  BEGIN
    PERFORM zz_kaydet(bol, '05 Kaydırmalı (şablonlu)', 'ok',
      rpc_move_lesson(zz_ders('a1', d, '10:00'), d + 3, '10:00', '10:30', true));
  EXCEPTION WHEN OTHERS THEN PERFORM zz_istisna(bol, '05 Kaydırmalı (şablonlu)', 'ok', SQLERRM); END;

  PERFORM zz_sifirla();
  BEGIN
    PERFORM zz_kaydet(bol, '06 Kaydırmalı (ŞABLONSUZ)', 'ok',
      rpc_move_lesson(zz_ders('b1', d + 1, '14:00'), d + 3, '14:00', '14:30', true));
    PERFORM zz_dogrula(bol, '06a ... hepsi +2 gün', '07.01 14:00 | 14.01 14:00 | 21.01 14:00 | 28.01 14:00', zz_program('b1'));
  EXCEPTION WHEN OTHERS THEN PERFORM zz_istisna(bol, '06 Kaydırmalı (ŞABLONSUZ)', 'ok', SQLERRM); END;

  PERFORM zz_sifirla();
  UPDATE lesson_instances SET status = 'completed' WHERE id = zz_ders('a1', d, '10:00');
  BEGIN
    PERFORM zz_kaydet(bol, '07 İşlenmiş dersi taşıma', 'ok',
      rpc_move_lesson(zz_ders('a1', d, '10:00'), d + 9, '10:00', '10:30', false));
  EXCEPTION WHEN OTHERS THEN PERFORM zz_istisna(bol, '07 İşlenmiş dersi taşıma', 'ok', SQLERRM); END;

  PERFORM zz_sifirla();
  UPDATE lesson_instances SET status = 'completed' WHERE id = zz_ders('a1', d, '10:00');
  BEGIN
    PERFORM zz_kaydet(bol, '26 İşlenmiş dersi KAYDIRMALI taşıma (admin)', 'ok',
      rpc_move_lesson(zz_ders('a1', d, '10:00'), d + 3, '10:00', '10:30', true));
  EXCEPTION WHEN OTHERS THEN PERFORM zz_istisna(bol, '26 İşlenmiş dersi KAYDIRMALI taşıma (admin)', 'ok', SQLERRM); END;

  -- ── Geri al ──────────────────────────────────────────────────────────
  PERFORM zz_sifirla();
  BEGIN
    id1 := zz_ders('a1', d, '10:00');
    PERFORM rpc_move_lesson(id1, d + 9, '10:00', '10:30', false);
    PERFORM zz_kaydet(bol, '09 Taşı → geri al', 'ok', rpc_revert_lesson(id1));
    PERFORM zz_dogrula(bol, '09a ... yerine döndü, iz yok',
      d::text || '|—|0', (SELECT lesson_date::text || '|' || COALESCE(original_date::text,'—') || '|' || rescheduled_count FROM lesson_instances WHERE id = id1));
  EXCEPTION WHEN OTHERS THEN PERFORM zz_istisna(bol, '09 Taşı → geri al', 'ok', SQLERRM); END;

  PERFORM zz_sifirla();
  BEGIN
    PERFORM zz_kaydet(bol, '10 Taşınmamışta geri al', 'ok', rpc_revert_lesson(zz_ders('a1', d, '10:00')));
  EXCEPTION WHEN OTHERS THEN PERFORM zz_istisna(bol, '10 Taşınmamışta geri al', 'ok', SQLERRM); END;

  PERFORM zz_sifirla();
  BEGIN
    id1 := zz_ders('a1', d + 14, '10:00');
    PERFORM rpc_move_lesson(id1, DATE '2026-09-01', '10:00', '10:30', false);
    PERFORM zz_kaydet(bol, '30 Geçmişe taşı → geri al', 'ok', rpc_revert_lesson(id1));
    PERFORM zz_dogrula(bol, '30a ... yerine döndü', (d + 14)::text, (SELECT lesson_date::text FROM lesson_instances WHERE id = id1));
  EXCEPTION WHEN OTHERS THEN PERFORM zz_istisna(bol, '30 Geçmişe taşı → geri al', 'ok', SQLERRM); END;

  -- Götür-getir: iz kalmamalı
  PERFORM zz_sifirla();
  BEGIN
    id1 := zz_ders('a1', d, '10:00');
    PERFORM rpc_move_lesson(id1, d + 9, '10:00', '10:30', false);
    PERFORM rpc_move_lesson(id1, d, '10:00', '10:30', false);
    PERFORM zz_dogrula(bol, '33 Götür-getir iz bırakmaz', '—|0|false',
      (SELECT COALESCE(original_date::text,'—') || '|' || rescheduled_count || '|' || is_manual_override FROM lesson_instances WHERE id = id1));
  EXCEPTION WHEN OTHERS THEN PERFORM zz_istisna(bol, '33 Götür-getir iz bırakmaz', 'ok', SQLERRM); END;

  -- ── Bu ders yapılmadı ────────────────────────────────────────────────
  PERFORM zz_sifirla();
  BEGIN
    PERFORM zz_kaydet(bol, '12 Bu ders yapılmadı (şablonlu)', 'ok', rpc_postpone_lesson(zz_ders('a1', d, '10:00')));
    PERFORM zz_dogrula(bol, '12a ... zincir bir slot kaydı',
      '04.01 11:00 | 11.01 10:00 | 11.01 11:00 | 18.01 10:00 | 18.01 11:00 | 25.01 10:00 | 25.01 11:00 | 01.02 10:00', zz_program('a1'));
  EXCEPTION WHEN OTHERS THEN PERFORM zz_istisna(bol, '12 Bu ders yapılmadı (şablonlu)', 'ok', SQLERRM); END;

  PERFORM zz_sifirla();
  BEGIN
    PERFORM zz_kaydet(bol, '13 Bu ders yapılmadı (ŞABLONSUZ)', 'ok', rpc_postpone_lesson(zz_ders('b1', d + 1, '14:00')));
    PERFORM zz_dogrula(bol, '13a ... tam hafta kaydı', '12.01 14:00 | 19.01 14:00 | 26.01 14:00 | 02.02 14:00', zz_program('b1'));
  EXCEPTION WHEN OTHERS THEN PERFORM zz_istisna(bol, '13 Bu ders yapılmadı (ŞABLONSUZ)', 'ok', SQLERRM); END;

  PERFORM zz_sifirla();
  UPDATE lesson_instances SET status = 'completed' WHERE id = zz_ders('a1', d, '10:00');
  BEGIN
    PERFORM zz_kaydet(bol, '14 İşlenmişi ertele (admin)', 'ok', rpc_postpone_lesson(zz_ders('a1', d, '10:00')));
  EXCEPTION WHEN OTHERS THEN PERFORM zz_istisna(bol, '14 İşlenmişi ertele (admin)', 'ok', SQLERRM); END;

  -- Paketin son dersi: arkasında kimse yok
  PERFORM zz_sifirla();
  BEGIN
    PERFORM zz_kaydet(bol, '24 Paketin SON dersi yapılmadı', 'ok', rpc_postpone_lesson(zz_ders('a1', d + 21, '11:00')));
    PERFORM zz_dogrula(bol, '24a ... tek başına sonraki slota', '01.02 10:00',
      (SELECT to_char(lesson_date,'DD.MM') || ' ' || to_char(start_time,'HH24:MI') FROM lesson_instances WHERE student_id = a ORDER BY lesson_date DESC, start_time DESC LIMIT 1));
  EXCEPTION WHEN OTHERS THEN PERFORM zz_istisna(bol, '24 Paketin SON dersi yapılmadı', 'ok', SQLERRM); END;

  -- Elle sabitlenmiş dersin kendisi "yapılmadı" dendiğinde taşınmalı
  PERFORM zz_sifirla();
  UPDATE lesson_instances SET is_manual_override = true WHERE id = zz_ders('a1', d + 7, '10:00');
  BEGIN
    PERFORM zz_kaydet(bol, '25 Sabitlenmiş dersin kendisi yapılmadı', 'ok', rpc_postpone_lesson(zz_ders('a1', d + 7, '10:00')));
    PERFORM zz_dogrula(bol, '25a ... sabitlenmiş ders de kaydı', 'false',
      (EXISTS (SELECT 1 FROM lesson_instances WHERE student_id = a AND lesson_date = d + 7 AND start_time = '10:00'))::text);
  EXCEPTION WHEN OTHERS THEN PERFORM zz_istisna(bol, '25 Sabitlenmiş dersin kendisi yapılmadı', 'ok', SQLERRM); END;

  -- ── Toplu kaydırma + geri alma ───────────────────────────────────────
  PERFORM zz_sifirla();
  BEGIN
    PERFORM rpc_postpone_lesson(zz_ders('a1', d, '10:00'));                       -- grup kaydırması
    id2 := zz_ders('a1', d + 7, '11:00');                                        -- gruptan biri
    PERFORM rpc_move_lesson(id2, d + 10, '10:00', '10:30', false);               -- elle taşındı → gruptan çıkar
    PERFORM zz_kaydet(bol, '27 Grup kaydırması → biri elle taşındı → grupta Geri Al', 'ok',
      rpc_revert_lesson(zz_ders('a1', d, '11:00')));
    PERFORM zz_dogrula(bol, '27a ... elle taşınan yerinde kaldı', (d + 10)::text,
      (SELECT lesson_date::text FROM lesson_instances WHERE id = id2));
    PERFORM zz_dogrula(bol, '27b ... diğer 7 ders geri döndü', '7',
      (SELECT count(*)::text FROM lesson_instances WHERE student_id = a AND original_date IS NULL AND id <> id2));
  EXCEPTION WHEN OTHERS THEN PERFORM zz_istisna(bol, '27 Grup kaydırması → elle → Geri Al', 'ok', SQLERRM); END;

  PERFORM zz_sifirla();
  BEGIN
    PERFORM rpc_ara_ver(a, t, d + 7, d + 14);
    PERFORM zz_kaydet(bol, '28 Ara ver → Geri Al (grup)', 'ok', rpc_revert_lesson(zz_ders('a1', d + 21, '10:00')));
    PERFORM zz_dogrula(bol, '28a ... program başa döndü',
      '04.01 10:00 | 04.01 11:00 | 11.01 10:00 | 11.01 11:00 | 18.01 10:00 | 18.01 11:00 | 25.01 10:00 | 25.01 11:00', zz_program('a1'));
  EXCEPTION WHEN OTHERS THEN PERFORM zz_istisna(bol, '28 Ara ver → Geri Al (grup)', 'ok', SQLERRM); END;

  -- ── Günü ertele ──────────────────────────────────────────────────────
  PERFORM zz_sifirla();
  BEGIN
    PERFORM zz_kaydet(bol, '16 Günü ertele (dolu gün)', 'ok', rpc_gunu_ertele(t, d));
  EXCEPTION WHEN OTHERS THEN PERFORM zz_istisna(bol, '16 Günü ertele (dolu gün)', 'ok', SQLERRM); END;

  PERFORM zz_sifirla();
  BEGIN
    PERFORM zz_kaydet(bol, '17 Günü ertele (boş gün)', 'ok', rpc_gunu_ertele(t, d + 4));
  EXCEPTION WHEN OTHERS THEN PERFORM zz_istisna(bol, '17 Günü ertele (boş gün)', 'ok', SQLERRM); END;

  -- ── Ara ver ──────────────────────────────────────────────────────────
  PERFORM zz_sifirla();
  BEGIN
    PERFORM zz_kaydet(bol, '18 Ara ver (şablonlu)', 'ok', rpc_ara_ver(a, t, d + 7, d + 14));
  EXCEPTION WHEN OTHERS THEN PERFORM zz_istisna(bol, '18 Ara ver (şablonlu)', 'ok', SQLERRM); END;

  PERFORM zz_sifirla();
  BEGIN
    PERFORM zz_kaydet(bol, '19 Ara ver (ŞABLONSUZ, tüm paket)', 'ok', rpc_ara_ver(b, t, d + 1, d + 22));
    PERFORM zz_dogrula(bol, '19a ... hepsi aranın ötesine', '02.02 14:00 | 09.02 14:00 | 16.02 14:00 | 23.02 14:00', zz_program('b1'));
  EXCEPTION WHEN OTHERS THEN PERFORM zz_istisna(bol, '19 Ara ver (ŞABLONSUZ, tüm paket)', 'ok', SQLERRM); END;

  -- ── Paket listesinden tarih ──────────────────────────────────────────
  PERFORM zz_sifirla();
  BEGIN
    id1 := zz_ders('a1', d, '10:00'); id2 := zz_ders('a1', d, '11:00');
    PERFORM zz_kaydet(bol, '20 Liste: iki ders aynı güne', 'ok', rpc_apply_chain_dates(a, t, jsonb_build_array(
      jsonb_build_object('id', id1, 'lessonDate', d + 9, 'startTime', '10:00', 'endTime', '10:30', 'markOverride', true),
      jsonb_build_object('id', id2, 'lessonDate', d + 9, 'startTime', '11:00', 'endTime', '11:30', 'markOverride', true))));
  EXCEPTION WHEN OTHERS THEN PERFORM zz_istisna(bol, '20 Liste: iki ders aynı güne', 'ok', SQLERRM); END;

  PERFORM zz_sifirla();
  BEGIN
    id1 := zz_ders('a1', d, '10:00'); id2 := zz_ders('a1', d, '11:00');
    PERFORM zz_kaydet(bol, '21 Liste: iki ders AYNI TARİH+SAAT', 'ret', rpc_apply_chain_dates(a, t, jsonb_build_array(
      jsonb_build_object('id', id1, 'lessonDate', d + 9, 'startTime', '10:00', 'endTime', '10:30', 'markOverride', true),
      jsonb_build_object('id', id2, 'lessonDate', d + 9, 'startTime', '10:00', 'endTime', '10:30', 'markOverride', true))));
  EXCEPTION WHEN OTHERS THEN PERFORM zz_istisna(bol, '21 Liste: iki ders AYNI TARİH+SAAT', 'ret', SQLERRM); END;

  -- ── İşlendi / geri al ────────────────────────────────────────────────
  PERFORM zz_sifirla();
  BEGIN
    id1 := zz_ders('a1', d, '10:00');
    PERFORM zz_kaydet(bol, '22 Sıradaki dersi işle', 'ok', rpc_complete_lesson(id1, t));
    PERFORM zz_kaydet(bol, '24b İkinci kez işle (değişiklik gerekmez)', 'ok', rpc_complete_lesson(id1, t));
    PERFORM zz_kaydet(bol, '25b Son işleneni geri al', 'ok', rpc_undo_complete_lesson(id1, t));
    PERFORM zz_kaydet(bol, '26b İşlenmemişi geri al (değişiklik gerekmez)', 'ok', rpc_undo_complete_lesson(id1, t));
    PERFORM zz_dogrula(bol, '26c ... defter net sıfır', '0',
      (SELECT COALESCE(sum(amount_minutes),0)::text FROM balance_events WHERE teacher_id = t));
  EXCEPTION WHEN OTHERS THEN PERFORM zz_istisna(bol, '22-26 İşlendi döngüsü', 'ok', SQLERRM); END;

  PERFORM zz_sifirla();
  BEGIN
    PERFORM zz_kaydet(bol, '23b Sıradan olmayanı işle', 'ret', rpc_complete_lesson(zz_ders('a1', d + 21, '11:00'), t));
  EXCEPTION WHEN OTHERS THEN PERFORM zz_istisna(bol, '23b Sıradan olmayanı işle', 'ret', SQLERRM); END;

  -- ── Deneme dersi ─────────────────────────────────────────────────────
  PERFORM zz_sifirla();
  BEGIN
    j := rpc_deneme_ekle(t, d + 3, '16:00', '17:00', 'ZZ Aday');
    PERFORM zz_kaydet(bol, '31a Deneme ekle', 'ok', j);
    id1 := (j->>'id')::uuid;
    PERFORM zz_kaydet(bol, '31b Deneme taşı', 'ok', rpc_move_lesson(id1, d + 4, '16:00', '17:00', false));
    PERFORM zz_kaydet(bol, '31c Deneme geri al', 'ok', rpc_revert_lesson(id1));
    PERFORM zz_kaydet(bol, '31d Deneme işle', 'ok', rpc_complete_lesson(id1, t));
    PERFORM zz_dogrula(bol, '31e ... defterde 60 dk', '60', (SELECT sum(amount_minutes)::text FROM balance_events WHERE instance_id = id1));
    PERFORM zz_kaydet(bol, '31f Deneme işlendiyi geri al', 'ok', rpc_undo_complete_lesson(id1, t));
    PERFORM zz_kaydet(bol, '31g Denemeyi ertele (açık ret)', 'ret', rpc_postpone_lesson(id1));
    DELETE FROM lesson_instances WHERE id = id1;
    PERFORM zz_dogrula(bol, '31h Deneme silindi', '0', (SELECT count(*)::text FROM lesson_instances WHERE id = id1));
  EXCEPTION WHEN OTHERS THEN PERFORM zz_istisna(bol, '31 Deneme döngüsü', 'ok', SQLERRM); END;

  PERFORM zz_sifirla();
END $$;

SELECT sira, senaryo, beklenen, gerceklesen, LEFT(ayrinti, 90) AS ayrinti
  FROM public.zz_test_sonuc WHERE bolum = 'erteleme' ORDER BY sira;
