

# "Sonraki Derse Aktar" Geri Al — Zincir Geri Alma Düzeltmesi

## Kök Neden

**Shift (ileri kaydırma)** batch bir işlem: `shiftLessonsForward()` hedef instance'dan itibaren TÜM planned instance'ları bir slot ileri kaydırıyor. Her birine `original_date/time` kaydediyor.

**Revert (geri alma)** tekil bir işlem: `handleRevert()` in `LessonOverrideDialog.tsx` yalnızca tıklanan TEK instance'ı `original_date`'ine geri döndürüyor. Aynı batch'te kaymış diğer instance'lara dokunmuyor.

Sorun: shift sırasında hangi instance'ların birlikte kaydırıldığını gösteren hiçbir bağ/grup bilgisi saklanmıyor. Bu yüzden revert hangi instance'ları birlikte geri alması gerektiğini bilemiyor.

## Eski Davranış
- Shift: 5 ders birlikte kayıyor
- Geri Al: sadece tıklanan 1 ders eski yerine dönüyor, diğer 4 kaymış kalıyor

## Yeni Davranış
- Shift: 5 ders birlikte kayıyor, hepsi aynı grup ID'si ile işaretleniyor
- Geri Al: tıklanan dersin grup ID'sine bakılıyor, aynı gruptaki tüm dersler birlikte eski yerlerine dönüyor

## Çözüm

### 1. Yeni kolon: `shift_group_id` (migration)
`lesson_instances` tablosuna nullable `uuid` kolon eklenir. Yalnızca batch shift işlemlerinde set edilir. Manuel tekil reschedule'larda null kalır.

### 2. `src/lib/instanceGeneration.ts` — `shiftLessonsForward()`
Shift sırasında bir UUID üretilir, kaydırılan tüm instance'lara `shift_group_id` olarak yazılır.

### 3. `src/components/LessonOverrideDialog.tsx` — `handleRevert()`
Revert sırasında:
- Tıklanan instance'ın `shift_group_id`'si kontrol edilir
- Eğer varsa, aynı `shift_group_id`'ye sahip TÜM instance'lar bulunur
- Her biri `original_date/time`'ına geri döndürülür ve `shift_group_id` null yapılır
- Eğer `shift_group_id` yoksa (tekil reschedule), mevcut davranış korunur

### 4. UI değişikliği: YOK
Tüm değişiklik veri modeli ve action mantığında. Ekranlara yeni buton, badge, kart düzeni eklenmeyecek.

## Değişecek dosyalar

| Dosya | Değişiklik |
|-------|-----------|
| Migration SQL | `lesson_instances` tablosuna `shift_group_id uuid` kolon |
| `src/lib/instanceGeneration.ts` | `shiftLessonsForward` içinde UUID üretip tüm shifted instance'lara yazma |
| `src/components/LessonOverrideDialog.tsx` | `handleRevert` içinde `shift_group_id` varsa grup olarak geri alma |

## Güvenlik / Yan Etki

- Tekil reschedule (LessonOverrideDialog'dan tarih/saat değiştirme) etkilenmez — `shift_group_id` null kalır, mevcut davranış devam eder
- Mevcut verideki eski shifted instance'ların `shift_group_id`'si null olduğu için tekil geri alma davranışı korunur (geriye dönük uyumlu)
- Paket/bakiye/döngü mantığı etkilenmez — revert yalnızca tarih/saat restore eder
- Completed instance'lar shift'e dahil olmadığı için revert'te de dahil olmaz

## Test Senaryoları

1. **Zincir shift + zincir geri al**: Öğrencinin 4 planned dersi var → ilkine "Sonraki Derse Aktar" → 4'ü de kayar → birine tıklayıp "Geri Al" → 4'ü de eski yerine döner
2. **Tekil reschedule + tekil geri al**: Bir dersi manuel olarak başka tarihe taşı → "Geri Al" → sadece o ders döner (mevcut davranış korunur)
3. **Eski veri uyumluluğu**: `shift_group_id` null olan eski shifted dersler → tekil geri alma davranışı korunur
4. **Admin panelinden işlem**: Ders programında shift + revert → UI değişmez, davranış doğru
5. **Öğretmen panelinde görünüm**: İşlenen dersler alanı aynen kalır
6. **Öğrenci panelinde görünüm**: Ders kutuları aynen kalır
7. **Conflict kontrolü**: Grup geri alınırken orijinal slotlarda başka öğrencinin dersi varsa conflict hata verir

