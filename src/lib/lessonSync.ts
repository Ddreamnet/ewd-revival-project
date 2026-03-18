/**
 * Lesson sync utilities.
 */

import { supabase } from "@/integrations/supabase/client";

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
