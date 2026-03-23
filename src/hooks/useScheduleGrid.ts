/**
 * Shared schedule grid logic for AdminWeeklySchedule and WeeklyScheduleDialog.
 * Supports both Template mode (student_lessons) and Actual mode (lesson_instances).
 */

import { format, startOfWeek, addDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

/** Helper to calculate the date for a lesson based on day_of_week for current week */
export function getLessonDateForCurrentWeek(dayOfWeek: number): Date {
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  return addDays(weekStart, daysFromMonday);
}

interface BaseLessonInfo {
  id: string;
  student_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

interface TrialLessonInfo {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  lesson_date: string;
}

/** Actual-mode lesson from lesson_instances */
export interface ActualLesson {
  id: string;
  student_id: string;
  student_name: string;
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
  isGhost?: boolean;
}

// ─── Week Cache ───────────────────────────────────────────────
const weekCache = new Map<string, { data: ActualLesson[]; ts: number }>();
const CACHE_TTL = 60_000; // 1 minute

// ─── Ensure Cache — skip redundant ensureInstancesForWeek calls ──
const ensuredWeeks = new Set<string>();

function getCacheKey(teacherId: string, weekStartStr: string): string {
  return `${teacherId}-${weekStartStr}`;
}

/** Clear all cached weeks + ensured set — call after mutations (shift/revert/complete/reschedule). */
export function clearWeekCache(): void {
  weekCache.clear();
  ensuredWeeks.clear();
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
 * Collects all unique time slots from lessons, trial lessons, and overrides.
 */
export function getAllTimeSlots(
  lessons: BaseLessonInfo[],
  trialLessons: TrialLessonInfo[]
): string[] {
  const allTimes = new Set<string>();
  lessons.forEach((l) => allTimes.add(l.start_time));
  trialLessons.forEach((l) => allTimes.add(l.start_time));
  return Array.from(allTimes).sort();
}

/**
 * Collects all unique time slots from actual lessons (lesson_instances) + trial lessons.
 */
export function getAllTimeSlotsActual(
  actualLessons: ActualLesson[],
  trialLessons: TrialLessonInfo[]
): string[] {
  const allTimes = new Set<string>();
  actualLessons.forEach((l) => allTimes.add(l.start_time));
  trialLessons.forEach((l) => allTimes.add(l.start_time));
  return Array.from(allTimes).sort();
}

/**
 * Finds a trial lesson for a specific day and time slot in a given week.
 */
export function getTrialLessonForDayAndTime<T extends TrialLessonInfo>(
  trialLessons: T[],
  dayIndex: number,
  timeSlot: string,
  weekStart?: Date
): T | undefined {
  const dbDayOfWeek = dayIndexToDbDayOfWeek(dayIndex);
  const dateForDay = getDateForDayIndex(dayIndex, weekStart);
  const dateStr = format(dateForDay, "yyyy-MM-dd");
  return trialLessons.find(
    (l) => l.day_of_week === dbDayOfWeek && l.start_time === timeSlot && l.lesson_date === dateStr
  );
}

/**
 * Ensure lesson_instances exist for all active template students for a given week.
 * OPTIMIZED: Uses batch queries instead of per-student N+1 loops.
 */
async function ensureInstancesForWeek(teacherId: string, ws: Date): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekEnd = addDays(ws, 6);

  // Don't generate for fully past weeks
  if (weekEnd < today) return;

  const startStr = format(ws, "yyyy-MM-dd");
  const endStr = format(weekEnd, "yyyy-MM-dd");

  // Skip if already ensured this session (cleared on mutations)
  const ensureKey = `${teacherId}-${startStr}`;
  if (ensuredWeeks.has(ensureKey)) return;

  // Get all templates for this teacher
  const { data: templates } = await supabase
    .from("student_lessons")
    .select("student_id, day_of_week, start_time, end_time")
    .eq("teacher_id", teacherId);

  if (!templates || templates.length === 0) return;

  // Get active (non-archived) student IDs
  const templateStudentIds = [...new Set(templates.map((t) => t.student_id))];
  const { data: activeStudents } = await supabase
    .from("students")
    .select("student_id")
    .eq("teacher_id", teacherId)
    .eq("is_archived", false)
    .in("student_id", templateStudentIds);

  if (!activeStudents || activeStudents.length === 0) return;
  const activeStudentIds = new Set(activeStudents.map((s) => s.student_id));

  // Check which students already have instances for this week
  const { data: existingInstances } = await supabase
    .from("lesson_instances")
    .select("student_id")
    .eq("teacher_id", teacherId)
    .gte("lesson_date", startStr)
    .lte("lesson_date", endStr);

  const studentsWithInstances = new Set((existingInstances || []).map((i) => i.student_id));

  // Find students with templates but no instances this week
  const missingStudents = [...activeStudentIds].filter((id) => !studentsWithInstances.has(id));
  if (missingStudents.length === 0) return;

  // ── BATCH: Get tracking data, max lesson numbers, cycle instances, max completed dates ──
  // All in parallel
  const [trackingResult, maxLessonsResult, cycleInstancesResult] = await Promise.all([
    supabase
      .from("student_lesson_tracking")
      .select("student_id, package_cycle, lessons_per_week")
      .eq("teacher_id", teacherId)
      .in("student_id", missingStudents),
    supabase
      .from("lesson_instances")
      .select("student_id, lesson_number")
      .eq("teacher_id", teacherId)
      .in("student_id", missingStudents)
      .order("lesson_number", { ascending: false }),
    // Get ALL instances for missing students to compute cycle counts + max completed dates in JS
    supabase
      .from("lesson_instances")
      .select("student_id, package_cycle, status, lesson_date")
      .eq("teacher_id", teacherId)
      .in("student_id", missingStudents),
  ]);

  const trackingMap = new Map<string, { cycle: number; lpw: number }>();
  (trackingResult.data || []).forEach((t) => {
    trackingMap.set(t.student_id, { cycle: t.package_cycle, lpw: t.lessons_per_week });
  });

  const maxLessonMap = new Map<string, number>();
  (maxLessonsResult.data || []).forEach((row) => {
    if (!maxLessonMap.has(row.student_id)) {
      maxLessonMap.set(row.student_id, row.lesson_number);
    }
  });

  // Compute per-student: cycle instance count + max completed date (all in JS, zero extra queries)
  const cycleCountMap = new Map<string, number>();
  const maxCompletedDateMap = new Map<string, string>();
  (cycleInstancesResult.data || []).forEach((row) => {
    const tracking = trackingMap.get(row.student_id);
    if (!tracking || row.package_cycle !== tracking.cycle) return;
    cycleCountMap.set(row.student_id, (cycleCountMap.get(row.student_id) || 0) + 1);
    if (row.status === "completed") {
      const current = maxCompletedDateMap.get(row.student_id);
      if (!current || row.lesson_date > current) {
        maxCompletedDateMap.set(row.student_id, row.lesson_date);
      }
    }
  });

  // Generate instances to insert
  const instancesToInsert: Array<{
    student_id: string;
    teacher_id: string;
    lesson_number: number;
    lesson_date: string;
    start_time: string;
    end_time: string;
    status: string;
    package_cycle: number;
  }> = [];

  for (const studentId of missingStudents) {
    const tracking = trackingMap.get(studentId);
    if (!tracking) continue;

    const totalRights = tracking.lpw * 4;
    const currentCycle = tracking.cycle;
    const existingInCycle = cycleCountMap.get(studentId) || 0;

    if (existingInCycle >= totalRights) continue; // Package exhausted

    const remainingSlots = totalRights - existingInCycle;
    const studentTemplates = templates.filter((t) => t.student_id === studentId);
    let nextNum = (maxLessonMap.get(studentId) || 0) + 1;
    let generated = 0;
    const lastCompletedDate = maxCompletedDateMap.get(studentId);

    for (const tmpl of studentTemplates) {
      if (generated >= remainingSlots) break;

      const dayIndex = tmpl.day_of_week === 0 ? 6 : tmpl.day_of_week - 1;
      const lessonDate = addDays(ws, dayIndex);
      const dateStr = format(lessonDate, "yyyy-MM-dd");

      if (lastCompletedDate && dateStr <= lastCompletedDate) continue;

      instancesToInsert.push({
        student_id: studentId,
        teacher_id: teacherId,
        lesson_number: nextNum++,
        lesson_date: dateStr,
        start_time: tmpl.start_time,
        end_time: tmpl.end_time,
        status: "planned",
        package_cycle: currentCycle,
      });
      generated++;
    }
  }

  if (instancesToInsert.length > 0) {
    await supabase.from("lesson_instances").insert(instancesToInsert);
  }

  // Mark this week as ensured for the session
  ensuredWeeks.add(ensureKey);

}

/**
 * Core fetch logic — no caching, used by both cached fetch and prefetch.
 */
async function fetchActualLessonsForWeekCore(
  teacherId: string,
  weekStart?: Date
): Promise<ActualLesson[]> {
  const ws = weekStart || startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = addDays(ws, 6);
  const startStr = format(ws, "yyyy-MM-dd");
  const endStr = format(weekEnd, "yyyy-MM-dd");

  // Ensure instances exist for all template students this week
  await ensureInstancesForWeek(teacherId, ws);

  // Fetch instances + active students + profiles in parallel
  const [instancesResult, activeStudentsResult] = await Promise.all([
    supabase
      .from("lesson_instances")
      .select("id, student_id, lesson_number, lesson_date, start_time, end_time, status, original_date, original_start_time, original_end_time, rescheduled_count, is_manual_override")
      .eq("teacher_id", teacherId)
      .gte("lesson_date", startStr)
      .lte("lesson_date", endStr)
      .in("status", ["planned", "completed"])
      .order("lesson_date")
      .order("start_time"),
    supabase
      .from("students")
      .select("student_id")
      .eq("teacher_id", teacherId)
      .eq("is_archived", false),
  ]);

  const realInstances = instancesResult.data || [];
  const allActiveStudentIds = new Set((activeStudentsResult.data || []).map((s) => s.student_id));

  // Filter real instances to active students only
  const filteredInstances = realInstances.filter((i) => allActiveStudentIds.has(i.student_id));

  // Determine which active students have NO instances this week → candidates for ghost
  const studentsWithInstances = new Set(filteredInstances.map((i) => i.student_id));
  const studentsWithoutInstances = [...allActiveStudentIds].filter((id) => !studentsWithInstances.has(id));

  // Generate ghost entries for students with exhausted packages
  const ghostEntries: ActualLesson[] = [];

  if (studentsWithoutInstances.length > 0) {
    // Get templates + tracking in parallel (BATCH)
    const [templatesResult, trackingResult] = await Promise.all([
      supabase
        .from("student_lessons")
        .select("student_id, day_of_week, start_time, end_time")
        .eq("teacher_id", teacherId)
        .in("student_id", studentsWithoutInstances),
      supabase
        .from("student_lesson_tracking")
        .select("student_id, package_cycle, lessons_per_week")
        .eq("teacher_id", teacherId)
        .in("student_id", studentsWithoutInstances),
    ]);

    const templates = templatesResult.data || [];
    const trackingData = trackingResult.data || [];

    if (templates.length > 0 && trackingData.length > 0) {
      const trackingMap = new Map<string, { cycle: number; lpw: number }>();
      trackingData.forEach((t) => {
        trackingMap.set(t.student_id, { cycle: t.package_cycle, lpw: t.lessons_per_week });
      });

      const templateStudentIds = [...new Set(templates.map((t) => t.student_id))];

      // BATCH: Get all cycle instance counts in ONE query instead of N
      const { data: allCycleInstances } = await supabase
        .from("lesson_instances")
        .select("student_id, package_cycle")
        .eq("teacher_id", teacherId)
        .in("student_id", templateStudentIds);

      // Count per student in their current cycle
      const cycleCountMap = new Map<string, number>();
      (allCycleInstances || []).forEach((row) => {
        const tracking = trackingMap.get(row.student_id);
        if (!tracking || row.package_cycle !== tracking.cycle) return;
        cycleCountMap.set(row.student_id, (cycleCountMap.get(row.student_id) || 0) + 1);
      });

      for (const studentId of templateStudentIds) {
        const tracking = trackingMap.get(studentId);
        if (!tracking) continue;

        const totalRights = tracking.lpw * 4;
        const existingInCycle = cycleCountMap.get(studentId) || 0;
        if (existingInCycle < totalRights) continue; // Not exhausted, skip

        // Package exhausted — generate ghost entries from template
        const studentTemplates = templates.filter((t) => t.student_id === studentId);
        for (const tmpl of studentTemplates) {
          const dayIndex = tmpl.day_of_week === 0 ? 6 : tmpl.day_of_week - 1;
          const lessonDate = addDays(ws, dayIndex);
          const dateStr = format(lessonDate, "yyyy-MM-dd");

          ghostEntries.push({
            id: `ghost-${studentId}-${dateStr}-${tmpl.start_time}`,
            student_id: studentId,
            student_name: "",
            lesson_number: 0,
            lesson_date: dateStr,
            start_time: tmpl.start_time,
            end_time: tmpl.end_time,
            status: "planned",
            original_date: null,
            original_start_time: null,
            original_end_time: null,
            rescheduled_count: 0,
            is_manual_override: false,
            isGhost: true,
          });
        }
      }
    }
  }

  const allResults = [...filteredInstances.map((inst) => ({ ...inst, isGhost: false })), ...ghostEntries];

  // Fetch student names for all unique student IDs
  const allStudentIds = [...new Set(allResults.map((i) => i.student_id))];
  if (allStudentIds.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, full_name")
    .in("user_id", allStudentIds);

  const nameMap = new Map((profiles || []).map((p) => [p.user_id, p.full_name]));

  return allResults.map((inst) => ({
    ...inst,
    student_name: nameMap.get(inst.student_id) || "Bilinmeyen",
  }));
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
 * Get actual lesson for a specific day and time slot.
 */
export function getActualLessonForDayAndTime(
  actualLessons: ActualLesson[],
  dayIndex: number,
  timeSlot: string,
  weekStart?: Date
): ActualLesson | null {
  const dateForDay = getDateForDayIndex(dayIndex, weekStart);
  const dateStr = format(dateForDay, "yyyy-MM-dd");
  return actualLessons.find(
    (l) => l.lesson_date === dateStr && l.start_time === timeSlot
  ) || null;
}

/**
 * Get ALL actual lessons for a specific day and time slot (supports multiple students in same slot).
 */
export function getActualLessonsForDayAndTime(
  actualLessons: ActualLesson[],
  dayIndex: number,
  timeSlot: string,
  weekStart?: Date
): ActualLesson[] {
  const dateForDay = getDateForDayIndex(dayIndex, weekStart);
  const dateStr = format(dateForDay, "yyyy-MM-dd");
  return actualLessons.filter(
    (l) => l.lesson_date === dateStr && l.start_time === timeSlot
  );
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
