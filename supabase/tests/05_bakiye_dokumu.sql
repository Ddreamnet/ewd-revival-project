-- ============================================================================
-- Senaryo testleri · 5/6 · Bakiye dökümü
-- ============================================================================
-- İki paneldeki "bakiyedeki dersler" listesi rpc_bakiye_dokumu'ndan beslenir.
-- Sınanan söz: liste, bakiyeyle HER ADIMDA aynı şeyi söyler —
--     devir + artı satırlar − eksi satırlar = görünümdeki ders sayaçları
-- İşlendi, geri al, deneme, ödeme (sıfırlama), açılış devri, transfer, silinen
-- deneme ve süresi değişen ders bu söze karşı tek tek yürütülür.

-- Dökümün tek satırlık özeti: "sıralar (yeni→eski) · toplam dk · uyum".
-- Eksi satır '-' olarak görünür.
CREATE OR REPLACE FUNCTION public.zz_dokum(p_ogretmen uuid) RETURNS text
LANGUAGE sql AS $$
  WITH d AS (SELECT public.rpc_bakiye_dokumu(p_ogretmen) AS j),
       s AS (SELECT e, ord FROM d, json_array_elements(d.j->'dersler') WITH ORDINALITY AS t(e, ord))
  SELECT COALESCE((SELECT string_agg(COALESCE(e->>'sira', '-'), ',' ORDER BY ord) FROM s), 'boş')
         || ' · ' || (d.j->'bakiye'->>'total_minutes') || ' dk · uyum '
         || ((d.j->>'devir')::int
             + (SELECT count(*) FROM s WHERE e->>'sira' IS NOT NULL)
             - (SELECT count(*) FROM s WHERE e->>'sira' IS NULL)
             = (d.j->'bakiye'->>'completed_regular_lessons')::int
             + (d.j->'bakiye'->>'completed_trial_lessons')::int)::text
    FROM d
$$;

-- En üstteki (en yeni) satır: "tur|ad|tarih|bas"
CREATE OR REPLACE FUNCTION public.zz_dokum_ust(p_ogretmen uuid) RETURNS text
LANGUAGE sql AS $$
  SELECT COALESCE(e->>'tur', '') || '|' || COALESCE(e->>'ad', '') || '|' ||
         COALESCE(e->>'tarih', '') || '|' || COALESCE(e->>'bas', '')
    FROM json_array_elements(public.rpc_bakiye_dokumu(p_ogretmen)->'dersler') WITH ORDINALITY AS t(e, ord)
   ORDER BY ord LIMIT 1
$$;

DO $$
DECLARE
  bol text := 'dokum';
  t1 uuid := zz_id('t1'); t2 uuid := zz_id('t2'); a uuid := zz_id('a1');
  d date := DATE '2027-01-04';
  id1 uuid; id2 uuid; dn uuid; n numeric;
