
# Ders Tarihi Düzenleme — İki Kritik Bug Düzeltmesi

## Sorun 1: "Kalan Günleri Güncelle" Geriye Dönük Değişiklik Yapıyor

### Mevcut Hatalı Davranış
`recalculateRemainingDates` fonksiyonu (satır 183-228), değiştirilen dersin numarasından hem **öncesine** hem **sonrasına** doğru tüm tarihleri yeniden hesaplıyor. Bu nedenle admin, örneğin 5. dersin tarihini değiştirip "Kalan günleri güncelle" seçeneğini işaretlediğinde, 1-4. derslerin tarihleri de değişiyor.

### Düzeltme
Sadece ileri yönlü (fromLessonNumber + 1 ve üzeri) hesaplama yapılacak. Önceki dersler (`i < fromLessonNumber`) hiçbir koşulda değiştirilmeyecek.

Kaldırılacak blok (satır 191-207):
```
// Recalculate PREVIOUS lessons (going backwards)
let currentDate = parse(startDate, "yyyy-MM-dd", new Date());
...
for (let i = fromLessonNumber - 1; i >= 1; i--) {
  ...
}
```

Yeni davranış: Değiştirilen ders tarihini yaz, sadece sonrasındaki dersleri öğrencinin haftalık program günlerine göre ileri hesapla.

---

## Sorun 2: Tarih Girerken Beklenmedik Geçiş / Input Çakışması

### Mevcut Hatalı Davranış
Input'un `value` prop'u şöyle tanımlı (satır 936):
```tsx
value={lesson.effectiveDate || lessonDates[lesson.lessonNumber.toString()] || ""}
```

Sorun şu: `effectiveDate`, `lessonDates` state'inden değil, override verisiyle hesaplanan anlık değerden geliyor. Kullanıcı input'a yazmaya başladığında `updateLessonDate` çağrısı `lessonDates`'i güncelliyor ama bir sonraki render'da `effectiveDate` yine override'dan yeniden hesaplanıyor. Bu iki değer arasında çakışma oluşuyor ve kullanıcı yarım tarih yazarken input beklenmedik değerlere atlıyor.

### Düzeltme
Input'un `value` prop'u doğrudan `lessonDates[lesson.lessonNumber.toString()] || ""` olarak değiştirilecek — override görsel gösterimi için ayrı `Label` zaten mevcut. Bu sayede input her zaman state'i doğrudan gösterip güncelleyecek, override date'den bağımsız davranacak.

---

## Değiştirilecek Dosya

**`src/components/EditStudentDialog.tsx`** — 2 noktada değişiklik:

### Değişiklik 1: `recalculateRemainingDates` fonksiyonu (satır 183-228)
- Geriye dönük hesaplama bloğu tamamen kaldırılır
- Sadece ileri yönlü hesaplama bırakılır

### Değişiklik 2: Ders tarih input'unun `value` prop'u (satır 936)
- `lesson.effectiveDate || lessonDates[...]` yerine doğrudan `lessonDates[lesson.lessonNumber.toString()] || ""`

---

## Özet Tablo

| Sorun | Nerede | Düzeltme |
|---|---|---|
| Önceki derslerin tarihleri değişiyor | `recalculateRemainingDates` (183-228) | Geriye dönük döngü kaldırılır |
| Tarih yazarken input atlıyor | Input `value` prop (936) | `effectiveDate` yerine `lessonDates[key]` |

Etkilenen dosya sayısı: 1, toplam değişen satır: ~20
