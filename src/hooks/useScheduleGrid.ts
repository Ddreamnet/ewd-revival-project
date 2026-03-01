/**
 * Shared schedule grid logic for AdminWeeklySchedule and WeeklyScheduleDialog.
 * Supports both Template mode (student_lessons) and Actual mode (lesson_instances).
 */

import { format, startOfWeek, addDays } from "date-fns";
import { getLessonDateForCurrentWeek, LessonOverride } from "@/hooks/useLessonOverrides";
import { supabase } from "@/integrations/supabase/client";

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
  trialLessons: TrialLessonInfo[],
  overrides: LessonOverride[]
): string[] {
  const allTimes = new Set<string>();

  lessons.forEach((l) => allTimes.add(l.start_time));
  trialLessons.forEach((l) => allTimes.add(l.start_time));
  overrides.forEach((o) => {
    if (!o.is_cancelled && o.new_start_time) {
      allTimes.add(o.new_start_time);
    }
  });

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
 * "Lazy generation": if a student has templates but no instances for this week, generate them.
 * Only generates for weeks that include today or are in the future.
 */
async function ensureInstancesForWeek(teacherId: string, ws: Date): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekEnd = addDays(ws, 6);

  // Don't generate for fully past weeks
  if (weekEnd < today) return;

  const startStr = format(ws, "yyyy-MM-dd");
  const endStr = format(weekEnd, "yyyy-MM-dd");

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

  // Fetch lessons_per_week for each missing student to enforce cap
  const { data: trackingRecords } = await supabase
    .from("student_lesson_tracking")
    .select("student_id, lessons_per_week")
    .eq("teacher_id", teacherId)
    .in("student_id", missingStudents);

  const lpwMap = new Map<string, number>();
  (trackingRecords || []).forEach((r) => {
    lpwMap.set(r.student_id, r.lessons_per_week);
  });

  // Count total existing instances per missing student (all statuses)
  const { data: allInstanceCounts } = await supabase
    .from("lesson_instances")
    .select("student_id, id")
    .eq("teacher_id", teacherId)
    .in("student_id", missingStudents)
    .in("status", ["planned", "completed"]);

  const existingCountMap = new Map<string, number>();
  (allInstanceCounts || []).forEach((row) => {
    existingCountMap.set(row.student_id, (existingCountMap.get(row.student_id) || 0) + 1);
  });

  // Get max lesson_number per missing student (batch)
  const { data: maxLessons } = await supabase
    .from("lesson_instances")
    .select("student_id, lesson_number")
    .eq("teacher_id", teacherId)
    .in("student_id", missingStudents)
    .order("lesson_number", { ascending: false });

  const maxLessonMap = new Map<string, number>();
  (maxLessons || []).forEach((row) => {
    if (!maxLessonMap.has(row.student_id)) {
      maxLessonMap.set(row.student_id, row.lesson_number);
    }
  });

  // Generate instances from templates, respecting the lpw*4 cap
  const instancesToInsert: Array<{
    student_id: string;
    teacher_id: string;
    lesson_number: number;
    lesson_date: string;
    start_time: string;
    end_time: string;
    status: string;
  }> = [];

  for (const studentId of missingStudents) {
    const studentTemplates = templates.filter((t) => t.student_id === studentId);
    const lpw = lpwMap.get(studentId) || studentTemplates.length;
    const cap = lpw * 4;
    const currentCount = existingCountMap.get(studentId) || 0;
    const remaining = cap - currentCount;

    if (remaining <= 0) continue; // Already at or over cap

    let nextNum = (maxLessonMap.get(studentId) || 0) + 1;
    let added = 0;

    for (const tmpl of studentTemplates) {
      if (added >= remaining) break;
      const dayIndex = tmpl.day_of_week === 0 ? 6 : tmpl.day_of_week - 1;
      const lessonDate = addDays(ws, dayIndex);

      const dateStr = format(lessonDate, "yyyy-MM-dd");
      instancesToInsert.push({
        student_id: studentId,
        teacher_id: teacherId,
        lesson_number: nextNum++,
        lesson_date: dateStr,
        start_time: tmpl.start_time,
        end_time: tmpl.end_time,
        status: "planned",
      });
      added++;
    }
  }

  if (instancesToInsert.length > 0) {
    await supabase.from("lesson_instances").insert(instancesToInsert);
  }

  // Clean up excess planned instances for students over cap
  for (const studentId of [...activeStudentIds]) {
    const lpw = lpwMap.get(studentId);
    if (!lpw) continue;
    const cap = lpw * 4;

    const { data: allInst } = await supabase
      .from("lesson_instances")
      .select("id, status, lesson_date, start_time")
      .eq("student_id", studentId)
      .eq("teacher_id", teacherId)
      .in("status", ["planned", "completed"])
      .order("lesson_date", { ascending: true })
      .order("start_time", { ascending: true });

    if (!allInst || allInst.length <= cap) continue;

    // Keep first `cap` instances, delete excess planned ones from the end
    const excess = allInst.slice(cap).filter((i) => i.status === "planned");
    if (excess.length > 0) {
      const excessIds = excess.map((e) => e.id);
      await supabase.from("lesson_instances").delete().in("id", excessIds);
    }
  }
}

/**
 * Fetch actual lessons (lesson_instances) for a teacher for a specific week.
 * Automatically generates missing instances from templates (lazy generation).
 */
export async function fetchActualLessonsForWeek(
  teacherId: string,
  weekStart?: Date
): Promise<ActualLesson[]> {
  const ws = weekStart || startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = addDays(ws, 6);
  const startStr = format(ws, "yyyy-MM-dd");
  const endStr = format(weekEnd, "yyyy-MM-dd");

  // Ensure instances exist for all template students this week
  await ensureInstancesForWeek(teacherId, ws);

  const { data: instances, error } = await supabase
    .from("lesson_instances")
    .select("id, student_id, lesson_number, lesson_date, start_time, end_time, status, original_date, original_start_time, original_end_time, rescheduled_count")
    .eq("teacher_id", teacherId)
    .gte("lesson_date", startStr)
    .lte("lesson_date", endStr)
    .in("status", ["planned", "completed"])
    .order("lesson_date")
    .order("start_time");

  if (error || !instances) return [];

  // Fetch student names
  const studentIds = [...new Set(instances.map((i) => i.student_id))];
  if (studentIds.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, full_name")
    .in("user_id", studentIds);

  const nameMap = new Map((profiles || []).map((p) => [p.user_id, p.full_name]));

  return instances.map((inst) => ({
    ...inst,
    student_name: nameMap.get(inst.student_id) || "Bilinmeyen",
  }));
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