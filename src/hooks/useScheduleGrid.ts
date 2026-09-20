/**
 * Admin haftalık programı ve öğretmen ders programı ekranının ortak ızgara mantığı.
 * Supports both Template mode (student_lessons) and Actual mode (lesson_instances).
 */

import { format, startOfWeek, addDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { ensureCycleInstances } from "@/lib/lessonService";

interface BaseLessonInfo {
  id: string;
  student_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

/** Actual-mode lesson from lesson_instances */
export interface ActualLesson {
  id: string;
  /** Dersin öğretmeni — günlük planda satırlar birden çok öğretmenden gelir. */
  teacher_id: string;
  /** Deneme dersinde boş: aday henüz kayıtlı bir öğrenci değil. */
  student_id: string | null;
  /** Deneme dersinde aday adı, yoksa "Deneme". */
  student_name: string;
  tur: "ders" | "deneme";
  /** Deneme dersinde adminin yazdığı aday adı; boş olabilir. */
  aday_adi: string | null;
  lesson_number: number;
  lesson_date: string;
  start_time: string;
  end_time: string;
  status: string;
  original_date: string | null;
  original_start_time: string | null;
  original_end_time: string | null;
  rescheduled_count: number;
  is_manual_override: boolean;
  created_at?: string | null;
  /** @deprecated Hayalet dersler kaldırıldı; her zaman false. */
  isGhost?: boolean;
}

// ─── Week Cache ───────────────────────────────────────────────
const weekCache = new Map<string, { data: ActualLesson[]; ts: number }>();
const CACHE_TTL = 60_000; // 1 minute

// ─── Ensure guard — one package top-up per teacher per session ──
const ensuredTeachers = new Set<string>();

function getCacheKey(teacherId: string, weekStartStr: string): string {
  return `${teacherId}-${weekStartStr}`;
}

/** Clear all cached weeks + ensured set — call after mutations (shift/revert/complete/reschedule). */
export function clearWeekCache(): void {
  weekCache.clear();
  ensuredTeachers.clear();
}

/** Prefetch a specific week in the background (no-op if already cached and fresh). */
export function prefetchWeek(teacherId: string, weekStart: Date): void {
  const key = getCacheKey(teacherId, format(weekStart, "yyyy-MM-dd"));
  const cached = weekCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return;
  // Fire and forget
  fetchActualLessonsForWeekCore(teacherId, weekStart).then((data) => {
    weekCache.set(key, { data, ts: Date.now() });
  }).catch(() => {});
}

/**
 * Get the Monday of the week for a given offset (0 = current week).
 */
export function getWeekStartForOffset(offset: number): Date {
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  return addDays(weekStart, offset * 7);
}

/**
 * Get the date for a specific day index (0=Mon, 6=Sun) in a given week.
 */
export function getDateForDayIndex(dayIndex: number, weekStart?: Date): Date {
  const ws = weekStart || startOfWeek(new Date(), { weekStartsOn: 1 });
  return addDays(ws, dayIndex);
}

/**
 * Converts a UI day index (0=Mon, 6=Sun) to DB day_of_week (1=Mon, 0=Sun).
 */
export function dayIndexToDbDayOfWeek(dayIndex: number): number {
  return dayIndex === 6 ? 0 : dayIndex + 1;
}

/**
 * Şablon kipinin zaman ekseni: haftalık ders programındaki saatler.
 */
export function getAllTimeSlots(lessons: BaseLessonInfo[]): string[] {
  const allTimes = new Set<string>();
  lessons.forEach((l) => allTimes.add(l.start_time));
  return Array.from(allTimes).sort();
}

/**
 * Güncel kipin zaman ekseni. Deneme dersleri de lesson_instances içinde
 * olduğu için ayrıca eklenmiyor; artık eksende kendiliğinden yerleri var.
 */
export function getAllTimeSlotsActual(
  actualLessons: ActualLesson[],
  templateLessons: BaseLessonInfo[] = []
): string[] {
  const allTimes = new Set<string>();
  actualLessons.forEach((l) => allTimes.add(l.start_time));
  // Şablon saatleri de eksende olsun: o gün boş olan bir saat ancak satır
  // olarak varsa sürükleme hedefi olabilir. Ders yalnızca dolu saatlerden
  // üretildiğinde, "salıyı cumartesiye al" için bırakılacak hücre yoktu.
  templateLessons.forEach((l) => allTimes.add(l.start_time));
  return Array.from(allTimes).sort();
}

/**
 * Make sure every active student's current package is fully materialised.
 *
 * This used to be a ~150-line client routine that asked "does this student have
 * a lesson in the week I'm looking at?" and, if not, inserted one on the
 * template day. Paging back to a week whose lesson had just been moved out
 * therefore conjured a replacement, and two open admin tabs could both insert.
 * The server RPC works on the package instead of the week — a cycle holds
 * exactly lessons_per_week * 4 lessons, missing ones are appended on free slots
 * after the last existing one — and it is idempotent, so calling it on load is
 * safe. Guarded per teacher so it costs one round trip per session.
 */
async function ensurePackagesForTeacher(teacherId: string): Promise<void> {
  if (ensuredTeachers.has(teacherId)) return;
  ensuredTeachers.add(teacherId);
  const result = await ensureCycleInstances(teacherId);
  if (!result.success) {
    // Not fatal: the schedule still renders whatever already exists.
    console.error("ensureCycleInstances failed:", result.error);
    ensuredTeachers.delete(teacherId);
  }
}

/**
 * Takvim satırlarının TEK okuma yolu: verilen öğretmenlerin, verilen tarih
 * aralığındaki dersleri. Haftalık program tek öğretmen + yedi günle, adminin
 * günlük planı bütün şube öğretmenleri + tek günle çağırır — süzgeçler
 * (arşivli öğrenci, deneme dersi) ve ad eşlemesi ikisinde de aynı kalsın diye
 * ayrı bir sorgu yazılmadı.
 */
async function fetchInstances(
  teacherIds: string[],
  startStr: string,
  endStr: string,
): Promise<ActualLesson[]> {
  if (teacherIds.length === 0) return [];

  // Top the packages up before reading, so a student who is short of lessons
  // (newly created, or template synced) shows a complete schedule.
  await Promise.all(teacherIds.map(ensurePackagesForTeacher));

  // Fetch instances + active students + profiles in parallel
  const [instancesResult, activeStudentsResult] = await Promise.all([
    supabase
      .from("lesson_instances")
      .select("id, teacher_id, student_id, tur, aday_adi, lesson_number, lesson_date, start_time, end_time, status, original_date, original_start_time, original_end_time, rescheduled_count, is_manual_override, created_at")
      .in("teacher_id", teacherIds)
      .gte("lesson_date", startStr)
      .lte("lesson_date", endStr)
      .in("status", ["planned", "completed"])
      .order("lesson_date")
      .order("start_time"),
    supabase
      .from("students")
      .select("teacher_id, student_id")
      .in("teacher_id", teacherIds)
      .eq("is_archived", false),
  ]);
  if (instancesResult.error) throw instancesResult.error;

  const realInstances = instancesResult.data || [];
  // Öğrenci, dersin KENDİ öğretmeninde etkin mi — aktarılmış öğrencinin eski
  // öğretmenindeki satırları da arşivli gibi süzülür.
  const activePairs = new Set(
    (activeStudentsResult.data || []).map((s) => `${s.teacher_id}:${s.student_id}`),
  );

  // Arşivlenmiş öğrencinin eski kayıtları takvimde görünmesin. Deneme
  // dersinin öğrencisi yok (aday henüz kayıtlı değil), o yüzden bu süzgecin
  // dışında: takvimde öğretmenin slotunu tutan gerçek bir satır.
  const filteredInstances = realInstances.filter(
    (i) => i.tur === "deneme" || activePairs.has(`${i.teacher_id}:${i.student_id}`)
  );

  // Hayalet dersler kaldırıldı.
  //
  // Paketi biten öğrenci için tarayıcıda sahte ders satırları üretiliyordu:
  // veritabanında karşılığı yok, tıklanamıyor, taşınamıyordu — aynı dersin
  // dördüncü temsiliydi. Paket boyu artık paket satırında saklandığı ve hak
  // bitince ders üretilmediği için bir önizlemeye gerek kalmadı: takvimde ne
  // varsa gerçek odur. Yeni paket açıldığında dersler kendiliğinden belirir.
  if (filteredInstances.length === 0) return [];

  const allStudentIds = [...new Set(filteredInstances.map((i) => i.student_id))].filter(
    (id): id is string => !!id
  );

  const { data: profiles } = allStudentIds.length
    ? await supabase.from("profiles").select("user_id, full_name").in("user_id", allStudentIds)
    : { data: [] };

  const nameMap = new Map((profiles || []).map((p) => [p.user_id, p.full_name]));

  return filteredInstances.map((inst) => ({
    ...inst,
    tur: inst.tur === "deneme" ? ("deneme" as const) : ("ders" as const),
    student_name:
      inst.tur === "deneme"
        ? inst.aday_adi?.trim() || "Deneme"
        : nameMap.get(inst.student_id) || "Bilinmeyen",
    isGhost: false,
  }));
}

/**
 * Core fetch logic — no caching, used by both cached fetch and prefetch.
 */
async function fetchActualLessonsForWeekCore(
  teacherId: string,
  weekStart?: Date
): Promise<ActualLesson[]> {
  const ws = weekStart || startOfWeek(new Date(), { weekStartsOn: 1 });
  return fetchInstances([teacherId], format(ws, "yyyy-MM-dd"), format(addDays(ws, 6), "yyyy-MM-dd"));
}

/**
 * Bir günün dersleri, birden çok öğretmen için — adminin "bugünün planı".
 * Önbelleksiz: tek günlük küçük bir sorgu, ve plan açıkken yapılan bir tarih
 * değişikliğinden sonra bayat veri göstermemeli.
 */
export function fetchLessonsForDay(teacherIds: string[], day: Date): Promise<ActualLesson[]> {
  const dayStr = format(day, "yyyy-MM-dd");
  return fetchInstances(teacherIds, dayStr, dayStr);
}

/**
 * Fetch actual lessons with stale-while-revalidate caching.
 * Returns cached data instantly if available, refreshes in background.
 */
export async function fetchActualLessonsForWeek(
  teacherId: string,
  weekStart?: Date
): Promise<ActualLesson[]> {
  const ws = weekStart || startOfWeek(new Date(), { weekStartsOn: 1 });
  const key = getCacheKey(teacherId, format(ws, "yyyy-MM-dd"));
  const cached = weekCache.get(key);

  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    // Fresh cache — return immediately, no background refresh
    return cached.data;
  }

  // No cache or stale — fetch fresh
  const data = await fetchActualLessonsForWeekCore(teacherId, ws);
  weekCache.set(key, { data, ts: Date.now() });
  return data;
}

/**
 * Get ALL actual lessons for a specific day and time slot (supports multiple students in same slot).
 *
 * Historical cross-cycle duplicates exist where the same (student, date, start_time)
 * has two completed rows in different package_cycles (migration artifact). Surface
 * dedup keeps only the newest-created row per (student, date, start_time) so the
 * grid renders one card. The DB rows are preserved (balance untouched).
 */
export function getActualLessonsForDayAndTime(
  actualLessons: ActualLesson[],
  dayIndex: number,
  timeSlot: string,
  weekStart?: Date
): ActualLesson[] {
  const dateForDay = getDateForDayIndex(dayIndex, weekStart);
  const dateStr = format(dateForDay, "yyyy-MM-dd");
  const matched = actualLessons.filter(
    (l) => l.lesson_date === dateStr && l.start_time === timeSlot
  );
  if (matched.length <= 1) return matched;

  const bestPerStudent = new Map<string, ActualLesson>();
  for (const l of matched) {
    // Denemenin öğrencisi yok; kendi kimliğiyle anahtarlanır, yoksa aynı
    // hücredeki iki deneme tek satıra iner.
    const anahtar = l.student_id ?? l.id;
    const existing = bestPerStudent.get(anahtar);
    if (!existing) { bestPerStudent.set(anahtar, l); continue; }
    // Aynı öğrencinin aynı hücredeki iki kaydından en yenisi kalır.
    const lTs = l.created_at || "";
    const eTs = existing.created_at || "";
    if (lTs > eTs) bestPerStudent.set(anahtar, l);
  }
  return Array.from(bestPerStudent.values());
}

/**
 * Detect back-to-back lesson groups for a specific day.
 */
export function getBackToBackGroups(
  actualLessons: ActualLesson[],
  dayIndex: number,
  weekStart?: Date
): ActualLesson[][] {
  const dateForDay = getDateForDayIndex(dayIndex, weekStart);
  const dateStr = format(dateForDay, "yyyy-MM-dd");
  
  const dayLessons = actualLessons
    .filter((l) => l.lesson_date === dateStr)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  const groups: ActualLesson[][] = [];
  const processed = new Set<string>();

  for (let i = 0; i < dayLessons.length; i++) {
    if (processed.has(dayLessons[i].id)) continue;

    const group: ActualLesson[] = [dayLessons[i]];
    processed.add(dayLessons[i].id);

    let current = dayLessons[i];
    for (let j = i + 1; j < dayLessons.length; j++) {
      if (processed.has(dayLessons[j].id)) continue;
      if (
        current.student_id !== null &&
        dayLessons[j].student_id === current.student_id &&
        dayLessons[j].start_time === current.end_time
      ) {
        group.push(dayLessons[j]);
        processed.add(dayLessons[j].id);
        current = dayLessons[j];
      }
    }

    if (group.length > 1) {
      groups.push(group);
    }
  }

  return groups;
}

/**
 * Check if a lesson is part of a back-to-back group (not the first one).
 */
export function isSecondaryInBackToBack(
  actualLessons: ActualLesson[],
  dayIndex: number,
  lessonId: string,
  weekStart?: Date
): boolean {
  const groups = getBackToBackGroups(actualLessons, dayIndex, weekStart);
  return groups.some(
    (group) => group.length > 1 && group.findIndex((l) => l.id === lessonId) > 0
  );
}

/**
 * Get the back-to-back group for a given lesson (if it's the first in the group).
 */
export function getBackToBackGroupForLesson(
  actualLessons: ActualLesson[],
  dayIndex: number,
  lessonId: string,
  weekStart?: Date
): ActualLesson[] | null {
  const groups = getBackToBackGroups(actualLessons, dayIndex, weekStart);
  const group = groups.find(
    (g) => g.length > 1 && g[0].id === lessonId
  );
  return group || null;
}
