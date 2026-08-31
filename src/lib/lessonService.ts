/**
 * Centralized lesson mutation service.
 * All lesson write operations go through these functions,
 * which call atomic Supabase RPC functions.
 *
 * This is the SINGLE write path for lesson mutations.
 * No component should directly update lesson_instances status,
 * teacher_balance, or balance tracking.
 */

import { supabase } from "@/integrations/supabase/client";

/** One entry in a student's weekly template (student_lessons). */
export interface TemplateSlot {
  dayOfWeek: number; // 0=Sun, 1=Mon, ..., 6=Sat
  startTime: string;
  endTime: string;
}

/** A blocking lesson reported by the server, ready to render. */
export interface ScheduleConflict {
  studentName: string;
  date: string;
  timeRange: string;
  type: "lesson" | "trial";
  message: string;
}

interface RpcResult {
  success: boolean;
  error?: string;
  duration_minutes?: number;
  new_cycle?: number;
  instances_created?: number;
}

/**
 * Mark the next completable lesson as completed.
 * Enforces sequential completion via RPC.
 */
export async function completeLesson(
  instanceId: string,
  teacherId: string
): Promise<RpcResult> {
  const { data, error } = await supabase.rpc("rpc_complete_lesson", {
    p_instance_id: instanceId,
    p_teacher_id: teacherId,
  });

  if (error) {
    console.error("completeLesson RPC error:", error);
    return { success: false, error: error.message };
  }

  const result = data as unknown as RpcResult;
  return result;
}

/**
 * Undo the most recent completed lesson.
 * Enforces: only the chronologically last completed in current cycle.
 * Available to both teacher and admin.
 */
export async function undoCompleteLesson(
  instanceId: string,
  teacherId: string
): Promise<RpcResult> {
  const { data, error } = await supabase.rpc("rpc_undo_complete_lesson", {
    p_instance_id: instanceId,
    p_teacher_id: teacherId,
  });

  if (error) {
    console.error("undoCompleteLesson RPC error:", error);
    return { success: false, error: error.message };
  }

  const result = data as unknown as RpcResult;
  return result;
}

/**
 * Reset package: increment cycle, preserve completed history,
 * generate fresh planned instances for new cycle.
 */
export async function resetPackage(
  studentId: string,
  teacherId: string,
  templateSlots: TemplateSlot[]
): Promise<RpcResult> {
  const slotsJsonb = templateSlots.map((s) => ({
    dayOfWeek: s.dayOfWeek,
    startTime: s.startTime,
    endTime: s.endTime,
  }));

  const { data, error } = await supabase.rpc("rpc_reset_package", {
    p_student_id: studentId,
    p_teacher_id: teacherId,
    p_template_slots: slotsJsonb,
  });

  if (error) {
    console.error("resetPackage RPC error:", error);
    return { success: false, error: error.message };
  }

  return data as unknown as RpcResult;
}

/**
 * Archive a student: set archived, delete planned instances.
 */
export async function archiveStudent(
  studentRecordId: string,
  studentUserId: string,
  teacherUserId: string
): Promise<RpcResult> {
  const { data, error } = await supabase.rpc("rpc_archive_student", {
    p_student_record_id: studentRecordId,
    p_student_user_id: studentUserId,
    p_teacher_user_id: teacherUserId,
  });

  if (error) {
    console.error("archiveStudent RPC error:", error);
    return { success: false, error: error.message };
  }

  return data as unknown as RpcResult;
}

/**
 * Permanently delete a student and all associated data.
 */
export async function deleteStudent(
  studentRecordId: string,
  studentUserId: string,
  teacherUserId: string
): Promise<RpcResult> {
  const { data, error } = await supabase.rpc("rpc_delete_student", {
    p_student_record_id: studentRecordId,
    p_student_user_id: studentUserId,
    p_teacher_user_id: teacherUserId,
  });

  if (error) {
    console.error("deleteStudent RPC error:", error);
    return { success: false, error: error.message };
  }

  return data as unknown as RpcResult;
}

/**
 * Restore an archived student and regenerate planned instances.
 */
export async function restoreStudent(
  studentRecordId: string,
  studentUserId: string,
  teacherUserId: string
): Promise<RpcResult> {
  const { data, error } = await supabase.rpc("rpc_restore_student", {
    p_student_record_id: studentRecordId,
    p_student_user_id: studentUserId,
    p_teacher_user_id: teacherUserId,
  });

  if (error) {
    console.error("restoreStudent RPC error:", error);
    return { success: false, error: error.message };
  }

  return data as unknown as RpcResult;
}

/**
 * Manual balance adjustment (admin only).
 * Separate from lesson completion metrics.
 */
export async function manualBalanceAdjust(
  teacherId: string,
  amountMinutes: number,
  notes?: string
): Promise<RpcResult> {
  const { data, error } = await supabase.rpc("rpc_manual_balance_adjust", {
    p_teacher_id: teacherId,
    p_amount_minutes: amountMinutes,
    p_notes: notes || null,
  });

  if (error) {
    console.error("manualBalanceAdjust RPC error:", error);
    return { success: false, error: error.message };
  }

  return data as unknown as RpcResult;
}

