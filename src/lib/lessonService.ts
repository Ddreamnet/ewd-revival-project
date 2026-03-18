/**
 * Centralized lesson mutation service — Phase 0.
 * All lesson write operations go through these functions,
 * which call atomic Supabase RPC functions.
 *
 * This is the SINGLE write path for lesson mutations.
 * No component should directly update lesson_instances status,
 * teacher_balance, or completed_lessons array.
 */

import { supabase } from "@/integrations/supabase/client";
import { rebuildLegacyLessonDatesFromInstances } from "./lessonSync";
import type { TemplateSlot } from "./instanceGeneration";

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
  teacherId: string,
  studentId: string
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

  // Legacy compat: rebuild lesson_dates JSON (transition period only)
  if (result.success) {
    await rebuildLegacyLessonDatesFromInstances(studentId, teacherId);
  }

  return result;
}

/**
 * Undo the most recent completed lesson.
 * Enforces: only the chronologically last completed in current cycle.
 * Available to both teacher and admin.
 */
export async function undoCompleteLesson(
  instanceId: string,
  teacherId: string,
  studentId: string
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

  if (result.success) {
    await rebuildLegacyLessonDatesFromInstances(studentId, teacherId);
  }

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
  teacherId: string
): Promise<{ id: string; lesson_number: number; lesson_date: string } | null> {
  // Get current cycle
  const { data: tracking } = await supabase
    .from("student_lesson_tracking")
    .select("package_cycle")
    .eq("student_id", studentId)
    .eq("teacher_id", teacherId)
    .maybeSingle();

  const currentCycle = tracking?.package_cycle ?? 1;

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
  teacherId: string
): Promise<{ id: string; lesson_number: number; lesson_date: string } | null> {
  const { data: tracking } = await supabase
    .from("student_lesson_tracking")
    .select("package_cycle")
    .eq("student_id", studentId)
    .eq("teacher_id", teacherId)
    .maybeSingle();

  const currentCycle = tracking?.package_cycle ?? 1;

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
