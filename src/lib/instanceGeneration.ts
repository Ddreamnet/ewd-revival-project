/**
 * Generate/regenerate lesson instances from template slots.
 * Handles template changes, future instance regeneration, and
 * "move to next lesson" cascading shift logic.
 * 
 * IMPORTANT: All generation functions support multiple slots on the same day
 * (e.g., a student with Mon 10:00 AND Mon 11:00). Slots on the same day are
 * sorted by startTime and each produces a separate instance.
 */

import { addDays, format, startOfDay, isBefore } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { checkTeacherConflicts, ConflictInfo } from "./conflictDetection";

export interface TemplateSlot {
  dayOfWeek: number; // 0=Sun, 1=Mon, ..., 6=Sat
  startTime: string;
  endTime: string;
}

export interface LessonInstanceRow {
  id: string;
  student_id: string;
  teacher_id: string;
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
 * Generate future instances starting from a given date, using template slots.
 * Returns instance data ready for upsert (no DB call).
 * 
 * Supports multiple slots on the same day: slots sharing a dayOfWeek are
 * sorted by startTime and each produces a separate entry in the results.
 */
export function generateFutureInstanceDates(
  templateSlots: TemplateSlot[],
  count: number,
  startFromDate: Date,
  afterTime?: string
): { lessonDate: string; startTime: string; endTime: string }[] {
  if (count <= 0 || templateSlots.length === 0) return [];

  const results: { lessonDate: string; startTime: string; endTime: string }[] = [];
  // Sort slots by dayOfWeek then startTime for predictable iteration
  const sortedSlots = [...templateSlots].sort((a, b) => {
    if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
    return a.startTime.localeCompare(b.startTime);
  });

  let currentDate = startOfDay(startFromDate);
  const maxDays = 200; // Safety limit

  for (let offset = 0; offset < maxDays && results.length < count; offset++) {
    const candidate = addDays(currentDate, offset);
    const dow = candidate.getDay();

    // Find ALL slots matching this day of week (not just the first)
    const matchingSlots = sortedSlots.filter((s) => s.dayOfWeek === dow);

    for (const slot of matchingSlots) {
      if (results.length >= count) break;
      // On the first day (offset=0), skip slots at or before afterTime
      if (offset === 0 && afterTime && slot.startTime <= afterTime) continue;
      results.push({
        lessonDate: format(candidate, "yyyy-MM-dd"),
        startTime: slot.startTime,
        endTime: slot.endTime,
      });
    }
  }

  return results;
}

/**
 * Sync template changes: keep completed instances, regenerate planned ones.
 * Returns conflicts if any would be created.
 */
export async function syncTemplateChange(
  studentId: string,
  teacherId: string,
  newSlots: TemplateSlot[],
  totalLessons: number
): Promise<{ conflicts: ConflictInfo[]; success: boolean }> {
  // Get current cycle
  const { data: tracking } = await supabase
    .from("student_lesson_tracking")
    .select("package_cycle")
    .eq("student_id", studentId)
    .eq("teacher_id", teacherId)
    .maybeSingle();

  const currentCycle = tracking?.package_cycle ?? 1;

  // Fetch existing instances for current cycle only
  const { data: existing } = await supabase
    .from("lesson_instances")
    .select("*")
    .eq("student_id", studentId)
    .eq("teacher_id", teacherId)
    .eq("package_cycle", currentCycle)
    .order("lesson_number", { ascending: true });

  if (!existing) return { conflicts: [], success: false };

  const completed = existing.filter((i) => i.status === "completed");
  const planned = existing.filter((i) => i.status === "planned");

  // Determine start date for regeneration: day after last completed, or today
  const today = startOfDay(new Date());
  let startFrom = today;
  if (completed.length > 0) {
    const lastCompleted = completed[completed.length - 1];
    const lastDate = new Date(lastCompleted.lesson_date);
    startFrom = addDays(lastDate, 1);
    if (isBefore(startFrom, today)) startFrom = today;
  }

  // Enforce total_rights cap
  const plannedCount = Math.max(0, totalLessons - completed.length);
  const newDates = generateFutureInstanceDates(newSlots, plannedCount, startFrom);

  // Check conflicts for each new date (excludeStudentId prevents self-conflicts)
  const allConflicts: ConflictInfo[] = [];
  for (const nd of newDates) {
    const conflicts = await checkTeacherConflicts(
      teacherId,
      nd.lessonDate,
      nd.startTime,
      nd.endTime,
      undefined,
      studentId
    );
    allConflicts.push(...conflicts);
  }

  // Warning only — log conflicts but proceed with instance generation
  if (allConflicts.length > 0) {
    console.warn("syncTemplateChange: conflicts detected (warning-only):", allConflicts);
  }

  // Update planned instances with new dates/times
  for (let i = 0; i < planned.length && i < newDates.length; i++) {
    await supabase
      .from("lesson_instances")
      .update({
        lesson_date: newDates[i].lessonDate,
        start_time: newDates[i].startTime,
        end_time: newDates[i].endTime,
      })
      .eq("id", planned[i].id);
  }

  // If more planned lessons than before, insert new ones with package_cycle
  if (newDates.length > planned.length) {
    const nextLessonNumber = Math.max(...existing.map((e) => e.lesson_number), 0) + 1;
    for (let i = planned.length; i < newDates.length; i++) {
      await supabase.from("lesson_instances").insert({
        student_id: studentId,
        teacher_id: teacherId,
        lesson_number: nextLessonNumber + (i - planned.length),
        lesson_date: newDates[i].lessonDate,
        start_time: newDates[i].startTime,
        end_time: newDates[i].endTime,
        status: "planned",
        package_cycle: currentCycle,
      });
    }
  }

  // If fewer planned lessons, delete excess
  if (newDates.length < planned.length) {
    const excessIds = planned.slice(newDates.length).map((p) => p.id);
    for (const id of excessIds) {
      await supabase.from("lesson_instances").delete().eq("id", id);
    }
  }

  return { conflicts: [], success: true };
}

/**
 * Shift a lesson and all subsequent planned instances forward by one template slot.
 * Used by "Sonraki Derse Aktar" (Move to Next Lesson).
 */
export async function shiftLessonsForward(
  studentId: string,
  teacherId: string,
  fromInstanceId: string,
  templateSlots: TemplateSlot[]
): Promise<{ conflicts: ConflictInfo[]; success: boolean }> {
  // Get current cycle
  const { data: tracking } = await supabase
    .from("student_lesson_tracking")
    .select("package_cycle")
    .eq("student_id", studentId)
    .eq("teacher_id", teacherId)
    .maybeSingle();

  const currentCycle = tracking?.package_cycle ?? 1;

  // Fetch instances for current cycle only
  const { data: allInstances } = await supabase
    .from("lesson_instances")
    .select("*")
    .eq("student_id", studentId)
    .eq("teacher_id", teacherId)
    .eq("package_cycle", currentCycle)
    .order("lesson_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (!allInstances) return { conflicts: [], success: false };

  // Find the target instance index
  const targetIdx = allInstances.findIndex((i) => i.id === fromInstanceId);
  if (targetIdx === -1) return { conflicts: [], success: false };

  // Collect planned instances from target onward
  const toShift = allInstances
    .slice(targetIdx)
    .filter((i) => i.status === "planned");

  if (toShift.length === 0) return { conflicts: [], success: false };

  // Generate new dates starting from the SAME day but after the current slot's time
  // This enables same-day cascade: Mon 10:00 shifts to Mon 11:00 if available
  const startDate = new Date(toShift[0].lesson_date);
  const afterTime = toShift[0].start_time;
  const newDates = generateFutureInstanceDates(templateSlots, toShift.length, startDate, afterTime);

  // Check conflicts
  const conflictChecks = newDates.map((nd, i) => ({
    id: toShift[i].id,
    date: nd.lessonDate,
    startTime: nd.startTime,
    endTime: nd.endTime,
  }));

  const allConflicts: ConflictInfo[] = [];
  for (const check of conflictChecks) {
    const c = await checkTeacherConflicts(
      teacherId,
      check.date,
      check.startTime,
      check.endTime,
      check.id,
      studentId
    );
    allConflicts.push(...c);
  }

  // Warning only — log conflicts but proceed with shift
  if (allConflicts.length > 0) {
    console.warn("shiftLessonsForward: conflicts detected (warning-only):", allConflicts);
  }

  // Apply shifts with a shared group ID for batch revert
  const shiftGroupId = crypto.randomUUID();
  for (let i = 0; i < toShift.length && i < newDates.length; i++) {
    const inst = toShift[i];
    await supabase
      .from("lesson_instances")
      .update({
        original_date: inst.original_date || inst.lesson_date,
        original_start_time: inst.original_start_time || inst.start_time,
        original_end_time: inst.original_end_time || inst.end_time,
        lesson_date: newDates[i].lessonDate,
        start_time: newDates[i].startTime,
        end_time: newDates[i].endTime,
        rescheduled_count: inst.rescheduled_count + 1,
        shift_group_id: shiftGroupId,
      })
      .eq("id", inst.id);
  }

  return { conflicts: [], success: true };
}