BEGIN
  PERFORM zz_admin_ol();
  PERFORM zz_sifirla();

  -- ── İşlendi / geri al ────────────────────────────────────────────────
  BEGIN
    id1 := zz_ders('a1', d, '10:00'); id2 := zz_ders('a1', d, '11:00');
    PERFORM zz_dogrula(bol, '01 Boş başlangıç', 'boş · 0 dk · uyum true', zz_dokum(t1));

    PERFORM zz_kaydet(bol, '02 Sırasız işaretleme reddedilir', 'ret', rpc_complete_lesson(id2, t1));
    PERFORM zz_dogrula(bol, '02a ... liste boş kaldı', 'boş · 0 dk · uyum true', zz_dokum(t1));

    PERFORM rpc_complete_lesson(id1, t1);
    PERFORM zz_kaydet(bol, '03 Çift tık hata değil', 'ok', rpc_complete_lesson(id1, t1));
    PERFORM zz_dogrula(bol, '03a ... tek satır, tek kazanç', '1 · 30 dk · uyum true', zz_dokum(t1));

    PERFORM zz_saat_ilerlet(t1);
    PERFORM rpc_complete_lesson(id2, t1);
    PERFORM zz_dogrula(bol, '04 İkinci ders en üste düştü', '2,1 · 60 dk · uyum true', zz_dokum(t1));
    PERFORM zz_dogrula(bol, '04a ... isim, gün, saat', 'ders|ZZ Sablonlu|2027-01-04|11:00', zz_dokum_ust(t1));

    PERFORM zz_saat_ilerlet(t1);
    PERFORM rpc_undo_complete_lesson(id2, t1);
    PERFORM zz_dogrula(bol, '05 Geri alınan listeden kalktı', '1 · 30 dk · uyum true', zz_dokum(t1));

    PERFORM zz_saat_ilerlet(t1);
    PERFORM rpc_complete_lesson(id2, t1);
    PERFORM zz_dogrula(bol, '06 Yeniden işlendi: çift satır yok', '2,1 · 60 dk · uyum true', zz_dokum(t1));
  EXCEPTION WHEN OTHERS THEN PERFORM zz_istisna(bol, '01-06 İşlendi / geri al', 'ok', SQLERRM); END;

  -- ── Deneme dersi ─────────────────────────────────────────────────────
  BEGIN
    PERFORM zz_saat_ilerlet(t1);
    dn := (rpc_deneme_ekle(t1, d + 3, '09:00', '09:30', 'ZZ Aday')->>'id')::uuid;
    PERFORM zz_dogrula(bol, '07 Planlı deneme listede yok', '2,1 · 60 dk · uyum true', zz_dokum(t1));

    PERFORM zz_kaydet(bol, '08 Deneme işlendi', 'ok', rpc_complete_lesson(dn, t1));
    PERFORM zz_dogrula(bol, '08a ... listeye düştü', '3,2,1 · 90 dk · uyum true', zz_dokum(t1));
    PERFORM zz_dogrula(bol, '08b ... aday adıyla', 'deneme|ZZ Aday|2027-01-07|09:00', zz_dokum_ust(t1));

    PERFORM zz_saat_ilerlet(t1);
    PERFORM rpc_undo_complete_lesson(dn, t1);
    PERFORM zz_dogrula(bol, '09 Deneme geri alındı', '2,1 · 60 dk · uyum true', zz_dokum(t1));

    PERFORM zz_saat_ilerlet(t1);
    PERFORM rpc_complete_lesson(dn, t1);
    PERFORM rpc_manual_balance_adjust(t1, 15, 'test düzeltme');
    PERFORM zz_dogrula(bol, '10 Manuel dakika listeyi değiştirmez', '3,2,1 · 105 dk · uyum true', zz_dokum(t1));
  EXCEPTION WHEN OTHERS THEN PERFORM zz_istisna(bol, '07-10 Deneme dersi', 'ok', SQLERRM); END;

  -- ── Ödeme (bakiyeyi sıfırla) ─────────────────────────────────────────
  BEGIN
    PERFORM zz_saat_ilerlet(t1);
    PERFORM zz_kaydet(bol, '11 Bakiye sıfırlandı', 'ok', rpc_close_teacher_payout(t1, 1, 'zz döküm testi')::json);
    PERFORM zz_dogrula(bol, '11a ... liste de sıfırlandı', 'boş · 0 dk · uyum true', zz_dokum(t1));

    -- Ödenmiş dersi geri almak: eksi satır, öğretmen 30 dk borçlu.
    PERFORM zz_saat_ilerlet(t1);
    PERFORM rpc_undo_complete_lesson(id2, t1);
    PERFORM zz_dogrula(bol, '12 Ödenmiş ders geri alındı → eksi satır', '- · -30 dk · uyum true', zz_dokum(t1));

    PERFORM zz_saat_ilerlet(t1);
    PERFORM rpc_complete_lesson(id2, t1);
    PERFORM zz_dogrula(bol, '13 Yeniden işlendi → net sıfır, satır yok', 'boş · 0 dk · uyum true', zz_dokum(t1));

    PERFORM zz_saat_ilerlet(t1);
    PERFORM rpc_complete_lesson(zz_ders('a1', d + 7, '10:00'), t1);
    PERFORM zz_dogrula(bol, '14 Yeni dönem 1''den başlar', '1 · 30 dk · uyum true', zz_dokum(t1));
  EXCEPTION WHEN OTHERS THEN PERFORM zz_istisna(bol, '11-14 Ödeme', 'ok', SQLERRM); END;

  -- ── Açılış devri ─────────────────────────────────────────────────────
  PERFORM zz_sifirla();
  BEGIN
    INSERT INTO teacher_balance_opening (teacher_id, minutes, regular_lessons, trial_lessons, created_at, notes)
    VALUES (t1, 180, 5, 1, now() - interval '1 day', 'zz döküm testi');
    PERFORM zz_dogrula(bol, '15 Yalnızca devir: liste boş, sayaç 6', 'boş · 180 dk · uyum true', zz_dokum(t1));

    PERFORM rpc_complete_lesson(zz_ders('a1', d, '10:00'), t1);
    PERFORM zz_dogrula(bol, '16 Devirden sonra ilk ders 7. ders', '7 · 210 dk · uyum true', zz_dokum(t1));

    PERFORM zz_saat_ilerlet(t1);
    PERFORM rpc_close_teacher_payout(t1, 1, 'zz döküm testi');
    PERFORM zz_saat_ilerlet(t1);
    PERFORM rpc_complete_lesson(zz_ders('a1', d, '11:00'), t1);
    PERFORM zz_dogrula(bol, '17 İlk ödemeden sonra devir biter', '1 · 30 dk · uyum true', zz_dokum(t1));
  EXCEPTION WHEN OTHERS THEN PERFORM zz_istisna(bol, '15-17 Açılış devri', 'ok', SQLERRM); END;
  DELETE FROM teacher_balance_opening WHERE teacher_id = t1;

  -- ── Transfer (K7) ────────────────────────────────────────────────────
  PERFORM zz_sifirla();
  BEGIN
    id1 := zz_ders('a1', d, '10:00');
    PERFORM rpc_complete_lesson(id1, t1);
    PERFORM rpc_ogrenciyi_aktar(a, t2);
    PERFORM zz_dogrula(bol, '18 Aktarılan öğrencinin dersi eski öğretmenin listesinde', '1 · 30 dk · uyum true', zz_dokum(t1));
    PERFORM zz_dogrula(bol, '18a ... adıyla', 'ders|ZZ Sablonlu|2027-01-04|10:00', zz_dokum_ust(t1));
    PERFORM zz_dogrula(bol, '18b ... yeni öğretmende yok', 'boş · 0 dk · uyum true', zz_dokum(t2));

    -- Yeni öğretmen, eskisinin işlediği dersi geri alır: kazanç yazandan düşer.
    PERFORM zz_saat_ilerlet(t1);
    PERFORM zz_kaydet(bol, '19 Yeni öğretmen eskinin dersini geri aldı', 'ok', rpc_undo_complete_lesson(id1, t2));
    PERFORM zz_dogrula(bol, '19a ... eski öğretmenden düştü', 'boş · 0 dk · uyum true', zz_dokum(t1));
    PERFORM zz_dogrula(bol, '19b ... yeni öğretmen borçlanmadı', 'boş · 0 dk · uyum true', zz_dokum(t2));

    PERFORM zz_saat_ilerlet(t1); PERFORM zz_saat_ilerlet(t2);
    PERFORM rpc_complete_lesson(id1, t2);
    PERFORM zz_dogrula(bol, '20 Dersi işleyen yeni öğretmen kazandı', 't1: boş · 0 dk · uyum true / t2: 1 · 30 dk · uyum true',
      't1: ' || zz_dokum(t1) || ' / t2: ' || zz_dokum(t2));
  EXCEPTION WHEN OTHERS THEN PERFORM zz_istisna(bol, '18-20 Transfer', 'ok', SQLERRM); END;

  -- ── Süresi değişen ve silinen deneme ─────────────────────────────────
  PERFORM zz_sifirla();
  BEGIN
    dn := (rpc_deneme_ekle(t1, d + 3, '09:00', '09:30', 'ZZ Aday')->>'id')::uuid;
    PERFORM rpc_complete_lesson(dn, t1);
    PERFORM zz_kaydet(bol, '21 İşlenmiş denemenin süresi 30 → 45 dk', 'ok', rpc_deneme_tasi(dn, d + 3, '09:00', '09:45'));
    PERFORM zz_saat_ilerlet(t1);
    PERFORM rpc_undo_complete_lesson(dn, t1);
    PERFORM zz_dogrula(bol, '21a ... geri alınca yazılan kadar düşer', 'boş · 0 dk · uyum true', zz_dokum(t1));

    PERFORM zz_saat_ilerlet(t1);
    PERFORM rpc_complete_lesson(dn, t1);
    DELETE FROM lesson_instances WHERE id = dn;   -- denemeSil: kazanç kalır (K7)
    PERFORM zz_dogrula(bol, '22 İşlenmiş deneme silindi: satır ve kazanç duruyor', '1 · 45 dk · uyum true', zz_dokum(t1));
    PERFORM zz_dogrula(bol, '22a ... adsız, saatsiz ama hatasız', 'deneme||',
      (SELECT split_part(zz_dokum_ust(t1), '|', 1) || '|' || split_part(zz_dokum_ust(t1), '|', 2) || '|' || split_part(zz_dokum_ust(t1), '|', 4)));
  EXCEPTION WHEN OTHERS THEN PERFORM zz_istisna(bol, '21-22 Deneme süresi / silme', 'ok', SQLERRM); END;

  -- ── Yetki ve görünürlük ──────────────────────────────────────────────
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', t2, 'role', 'authenticated')::text, true);
    PERFORM zz_kaydet(bol, '23 Öğretmen başkasının dökümünü isteyemez', 'ret', rpc_bakiye_dokumu(t1));
    PERFORM zz_kaydet(bol, '24 Öğretmen kendi dökümünü alır', 'ok', rpc_bakiye_dokumu(t2));

    -- Görünüm RLS'ye tabi mi? t1'in 45 dakikası var; t2 kimliğiyle okunamamalı.
    SET LOCAL ROLE authenticated;
    SELECT COALESCE(sum(total_minutes), 0) INTO n FROM teacher_balance WHERE teacher_id = t1;
    RESET ROLE;
    PERFORM zz_admin_ol();
    PERFORM zz_dogrula(bol, '25 Görünüm başka öğretmenin bakiyesini sızdırmaz', '0', n::text);
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE; PERFORM zz_admin_ol();
    PERFORM zz_istisna(bol, '23-25 Yetki', 'ok', SQLERRM);
  END;

  BEGIN
    PERFORM zz_dogrula(bol, '26 Defter canlı yayında', 'true',
      (SELECT EXISTS (SELECT 1 FROM pg_publication_tables
                       WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
                         AND tablename = 'balance_events'))::text);
    PERFORM zz_dogrula(bol, '27 Sağlık: defter ile ders durumu uyumlu', '0',
      (SELECT adet::text FROM sistem_sagligi() WHERE kod = 'defter_uyumsuz'));
  EXCEPTION WHEN OTHERS THEN PERFORM zz_istisna(bol, '26-27 Yayın / sağlık', 'ok', SQLERRM); END;

  -- Ödeme kapatma payment_history'ye de yazar; kurgunun izini bırakma.
  DELETE FROM payment_history WHERE teacher_id IN (t1, t2);
  PERFORM zz_sifirla();
END $$;

SELECT sira, senaryo, beklenen, gerceklesen, LEFT(ayrinti, 90) AS ayrinti
  FROM public.zz_test_sonuc WHERE bolum = 'dokum' ORDER BY sira;
