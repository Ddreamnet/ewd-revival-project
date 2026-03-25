

# Plan: Saat Seçimini Select Dropdown'a Çevir

## Sorun
Native `<Input type="time">` kullanılıyor. Tarayıcının kendi time picker popup'ı açılıyor — bu CSS ile stillenemez çünkü tarayıcı/OS tarafından render ediliyor.

## Çözüm
Saat input'larını, gün seçicisiyle aynı `<Select>` dropdown bileşeniyle değiştir. 08:00–22:00 arası 5 dakika aralıklarla seçenek oluştur. Böylece açılan liste sitenin kendi tema renklerini ve stilini kullanır.

## Değişiklikler

### `src/components/EditStudentDialog.tsx`
- Dosya başına `timeOptions` dizisi ekle (08:00–22:00, 5dk aralık)
- Satır 115-120 ve 124-129'daki `<Input type="time">` → `<Select>` ile değiştir
- Gün seçicisiyle birebir aynı görünüm

### `src/components/AddStudentDialog.tsx`
- Aynı değişiklik tutarlılık için buraya da uygulanacak

## Örnek
```tsx
<Select value={lesson.startTime} onValueChange={(v) => updateLesson(index, "startTime", v)}>
  <SelectTrigger><SelectValue placeholder="Seçin" /></SelectTrigger>
  <SelectContent className="max-h-60">
    {timeOptions.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
  </SelectContent>
</Select>
```

