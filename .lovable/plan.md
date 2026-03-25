

# Kök Neden Analizi: Same-Day Multi-Slot Ders Zinciri Bozulması

## Özet

4 birbirine bağlı kök neden tespit edildi. Hepsi aynı gün birden fazla slotu olan öğrencileri etkiliyor. Sorun Koray'a özel değil — sistem genelinde aynı pattern'e sahip tüm öğrencilerde var.

---

## Kök Neden 1 (Kritik): `confirmDateUpdate` — Tarih günceller ama saat güncellemez

**Dosya:** `src/hooks/useEditStudentDialog.ts` satır 264-303

Admin "ilk dersi 24.03 seç + kalan günleri güncelle" dediğinde:

1. `batchUpdateInstances` sadece `lesson_date` günceller, `start_time`/`end_time`'a dokunmaz
2. Ders 1 (aslında Perşembe 17:30 slotundan gelmiş) → tarih 24.03 Salı olur ama saat 17:30 kalır
3. `afterTime = "17:30"` olarak hesaplanır
4. `generateFutureInstanceDates` Salı slotlarını kontrol eder: 16:40 ≤ 17:30 → atla, 17:20 ≤ 17:30 → atla
5. Sonuç: Salı'nın her iki slotu da atlanır, sonraki Perşembe'ye geçilir

**Neden duplicate ve yanlış saat oluşuyor:** Ders 1'in saati 17:30 (Perşembe'den kalan), Salı slotlarıyla eşleşmiyor. Kalan dersler yanlış anchor'dan üretilince sıra kayıyor.

## Kök Neden 2 (Kritik): RPC fonksiyonları slotları sıralamıyor

**Dosya:** DB fonksiyonları `rpc_reset_package`, `rpc_sync_student_schedule`, `rpc_restore_student`

Her üç RPC'de aynı pattern:
```sql
FOR v_slot IN SELECT * FROM jsonb_array_elements(p_template_slots) LOOP
```

Bu, slotları client'tan gelen sırada işler. Eğer UI'da slotlar [Salı 17:20, Salı 16:40, Perşembe 17:30] sırasında gelirse:
- Salı'da: ders 1 = 17:20, ders 2 = 16:40 → **kronolojik sıra bozuk**
- lesson_number ataması yanlış

Client-side `generateFutureInstanceDates` slotları sıralar ama RPC'ler sıralamaz → tutarsızlık.

## Kök Neden 3 (Kritik): Tüm RPC'lerde `+1 gün` anchor hatası

**Dosya:** `rpc_reset_package`, `rpc_sync_student_schedule`, `rpc_restore_student`

Her üçünde:
```sql
v_start_date := last_completed_date + 1;
-- veya
v_start_date := GREATEST(CURRENT_DATE, v_last_completed_date + 1);
```

Koray örneği: Son tamamlanan ders = 24.03 Salı 16:40 ise:
- `start_date` = 25.03 Çarşamba
- Salı 17:20 slotu (aynı gün, sonraki slot) tamamen atlanır
- Sonraki uygun gün = 26.03 Perşembe 17:30

Bu, aynı gün ikinci slotu olan HER öğrenciyi etkiler.

## Kök Neden 4: `syncTemplateChange` aynı `+1 gün` hatası

**Dosya:** `src/lib/instanceGeneration.ts` satır 120-125

Aynı `addDays(lastDate, 1)` pattern'i. Ancak bu fonksiyon şu an aktif olarak çağrılmıyor (dead code) — `handleSubmit` artık `rpc_sync_student_schedule` RPC'sini kullanıyor.

---

## Zincir Mantığı Analizi

Sorularınıza yanıtlar:

**Zincir mantığı date+time bazlı mı?**
Hayır. Sadece tarih bazlı. `+1 gün` anchor'ı saati hiç dikkate almıyor. RPC'ler slotları sıralamıyor.

**`student + date` tekil varsayım var mı?**
Doğrudan tekil varsayım yok, ama `+1 gün` mantığı fiilen aynı gün birden fazla slot olamayacağını varsayıyor.

**Template ile instances arasında kopukluk var mı?**
Evet. `batchUpdateInstances` sadece tarih günceller, saat template'e göre yeniden eşleştirilmez. Instance farklı bir günün saatini taşımaya devam eder.

---

## Etki Analizi

Bu sorun Koray'a özel değildir. Aynı gün birden fazla dersi olan TÜM öğrencileri etkiler:
- Paket sıfırlama sonrası son tamamlanan ders aynı gün ilk slotsa → ikinci slot kaybolur
- "Kalan günleri güncelle" sonrası farklı gün saati ile afterTime hesaplanır → slotlar atlanır
- Schedule sync sonrası → aynı +1 gün problemi
- Öğrenci restore sonrası → aynı +1 gün problemi

---

## Düzeltme Planı

### Fix 1: RPC'lerde slot sıralaması (3 RPC)
`rpc_reset_package`, `rpc_sync_student_schedule`, `rpc_restore_student` içinde slot iterasyonuna `ORDER BY` ekle:

```sql
FOR v_slot IN
  SELECT * FROM jsonb_array_elements(p_template_slots) AS s
  ORDER BY (s->>'dayOfWeek')::integer, (s->>'startTime')
LOOP
```

### Fix 2: RPC'lerde `+1 gün` → `afterTime` mantığına geçiş (3 RPC)
Son tamamlanan dersin tarihini ve saatini birlikte al. Aynı gün sonraki slotları atlamamak için:

```sql
-- Mevcut (hatalı):
v_start_date := last_completed_date + 1;

-- Düzeltme:
-- Son tamamlanan dersin tarihinde kal, ama start_time'ından sonraki slotları al
-- Eğer o gün kalan slot yoksa, sonraki güne geç
```

Bu, `generateFutureInstanceDates`'teki `afterTime` pattern'inin SQL karşılığıdır. RPC loop'unda her gün her slot için "bu slot zaten doldurulmuş mu" kontrolü eklenir.

### Fix 3: `confirmDateUpdate` — tarih değiştiğinde saati de template'e eşle
`batchUpdateInstances` içinde, instance yeni bir güne taşındığında o günün template slotuna göre `start_time`/`end_time` de güncellenmeli. Alternatif olarak, `afterTime` hesaplanırken instance'ın kendi saati yerine o gün için uygun template slot saati kullanılmalı.

### Fix 4: `syncTemplateChange` dead code temizliği
Artık kullanılmayan fonksiyon kaldırılabilir veya en azından aynı fix uygulanabilir.

### Dosyalar
1. **3 SQL migration** — `rpc_reset_package`, `rpc_sync_student_schedule`, `rpc_restore_student` güncelleme
2. **`src/hooks/useEditStudentDialog.ts`** — `batchUpdateInstances` ve `confirmDateUpdate` düzeltme
3. **`src/lib/instanceGeneration.ts`** — `syncTemplateChange` düzeltme veya kaldırma

### Risk
Orta. RPC değişiklikleri tüm paket sıfırlama, schedule sync, ve restore akışlarını etkiler. Ancak fix mantığı basit (sıralama + afterTime) ve client-side'da zaten test edilmiş pattern.