/**
 * Complete a trial lesson (separate domain from regular lessons).
 */
export async function completeTrialLesson(
  trialId: string,
  teacherId: string
): Promise<RpcResult> {
  const { data, error } = await supabase.rpc("rpc_complete_trial_lesson", {
    p_trial_id: trialId,
    p_teacher_id: teacherId,
  });

  if (error) {
    console.error("completeTrialLesson RPC error:", error);
    return { success: false, error: error.message };
  }

  return data as unknown as RpcResult;
}

/**
 * Get the next completable instance for a student (first planned by date in current cycle).
 */
export async function getNextCompletableInstance(
  studentId: string,
  teacherId: string,
  preloadedCycle?: number
): Promise<{ id: string; lesson_number: number; lesson_date: string } | null> {
  let currentCycle = preloadedCycle;
  if (currentCycle === undefined) {
    const { data: tracking } = await supabase
      .from("student_lesson_tracking")
      .select("package_cycle")
      .eq("student_id", studentId)
      .eq("teacher_id", teacherId)
      .maybeSingle();
    currentCycle = tracking?.package_cycle ?? 1;
  }

  const { data } = await supabase
    .from("lesson_instances")
    .select("id, lesson_number, lesson_date")
    .eq("student_id", studentId)
    .eq("teacher_id", teacherId)
    .eq("status", "planned")
    .eq("package_cycle", currentCycle)
    .order("lesson_date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(1)
    .maybeSingle();

  return data || null;
}

/**
 * Get the last completed instance for undo purposes (current cycle only).
 */
export async function getLastCompletedInstance(
  studentId: string,
  teacherId: string,
  preloadedCycle?: number
): Promise<{ id: string; lesson_number: number; lesson_date: string } | null> {
  let currentCycle = preloadedCycle;
  if (currentCycle === undefined) {
    const { data: tracking } = await supabase
      .from("student_lesson_tracking")
      .select("package_cycle")
      .eq("student_id", studentId)
      .eq("teacher_id", teacherId)
      .maybeSingle();
    currentCycle = tracking?.package_cycle ?? 1;
  }

  const { data } = await supabase
    .from("lesson_instances")
    .select("id, lesson_number, lesson_date")
    .eq("student_id", studentId)
    .eq("teacher_id", teacherId)
    .eq("status", "completed")
    .eq("package_cycle", currentCycle)
    .order("lesson_date", { ascending: false })
    .order("start_time", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data || null;
}

/**
 * Undo a completed trial lesson (atomic RPC).
 */
export async function undoTrialLesson(
  trialId: string,
  teacherId: string
): Promise<RpcResult> {
  const { data, error } = await supabase.rpc("rpc_undo_trial_lesson", {
    p_trial_id: trialId,
    p_teacher_id: teacherId,
  });

  if (error) {
    console.error("undoTrialLesson RPC error:", error);
    return { success: false, error: error.message };
  }

  return data as unknown as RpcResult;
}

/**
 * Get remaining rights for a student in current cycle.
 */
export async function getRemainingRights(
  studentId: string,
  teacherId: string
): Promise<{ total: number; completed: number; remaining: number; cycle: number }> {
  // Get template count
  const { count: templateCount } = await supabase
    .from("student_lessons")
    .select("id", { count: "exact", head: true })
    .eq("student_id", studentId)
    .eq("teacher_id", teacherId);

  const weeklyCount = templateCount ?? 0;
  const total = weeklyCount * 4;

  // Get current cycle
  const { data: tracking } = await supabase
    .from("student_lesson_tracking")
    .select("package_cycle")
    .eq("student_id", studentId)
    .eq("teacher_id", teacherId)
    .maybeSingle();

  const currentCycle = tracking?.package_cycle ?? 1;

  // Count completed in current cycle
  const { count: completedCount } = await supabase
    .from("lesson_instances")
    .select("id", { count: "exact", head: true })
    .eq("student_id", studentId)
    .eq("teacher_id", teacherId)
    .eq("status", "completed")
    .eq("package_cycle", currentCycle);

  const completed = completedCount ?? 0;

  return {
    total,
    completed,
    remaining: Math.max(0, total - completed),
    cycle: currentCycle,
  };
}

// ─── Rescheduling ────────────────────────────────────────────────────────────
// Every date/time change to a lesson goes through one of these. The server
// resolves times from the template, checks conflicts, writes and renumbers the
// chain inside a single transaction — the client does no date math and issues
// no direct UPDATE against lesson_instances.

export interface RescheduleResult {
  success: boolean;
  error?: string;
  updated?: number;
  created?: number;
  /** true when the blocking lesson belongs to the same student */
  conflict_self?: boolean;
  conflict_student?: string;
  conflict_date?: string;
  conflict_time?: string;
  /** Where each lesson actually landed — the server resolves omitted times. */
  placements?: { id: string; lessonDate: string; startTime: string; endTime: string }[];
}

/** Turkish message for a failed reschedule, ready to drop into a toast. */
export function describeRescheduleError(result: RescheduleResult): string {
  if (result.error !== "conflict") {
    return result.error || "İşlem tamamlanamadı";
  }
  const when = [result.conflict_date, result.conflict_time].filter(Boolean).join(" ");
  if (result.conflict_student === "Deneme Dersi") {
    return `Bu saatte bir deneme dersi var (${when}). Önce deneme dersini taşıyın.`;
  }
  if (result.conflict_self) {
    return `Bu öğrencinin ${when} saatinde zaten bir dersi var. Başka bir saat seçin.`;
  }
  return `Bu saat ${result.conflict_student} öğrencisine ait (${when}). Önce o dersi taşıyın.`;
}

async function callReschedule(
  fn: string,
  args: Record<string, unknown>
): Promise<RescheduleResult> {
  const { data, error } = await supabase.rpc(fn as never, args as never);
  if (error) {
    console.error(`${fn} RPC error:`, error);
    return { success: false, error: error.message };
  }
  return (data ?? { success: false, error: "Boş yanıt" }) as unknown as RescheduleResult;
}

/**
 * Move one lesson to an explicit date and time.
 * cascade=false pins the lesson where it is put: later template edits and chain
 * shifts leave it alone. cascade=true carries every following planned lesson
 * along behind it, each onto the next free slot.
 */
export function moveLesson(
  instanceId: string,
  lessonDate: string,
  startTime: string,
  endTime: string,
  cascade: boolean
): Promise<RescheduleResult> {
  return callReschedule("rpc_move_lesson", {
    p_instance_id: instanceId,
    p_date: lessonDate,
    p_start: startTime,
    p_end: endTime,
    p_cascade: cascade,
  });
}

/** "Sonraki boş saate ertele": this lesson and every later one slide one slot. */
export function postponeLesson(instanceId: string): Promise<RescheduleResult> {
  return callReschedule("rpc_postpone_lesson", { p_instance_id: instanceId });
}

/** Undo a move — the lesson, or its whole shift group, returns to its original slot. */
export function revertLesson(instanceId: string): Promise<RescheduleResult> {
  return callReschedule("rpc_revert_lesson", { p_instance_id: instanceId });
}

/** Re-lay a set of lessons onto the free template slots from a point in time. */
export function relayoutChain(
  instanceIds: string[],
  fromDate: string,
  fromTime: string | null,
  options?: { inclusive?: boolean; markOverride?: boolean }
): Promise<RescheduleResult> {
  return callReschedule("rpc_relayout_chain", {
    p_instance_ids: instanceIds,
    p_from_date: fromDate,
    p_from_time: fromTime,
    p_inclusive: options?.inclusive ?? false,
    p_mark_override: options?.markOverride ?? false,
    p_shift_group_id: null,
  });
}

/** Set explicit dates on several lessons at once. Times are resolved server-side. */
export function applyLessonDates(
  studentId: string,
  teacherId: string,
  updates: { id: string; lessonDate: string; startTime?: string; endTime?: string }[]
): Promise<RescheduleResult> {
  return callReschedule("rpc_apply_chain_dates", {
    p_student_id: studentId,
    p_teacher_id: teacherId,
    p_updates: updates.map((u) => ({ ...u, markOverride: true, manual: true })),
    p_mark_override: false,
    p_shift_group_id: null,
  });
}

export interface FreeSlot {
  success: boolean;
  error?: string;
  lessonDate?: string;
  startTime?: string;
  endTime?: string;
}

/** First free template slot after a point in time (postpone preview, chain head). */
export async function nextFreeSlot(
  studentId: string,
  teacherId: string,
  fromDate: string,
  fromTime?: string | null,
  excludeIds: string[] = []
): Promise<FreeSlot> {
  const { data, error } = await supabase.rpc("rpc_next_free_slot" as never, {
    p_student_id: studentId,
    p_teacher_id: teacherId,
    p_from_date: fromDate,
    p_from_time: fromTime ?? null,
    p_exclude: excludeIds,
  } as never);
  if (error) return { success: false, error: error.message };
  return (data ?? { success: false }) as unknown as FreeSlot;
}

/** Nearest free slot *before* a point in time — powers the backward chain arrow. */
export async function prevFreeSlot(
  studentId: string,
  teacherId: string,
  beforeDate: string,
  beforeTime: string,
  excludeIds: string[] = []
): Promise<FreeSlot> {
  const { data, error } = await supabase.rpc("rpc_prev_free_slot" as never, {
    p_student_id: studentId,
    p_teacher_id: teacherId,
    p_before_date: beforeDate,
    p_before_time: beforeTime,
    p_exclude: excludeIds,
  } as never);
  if (error) return { success: false, error: error.message };
  return (data ?? { success: false }) as unknown as FreeSlot;
}

/**
 * Top every active student's current package back up to lessons_per_week * 4.
 * Idempotent, so the schedule view can call it on load without risk. This
 * replaces the per-week generation the browser used to do, which recreated a
 * lesson whenever the admin paged back to a week they had just emptied.
 */
export function ensureCycleInstances(
  teacherId: string,
  studentId?: string
): Promise<RescheduleResult> {
  return callReschedule("rpc_ensure_cycle_instances", {
    p_teacher_id: teacherId,
    p_student_id: studentId ?? null,
  });
}
