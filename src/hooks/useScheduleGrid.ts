/**
 * Shared schedule grid logic for AdminWeeklySchedule and WeeklyScheduleDialog.
 * Extracts ~100 lines of near-identical grid positioning, time slot calculation,
 * and trial lesson lookup logic.
 */

import { useMemo } from "react";
import { format, startOfWeek, addDays } from "date-fns";
import { getLessonDateForCurrentWeek, LessonOverride } from "@/hooks/useLessonOverrides";

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

/**
 * Get the date for a specific day index (0=Mon, 6=Sun) in the current week.
 */
export function getDateForDayIndex(dayIndex: number): Date {
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  return addDays(weekStart, dayIndex);
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
 * Finds a trial lesson for a specific day and time slot in the current week.
 */
export function getTrialLessonForDayAndTime<T extends TrialLessonInfo>(
  trialLessons: T[],
  dayIndex: number,
  timeSlot: string
): T | undefined {
  const dbDayOfWeek = dayIndexToDbDayOfWeek(dayIndex);
  const dateForDay = getDateForDayIndex(dayIndex);
  const dateStr = format(dateForDay, "yyyy-MM-dd");
  return trialLessons.find(
    (l) => l.day_of_week === dbDayOfWeek && l.start_time === timeSlot && l.lesson_date === dateStr
  );
}
