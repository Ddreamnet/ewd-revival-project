/**
 * Interval-based conflict detection for teacher schedules.
 * Checks lesson_instances + trial_lessons for time overlaps.
 * Back-to-back (endA == startB) is NOT a conflict.
 */

import { supabase } from "@/integrations/supabase/client";
import { toDbTime } from "./lessonTypes";

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
 *
 * Both sides are normalized to HH:MM:SS first. Without that, a form value
 * ("10:00") compared against a DB value ("10:00:00") makes the lexicographic
 * `<` treat the shorter string as *smaller* — so a lesson starting exactly when
 * another ends was reported as a conflict. That was the phantom "çakışma var"
 * users hit when moving a lesson next to an adjacent one.
 */
export function hasTimeOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  const sA = toDbTime(startA);
  const eA = toDbTime(endA);
  const sB = toDbTime(startB);
  const eB = toDbTime(endB);
  return sA < eB && eA > sB;
}

/**
 * Check a teacher's ACTUAL schedule for conflicts on a given date + time range.
 * Queries lesson_instances (planned/completed) and trial_lessons.
 *
 * Pass `excludeInstanceIds` to ignore the row(s) currently being moved/edited
 * (a single edit passes one id; a batch shift passes every id in the batch).
 * Self-conflicts within the same student are now reported — the caller
 * decides whether to allow them. The previous `excludeStudentId` parameter
 * silenced these and is the root cause of the duplicate slot bug, so it has
 * been removed.
 */
export async function checkTeacherConflicts(
  teacherId: string,
  date: string,
  startTime: string,
  endTime: string,
  excludeInstanceIds: string | string[] = []
): Promise<ConflictInfo[]> {
  const conflicts: ConflictInfo[] = [];
  const excludeIds = Array.isArray(excludeInstanceIds)
    ? excludeInstanceIds.filter(Boolean)
    : excludeInstanceIds
      ? [excludeInstanceIds]
      : [];

  // 1. Check lesson_instances for that teacher on that date
  let instanceQuery = supabase
    .from("lesson_instances")
    .select("id, student_id, start_time, end_time")
    .eq("teacher_id", teacherId)
    .eq("lesson_date", date)
    .in("status", ["planned", "completed"]);

  if (excludeIds.length === 1) {
    instanceQuery = instanceQuery.neq("id", excludeIds[0]);
  } else if (excludeIds.length > 1) {
    instanceQuery = instanceQuery.not("id", "in", `(${excludeIds.join(",")})`);
  }

  const { data: instances } = await instanceQuery;

  if (instances && instances.length > 0) {
    // Exclude archived students from conflict reporting — their old completed
    // rows live on for balance integrity but shouldn't block new scheduling.
    const studentIds = [...new Set(instances.map((i) => i.student_id))];
    const { data: activeRows } = await supabase
      .from("students")
      .select("student_id")
      .eq("teacher_id", teacherId)
      .eq("is_archived", false)
      .in("student_id", studentIds);
    const activeIds = new Set((activeRows || []).map((r) => r.student_id));
    const activeInstances = instances.filter((i) => activeIds.has(i.student_id));

    if (activeInstances.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", [...new Set(activeInstances.map((i) => i.student_id))]);

      const nameMap = new Map(
        (profiles || []).map((p) => [p.user_id, p.full_name])
      );

      for (const inst of activeInstances) {
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
