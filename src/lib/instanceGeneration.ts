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
/**
 * Given a sorted template slot ring, find the slot BEFORE the given date+time.
 * Returns null if no prior slot exists (e.g., already at the earliest possible position).
 * Used by backward arrow to shift chain one slot back.
 */
export function getSlotBefore(
  templateSlots: TemplateSlot[],
  currentDate: Date,
  currentTime: string
): { date: Date; startTime: string; endTime: string } | null {
  if (templateSlots.length === 0) return null;

  const sortedSlots = [...templateSlots].sort((a, b) => {
    if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
    return a.startTime.localeCompare(b.startTime);
  });

  const currentDow = currentDate.getDay();

  // Find current slot's index in the sorted ring
  const currentIdx = sortedSlots.findIndex(
    (s) => s.dayOfWeek === currentDow && s.startTime === currentTime
  );

  if (currentIdx === -1) return null;

  // Previous slot in the ring
  const prevIdx = currentIdx - 1;

  if (prevIdx >= 0) {
    // Previous slot is in the same week, possibly same day or earlier day
    const prevSlot = sortedSlots[prevIdx];
    const dayDiff = currentDow - prevSlot.dayOfWeek;
    const prevDate = addDays(currentDate, -dayDiff);
    return { date: prevDate, startTime: prevSlot.startTime, endTime: prevSlot.endTime };
  } else {
    // Wrap around: previous slot is last slot from previous week
    const prevSlot = sortedSlots[sortedSlots.length - 1];
    let dayDiff = currentDow - prevSlot.dayOfWeek;
    if (dayDiff <= 0) dayDiff += 7;
    const prevDate = addDays(currentDate, -dayDiff);
    return { date: prevDate, startTime: prevSlot.startTime, endTime: prevSlot.endTime };
  }
}

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

  // Determine start date for regeneration: same day as last completed (with afterTime), or today
  const today = startOfDay(new Date());
  let startFrom = today;
  let afterTime: string | undefined;
  if (completed.length > 0) {
    const lastCompleted = completed[completed.length - 1];
    const lastDate = startOfDay(new Date(lastCompleted.lesson_date));
    startFrom = isBefore(lastDate, today) ? today : lastDate;
    // Use afterTime to skip slots at or before the last completed lesson's time on same day
    if (startFrom.getTime() === lastDate.getTime()) {
      afterTime = lastCompleted.start_time;
    }
  }

  // Enforce total_rights cap
  const plannedCount = Math.max(0, totalLessons - completed.length);
  const newDates = generateFutureInstanceDates(newSlots, plannedCount, startFrom, afterTime);

  // Check conflicts in parallel (warning-only)
  const conflictResults = await Promise.all(
    newDates.map((nd) =>
      checkTeacherConflicts(teacherId, nd.lessonDate, nd.startTime, nd.endTime, undefined, studentId)
    )
  );
  const allConflicts = conflictResults.flat();

  if (allConflicts.length > 0) {
    console.warn("syncTemplateChange: conflicts detected (warning-only):", allConflicts);
  }

  // Batch update planned instances
  if (planned.length > 0 && newDates.length > 0) {
    const updatePromises = planned.slice(0, Math.min(planned.length, newDates.length)).map((p, i) =>
      supabase
        .from("lesson_instances")
        .update({
          lesson_date: newDates[i].lessonDate,
          start_time: newDates[i].startTime,
          end_time: newDates[i].endTime,
        })
        .eq("id", p.id)
    );
    const updateResults = await Promise.all(updatePromises);
    const updateErrors = updateResults.filter(r => r.error);
    if (updateErrors.length > 0) {
      throw new Error(`Instance güncelleme hatası: ${updateErrors.map(e => e.error?.message).join(', ')}`);
    }
  }

  // If more planned lessons than before, batch insert
  if (newDates.length > planned.length) {
    const nextLessonNumber = Math.max(...existing.map((e) => e.lesson_number), 0) + 1;
    const toInsert = newDates.slice(planned.length).map((nd, i) => ({
      student_id: studentId,
      teacher_id: teacherId,
      lesson_number: nextLessonNumber + i,
      lesson_date: nd.lessonDate,
      start_time: nd.startTime,
      end_time: nd.endTime,
      status: "planned",
      package_cycle: currentCycle,
    }));
    const { error: insertError } = await supabase.from("lesson_instances").insert(toInsert);
    if (insertError) throw new Error(`Instance ekleme hatası: ${insertError.message}`);
  }

  // If fewer planned lessons, batch delete
  if (newDates.length < planned.length) {
    const excessIds = planned.slice(newDates.length).map((p) => p.id);
    const { error: deleteError } = await supabase.from("lesson_instances").delete().in("id", excessIds);
    if (deleteError) throw new Error(`Instance silme hatası: ${deleteError.message}`);
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

  // Check conflicts in parallel (warning-only)
  const conflictResults = await Promise.all(
    newDates.map((nd, i) =>
      checkTeacherConflicts(teacherId, nd.lessonDate, nd.startTime, nd.endTime, toShift[i].id, studentId)
    )
  );
  const allConflicts = conflictResults.flat();

  if (allConflicts.length > 0) {
    console.warn("shiftLessonsForward: conflicts detected (warning-only):", allConflicts);
  }

  // Apply shifts in parallel with a shared group ID for batch revert
  const shiftGroupId = crypto.randomUUID();
  const shiftResults = await Promise.all(
    toShift.slice(0, newDates.length).map((inst, i) =>
      supabase
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
        .eq("id", inst.id)
    )
  );
  const shiftErrors = shiftResults.filter(r => r.error);
  if (shiftErrors.length > 0) {
    throw new Error(`Shift güncelleme hatası: ${shiftErrors.map(e => e.error?.message).join(', ')}`);
  }

  return { conflicts: [], success: true };
}
