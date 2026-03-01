/**
 * Interval-based conflict detection for teacher schedules.
 * Checks lesson_instances + trial_lessons for time overlaps.
 * Back-to-back (endA == startB) is NOT a conflict.
 */

import { supabase } from "@/integrations/supabase/client";

export interface ConflictInfo {
  studentName: string;
  date: string;
  timeRange: string;
  type: "lesson" | "trial";
  teacherId: string;
}

/**
 * Core overlap check: overlap if startA < endB AND endA > startB.
 * Back-to-back (endA == startB or endB == startA) is allowed.
 */
export function hasTimeOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  return startA < endB && endA > startB;
}

/**
 * Check a teacher's ACTUAL schedule for conflicts on a given date + time range.
 * Queries lesson_instances (planned/completed) and trial_lessons.
 * Optionally excludes one instance (for edits).
 */
export async function checkTeacherConflicts(
  teacherId: string,
  date: string,
  startTime: string,
  endTime: string,
  excludeInstanceId?: string,
  excludeStudentId?: string
): Promise<ConflictInfo[]> {
  const conflicts: ConflictInfo[] = [];

  // 1. Check lesson_instances for that teacher on that date
  let instanceQuery = supabase
    .from("lesson_instances")
    .select("id, student_id, start_time, end_time")
    .eq("teacher_id", teacherId)
    .eq("lesson_date", date)
    .in("status", ["planned", "completed"]);

  if (excludeInstanceId) {
    instanceQuery = instanceQuery.neq("id", excludeInstanceId);
  }

  const { data: instances } = await instanceQuery;

  if (instances) {
    // Filter out all instances of the excluded student (self-conflict prevention)
    const filtered = excludeStudentId
      ? instances.filter((i) => i.student_id !== excludeStudentId)
      : instances;

    // Fetch student names for conflicting instances
    const studentIds = [...new Set(filtered.map((i) => i.student_id))];
    const { data: profiles } = studentIds.length > 0
      ? await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", studentIds)
      : { data: [] };

    const nameMap = new Map(
      (profiles || []).map((p) => [p.user_id, p.full_name])
    );

    for (const inst of filtered) {
      if (hasTimeOverlap(startTime, endTime, inst.start_time, inst.end_time)) {
        conflicts.push({
          studentName: nameMap.get(inst.student_id) || "Bilinmeyen Öğrenci",
          date,
          timeRange: `${inst.start_time.slice(0, 5)} - ${inst.end_time.slice(0, 5)}`,
          type: "lesson",
          teacherId,
        });
      }
    }
  }

  // 2. Check trial_lessons for that teacher on that date
  const { data: trials } = await supabase
    .from("trial_lessons")
    .select("id, start_time, end_time")
    .eq("teacher_id", teacherId)
    .eq("lesson_date", date);

  if (trials) {
    for (const trial of trials) {
      if (hasTimeOverlap(startTime, endTime, trial.start_time, trial.end_time)) {
        conflicts.push({
          studentName: "Deneme Dersi",
          date,
          timeRange: `${trial.start_time.slice(0, 5)} - ${trial.end_time.slice(0, 5)}`,
          type: "trial",
          teacherId,
        });
      }
    }
  }

  return conflicts;
}

/**
 * Check conflicts for multiple instances at once (batch).
 * Used when shifting multiple lessons (e.g., "move to next lesson" cascading).
 */
export async function checkTeacherConflictsBatch(
  teacherId: string,
  instances: { id?: string; date: string; startTime: string; endTime: string }[]
): Promise<ConflictInfo[]> {
  const allConflicts: ConflictInfo[] = [];

  for (const inst of instances) {
    const conflicts = await checkTeacherConflicts(
      teacherId,
      inst.date,
      inst.startTime,
      inst.endTime,
      inst.id
    );
    allConflicts.push(...conflicts);
  }

  return allConflicts;
}
