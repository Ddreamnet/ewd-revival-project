

# İşlenen Dersler Sadeleştirme

## Değişiklikler

### 1. `src/components/LessonTracker.tsx` (Öğretmen paneli)

**Kaldırılacaklar:**
- "Döngü X" badge metni (satır 205)
- "X/Y" sayaç metni (satır 203-206 arası tüm blok)
- Ayrı Undo butonu (satır 256-266)

**Yeni toggle davranışı:**
- `handleLessonClick` fonksiyonu güncellenir: tıklanan kutu `completed` ise undo onay dialogu açılır, `planned` ve `nextCompletable` ise complete onay dialogu açılır
- Completed kutular artık `disabled` olmaz, tıklanabilir olur (sadece `lastCompletedId` eşleşen kutu)
- Kutu stilleri: completed + undoable olan kutuda hover efekti eklenir

**Layout iyileştirmeleri:**
- Dış container'a `justify-center w-full` eklenir
- Kutuların `h-8 w-8` boyutu `h-9 w-9 sm:h-10 sm:w-10` olarak güncellenir
- Kutular arası gap `gap-1.5` → `gap-2 sm:gap-2.5` olur
- Container'a `mx-auto` eklenerek yatay ortalama sağlanır

### 2. `src/components/StudentLessonTracker.tsx` (Öğrenci paneli)

**Kaldırılacaklar:**
- "Döngü X" badge (satır 158-160)
- "X/Y" sayaç ve "İşlenen Dersler" metni (satır 150-163 arası sol bölüm), sadece `BookCheck` ikonu kalır veya o da kaldırılır
- `packageCycle` state ve `fetchPackageCycle` fonksiyonu (artık kullanılmıyor)

**Layout iyileştirmeleri:**
- Kutu boyutları `h-8 w-8` → `h-9 w-9 sm:h-10 sm:w-10`
- Gap `gap-1.5` → `gap-2 sm:gap-2.5`
- Card content'e `flex justify-center` eklenir
- Sol taraftaki ikon+sayaç alanı kaldırılınca kutular karta ortalanmış şekilde yerleşir

### 3. `src/components/StudentTopics.tsx`

- LessonTracker container'ına `w-full flex justify-center` eklenerek tablet/mobilde ortalanması sağlanır

## Dosya Özeti

| Dosya | Değişiklik |
|---|---|
| `LessonTracker.tsx` | Döngü/sayaç/undo butonu kaldır, toggle davranışı ekle, kutu boyutu ve spacing artır, ortalama |
| `StudentLessonTracker.tsx` | Döngü/sayaç kaldır, packageCycle state temizle, kutu boyutu ve spacing artır, ortalama |
| `StudentTopics.tsx` | LessonTracker wrapper'ına centering class ekle |

