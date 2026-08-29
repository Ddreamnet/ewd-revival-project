/**
 * Generate/regenerate lesson instances from template slots.
 * Handles template changes, future instance regeneration, and
 * "move to next lesson" cascading shift logic.
 * 
 * IMPORTANT: All generation functions support multiple slots on the same day
 * (e.g., a student with Mon 10:00 AND Mon 11:00). Slots on the same day are
 * sorted by startTime and each produces a separate instance.
 */

import { addDays, startOfDay } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { checkTeacherConflicts, ConflictInfo } from "./conflictDetection";
import { toDbTime, isSameTime, parseLocalDate, toDateStr } from "./lessonTypes";

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
    return toDbTime(a.startTime).localeCompare(toDbTime(b.startTime));
  });

  const currentDow = currentDate.getDay();

  // Find current slot's index in the sorted ring.
  // Compared through isSameTime: template slots may carry "09:00" while the
  // instance carries "09:00:00", and a raw === never matched — which made the
  // backward-shift arrow silently do nothing ("Daha geriye kaydırılamaz").
  const currentIdx = sortedSlots.findIndex(
    (s) => s.dayOfWeek === currentDow && isSameTime(s.startTime, currentTime)
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
  // Normalize every slot time up front so ordering and the afterTime cutoff
  // below compare like-for-like (see toDbTime in lessonTypes).
  const sortedSlots = [...templateSlots]
    .map((s) => ({
      dayOfWeek: s.dayOfWeek,
      startTime: toDbTime(s.startTime),
      endTime: toDbTime(s.endTime),
    }))
    .sort((a, b) => {
      if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
      return a.startTime.localeCompare(b.startTime);
    });

  const cutoff = afterTime ? toDbTime(afterTime) : undefined;
  const currentDate = startOfDay(parseLocalDate(startFromDate));
  const maxDays = 200; // Safety limit

  for (let offset = 0; offset < maxDays && results.length < count; offset++) {
    const candidate = addDays(currentDate, offset);
    const dow = candidate.getDay();

    // Find ALL slots matching this day of week (not just the first)
    const matchingSlots = sortedSlots.filter((s) => s.dayOfWeek === dow);

    for (const slot of matchingSlots) {
      if (results.length >= count) break;
      // On the first day (offset=0), skip slots at or before afterTime.
      // Unnormalized, "09:00:00" <= "09:00" was false and the anchor slot got
      // regenerated on top of itself — one source of duplicate lesson rows.
      if (offset === 0 && cutoff && slot.startTime <= cutoff) continue;
      results.push({
        lessonDate: toDateStr(candidate),
        startTime: slot.startTime,
        endTime: slot.endTime,
      });
    }
  }

  return results;
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
  const startDate = parseLocalDate(toShift[0].lesson_date);
  const afterTime = toDbTime(toShift[0].start_time);
  const newDates = generateFutureInstanceDates(templateSlots, toShift.length, startDate, afterTime);

  // One atomic RPC: conflict check, sentinel-parked reorder, override
  // bookkeeping and renumbering all happen in a single transaction.
  //
  // This used to run the conflict check and then N parallel UPDATEs. Because
  // `uniq_active_planned_slot` is a partial UNIQUE index on
  // (student_id, lesson_date, start_time) WHERE status='planned', the lesson
  // moving into the next slot collided with the lesson still occupying it
  // whenever the writes landed in an unlucky order — the intermittent
  // "zaten bir ders var" failure when postponing a lesson. A mid-flight error
  // also left the chain half-shifted, with no rollback.
  const count = Math.min(toShift.length, newDates.length);
  const shiftGroupId = crypto.randomUUID();

  const { data, error } = await supabase.rpc("rpc_apply_chain_dates", {
    p_student_id: studentId,
    p_teacher_id: teacherId,
    p_updates: toShift.slice(0, count).map((inst, i) => ({
      id: inst.id,
      lessonDate: newDates[i].lessonDate,
      startTime: newDates[i].startTime,
      endTime: newDates[i].endTime,
    })),
    p_mark_override: true,
    p_shift_group_id: shiftGroupId,
  });

  if (error) throw new Error(`Shift güncelleme hatası: ${error.message}`);

  const result = data as unknown as {
    success: boolean;
    error?: string;
    conflict_student?: string;
    conflict_date?: string;
    conflict_time?: string;
  };

  if (!result?.success) {
    if (result?.error === "conflict") {
      return {
        conflicts: [
          {
            studentName: result.conflict_student || "Bilinmeyen Öğrenci",
            date: result.conflict_date || "",
            timeRange: result.conflict_time || "",
            type: result.conflict_student === "Deneme Dersi" ? "trial" : "lesson",
            teacherId,
          },
        ],
        success: false,
      };
    }
    throw new Error(result?.error || "Dersler kaydırılamadı");
  }

  return { conflicts: [], success: true };
}
