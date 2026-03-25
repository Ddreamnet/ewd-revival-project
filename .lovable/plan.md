

# Plan: "Kaydet" Butonu Manuel Zincir Ayarlamalarını Sıfırlıyor

## Kök Neden

`handleSubmit` (satır 479) **her zaman** `rpc_sync_student_schedule` çağırıyor. Bu RPC:
1. Tüm `planned` instance'ları siler (`is_manual_override = false AND shift_group_id IS NULL`)
2. Template slotlarından sıfırdan yeniden üretir

Ok tuşları ve "Hizala" aksiyonu instance'ları in-place günceller ama `is_manual_override` veya `shift_group_id` set etmez. Bu yüzden RPC bunları "normal planned" olarak görüp siler ve eski pozisyonlarda yeniden üretir.

## Düzeltme

`handleSubmit` içinde template'in gerçekten değişip değişmediğini kontrol et. Değişmediyse sadece isim ve `lessons_per_week` güncelle, instance regeneration yapma.

### Değişiklik: `src/hooks/useEditStudentDialog.ts` — `handleSubmit`

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  // ... validation aynı ...

  // Template değişti mi kontrol et
  const templateChanged = 
    lessonsPerWeek !== currentLessons.length ||
    lessons.some((l, i) => {
      const curr = currentLessons[i];
      if (!curr) return true;
      return l.dayOfWeek !== curr.dayOfWeek || 
             l.startTime !== curr.startTime || 
             l.endTime !== curr.endTime;
    }) ||
    currentLessons.length !== lessons.length;

  // İsim güncelle (her zaman)
  await supabase.from("profiles").update({ full_name: name.trim() }).eq("user_id", studentUserId);

  if (templateChanged) {
    // Template değiştiyse → RPC ile full sync (mevcut davranış)
    await supabase.rpc('rpc_sync_student_schedule', { ... });
  } else {
    // Template değişmediyse → sadece lessons_per_week güncelle, instance'lara dokunma
    await supabase.from("student_lesson_tracking")
      .update({ lessons_per_week: lessonsPerWeek })
      .eq("student_id", studentUserId)
      .eq("teacher_id", teacherUserId);
    
    // Note alanlarını güncelle (student_lessons tablosunda)
    for (const lesson of lessons) {
      await supabase.from("student_lessons")
        .update({ note: lesson.note || null })
        .eq("student_id", studentUserId)
        .eq("teacher_id", teacherUserId)
        .eq("day_of_week", lesson.dayOfWeek)
        .eq("start_time", lesson.startTime);
    }
  }
};
```

## Dosya
- `src/hooks/useEditStudentDialog.ts` — `handleSubmit` fonksiyonu (~20 satır değişiklik)

## Risk
Düşük. Template değişmediyse instance'lara hiç dokunulmuyor — tam olarak istenen davranış. Template değiştiyse mevcut RPC davranışı korunuyor.

