/**
 * Canonical helper to rebuild student_lesson_tracking.lesson_dates
 * from lesson_instances. Prevents drift between the two data sources.
 */

import { supabase } from "@/integrations/supabase/client";

/**
 * Rebuilds the legacy lesson_dates JSON in student_lesson_tracking
 * from the authoritative lesson_instances table.
 *
 * MUST be called after any operation that changes instance dates/times:
 * - EditStudentDialog.confirmDateUpdate (both ON and OFF paths)
 * - EditStudentDialog.handleSubmit (template sync)
 * - LessonOverrideDialog.handleOneTimeChange
 * - LessonOverrideDialog.handlePostponeToNextLesson
 * - LessonOverrideDialog.handleRevert
 * - instanceGeneration.syncTemplateChange / shiftLessonsForward
 */
export async function rebuildLegacyLessonDatesFromInstances(
  studentId: string,
  teacherId: string
): Promise<void> {
  try {
    const { data: instances } = await supabase
      .from("lesson_instances")
      .select("lesson_number, lesson_date")
      .eq("student_id", studentId)
      .eq("teacher_id", teacherId)
      .in("status", ["planned", "completed"])
      .order("lesson_number", { ascending: true });

    if (!instances || instances.length === 0) return;

    const lessonDates: Record<string, string> = {};
    instances.forEach((inst) => {
      lessonDates[inst.lesson_number.toString()] = inst.lesson_date;
    });

    await supabase
      .from("student_lesson_tracking")
      .update({ lesson_dates: lessonDates })
      .eq("student_id", studentId)
      .eq("teacher_id", teacherId);
  } catch (err) {
    console.error("Error rebuilding legacy lesson_dates from instances:", err);
  }
}

/**
 * Checks if a given date falls on a weekday present in the student's template slots.
 * Returns the template day names if not matching.
 */
export async function checkNonTemplateWeekday(
  studentId: string,
  teacherId: string,
  dateStr: string
): Promise<{ isNonTemplate: boolean; templateDays: string[] }> {
  try {
    const { data: templateSlots } = await supabase
      .from("student_lessons")
      .select("day_of_week")
      .eq("student_id", studentId)
      .eq("teacher_id", teacherId);

    if (!templateSlots || templateSlots.length === 0) {
      return { isNonTemplate: false, templateDays: [] };
    }

    const templateDayNumbers = templateSlots.map((s) => s.day_of_week);
    const targetDate = new Date(dateStr);
    const targetDay = targetDate.getDay(); // 0=Sun, 1=Mon, ...

    const dayNames = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
    const templateDayNames = templateDayNumbers.map((d) => dayNames[d]);

    return {
      isNonTemplate: !templateDayNumbers.includes(targetDay),
      templateDays: templateDayNames,
    };
  } catch {
    return { isNonTemplate: false, templateDays: [] };
  }
}
