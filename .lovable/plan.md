

# Kök Neden Analizi: Restore Sırasında Duplicate Key Hatası

## Kök Neden

`rpc_restore_student` RPC'si `lesson_number` başlangıç değerini `COUNT(completed)` ile hesaplıyor (satır: `v_lesson_num := v_completed_count`). Sonra döngüde `v_lesson_num := v_lesson_num + 1` ile ardışık numara veriyor.

**Problem:** Bu mantık, completed instance'ların lesson_number'larının tam olarak `1, 2, 3, ..., N` sıralı olduğunu varsayıyor. Ancak:

- `resequenceLessonNumbers` (arrow shift/realign sonrası çalışan client-side fonksiyon) tüm instance'ları tarih sırasına göre yeniden numaralandırıyor
- Manuel tarih değişiklikleri, ertelemeler ve zincir kaydırmaları lesson_number'ları değiştirebiliyor
- Sonuç: completed instance'larda lesson_number boşluk veya atlama olabiliyor

**Somut örnek (hata logu):**
- student_id: `9e0650ce...`, teacher_id: `a012bfff...`, cycle: 1
- Mevcut completed instance'lardan biri `lesson_number = 6`'ya sahip
- `v_completed_count` diyelim 5 döndü (belki bir completed farklı cycle'da veya count yanlış hesaplandı)
- RPC `lesson_number = 6` ile INSERT denedi → unique constraint ihlali

## Etkilenen Dosya

`rpc_restore_student` — PL/pgSQL fonksiyonu (veritabanı)

Aynı pattern `rpc_sync_student_schedule` ve `rpc_reset_package`'de de var ama oralarda çakışma riski daha düşük çünkü planned'lar silinip yeniden üretiliyor. Restore'da ise completed'lar yerinde kalıyor ve çakışma gerçekleşiyor.

## Düzeltme

`v_lesson_num := v_completed_count` yerine `v_lesson_num := MAX(lesson_number)` kullanılmalı:

```sql
-- Mevcut (hatalı):
v_lesson_num := v_completed_count;

-- Düzeltme:
SELECT COALESCE(MAX(lesson_number), 0) INTO v_lesson_num
FROM lesson_instances
WHERE student_id = p_student_user_id
  AND teacher_id = p_teacher_user_id
  AND package_cycle = v_current_cycle;
```

Bu sayede yeni eklenen instance'lar mevcut en yüksek lesson_number'dan sonra başlar — completed'ların hangi numaralara sahip olduğu fark etmez.

## Aynı pattern'i taşıyan diğer RPC'ler

- `rpc_sync_student_schedule`: Aynı `v_completed_count` tabanlı lesson_number başlatma mantığı var. Ancak orada planned'lar önceden silindiği için çakışma riski düşük. Yine de güvenlik için aynı MAX fix uygulanmalı.
- `rpc_reset_package`: Yeni cycle'a geçtiği için lesson_number 0'dan başlıyor — bu güvenli.

## Mevcut hatalı kayıtlar için repair

Restore zaten başarısız oldu (hata döndü), yani bozuk kayıt eklenmedi. Sadece `is_archived = false` güncellemesi yapılmış olabilir (RPC'nin ilk satırı). Kontrol edilmeli:
- Eğer öğrenci `is_archived = false` oldu ama planned instance'ları oluşturulamadıysa, öğrenci "aktif ama derssiz" durumda kalır
- Fix sonrası restore tekrar çağrılabilir

## Uygulama

1. Tek SQL migration: `rpc_restore_student` fonksiyonunda `v_lesson_num := v_completed_count` → `SELECT COALESCE(MAX(lesson_number), 0) INTO v_lesson_num FROM lesson_instances WHERE ...`
2. Güvenlik için `rpc_sync_student_schedule`'da da aynı fix
3. Client-side değişiklik yok

## Risk
Düşük. `MAX(lesson_number)` her zaman `COUNT(*)` değerine eşit veya büyük. Yeni lesson_number'lar en yüksek mevcut numaradan sonra başlar — duplicate imkansız hale gelir. Completed, balance ve geçmiş kayıtlara dokunulmaz.

