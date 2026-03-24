

# Plan: EditStudentDialog Schedule Değişikliği — Görsel Programa Yansımıyor

## Kök Neden

`AdminWeeklySchedule` bileşeninin `useEffect` dependency'leri şunlar:

```text
useEffect → [teacherId]           // satır 93 — ilk yükleme
useEffect → [showTemplate, weekOffset]  // satır 95-101 — mod/hafta değişimi
useEffect → realtime trial_lessons      // satır 103-114 — trial değişiklikleri
```

`EditStudentDialog.handleSubmit` şu sırayla çalışıyor:
1. `student_lessons` template güncelle ✓
2. `syncTemplateChange` → planned `lesson_instances` güncelle ✓
3. `clearWeekCache()` → in-memory cache temizle ✓
4. `onStudentUpdated()` → `fetchTeachers()` çağır ✓
5. Dialog kapat ✓

**Sorun:** `fetchTeachers()` öğretmen/öğrenci listesini yeniler ama `teacherId` değişmez (aynı öğretmen seçili). `AdminWeeklySchedule`'ın hiçbir `useEffect` dependency'si tetiklenmez. Cache temizlenmiş olsa bile `fetchSchedule()` ve `fetchActualSchedule()` hiç çağrılmaz.

Sonuç: Grid eski state'i göstermeye devam eder.

"İşlenen Dersler" listesi (dialog içi) ise `instances` state'ini okur — `handleSubmit` sonrasında `fetchInstances()` çağrılmaz çünkü dialog kapanır. Kullanıcı dialogu tekrar açtığında `initializeDialog` çalışır ve DB'den taze veri gelir. Bu kısım sorunsuz çalışır.

Asıl sorun **görsel ders programı grid'inin yeniden fetch yapmaması**.

## Çözüm

`AdminDashboard`'a bir `scheduleRefreshKey` counter state'i ekle. `fetchTeachers` her çağrıldığında bu counter artırılsın. Bu counter `AdminWeeklySchedule`'a prop olarak geçsin. `AdminWeeklySchedule` bu prop'u `useEffect` dependency'lerine eklesin.

### Değişecek Dosyalar

| Dosya | Değişiklik |
|-------|-----------|
| `src/components/AdminDashboard.tsx` | `scheduleRefreshKey` state ekle, `fetchTeachers` içinde artır, `AdminWeeklySchedule`'a prop olarak geç |
| `src/components/AdminWeeklySchedule.tsx` | `refreshKey` prop kabul et, ilk `useEffect` dependency'sine ekle |

### Detay

**AdminDashboard.tsx:**
```typescript
const [scheduleRefreshKey, setScheduleRefreshKey] = useState(0);

const fetchTeachers = async () => {
  // ...existing fetch logic...
  setScheduleRefreshKey(prev => prev + 1);
};

// JSX:
<AdminWeeklySchedule teacherId={selectedTeacher.user_id} refreshKey={scheduleRefreshKey} />
```

**AdminWeeklySchedule.tsx:**
```typescript
// Props'a ekle:
interface Props { teacherId: string; refreshKey?: number; }

// İlk useEffect dependency'sine ekle:
useEffect(() => {
  if (!showTemplate) {
    Promise.all([fetchSchedule(), fetchActualSchedule()]).then(() => { ... });
  } else {
    fetchSchedule();
  }
}, [teacherId, refreshKey]);  // <-- refreshKey eklendi
```

## Risk

Sıfır risk. `refreshKey` sadece re-fetch tetikler. `clearWeekCache()` zaten çağrılıyor, şimdi refetch de tetiklenmiş olacak.

