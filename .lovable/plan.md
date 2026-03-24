

# Plan: Reset Package — Başlangıç Tarihi Bug Fix (Güncellenmiş)

## Kök Neden

`rpc_reset_package` yeni cycle instance'ları üretirken başlangıç tarihini şöyle hesaplıyor:

```sql
v_start_date := CURRENT_DATE;
```

Hiçbir completed lesson kontrolü yok. Oysa `rpc_sync_student_schedule` bunu doğru yapıyor:

```sql
v_start_date := CURRENT_DATE;
IF v_completed_count > 0 THEN
    SELECT (lesson_date + 1)::date INTO v_start_date
    FROM lesson_instances WHERE ... status = 'completed'
    ORDER BY lesson_date DESC LIMIT 1;
    IF v_start_date < CURRENT_DATE THEN
      v_start_date := CURRENT_DATE;
    END IF;
END IF;
```

## Etkilenen Öğrenciler (DB'den doğrulandı)

| Öğrenci | Son Completed | İlk Planned (yeni cycle) | Durum |
|---------|--------------|-------------------------|-------|
| **Emir** | 2026-03-24 | 2026-03-24 | Aynı gün — BUG |
| **Yaren Eylül** | 2026-03-28 | 2026-03-28 | Aynı gün — BUG |
| **Sadullah** | 2026-04-02 | 2026-03-25 | Geriye düşmüş — DAHA KÖTÜ |

---

## ⚠ Kritik Nokta 1: Başlangıç tarihi sadece "bugün completed varsa" kuralına indirgenemez

Önceki plandaki `IF EXISTS (... lesson_date = CURRENT_DATE AND status = 'completed')` kontrolü **Sadullah örneğini çözmez**:

- Sadullah'ın son completed lesson'ı 2026-04-02'de (gelecekte).
- Reset bugün (2026-03-24) yapılsa bile, yeni planned instance'lar bugünden başlar → 2026-04-02'den önceki tarihlere düşer → completed lesson'larla örtüşür.

**Doğru kural**: Başlangıç anchor'ı sadece bugüne değil, son completed lesson'a da bakmalı:

```sql
v_start_date := CURRENT_DATE;

-- Eski cycle dahil tüm completed lesson'ların en son tarihini bul
SELECT MAX(lesson_date) INTO v_last_completed_date
FROM lesson_instances
WHERE student_id = p_student_id
  AND teacher_id = p_teacher_id
  AND status = 'completed';

IF v_last_completed_date IS NOT NULL THEN
  v_start_date := GREATEST(CURRENT_DATE, v_last_completed_date + 1);
END IF;
```

Bu mantık `rpc_sync_student_schedule`'daki yaklaşımla tutarlı ve tüm edge case'leri kapsar:
- **Emir**: Son completed 2026-03-24 → anchor = MAX(bugün, 2026-03-25) = 2026-03-25 → ilk uygun slot Perşembe 2026-03-26 ✓
- **Yaren Eylül**: Son completed 2026-03-28 → anchor = MAX(bugün, 2026-03-29) → ilk uygun slot template'e göre ✓
- **Sadullah**: Son completed 2026-04-02 → anchor = MAX(bugün, 2026-04-03) → ilk uygun slot 2026-04-03 sonrası ✓

---

## ⚠ Kritik Nokta 2: Sadullah örneğinin neden ek kontrol gerektirdiği

Sadullah'ın son completed lesson'ı bugünden ileride (2026-04-02). Bu, ileriye kaydırma (shift) veya ileri tarihli tamamlama gibi senaryolarda oluşabilir.

Sadece `CURRENT_DATE` kullanmak veya sadece "bugün completed var mı" kontrolü yapmak bu durumu kaçırır çünkü:
- `CURRENT_DATE` = 2026-03-24
- `last_completed_date` = 2026-04-02
- `CURRENT_DATE + 1` = 2026-03-25 → bu, completed lesson'ların (2026-04-02 dahil) üstüne biner

`GREATEST(CURRENT_DATE, last_completed_date + 1)` formülü bu sorunu tamamen çözer.

---

## ⚠ Kritik Nokta 3: Sistem geneli audit — genişletilmiş kapsam

Audit sadece "aynı gün çakışma" aramayla sınırlı kalmamalı. Doğru audit koşulu:

```sql
-- Herhangi bir öğrenci/teacher çifti için:
-- yeni (en yüksek) cycle'daki ilk planned instance tarihi
-- ≤ herhangi bir cycle'daki son completed instance tarihi mi?
SELECT
  li_planned.student_id,
  li_planned.teacher_id,
  p.full_name,
  li_planned.package_cycle as planned_cycle,
  li_planned.first_planned_date,
  li_completed.last_completed_date
FROM (
  SELECT student_id, teacher_id, package_cycle,
         MIN(lesson_date) as first_planned_date
  FROM lesson_instances
  WHERE status = 'planned'
  GROUP BY student_id, teacher_id, package_cycle
) li_planned
JOIN (
  SELECT student_id, teacher_id,
         MAX(lesson_date) as last_completed_date
  FROM lesson_instances
  WHERE status = 'completed'
  GROUP BY student_id, teacher_id
) li_completed
  ON li_planned.student_id = li_completed.student_id
  AND li_planned.teacher_id = li_completed.teacher_id
JOIN profiles p ON p.user_id = li_planned.student_id
WHERE li_planned.first_planned_date <= li_completed.last_completed_date;
```

