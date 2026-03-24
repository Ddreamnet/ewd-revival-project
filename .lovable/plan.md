

# Performans Optimizasyonu Planı — Güncellenmiş (Değerlendirme Notları Ekli)

## Akış Bazlı Optimizasyonlar

### 1. Admin Dashboard — `fetchTeachers` N+1 → Batch (Öncelik: 1)
**Darboğaz**: Her öğretmen için ayrı 2 DB sorgusu. 5 öğretmen = 11 sıralı sorgu.
**Çözüm**: Tüm `students` + `student_lessons` verilerini 2 batch sorguda çek, JS'te grupla.
**Dosya**: `src/components/AdminDashboard.tsx`
**Kazanım**: Dashboard açılış %50-70 hızlanır
**Risk**: Düşük

> **⚠ Değerlendirme Notu — Veri boyutu / kapsam kontrolü**
> Tüm öğretmenlerin tüm öğrenci ve ders verilerini tek seferde çekmek şu an düşük öğretmen/öğrenci sayısında sorunsuz çalışır. Ancak uygulamadan önce şunlar doğrulanmalı:
> - Mevcut öğretmen/öğrenci sayısıyla response payload boyutu makul mü (~KB düzeyinde kalır mı)
> - Frontend grouping (reduce/map) maliyeti N sayısına göre ihmal edilebilir mi
> - `is_archived = false` filtresi batch sorgularda da uygulanıyor mu (gereksiz veri çekilmemeli)
> - Eğer ileride öğretmen sayısı önemli ölçüde artarsa, sadece seçili öğretmenin verilerini çekmek daha dengeli bir batch stratejisi olabilir — ama şu anki ölçekte full batch en hızlı yaklaşım.

---

### 2. LessonTracker — 3× Tekrarlayan `package_cycle` Fetch (Öncelik: 2)
**Darboğaz**: 3 ayrı fonksiyon aynı `package_cycle` değerini DB'den çekiyor (6 sorgu, 3'ü redundant).
**Çözüm**: `loadData`'da cycle'ı bir kez çek, diğer fonksiyonlara opsiyonel parametre olarak geç.
**Dosyalar**: `src/lib/lessonService.ts`, `src/components/LessonTracker.tsx`
**Kazanım**: %30-40 hızlanma
**Risk**: Sıfır — opsiyonel parametre, mevcut çağrılar bozulmaz

---

### 3. fetchSchedule Waterfall → Paralel (Öncelik: 3)
**Darboğaz**: 4 sıralı sorgu; `trial_lessons` bağımsız olduğu halde bekliyor.
**Çözüm**: Bağımsız sorguları paralelize et (2 adımlık pipeline).
**Dosya**: `src/components/AdminWeeklySchedule.tsx`
**Kazanım**: Template mode %30 hızlanır
**Risk**: Sıfır

---

### 4. scheduleRefreshKey — İlk Yüklemede Çift Fetch (Öncelik: 4)
**Darboğaz**: `fetchTeachers` her çağrıldığında key artıyor → ilk yüklemede gereksiz ikinci fetch.
**Çözüm**: Key'i `fetchTeachers` içinde değil, sadece mutation callback'lerinde artır.
**Dosya**: `src/components/AdminDashboard.tsx`
**Kazanım**: İlk yüklemede 1 gereksiz schedule fetch önlenir
**Risk**: Sıfır

> **⚠ Değerlendirme Notu — Hedefli refresh alternatifi**
> Mevcut `scheduleRefreshKey` yaklaşımı basit ve güvenli. Alternatif olarak, her `fetchTeachers` yerine sadece schedule'ı etkileyen mutation'lardan sonra (EditStudentDialog submit, archive, delete, override) hedefli refresh tetiklemek daha cerrahi bir çözüm olabilir. Bu durumda `onStudentUpdated` callback'ine ikinci bir `onScheduleChanged` callback eklenir ve sadece o tetiklendiğinde key artar.
> Ancak mevcut çözüm daha az hata riski taşıyor — yeni bir mutation eklendiğinde `onScheduleChanged`'ı çağırmayı unutma riski var. Şu anki planı korumak daha güvenli; bu alternatif sadece ileride refine edilecek bir opsiyon olarak not düşülmüştür.

---

### 5. Dersi İşlendi Yapma — Optimistic Update (Öncelik: 5)
**Darboğaz**: RPC başarılı döndükten sonra 4-5 DB sorgusuyla tam refetch.
**Çözüm**: RPC başarılı dönünce local state güncelle, DB refetch atla.
**Dosyalar**: `src/components/LessonTracker.tsx`, `src/hooks/useEditStudentDialog.ts`
**Kazanım**: Complete/undo anında yansır (0ms vs ~500ms)
**Risk**: Düşük

