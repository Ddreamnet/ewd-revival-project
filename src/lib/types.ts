/**
 * Centralized domain types used across multiple components.
 * Eliminates duplicate interface definitions and prevents drift.
 */

// =============================================================================
// STUDENT LESSON
// =============================================================================

/** Base student lesson with camelCase fields (used by forms/dialogs) */
export interface StudentLessonBase {
  id?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  note?: string;
  isCompleted?: boolean;
}

/** Student lesson with snake_case fields (used by schedule grid components) */
export interface StudentLessonSchedule {
  id: string;
  student_id: string;
  student_name: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_completed?: boolean;
  note?: string;
  /** Override metadata for schedule rendering */
  _originalStartTime?: string;
  _originalEndTime?: string;
  _hasOverride?: boolean;
}

/** Trial lesson used by schedule components */
export interface TrialLesson {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_completed: boolean;
  lesson_date: string;
}

// =============================================================================
// STUDENT
// =============================================================================

export interface StudentProfile {
  full_name: string;
  email: string;
}

export interface Student {
  id: string;
  student_id: string;
  lessons: StudentLessonBase[];
  is_archived?: boolean;
  about_text?: string | null;
  profiles: StudentProfile;
}

// =============================================================================
// TEACHER
// =============================================================================

export interface Teacher {
  user_id: string;
  full_name: string;
  email: string;
  students: Student[];
}

// =============================================================================
// TOPIC / RESOURCE
// =============================================================================

export interface Resource {
  id: string;
  title: string;
  description: string | null;
  resource_type: string;
  resource_url: string;
  order_index: number;
  is_completed?: boolean;
  completed_at?: string | null;
}

export interface Topic {
  id: string;
  title: string;
  description: string | null;
  is_completed: boolean;
  completed_at?: string | null;
  order_index: number;
  resources: Resource[];
  isGlobal?: boolean;
}

// =============================================================================
// DAYS OF WEEK (shared dropdown data)
// =============================================================================

export const DAYS_OF_WEEK = [
  { value: 1, label: "Pazartesi" },
  { value: 2, label: "Salı" },
  { value: 3, label: "Çarşamba" },
  { value: 4, label: "Perşembe" },
  { value: 5, label: "Cuma" },
  { value: 6, label: "Cumartesi" },
  { value: 0, label: "Pazar" },
] as const;
