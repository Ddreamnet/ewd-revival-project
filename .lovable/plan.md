

# Fix: Sıfırla Sonrası Ders Tarihlerinin Görünmeye Devam Etmesi

## Problem

"Sıfırla" butonuna basıldığında:
- `lesson_dates` tracking tablosunda `{}` olarak temizleniyor (dogru)
- `completed_lessons` temizleniyor (dogru)
- Ama yeni `lesson_instances` gercek tarihlerle olusturuluyor (zorunlu -- `lesson_date` kolonu NOT NULL)
- UI `sortedLessonsForDisplay` instance'lardan tarihleri okuyor, bu yuzden tarihler hala gorunuyor

## Cozum

### Yaklasim: `lesson_dates` bos oldugunda tarihleri gizle

`lesson_dates = {}` durumu "tarihler henuz atanmadi" anlamina gelir. Bu durumu UI'da kullanarak, instance'lardaki placeholder tarihleri gizleyebiliriz.

### Degisiklik 1: `EditStudentDialog.tsx` -- `sortedLessonsForDisplay`

`sortedLessonsForDisplay` hesaplanirken, `lessonDates` bos ise (`Object.keys(lessonDates).length === 0`), instance'lardan gelen tarihleri gosterme -- bos satir olarak goster:

```text
// Eger lesson_dates bos ise (sifirlanmis durum), 
// instance'lar varsa bile tarihleri bos goster
const datesUnassigned = Object.keys(lessonDates).length === 0;

if (instances.length > 0) {
  const sorted = [...instances].sort(...);
  const capped = sorted.slice(0, totalLessons);
  
  const result = capped.map((inst, idx) => ({
    displayIndex: idx + 1,
    lessonNumber: inst.lesson_number,
    effectiveDate: datesUnassigned ? "" : inst.lesson_date,  // <-- key change
    startTime: inst.start_time,
    endTime: inst.end_time,
    isCompleted: inst.status === "completed",
    ...
  }));
}
```

Bu sekilde:
- Sifirlamadan sonra "Islenen Dersler" listesinde tum tarihler bos gorunur
- Ogretmen ilk dersi isaretlediginde `lesson_dates` dolar, tarihler tekrar gorunur
- Instance'lardaki placeholder tarihler haftalik grid icin korunur (programin bozulmamasi icin)

### Haftalik Ders Programina Etkisi

Bu degisiklik haftalik ders programini **etkilemez** cunku:
- Haftalik grid `lesson_instances` tablosundaki `lesson_date` degerlerini dogrudan okur
- `sortedLessonsForDisplay` sadece EditStudentDialog icindeki "Islenen Dersler" listesini etkiler
- Instance'lardaki tarihler degismiyor, sadece UI'da gizleniyor

### Dosya Degisiklikleri

| Dosya | Degisiklik |
|---|---|
| `src/components/EditStudentDialog.tsx` | `sortedLessonsForDisplay` icinde `datesUnassigned` kontrolu ekle, bos ise `effectiveDate: ""` yap |

Tek dosyada tek satirlik bir degisiklik. Mevcut reset ve first-mark-sync mantigi zaten dogru calisiyor.
