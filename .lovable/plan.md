
# Deneme Dersleri Hafta Filtreleme Duzeltmesi

## Tespit Edilen Sorunlar

1. **Gelecek haftanin deneme dersleri su an gorunuyor**: `getTrialLessonForDayAndTime` fonksiyonu sadece `day_of_week` ve `start_time` ile eslesiyor, `lesson_date`'i kontrol etmiyor. Yani gelecek Pazartesi'ye eklenen bir deneme dersi bu hafta da gorunuyor.

2. **Gecmis haftanin dersleri hafta bitene kadar gorunuyor**: Cron fonksiyonu `lesson_date < today` ile siliyor (yani ertesi gun). Ama hafta icerisinde gecmis gunlerin dersleri hala gorunuyor — bu dogru davranis. Asil sorun: hafta bittikten sonra cron zaten siliyor, ama goruntuleme zaten hafta bazli filtrelenmeli.

## Cozum

Her iki schedule component'inde (`AdminWeeklySchedule.tsx` ve `WeeklyScheduleDialog.tsx`) deneme derslerini sadece **icinde bulunulan haftaya ait olanlari** gosterecek sekilde filtrelemek.

### Degisiklik 1: `TrialLesson` interface'ine `lesson_date` ekle

Her iki dosyada da `TrialLesson` interface'ine `lesson_date: string` alani eklenir.

### Degisiklik 2: Fetch sorgularinda `lesson_date`'i dahil et

`select("*")` veya `select("id, day_of_week, ...")` sorgularina `lesson_date` eklenir (AdminWeeklySchedule zaten `select("*")` kullaniyor).

### Degisiklik 3: `getTrialLessonForDayAndTime` fonksiyonuna hafta filtresi ekle

Mevcut hafta baslangicinı (Pazartesi) ve bitisini (Pazar) hesapla. Trial lesson'in `lesson_date`'inin bu aralikta olup olmadigini kontrol et:

```typescript
const getTrialLessonForDayAndTime = (dayIndex: number, timeSlot: string) => {
  const dbDayOfWeek = dayIndex === 6 ? 0 : dayIndex + 1;
  const dateForDay = getDateForDayIndex(dayIndex);
  const dateStr = format(dateForDay, "yyyy-MM-dd");
  
  return trialLessons.find(
    (l) => l.day_of_week === dbDayOfWeek 
        && l.start_time === timeSlot 
        && l.lesson_date === dateStr
  );
};
```

Bu sayede:
- Deneme dersi sadece `lesson_date`'inin dustugu haftada gorunur
- Gelecek haftaya eklenen ders bu hafta gorunmez
- Gecmis haftanin dersi (cron henuz silmediyse bile) bu hafta gorunmez

### Degisiklik 4: Cleanup cron — mevcut hali yeterli

Cron fonksiyonu `lesson_date < today` ile siliyor. Bu dogru calisıyor: dersin gunu gectikten sonra ertesi gun silinir. Frontend zaten hafta bazli filtrelediginden, haftanin bitmesini beklemeye gerek yok — cron daha erken temizliyor, frontend de zaten dogru haftayi gosteriyor.

## Degistirilecek Dosyalar

| Dosya | Degisiklik |
|---|---|
| `src/components/AdminWeeklySchedule.tsx` | TrialLesson interface'ine `lesson_date` ekle, `getTrialLessonForDayAndTime`'a tarih filtresi ekle |
| `src/components/WeeklyScheduleDialog.tsx` | Ayni degisiklikler (ogretmen paneli) |

## Bakiye Etkisi

Bakiyede hicbir degisiklik olmayacak. Bu degisiklik sadece goruntulemeyi etkiler — deneme dersi veritabanindan silindiginde veya "islendi" olarak isaretlendiginde bakiye zaten ayri yonetiliyor.
