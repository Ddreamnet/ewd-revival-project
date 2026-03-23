/**
 * Pure functions for lesson date calculation (date-walking algorithms).
 * Also contains non-template weekday checking (moved from lessonSync.ts).
 */

import { addDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

/**
 * Finds the next lesson date after a given date, based on the student's weekly pattern.
 * Used by LessonOverrideDialog for "Sonraki Derse Aktar" preview.
 * 
 * NOTE: This is day-of-week based only (slot-agnostic). It does NOT distinguish
 * between multiple slots on the same day. This is acceptable because it's only
 * used for preview purposes, not for actual instance generation.
 * 
 * @param currentDate - The date to search from
 * @param lessonDays - Array of day_of_week values
 * @returns The next available lesson date, or null if not found within 14 days
 */
export function calculateNextLessonDate(
  currentDate: Date,
  lessonDays: number[]
): Date | null {
  if (lessonDays.length === 0) return null;

  let nextDate = new Date(currentDate);
  nextDate.setHours(0, 0, 0, 0);

  // Start from next day
  nextDate = addDays(nextDate, 1);

  let attempts = 0;
  while (!lessonDays.includes(nextDate.getDay()) && attempts < 14) {
    nextDate = addDays(nextDate, 1);
    attempts++;
  }

  if (attempts >= 14) return null;

  return nextDate;
}

/**
 * Checks if a given date falls on a weekday present in the student's template slots.
 * Returns the template day names if not matching.
 * Used as a non-blocking warning only.
 * 
 * Moved from lessonSync.ts (single-function file consolidation).
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
