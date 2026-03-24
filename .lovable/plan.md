

# Plan: Ghost Warning Icon Bug — Masal 05.04 Görünmüyor

## Kök Neden

`useScheduleGrid.ts` satır 347-349'daki ghost mantığı **ikili (binary)**: Bir öğrencinin o hafta HERHANGİ BİR instance'ı varsa, ghost üretilmez.

Masal'ın durumu:
- Son 3 planned ders: 28.03 (Cumartesi), 29.03 (Pazar), 04.04 (Cumartesi)
- 05.04 (Pazar) için instance yok — paketi bitmiş olacak
- Hafta aralığı: 30.03 Pazartesi → 05.04 Pazar
- 04.04 Cumartesi bu haftada → Masal `studentsWithInstances`'a dahil → ghost atlanıyor

Sonuç: 05.04 Pazar'da uyarı ikonu görünmüyor.

## Sorun Türü

Veri seviyesinde değil, **derived mantık** (ghost üretimi) problemi. DB verileri doğru.

## Düzeltme

`useScheduleGrid.ts` — ghost üretim mantığını "hafta bazında instance var mı" yerine **"gün bazında template slot'u var ama instance yok mu"** kontrolüne çevir.

Mevcut mantık:
```
studentsWithoutInstances = aktif öğrenciler - bu hafta instance'ı olanlar
→ sadece bu listedekiler için ghost üret
```

Doğru mantık:
```
Her aktif öğrencinin bu haftadaki her template slot'u için:
  - O gün/saat'te zaten bir instance (planned/completed) varsa → skip
  - Yoksa VE öğrencinin paketi bitmişse → ghost üret
```

Somut değişiklik:
1. `studentsWithoutInstances` filtresini kaldır
2. Tüm aktif öğrencilerin template'lerini çek
3. Her template slot için o hafta o gün/saat'te instance olup olmadığını kontrol et
4. Instance yoksa VE cycle exhausted ise → ghost entry üret

**Dosya**: `src/hooks/useScheduleGrid.ts` satır 346-428

## Etki

- Masal: 04.04'te normal planned ders görünür, 05.04'te ghost uyarı ikonu görünür
- Tüm Cumartesi/Pazar veya hafta sonu bölünmüş öğrenciler için aynı fix geçerli
- Paketi bitmemiş öğrenciler etkilenmez (exhaustion check korunuyor)

## Risk

Düşük. Ghost üretimi sadece görsel; tıklanamaz (`cursor-default`). Ek template + tracking sorgusu zaten mevcut batch pattern'e eklenir. Performans etkisi ihmal edilebilir.

## Teknik Detay

Değiştirilecek bölüm ~80 satır. Mantık:
1. Tüm aktif öğrencilerin template'lerini çek (mevcut sorgu genişletilir)
2. `filteredInstances`'tan bir `Set<string>` oluştur: `"studentId-dayOfWeek-startTime"` formatında
3. Her template slot için: bu haftada karşılık gelen gün/saat'te instance yoksa VE paketi exhausted ise → ghost ekle
4. Exhaustion kontrolü mevcut `cycleCountMap` mantığıyla aynı kalır

