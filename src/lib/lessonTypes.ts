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

// ─── Time & date normalization ──────────────────────────────────────────
// Postgres `time` columns always come back as "HH:MM:SS", but <input type="time">
// produces "HH:MM". Comparing the two as raw strings silently misfires:
// "10:00" < "10:00:00" is true (prefix rule), so a back-to-back lesson reads as
// an overlap and an already-used slot fails its "skip" check. Every comparison
// and every value written to the DB goes through toDbTime first.

/** Canonical DB form: "9:5" | "09:05" | "09:05:00" -> "09:05:00". */
export function toDbTime(time: string | null | undefined): string {
  if (!time) return "";
  const parts = String(time).trim().split(":");
  if (parts.length < 2) return String(time);
  const pad = (n: string) => n.padStart(2, "0");
  return `${pad(parts[0])}:${pad(parts[1])}:${pad(parts[2] ?? "00")}`;
}

/** Form-input form: "09:05:00" -> "09:05". */
export function toInputTime(time: string | null | undefined): string {
  if (!time) return "";
  return toDbTime(time).slice(0, 5);
}

/** True when two times denote the same instant, regardless of seconds notation. */
export function isSameTime(a: string, b: string): boolean {
  return toDbTime(a) === toDbTime(b);
}

/**
 * Parses "yyyy-MM-dd" as LOCAL midnight.
 * `new Date("2026-03-10")` is parsed as UTC midnight, which resolves to the
 * previous calendar day for any viewer behind UTC — day-of-week math then
 * lands on the wrong weekday. Always parse date-only strings through this.
 */
export function parseLocalDate(dateStr: string | Date): Date {
  if (dateStr instanceof Date) return dateStr;
  const [y, m, d] = String(dateStr).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return new Date(dateStr);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/** Formats a Date as "yyyy-MM-dd" in LOCAL time (never shifts across midnight). */
export function toDateStr(date: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
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
