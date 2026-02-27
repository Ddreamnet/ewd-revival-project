/**
 * Centralized teacher balance operations.
 * Replaces 4+ duplicate implementations across LessonTracker, EditStudentDialog,
 * AdminWeeklySchedule, and WeeklyScheduleDialog.
 */

import { supabase } from "@/integrations/supabase/client";
import { calculateDurationMinutes } from "./lessonTypes";

interface BalanceUpdateParams {
  teacherId: string;
  lessonType: "regular" | "trial";
  startTime: string;
  endTime: string;
}

/**
 * Adds lesson duration to teacher balance. Creates balance record if none exists.
 * 
 * For regular lessons: increments completed_regular_lessons and regular_lessons_minutes.
 * For trial lessons: increments completed_trial_lessons and trial_lessons_minutes.
 */
export async function addToTeacherBalance({
  teacherId,
  lessonType,
  startTime,
  endTime,
}: BalanceUpdateParams): Promise<void> {
  try {
    const durationMinutes = calculateDurationMinutes(startTime, endTime);

    const { data: existingBalance } = await supabase
      .from("teacher_balance")
      .select("*")
      .eq("teacher_id", teacherId)
      .maybeSingle();

    if (existingBalance) {
      const updates =
        lessonType === "regular"
          ? {
              total_minutes: existingBalance.total_minutes + durationMinutes,
              completed_regular_lessons: existingBalance.completed_regular_lessons + 1,
              regular_lessons_minutes: existingBalance.regular_lessons_minutes + durationMinutes,
            }
          : {
              total_minutes: existingBalance.total_minutes + durationMinutes,
              completed_trial_lessons: existingBalance.completed_trial_lessons + 1,
              trial_lessons_minutes: existingBalance.trial_lessons_minutes + durationMinutes,
            };

      await supabase
        .from("teacher_balance")
        .update(updates)
        .eq("teacher_id", teacherId);
    } else {
      await supabase.from("teacher_balance").insert({
        teacher_id: teacherId,
        total_minutes: durationMinutes,
        completed_regular_lessons: lessonType === "regular" ? 1 : 0,
        completed_trial_lessons: lessonType === "trial" ? 1 : 0,
        regular_lessons_minutes: lessonType === "regular" ? durationMinutes : 0,
        trial_lessons_minutes: lessonType === "trial" ? durationMinutes : 0,
      });
    }
  } catch (error) {
    console.error("Error updating teacher balance:", error);
  }
}

/**
 * Subtracts lesson duration from teacher balance (undo operation).
 * Uses Math.max(0, ...) to prevent negative values.
 */
export async function subtractFromTeacherBalance({
  teacherId,
  lessonType,
  startTime,
  endTime,
}: BalanceUpdateParams): Promise<void> {
  try {
    const durationMinutes = calculateDurationMinutes(startTime, endTime);

    const { data: existingBalance } = await supabase
      .from("teacher_balance")
      .select("*")
      .eq("teacher_id", teacherId)
      .maybeSingle();

    if (existingBalance) {
      const updates =
        lessonType === "regular"
          ? {
              total_minutes: Math.max(0, existingBalance.total_minutes - durationMinutes),
              completed_regular_lessons: Math.max(0, existingBalance.completed_regular_lessons - 1),
              regular_lessons_minutes: Math.max(0, existingBalance.regular_lessons_minutes - durationMinutes),
            }
          : {
              total_minutes: Math.max(0, existingBalance.total_minutes - durationMinutes),
              completed_trial_lessons: Math.max(0, existingBalance.completed_trial_lessons - 1),
              trial_lessons_minutes: Math.max(0, existingBalance.trial_lessons_minutes - durationMinutes),
            };

      await supabase
        .from("teacher_balance")
        .update(updates)
        .eq("teacher_id", teacherId);
    }
  } catch (error) {
    console.error("Error subtracting from teacher balance:", error);
  }
}

/**
 * Convenience: fetches lesson times from student_lessons, then adds to balance.
 * Used when only studentId/teacherId are known (no start/end time available directly).
 */
export async function addRegularLessonBalance(teacherId: string, studentId: string): Promise<void> {
  try {
    const { data: lessonData } = await supabase
      .from("student_lessons")
      .select("start_time, end_time")
      .eq("student_id", studentId)
      .eq("teacher_id", teacherId)
      .limit(1)
      .single();

    if (!lessonData) return;

    await addToTeacherBalance({
      teacherId,
      lessonType: "regular",
      startTime: lessonData.start_time,
      endTime: lessonData.end_time,
    });
  } catch (error) {
    console.error("Error adding regular lesson balance:", error);
  }
}

/**
 * Convenience: fetches lesson times from student_lessons, then subtracts from balance.
 */
export async function subtractRegularLessonBalance(teacherId: string, studentId: string): Promise<void> {
  try {
    const { data: lessonData } = await supabase
      .from("student_lessons")
      .select("start_time, end_time")
      .eq("student_id", studentId)
      .eq("teacher_id", teacherId)
      .limit(1)
      .single();

    if (!lessonData) return;

    await subtractFromTeacherBalance({
      teacherId,
      lessonType: "regular",
      startTime: lessonData.start_time,
      endTime: lessonData.end_time,
    });
  } catch (error) {
    console.error("Error subtracting regular lesson balance:", error);
  }
}