Bu, same-day çakışmayı DA, backward-start bug'ını DA yakalar.

---

## ⚠ Kritik Nokta 4: Repair yaklaşımı — doğru araç seçimi

Bu sorun template sync değil, **reset package başlangıç tarihi** problemi. Bu nedenle:

- `rpc_sync_student_schedule` kullanmak **doğru repair değil** — çünkü o mevcut cycle içinde template'e göre regenerate eder; cycle değiştirmez.
- Etkilenen öğrencilerde sorun **yeni cycle'ın planned instance'larının yanlış tarihlerden başlaması**.

**Doğru repair yaklaşımı:**

1. Etkilenen öğrenci/teacher/cycle üçlüsü için sadece `planned` instance'ları sil:
```sql
DELETE FROM lesson_instances
WHERE student_id = ? AND teacher_id = ? AND package_cycle = ? AND status = 'planned';
```

2. Düzeltilmiş `rpc_reset_package` mantığıyla (yani `GREATEST` formülüyle) aynı üretim algoritmasını kullanarak yeni planned instance'lar üret.

3. Bu repair sırasında:
   - `student_lesson_tracking.package_cycle` **değişmez** (zaten doğru cycle'da)
   - `balance_events` **etkilenmez** (completed lesson'lara dokunulmaz)
   - `teacher_balance` **etkilenmez** (sadece planned silinip yeniden üretiliyor)
   - `completed` instance'lar **korunur** (sadece planned silinir)

Pratik uygulama: RPC düzeltildikten sonra, etkilenen her öğrenci için yeni cycle'daki planned instance'ları silip, template slotlarını okuyup, doğru anchor'dan başlayarak yeniden üretmek yeterli. Bu, bir SQL script ile batch yapılabilir.

---

## Değişecek Dosyalar

| Dosya | Değişiklik |
|-------|-----------|
| Migration SQL | `rpc_reset_package` — `v_start_date` hesabını `GREATEST(CURRENT_DATE, last_completed_date + 1)` ile değiştir |
| Migration SQL (aynı) | `rpc_restore_student` — aynı bug mevcut, aynı fix uygulanacak |
| Data repair (script) | Audit'ten çıkan öğrenciler için planned instance delete + regenerate |

**Not**: `rpc_restore_student` da aynı `v_start_date := CURRENT_DATE` pattern'ini kullanıyor. Aynı fix uygulanmalı.

---

## Uygulama Sırası

| Sıra | Adım | Risk |
|------|------|------|
| 1 | `rpc_reset_package` ve `rpc_restore_student` — anchor fix | Sıfır |
| 2 | Sistem geneli audit sorgusu çalıştır | Sıfır |
| 3 | Dry-run: etkilenen öğrenci sayısı ve instance sayısı raporla | Sıfır |
| 4 | Repair: etkilenen planned instance'ları sil + doğru anchor'dan regenerate | Düşük |
| 5 | Doğrulama: audit sorgusunu tekrar çalıştır → sonuç boş olmalı | Sıfır |

---

## Başlangıç Tarihi Kuralı (Kesin Tanım)

**Kural**: Reset package veya restore student sonrası yeni planned instance'ların başlangıç anchor'ı:

```
v_start_date = GREATEST(CURRENT_DATE, MAX(completed_lesson_date) + 1)
```

Sonra bu anchor'dan itibaren öğrencinin template schedule'ındaki ilk uygun slot günü seçilir.

**Bu kuralın 3 örneğe uygulanması:**

| Öğrenci | Son Completed | CURRENT_DATE | Anchor | İlk Uygun Slot |
|---------|--------------|--------------|--------|----------------|
| Emir (Sa/Pe) | 2026-03-24 | 2026-03-24 | 2026-03-25 | Perşembe 2026-03-26 ✓ |
| Yaren Eylül | 2026-03-28 | 2026-03-24 | 2026-03-29 | Template'e göre ilk slot ✓ |
| Sadullah | 2026-04-02 | 2026-03-24 | 2026-04-03 | Template'e göre ilk slot ✓ |

**Audit hangi öğrencileri yakalayacak**: İlk planned lesson tarihi ≤ son completed lesson tarihi olan tüm öğrenci/teacher çiftleri.

**Repair hangi öğrencilere uygulanacak**: Audit'ten çıkan her öğrenci — yeni cycle'daki planned instance'lar silinip doğru anchor'dan yeniden üretilecek. Balance, cycle ve completed history korunacak.

---

## Scope Kontrolü

- **Önceki plandan aynen korunan**: Kök neden analizi, etkilenen öğrenci listesi, dosya listesi, repair sonrası doğrulama adımı
- **Bu güncellemede güçlendirilen**:
  - Başlangıç tarihi kuralı `CURRENT_DATE + today-check` → `GREATEST(CURRENT_DATE, last_completed + 1)` olarak genişletildi
  - Sadullah örneği neden ek kontrol gerektiriyor açıkça belirtildi
  - Audit kapsamı same-day'den general overlap/backward-start'a genişletildi
  - Repair yaklaşımı `rpc_sync_student_schedule` yerine doğrudan planned delete + regenerate olarak düzeltildi
  - `rpc_restore_student`'ın da aynı bug'a sahip olduğu eklendi

