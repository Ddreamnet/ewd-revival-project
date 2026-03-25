

# Plan: Same-Day Multi-Slot "Kalan Günleri Güncelle" Bug Fix

## Kök Neden

`confirmDateUpdate` satır 342-345:

```typescript
const startDate = new Date(lastChangedDate);
startDate.setDate(startDate.getDate() + 1);  // ← BUG
const futureDates = generateFutureInstanceDates(templateSlots, plannedAfterChanged.length, startDate);
```

Kullanıcı 1. dersi 10 Mart Salı olarak seçtiğinde:
- `lastChangedDate` = 10 Mart
- `startDate` = 10 Mart + 1 = **11 Mart (Çarşamba)**
- `generateFutureInstanceDates` 11 Mart'tan itibaren ilk Salı slotunu arar → **17 Mart Salı 17:20** bulur
- Sonuç: 2. ders (aynı gün 18:00 olması gereken) 17 Mart 17:20'ye atanır

Problem: `+1 gün` mantığı aynı gün ikinci slotu tamamen atlıyor. `generateFutureInstanceDates` zaten `afterTime` parametresiyle aynı gün filtreleme yapabiliyor — ama bu parametre burada hiç kullanılmıyor.

## Doğru Davranış

1. dersi 10 Mart Salı 17:20 olarak seçtiğimde:
- 2. ders: 10 Mart Salı 18:00 (aynı gün, ikinci slot)
- 3. ders: 17 Mart Salı 17:20 (sonraki hafta)
- 4. ders: 17 Mart Salı 18:00
- ... ve böyle devam

## Düzeltme

`confirmDateUpdate` içinde `startDate + 1` yerine, son değiştirilen instance'ın tarihini koruyup `afterTime` parametresiyle aynı gün kalan slotları yakalamalı:

```typescript
// Mevcut (hatalı):
const startDate = new Date(lastChangedDate);
startDate.setDate(startDate.getDate() + 1);
const futureDates = generateFutureInstanceDates(templateSlots, plannedAfterChanged.length, startDate);

// Düzeltme:
const startDate = new Date(lastChangedDate);
// Son değiştirilen instance'ın start_time'ını bul
const lastChangedInst = allSorted.find(
  inst => inst.id === instanceIdMap[lastChangedKey]
);
const afterTime = lastChangedInst?.start_time;
const futureDates = generateFutureInstanceDates(
  templateSlots,
  plannedAfterChanged.length,
  startDate,
  afterTime  // aynı gün bu saatten sonraki slotları yakala
);
```

`generateFutureInstanceDates` zaten `afterTime` desteğine sahip (satır 70-71):
```typescript
if (offset === 0 && afterTime && slot.startTime <= afterTime) continue;
```

Bu, aynı gündeki 17:20 slotunu atlar ama 18:00 slotunu yakalar — tam istenen davranış.

## Etki

- Koray (Sa 17:20 + Sa 18:00): Düzeltme sonrası aynı gün iki ders doğru sırayla üretilir
- Tüm same-day multi-slot öğrenciler aynı şekilde düzelir
- Tek slotlu öğrenciler etkilenmez (`afterTime` ile aynı gün tek slot zaten atlanır, sonraki haftaya geçer — mevcut davranışla aynı)

## Dosya

`src/hooks/useEditStudentDialog.ts` — satır 340-345 (3-4 satır değişiklik)

## Risk

Sıfır. `generateFutureInstanceDates` + `afterTime` zaten production'da `shiftLessonsForward` tarafından kullanılıyor ve test edilmiş.

