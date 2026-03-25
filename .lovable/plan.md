

# Plan: Saat Seçimi İçin Select Dropdown Tasarımı

## Sorun
Ders programındaki "Başlangıç" ve "Bitiş" saat alanları native `<Input type="time">` kullanıyor. Bu, gün seçicideki styled `<Select>` dropdown'dan görsel olarak farklı duruyor.

## Çözüm
Native time input'ları `<Select>` dropdown'larla değiştir. 08:00–22:00 arası 15 dakika aralıklarla saat seçenekleri oluştur. Gün seçicisiyle aynı `Select/SelectTrigger/SelectContent/SelectItem` bileşenlerini kullan.

## Teknik Detay

### `src/components/EditStudentDialog.tsx`
1. Dosyanın üstüne saat seçenekleri dizisi ekle:
   ```typescript
   const timeOptions: string[] = [];
   for (let h = 8; h <= 22; h++) {
     for (let m = 0; m < 60; m += 15) {
       timeOptions.push(`${h.toString().padStart(2,"0")}:${m.toString().padStart(2,"0")}`);
     }
   }
   ```

2. Başlangıç ve Bitiş `<Input type="time">` → `<Select>` ile değiştir (satır 113-130):
   ```tsx
   <Select value={lesson.startTime} onValueChange={(v) => updateLesson(index, "startTime", v)}>
     <SelectTrigger><SelectValue placeholder="Seçin" /></SelectTrigger>
     <SelectContent>
       {timeOptions.map((t) => (
         <SelectItem key={t} value={t}>{t}</SelectItem>
       ))}
     </SelectContent>
   </Select>
   ```
   Aynısı `endTime` için de.

### Aynı değişiklik `AddStudentDialog.tsx`'e de uygulanacak
Tutarlılık için oradaki time input'lar da aynı Select'e dönüştürülecek.

## Dosyalar
- `src/components/EditStudentDialog.tsx` — 2 time input → Select
- `src/components/AddStudentDialog.tsx` — 2 time input → Select

