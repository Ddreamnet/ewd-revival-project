/**
 * Shared types and utilities for lesson tracking, scheduling, and overrides.
 * Eliminates duplicate interface definitions across LessonTracker, StudentLessonTracker,
 * EditStudentDialog, and LessonOverrideDialog.
 */

/** Map of lesson number (string key) to date string (yyyy-MM-dd) */
export interface LessonDates {
  [key: string]: string;
}

/** Lightweight override info used by tracker components (not the full DB row) */
export interface LessonOverrideInfo {
  id: string;
  original_date: string;
  new_date: string | null;
  is_cancelled: boolean;
}

/** A single lesson with its dates and override status, used for display */
export interface SortedLesson {
  lessonNumber: number;
  originalDate: string;
  effectiveDate: string;
  isCancelled: boolean;
  isOverridden: boolean;
}

/** Display data for a single lesson position in the tracker grid */
export interface DisplayLessonData {
  lessonNumber: number;
  displayDate: string | null;
  isCancelled: boolean;
  isOverridden: boolean;
}

/**
 * Calculates tracker grid row configuration based on lessons per week.
 * Used by both LessonTracker (teacher) and StudentLessonTracker (student).
 */
export function getRowConfig(lessonsPerWeek: number): { rows: number; buttonsPerRow: number } {
  if (lessonsPerWeek === 1) return { rows: 1, buttonsPerRow: 4 };
  if (lessonsPerWeek === 2) return { rows: 2, buttonsPerRow: 4 };
  return { rows: 2, buttonsPerRow: 6 };
}

/**
 * Formats a time string (HH:MM:SS) for display using Turkish locale.
 * Used across schedule and tracker components.
 */
export function formatTime(time: string): string {
  try {
    return new Date(`2000-01-01T${time}`).toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return time;
  }
}

/**
 * Calculates lesson duration in minutes from start and end time strings.
 */
export function calculateDurationMinutes(startTime: string, endTime: string): number {
  const start = new Date(`2000-01-01T${startTime}`);
  const end = new Date(`2000-01-01T${endTime}`);
  return Math.round((end.getTime() - start.getTime()) / 60000);
}