> **⚠ Değerlendirme Notu — Derived state tutarlılığı**
> Optimistic update sadece `instances` array'ini güncellemekle yetinmemeli. Aşağıdaki derived state'ler de senkron ve güvenli şekilde güncellenebiliyorsa uygulanmalı:
> - `nextCompletableId` — sıradaki planned instance'a kaydırılmalı
> - `lastCompletedId` — yeni completed instance'a set edilmeli
> - `completedCount` / `totalLessons` gibi summary state'ler varsa bunlar da güncellenmeli
> - Balance (teacher_balance) — bu RPC tarafında DB trigger ile güncelleniyor, client tarafında dokunulamaz. Optimistic update balance UI'ını kapsamayacak; balance ayrı fetch ile güncel kalacak.
> - Eğer herhangi bir derived state güvenli şekilde senkron güncellenemiyorsa, o akış için optimistic update yerine mevcut refetch korunmalı.
> "DB refetch'i tamamen atla" kararı ancak tüm ilgili derived state'ler tutarlı kalıyorsa uygulanacak. Aksi halde selective refetch (sadece tracking hariç instances) yapılabilir.

---

### 6. DB Index (Öncelik: 6 — Opsiyonel)
**Öneri**: `lesson_instances(student_id, teacher_id, package_cycle, status)` composite index.

> **⚠ Değerlendirme Notu — Query pattern doğrulaması**
> Bu index'i eklemeden önce şunlar doğrulanmalı:
> - Bu 4'lü filtre kombinasyonu gerçekten sık kullanılıyor mu? (Evet — `lessonService.ts`'teki `getNextCompletableInstance`, `getLastCompletedInstance`, `fetchInstances` hepsi bu pattern'ı kullanıyor)
> - Mevcut tek kolon index'leri (`student_id` FK index) bu sorguları yeterince hızlı çözüyor mu? Düşük veri hacminde muhtemelen evet.
> - Composite index'in maintenance cost'u (insert/update overhead) kazanımdan büyük mü? Düşük insert frekanslı bir tablo olduğu için hayır.
> - **Sonuç**: Mantıklı bir index ama acil değil. Veri hacmi artınca eklenmesi daha anlamlı. Şimdilik opsiyonel olarak bırakılıyor.

---

### 7. Dokunmaya Değmez Alanlar (aynen korunuyor)
- Login flow — zaten optimize (paralel fetch, lazy load)
- Auth context — zaten Promise.all
- Kaynak/ödev completion — zaten hedefli fetch
- weekCache TTL / prefetch — zaten çalışıyor
- Template ↔ Actual switch — zaten hızlı

---

## Önceliklendirme Özeti

| Kategori | Maddeler |
|----------|----------|
| **En düşük risk, en hızlı kazanım** | #2 (triple fetch), #3 (waterfall paralelize), #4 (çift fetch fix) |
| **Düşük risk, yüksek kazanım** | #1 (N+1 batch) — varsayım doğrulaması sonrası |
| **Dikkatli uygulanmalı** | #5 (optimistic update) — derived state tutarlılığı kontrol sonrası |
| **Opsiyonel değerlendirme** | #6 (DB index) — acil ihtiyaç yok, ileride eklenebilir |

---

## Değişecek Dosyalar (aynen korunuyor)

| Dosya | Değişiklik | Öncelik |
|-------|-----------|---------|
| `AdminDashboard.tsx` | `fetchTeachers` N+1 → batch + refreshKey sadece mutation'da | 1, 4 |
| `lessonService.ts` | Opsiyonel cycle parametresi | 2 |
| `LessonTracker.tsx` | Tek cycle fetch + optimistic update | 2, 5 |
| `AdminWeeklySchedule.tsx` | `fetchSchedule` paralelize | 3 |
| `useEditStudentDialog.ts` | mark/undo optimistic | 5 |
| Migration SQL | Composite index (opsiyonel) | 6 |

---

## Scope Kontrolü

- **Aynen korunan maddeler**: Tüm 7 ana madde (#1-#7) ve dosya listesi değişmedi
- **Sadece düşünülmek üzere eklenen notlar**: 5 değerlendirme notu — bunlar uygulama kararını etkileyebilir ama planın yapısını değiştirmedi
- **Mevcut planı revize eden not**: #4'teki çift fetch fix'in uygulanma şekli netleştirildi (mutation-only increment); #5'e derived state güvenlik kontrolü ön koşulu eklendi
- **Yeni scope açılmadı**: Hiçbir yeni dosya/feature/akış eklenmedi

