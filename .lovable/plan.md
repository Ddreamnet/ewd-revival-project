

# Plan: Atomik Template Sync RPC + Kontrollü Repair (Güncellenmiş)

## Adım 1: `rpc_sync_student_schedule` RPC Fonksiyonu

Tek PL/pgSQL transaction içinde çalışan atomik RPC:

```sql
rpc_sync_student_schedule(
  p_student_id uuid,
  p_teacher_id uuid,
  p_slots jsonb,          -- [{dayOfWeek, startTime, endTime}]
  p_lessons_per_week integer
) RETURNS json
```

**İç mantık (tek transaction):**
1. `student_lessons` DELETE + INSERT (yeni template)
2. `student_lesson_tracking.lessons_per_week` UPDATE (veya INSERT)
3. Mevcut cycle'daki instance'ları çek
4. `is_manual_override = true` veya `shift_group_id IS NOT NULL` olanları koru
5. Geri kalan planned instance'ları SİL
6. Template'e göre yeni planned instance'ları regenerate et (completed count'u koruyarak)
7. Herhangi bir adımda hata → otomatik ROLLBACK

Conflict check RPC içinde yapılmayacak — mevcut warning-only client-side davranış korunuyor.

---

## Adım 2: `handleSubmit` → Tek RPC Çağrısı

`useEditStudentDialog.ts` satır 416-521 arasındaki 6-7 ayrı DB çağrısı tek `supabase.rpc('rpc_sync_student_schedule', {...})` çağrısına dönüşecek.

Profil isim güncelleme RPC dışında kalacak — ayrı mutation.

**Dosya**: `src/hooks/useEditStudentDialog.ts`

---

## Adım 3: `syncTemplateChange` + `shiftLessonsForward` Error Propagation

RPC dışında kalan çağrı noktaları için `Promise.all` sonuçlarında error check + throw:

```typescript
const results = await Promise.all(updatePromises);
const errors = results.filter(r => r.error);
if (errors.length > 0) {
  throw new Error(`Instance güncelleme hatası: ${errors.map(e => e.error?.message).join(', ')}`);
}
```

**Dosya**: `src/lib/instanceGeneration.ts`

---

## Adım 4: Kontrollü Repair (Audit-First, Batch, Idempotent)

### 4a. Audit — uyumsuz kayıtları tespit et
Template saati ile planned instance saati farklı olan kayıtları listele (`is_manual_override = false` AND `shift_group_id IS NULL`).

### 4b. Dry-run raporu — kaç öğrenci, kaç instance etkileniyor

### 4c. Same-day multi-slot ön kontrol (zorunlu)

### 4d. Repair — sadece uyumsuz öğrenci/teacher çiftleri için RPC çağrısı

### 4e. Doğrulama — aynı audit sorgusunu tekrar çalıştır, sonuç boş olmalı

---

## Planned Instance ID Stabilitesi — Bağımlılık Analizi

Codebase'de `lesson_instances.id` referans alan noktaları inceledim:

| Referans Noktası | Planned Instance'ı Etkiler mi? |
|---|---|
| `balance_events.instance_id` | **Hayır** — sadece `lesson_complete` ve `lesson_undo` event'lerinde yazılır. Bu event'ler yalnızca **completed** instance'lar için oluşur. Planned instance'ların ID'si hiçbir balance_events kaydında bulunmaz. |
| `rpc_complete_lesson(p_instance_id)` | **Hayır** — runtime'da `nextCompletableId` state'inden geçirilir, persist edilmez. Delete + regenerate sonrası yeni ID, bir sonraki `loadData` ile taze çekilir. |
| `rpc_undo_complete_lesson(p_instance_id)` | **Hayır** — sadece completed instance'lar için çalışır. Completed instance'lara dokunulmaz. |
| `LessonTracker` — `nextCompletableId` / `lastCompletedId` | **Hayır** — React state, her `loadData` çağrısında DB'den yeniden derive edilir. |
| `LessonOverrideDialog` — instance seçimi | **Hayır** — dialog açıldığında DB'den taze veri çeker. |
| `notify_admin_last_lesson` trigger | **Hayır** — trigger `status = 'completed'` değişikliğinde ateşlenir, planned instance silme/insert trigger'ı tetiklemez. |
| Foreign key constraint | **Yok** — `lesson_instances.id` hiçbir tabloda foreign key olarak referans alınmıyor. `balance_events.instance_id` FK constraint'i yok, sadece veri seviyesinde referans. |

### Sonuç: Delete + Regenerate Güvenli

**Planned instance'ların ID'si hiçbir persist edilen referansta kullanılmıyor.** `balance_events.instance_id` sadece completed instance'lar için yazılır; completed instance'lara dokunulmaz. Tüm runtime referansları (nextCompletableId, lastCompletedId) DB'den yeniden derive edilir.

Bu nedenle **full delete + regenerate yaklaşımı güvenlidir** ve in-place update'e geçmeye gerek yoktur.

---

## Değişecek Dosyalar

| Dosya | Değişiklik |
|-------|-----------|
| Migration SQL | `rpc_sync_student_schedule` RPC fonksiyonu |
| `src/hooks/useEditStudentDialog.ts` | `handleSubmit` → tek RPC çağrısı |
| `src/lib/instanceGeneration.ts` | Error propagation (syncTemplateChange + shiftLessonsForward) |
| Script / manual | Audit + kontrollü repair (RPC çağrıları) |

## Uygulama Sırası

1. `rpc_sync_student_schedule` RPC oluştur
2. `instanceGeneration.ts` error propagation ekle
3. `handleSubmit`'i tek RPC çağrısına dönüştür
4. Audit sorgusu çalıştır → dry-run raporu sun
5. Uyumsuz kayıtlar için kontrollü repair uygula
6. Doğrulama audit'i çalıştır

## Scope Kontrolü

- **Önceki plandan aynen korunan**: Tüm 4 adım, dosya listesi, uygulama sırası, repair kuralları (override/shift istisnaları), multi-slot ön kontrol zorunluluğu, idempotent batch yaklaşımı
- **Bu güncellemede eklenen**: Planned instance ID bağımlılık analizi — 7 referans noktası incelendi, hepsi güvenli bulundu
- **Karar**: Delete + regenerate yaklaşımı korunuyor, in-place update'e geçmeye gerek yok

