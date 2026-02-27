/**
 * Pure functions for lesson date calculation (date-walking algorithms).
 * Extracted from LessonTracker, EditStudentDialog, and LessonOverrideDialog.
 */

import { format, addDays, parse } from "date-fns";
import { LessonDates } from "./lessonTypes";

/**
 * Calculates all lesson dates (forward and backward) from a marked lesson.
 * Used when a teacher marks the FIRST lesson as complete — assigns today's date
 * to the specific lesson being marked and backfills previous dates.
 * 
 * CRITICAL: The markedLessonNumber receives markedDate. Dates are calculated
 * bidirectionally from that anchor point using the student's weekly lesson days.
 * 
 * @param markedLessonNumber - Which lesson is being marked (1-based)
 * @param markedDate - The date to assign to the marked lesson
 * @param studentLessonDays - Array of day_of_week values (0=Sun, 1=Mon, etc.)
 * @param totalLessons - Total number of lessons (typically lessonsPerWeek * 4)
 */
export function calculateLessonDates(
  markedLessonNumber: number,
  markedDate: Date,
  studentLessonDays: number[],
  totalLessons: number
): LessonDates {
  if (studentLessonDays.length === 0) return {};

  const dates: LessonDates = {};

  // Set the marked lesson's date
  dates[markedLessonNumber.toString()] = format(markedDate, "yyyy-MM-dd");

  // Calculate dates for lessons BEFORE the marked lesson (going backwards)
  let currentDate = new Date(markedDate);
  currentDate.setHours(0, 0, 0, 0);

  for (let lessonCount = markedLessonNumber - 1; lessonCount >= 1; lessonCount--) {
    let daysToSubtract = 1;
    let prevDate = addDays(currentDate, -daysToSubtract);

    while (!studentLessonDays.includes(prevDate.getDay())) {
      daysToSubtract++;
      prevDate = addDays(currentDate, -daysToSubtract);
    }

    currentDate = prevDate;
    dates[lessonCount.toString()] = format(currentDate, "yyyy-MM-dd");
  }

  // Calculate dates for lessons AFTER the marked lesson (going forwards)
  currentDate = new Date(markedDate);
  currentDate.setHours(0, 0, 0, 0);

  for (let lessonCount = markedLessonNumber + 1; lessonCount <= totalLessons; lessonCount++) {
    let daysToAdd = 1;
    let nextDate = addDays(currentDate, daysToAdd);

    while (!studentLessonDays.includes(nextDate.getDay())) {
      daysToAdd++;
      nextDate = addDays(currentDate, daysToAdd);
    }

    currentDate = nextDate;
    dates[lessonCount.toString()] = format(currentDate, "yyyy-MM-dd");
  }

  return dates;
}

/**
 * Recalculates lesson dates for future lessons only (from a changed lesson forward).
 * Historical (previous) lesson dates are preserved and never modified.
 * 
 * Used in EditStudentDialog when admin changes a date and checks "Kalan günleri de güncelle".
 * 
 * @param fromLessonNumber - The lesson number whose date was changed
 * @param startDate - The new date string (yyyy-MM-dd) for that lesson
 * @param currentDates - Current lesson dates map
 * @param lessonDays - Array of day_of_week values
 * @param totalLessons - Total number of lessons
 */
export function recalculateRemainingDates(
  fromLessonNumber: number,
  startDate: string,
  currentDates: LessonDates,
  lessonDays: number[],
  totalLessons: number
): LessonDates {
  const newDates = { ...currentDates };
  const sortedDays = [...lessonDays].sort((a, b) => a - b);

  // Set the changed lesson's date
  newDates[fromLessonNumber.toString()] = startDate;

  // Recalculate FUTURE lessons only
  let currentDate = parse(startDate, "yyyy-MM-dd", new Date());
  currentDate.setHours(0, 0, 0, 0);

  for (let i = fromLessonNumber + 1; i <= totalLessons; i++) {
    let daysToAdd = 1;
    let nextDate = addDays(currentDate, daysToAdd);

    while (!sortedDays.includes(nextDate.getDay())) {
      daysToAdd++;
      nextDate = addDays(currentDate, daysToAdd);
    }

    currentDate = nextDate;
    newDates[i.toString()] = format(currentDate, "yyyy-MM-dd");
  }

  return newDates;
}

/**
 * Finds the next lesson date after a given date, based on the student's weekly pattern.
 * Used by LessonOverrideDialog for "Sonraki Derse Aktar" preview.
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
