/**
 * Shared types and utilities for lesson tracking, scheduling, and overrides.
 * Eliminates duplicate interface definitions across LessonTracker, StudentLessonTracker,
 * EditStudentDialog, and LessonOverrideDialog.
 */

/** Map of lesson number (string key) to date string (yyyy-MM-dd) */
export interface LessonDates {
  [key: string]: string;
}

/** Full lesson instance row from the lesson_instances table */
export interface LessonInstance {
  id: string;
  student_id: string;
  teacher_id: string;
  lesson_number: number;
  lesson_date: string;
  start_time: string;
  end_time: string;
  status: string; // 'planned' | 'completed'
  original_date: string | null;
  original_start_time: string | null;
  original_end_time: string | null;
  rescheduled_count: number;
  package_cycle: number;
  is_manual_override?: boolean;
  shift_group_id?: string | null;
  created_at?: string;
  updated_at?: string;
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
 * Returns the Turkish name for a day of week (0=Pazar, 1=Pazartesi, ..., 6=Cumartesi).
 * Previously duplicated in AdminDashboard and TeacherDashboard.
 */
export function getDayName(dayOfWeek?: number): string {
  const days = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
  return dayOfWeek !== undefined ? days[dayOfWeek] : "";
}
