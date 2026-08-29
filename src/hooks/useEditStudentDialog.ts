import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { LessonDates, LessonInstance, toDbTime, parseLocalDate, toDateStr } from "@/lib/lessonTypes";
import {
  completeLesson,
  undoCompleteLesson,
  resetPackage,
  archiveStudent,
  deleteStudent,
  getNextCompletableInstance,
  getLastCompletedInstance,
} from "@/lib/lessonService";
import { TemplateSlot, generateFutureInstanceDates, getSlotBefore } from "@/lib/instanceGeneration";
import { startOfDay } from "date-fns";
import type { ConflictInfo } from "@/lib/conflictDetection";
import { checkNonTemplateWeekday } from "@/lib/lessonDateCalculation";
import { clearWeekCache } from "@/hooks/useScheduleGrid";
import type { StudentLessonBase } from "@/lib/types";

interface UseEditStudentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStudentUpdated: () => void;
  studentId: string;
  currentName: string;
  currentLessons: StudentLessonBase[];
}

export function useEditStudentDialog({
  open,
  onOpenChange,
  onStudentUpdated,
  studentId,
  currentName,
  currentLessons,
}: UseEditStudentDialogProps) {
  const [name, setName] = useState("");
  const [lessonsPerWeek, setLessonsPerWeek] = useState(1);
  const [lessons, setLessons] = useState<StudentLessonBase[]>([{ dayOfWeek: 1, startTime: "", endTime: "", note: "" }]);
  const [lessonDates, setLessonDates] = useState<LessonDates>({});
  const [originalLessonDates, setOriginalLessonDates] = useState<LessonDates>({});
  const [instances, setInstances] = useState<LessonInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const [shifting, setShifting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [updateRemainingDays, setUpdateRemainingDays] = useState(false);
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);
  const [studentUserId, setStudentUserId] = useState("");
  const [teacherUserId, setTeacherUserId] = useState("");
  const [canShiftBackward, setCanShiftBackward] = useState(false);
  /** Last completed instance across ALL cycles — the backward/realign boundary.
   *  Loaded with the instances so chain checks stay synchronous. */
  const [lastCompletedAnchor, setLastCompletedAnchor] = useState<{ lessonDate: string; startTime: string } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setName(currentName);
      setLessonsPerWeek(currentLessons.length || 1);
      setLessons(
        currentLessons.length > 0
          ? currentLessons
          : [{ dayOfWeek: 1, startTime: "", endTime: "", note: "" }]
      );
      setConflicts([]);
      initializeDialog();
    }
  }, [open, currentName, currentLessons]);

  /**
   * Loads the current cycle's instances plus the cross-cycle "last completed"
   * anchor in one round trip. Single source of truth for both the initial open
   * and every post-mutation refresh (these were two identical copies before).
   */
  const loadInstances = useCallback(async (sUserId: string, tUserId: string) => {
    const [trackingResult, instanceResult, anchorResult] = await Promise.all([
      supabase
        .from("student_lesson_tracking")
        .select("package_cycle")
        .eq("student_id", sUserId)
        .eq("teacher_id", tUserId)
        .maybeSingle(),
      supabase
        .from("lesson_instances")
        .select("*")
        .eq("student_id", sUserId)
        .eq("teacher_id", tUserId)
        .in("status", ["planned", "completed"])
        .order("lesson_date", { ascending: true })
        .order("start_time", { ascending: true }),
      supabase
        .from("lesson_instances")
        .select("lesson_date, start_time")
        .eq("student_id", sUserId)
        .eq("teacher_id", tUserId)
        .eq("status", "completed")
        .order("lesson_date", { ascending: false })
        .order("start_time", { ascending: false })
        .limit(1),
    ]);

    const currentCycle = trackingResult.data?.package_cycle ?? 1;
    const allInstances = (instanceResult.data || []) as LessonInstance[];
    const fetchedInstances = allInstances.filter((i) => i.package_cycle === currentCycle);
    setInstances(fetchedInstances);

    const dates: LessonDates = {};
    fetchedInstances.forEach((inst) => {
      dates[inst.lesson_number.toString()] = inst.lesson_date;
    });
    setLessonDates(dates);
    setOriginalLessonDates(dates);

    const anchor = anchorResult.data?.[0];
    setLastCompletedAnchor(
      anchor ? { lessonDate: anchor.lesson_date, startTime: toDbTime(anchor.start_time) } : null
    );
  }, []);

  const initializeDialog = async () => {
    try {
      const { data, error } = await supabase
        .from("students")
        .select("student_id, teacher_id")
        .eq("id", studentId)
        .single();

      if (error || !data) return;

      setStudentUserId(data.student_id);
      setTeacherUserId(data.teacher_id);
      await loadInstances(data.student_id, data.teacher_id);
    } catch (error: any) {
      console.error("Failed to initialize dialog:", error);
    }
  };

  const fetchInstances = async () => {
    if (!studentUserId || !teacherUserId) return;
    try {
      await loadInstances(studentUserId, teacherUserId);
    } catch (error: any) {
      console.error("Failed to fetch lesson instances:", error);
    }
  };

  useEffect(() => {
    if (lessonsPerWeek > lessons.length) {
      const newLessons = [...lessons];
      for (let i = lessons.length; i < lessonsPerWeek; i++) {
        newLessons.push({ dayOfWeek: 1, startTime: "", endTime: "", note: "" });
      }
      setLessons(newLessons);
    } else if (lessonsPerWeek < lessons.length) {
      setLessons(lessons.slice(0, lessonsPerWeek));
    }
  }, [lessonsPerWeek]);

  const updateLesson = (index: number, field: keyof StudentLessonBase, value: string | number) => {
    const updatedLessons = [...lessons];
    updatedLessons[index] = { ...updatedLessons[index], [field]: value };
    setLessons(updatedLessons);
  };

  const updateLessonDate = (lessonNumber: number, dateStr: string) => {
    setLessonDates({ ...lessonDates, [lessonNumber.toString()]: dateStr });
  };

  const findInstanceForLesson = (lessonNumber: number): LessonInstance | undefined => {
    return instances.find((inst) => inst.lesson_number === lessonNumber);
  };

  const handleDateSubmit = () => {
    const hasChanges = Object.keys(lessonDates).some(
      (key) => lessonDates[key] !== originalLessonDates[key]
    );
    if (hasChanges) {
      setShowConfirm(true);
    } else {
      toast({ title: "Bilgi", description: "Hiçbir değişiklik yapılmadı" });
    }
  };

  const handleMarkLastLesson = async () => {
    try {
      const nextInst = await getNextCompletableInstance(studentUserId, teacherUserId);
      if (!nextInst) {
        toast({ title: "Bilgi", description: "İşlenecek ders kalmadı" });
        return;
      }
      const result = await completeLesson(nextInst.id, teacherUserId);
      if (!result.success) {
        toast({ title: "Hata", description: result.error || "Ders işaretlenemedi", variant: "destructive" });
        return;
      }
      await fetchInstances();
      toast({ title: "Başarılı", description: "Ders işaretlendi" });
    } catch (error: any) {
      toast({ title: "Hata", description: error.message || "Ders işaretlenemedi", variant: "destructive" });
    }
  };

  const handleUndoLastLesson = async () => {
    try {
      const lastInst = await getLastCompletedInstance(studentUserId, teacherUserId);
      if (!lastInst) {
        toast({ title: "Bilgi", description: "Geri alınacak ders yok" });
        return;
      }
      const result = await undoCompleteLesson(lastInst.id, teacherUserId);
      if (!result.success) {
        toast({ title: "Hata", description: result.error || "Ders geri alınamadı", variant: "destructive" });
        return;
      }
      await fetchInstances();
      toast({ title: "Başarılı", description: "Son ders geri alındı" });
    } catch (error: any) {
      toast({ title: "Hata", description: error.message || "Ders geri alınamadı", variant: "destructive" });
    }
  };

  const handleResetAllLessons = async () => {
    try {
      const result = await resetPackage(studentUserId, teacherUserId, getTemplateSlots());
      if (!result.success) {
        toast({ title: "Hata", description: result.error || "Dersler sıfırlanamadı", variant: "destructive" });
        return;
      }
      setLessonDates({});
      setOriginalLessonDates({});
      setShowResetConfirm(false);
      await fetchInstances();
      toast({
        title: "Başarılı",
        description: `Paket sıfırlandı (Yeni döngü: ${result.new_cycle}). ${result.instances_created} ders planlandı.`,
      });
    } catch (error: any) {
      toast({ title: "Hata", description: error.message || "Dersler sıfırlanamadı", variant: "destructive" });
    }
  };

  /** Shared logic for batch date updates with conflict checks.
   *  When a date changes, also re-maps start_time/end_time to the
   *  matching template slot for the new day-of-week so the time
   *  chain stays consistent with the schedule. */
  const batchUpdateInstances = async (
    changedKeys: string[],
    finalDatesRef: { current: LessonDates }
  ) => {
    const changeEntries = changedKeys
      .map((key) => ({ key, inst: findInstanceForLesson(parseInt(key)) }))
      .filter((e) => e.inst != null);

    // Build sorted template slots for time mapping (already normalized)
    const templateSlots: TemplateSlot[] = getTemplateSlots()
      .sort((a, b) => a.dayOfWeek !== b.dayOfWeek ? a.dayOfWeek - b.dayOfWeek : a.startTime.localeCompare(b.startTime));

    // For each changed instance, find matching template slot for the new date's DOW
    const usedSlotsPerDate: Record<string, number> = {};
    const updates = changeEntries.map((e) => {
      const newDate = finalDatesRef.current[e.key];
      const newDow = parseLocalDate(newDate).getDay();
      const matchingSlots = templateSlots.filter(s => s.dayOfWeek === newDow);

      const usedCount = usedSlotsPerDate[newDate] || 0;
      const slotIdx = Math.min(usedCount, Math.max(0, matchingSlots.length - 1));
      const matchedSlot = matchingSlots[slotIdx];
      usedSlotsPerDate[newDate] = usedCount + 1;

      return {
        ...e,
        newStartTime: toDbTime(matchedSlot?.startTime || e.inst!.start_time),
        newEndTime: toDbTime(matchedSlot?.endTime || e.inst!.end_time),
      };
    });

    // One atomic RPC handles the conflict check, the reorder and the renumber.
    // original_* / rescheduled_count bookkeeping is recorded server-side from
    // the pre-move snapshot (markOverride).
    await applyChainDates(
      updates.map((u) => u.inst!),
      updates.map((u) => ({
        lessonDate: finalDatesRef.current[u.key],
        startTime: u.newStartTime,
        endTime: u.newEndTime,
      })),
      { markOverride: true, skipRefresh: true }
    );

    return updates;
  };

  const confirmDateUpdate = async () => {
    try {
      const finalDatesRef = { current: { ...lessonDates } };
      const changedKeys = Object.keys(lessonDates).filter(
        (key) => lessonDates[key] !== originalLessonDates[key]
      );

      if (updateRemainingDays && changedKeys.length > 0 && instances.length > 0) {
        // Update changed instances — returns updates with newStartTime/newEndTime
        const updates = await batchUpdateInstances(changedKeys, finalDatesRef);

        // Regenerate planned instances after the last changed one
        const templateSlots: TemplateSlot[] = getTemplateSlots();

        const allSorted = [...instances].sort((a, b) => {
          const dc = a.lesson_date.localeCompare(b.lesson_date);
          return dc !== 0 ? dc : toDbTime(a.start_time).localeCompare(toDbTime(b.start_time));
        });

        const changedInstanceIds = new Set(updates.map((u) => u.inst!.id));
        let lastChangedIdx = -1;
        allSorted.forEach((inst, idx) => {
          if (changedInstanceIds.has(inst.id)) lastChangedIdx = idx;
        });

        const plannedAfterChanged = allSorted
          .slice(lastChangedIdx + 1)
          .filter((inst) => inst.status === "planned");

        if (plannedAfterChanged.length > 0) {
          // Anchor the regenerated tail on the chronologically last changed
          // lesson. This used to pick the highest lesson_number, but after a
          // shift the numbers no longer follow date order — so the tail could
          // regenerate from an earlier date and collide with lessons left in
          // place, which surfaced as a spurious conflict.
          const lastUpdate = [...updates].sort((a, b) => {
            const dc = finalDatesRef.current[a.key].localeCompare(finalDatesRef.current[b.key]);
            return dc !== 0 ? dc : a.newStartTime.localeCompare(b.newStartTime);
          }).pop()!;

          const startDate = parseLocalDate(finalDatesRef.current[lastUpdate.key]);
          const afterTime = lastUpdate.newStartTime;

          const futureDates = generateFutureInstanceDates(templateSlots, plannedAfterChanged.length, startDate, afterTime);

          // The tail is a plain chain move (no override bookkeeping) — same
          // atomic path, so it cannot half-apply or collide with itself.
          await applyChainDates(plannedAfterChanged, futureDates, { skipRefresh: true });

          const updateCount = Math.min(plannedAfterChanged.length, futureDates.length);
          for (let i = 0; i < updateCount; i++) {
            finalDatesRef.current[plannedAfterChanged[i].lesson_number.toString()] = futureDates[i].lessonDate;
          }
        }
      } else if (changedKeys.length > 0) {
        // Only date changes, time stays the same
        await batchUpdateInstances(changedKeys, finalDatesRef);
      }

      clearWeekCache();
      await fetchInstances();
      onStudentUpdated();
      toast({ title: "Başarılı", description: "Ders tarihleri güncellendi" });

      // Non-template weekday warning
      const changedKeysForWarning = Object.keys(lessonDates).filter(
        (key) => lessonDates[key] !== originalLessonDates[key]
      );
      for (const key of changedKeysForWarning) {
        const check = await checkNonTemplateWeekday(studentUserId, teacherUserId, lessonDates[key]);
        if (check.isNonTemplate) {
          toast({
            title: "Bilgi",
            description: `Seçilen tarih (${lessonDates[key]}) şablon ders günlerinden (${check.templateDays.join(", ")}) farklı bir güne denk geliyor.`,
          });
          break;
        }
      }

      setShowConfirm(false);
      setUpdateRemainingDays(false);
      setConflicts([]);
    } catch (error: any) {
      toast({ title: "Hata", description: error.message || "Tarihler güncellenemedi", variant: "destructive" });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast({ title: "Hata", description: "Öğrenci adı gereklidir", variant: "destructive" });
      return;
    }
    if (!lessons.every((lesson) => lesson.dayOfWeek !== undefined && lesson.startTime && lesson.endTime)) {
      toast({ title: "Hata", description: "Tüm ders programı alanlarını doldurun", variant: "destructive" });
      return;
    }

    setLoading(true);
    setConflicts([]);

    try {
      // Update profile name (separate from schedule sync)
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ full_name: name.trim() })
        .eq("user_id", studentUserId);
      if (profileError) throw profileError;

      // Check if template actually changed.
      // Both sides are normalized and order-insensitive: the DB hands back
      // "09:00:00" while <input type="time"> hands back "09:00", so a raw
      // comparison reported a change as soon as the admin so much as focused a
      // time field — and a "change" here triggers rpc_sync_student_schedule,
      // which deletes and regenerates every planned instance, wiping manually
      // arranged dates.
      const slotKey = (l: { dayOfWeek: number; startTime: string; endTime: string }) =>
        `${l.dayOfWeek}|${toDbTime(l.startTime)}|${toDbTime(l.endTime)}`;
      const currentKeys = [...currentLessons].map(slotKey).sort();
      const nextKeys = lessons.map(slotKey).sort();
      const templateChanged =
        lessonsPerWeek !== currentLessons.length ||
        nextKeys.length !== currentKeys.length ||
        nextKeys.some((k, i) => k !== currentKeys[i]);

      if (templateChanged) {
        // Template changed → full sync via RPC (regenerates instances)
        const slots = lessons.map((l) => ({
          dayOfWeek: l.dayOfWeek,
          startTime: toDbTime(l.startTime),
          endTime: toDbTime(l.endTime),
        }));

        const { data: rpcResult, error: rpcError } = await supabase.rpc('rpc_sync_student_schedule', {
          p_student_id: studentUserId,
          p_teacher_id: teacherUserId,
          p_slots: slots,
          p_lessons_per_week: lessonsPerWeek,
        });

        if (rpcError) throw rpcError;
        if (rpcResult && !(rpcResult as any).success) {
          throw new Error((rpcResult as any).error || 'Schedule sync failed');
        }
      } else {
        // Template unchanged → only update metadata, preserve instance positions
        const { error: trackingError } = await supabase
          .from("student_lesson_tracking")
          .update({ lessons_per_week: lessonsPerWeek })
          .eq("student_id", studentUserId)
          .eq("teacher_id", teacherUserId);
        if (trackingError) throw trackingError;

        // Update notes on template slots
        await Promise.all(
          lessons.map((lesson) =>
            supabase
              .from("student_lessons")
              .update({ note: lesson.note || null })
              .eq("student_id", studentUserId)
              .eq("teacher_id", teacherUserId)
              .eq("day_of_week", lesson.dayOfWeek)
              .eq("start_time", toDbTime(lesson.startTime))
          )
        );
      }

      toast({ title: "Başarılı", description: "Öğrenci ayarları güncellendi" });
      clearWeekCache();
      onStudentUpdated();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Hata", description: error.message || "Öğrenci ayarları güncellenemedi", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStudent = async () => {
    setLoading(true);
    try {
      const result = await deleteStudent(studentId, studentUserId, teacherUserId);
      if (!result.success) throw new Error(result.error || "Öğrenci silinemedi");
      toast({ title: "Başarılı", description: "Öğrenci ve tüm verileri silindi" });
      clearWeekCache();
      onStudentUpdated();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Hata", description: error.message || "Öğrenci silinemedi", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleArchiveStudent = async () => {
    setLoading(true);
    try {
      const result = await archiveStudent(studentId, studentUserId, teacherUserId);
      if (!result.success) throw new Error(result.error || "Arşivleme başarısız");
      toast({ title: "Başarılı", description: "Öğrenci arşivlendi" });
      clearWeekCache();
      onStudentUpdated();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Hata", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // =============================================
  // Chain control helpers
  // =============================================

  const getTemplateSlots = (): TemplateSlot[] =>
    lessons.map((l) => ({
      dayOfWeek: l.dayOfWeek,
      startTime: toDbTime(l.startTime),
      endTime: toDbTime(l.endTime),
    }));

  /** Compute the minimum allowed slot (boundary for backward + realign).
   *  = first template slot after the last completed instance (cross-cycle).
   *  If no completed: first template slot from today.
   *  Synchronous — the anchor is loaded alongside the instances, so this no
   *  longer fires a query on every keystroke in the schedule form. */
  const computeMinSlot = () => {
    const templateSlots = getTemplateSlots();
    if (lastCompletedAnchor) {
      const result = generateFutureInstanceDates(
        templateSlots,
        1,
        parseLocalDate(lastCompletedAnchor.lessonDate),
        lastCompletedAnchor.startTime
      );
      return result[0] || null;
    }
    const result = generateFutureInstanceDates(templateSlots, 1, startOfDay(new Date()));
    return result[0] || null;
  };

  /** Get planned instances eligible for chain operations (excluding manual overrides) */
  const getRealignableInstances = () =>
    [...instances]
      .filter((i) => i.status === "planned" && !i.is_manual_override)
      .sort((a, b) => {
        const dc = a.lesson_date.localeCompare(b.lesson_date);
        return dc !== 0 ? dc : toDbTime(a.start_time).localeCompare(toDbTime(b.start_time));
      });

  /**
   * Single write path for every chain operation (realign / forward / backward /
   * bulk date edit). One atomic RPC does the conflict check, the reorder and the
   * renumbering inside one transaction.
   *
   * The previous implementation fired N parallel UPDATEs. Because
   * `uniq_active_planned_slot` is a partial UNIQUE index on
   * (student_id, lesson_date, start_time) WHERE status='planned', a rotating
   * chain hit transient collisions depending on which write landed first — the
   * random "zaten bir ders var" failures — and a mid-flight error left the
   * chain split across two layouts.
   */
  const applyChainDates = async (
    targets: LessonInstance[],
    newDates: { lessonDate: string; startTime: string; endTime: string }[],
    options?: { markOverride?: boolean; skipRefresh?: boolean }
  ) => {
    const count = Math.min(targets.length, newDates.length);
    if (count === 0) throw new Error("Taşınacak ders bulunamadı");

    const moving = targets.slice(0, count);
    const payload = moving.map((inst, i) => ({
      id: inst.id,
      lessonDate: newDates[i].lessonDate,
      startTime: toDbTime(newDates[i].startTime),
      endTime: toDbTime(newDates[i].endTime),
    }));

    // Paint the move immediately; the server stays the arbiter and the snapshot
    // is restored on any failure, thrown or returned.
    const snapshot = instances;
    const movedById = new Map(payload.map((p) => [p.id, p]));
    setInstances(
      instances.map((inst) => {
        const nd = movedById.get(inst.id);
        return nd
          ? { ...inst, lesson_date: nd.lessonDate, start_time: nd.startTime, end_time: nd.endTime }
          : inst;
      })
    );

    try {
      const { data, error } = await supabase.rpc("rpc_apply_chain_dates", {
        p_student_id: studentUserId,
        p_teacher_id: teacherUserId,
        p_updates: payload,
        p_mark_override: options?.markOverride ?? false,
      });
      if (error) throw new Error(error.message);

      const result = data as unknown as {
        success: boolean;
        error?: string;
        conflict_student?: string;
        conflict_date?: string;
        conflict_time?: string;
      };

      if (!result?.success) {
        if (result?.error === "conflict") {
          setConflicts([
            {
              studentName: result.conflict_student || "Bilinmeyen Öğrenci",
              date: result.conflict_date || "",
              timeRange: result.conflict_time || "",
              type: result.conflict_student === "Deneme Dersi" ? "trial" : "lesson",
              teacherId: teacherUserId,
            },
          ]);
          throw new Error("Çakışma var, dersler taşınamadı");
        }
        throw new Error(result?.error || "Dersler taşınamadı");
      }
    } catch (err) {
      setInstances(snapshot);
      throw err;
    }

    clearWeekCache();
    if (!options?.skipRefresh) {
      onStudentUpdated();
      await fetchInstances();
    }
  };

  /** Realign: regenerate all planned chain from the last completed anchor (cross-cycle) */
  const handleRealignChain = async () => {
    const realignable = getRealignableInstances();
    if (realignable.length === 0) {
      toast({ title: "Bilgi", description: "Hizalanacak planlı ders yok" });
      return;
    }
    setShifting(true);
    setConflicts([]);
    try {
      const templateSlots = getTemplateSlots();
      const startDate = lastCompletedAnchor
        ? parseLocalDate(lastCompletedAnchor.lessonDate)
        : startOfDay(new Date());
      const afterTime = lastCompletedAnchor?.startTime;

      const newDates = generateFutureInstanceDates(
        templateSlots,
        realignable.length,
        startDate,
        afterTime
      );

      await applyChainDates(realignable, newDates);
      toast({ title: "Başarılı", description: "Ders zinciri yeniden hizalandı" });
    } catch (error: any) {
      toast({ title: "Hata", description: error.message || "Hizalama başarısız", variant: "destructive" });
    } finally {
      setShifting(false);
    }
  };

  /** Shift chain forward by 1 slot */
  const handleShiftForward = async () => {
    const realignable = getRealignableInstances();
    if (realignable.length === 0) return;
    setShifting(true);
    setConflicts([]);
    try {
      const templateSlots = getTemplateSlots();
      const first = realignable[0];
      const newDates = generateFutureInstanceDates(
        templateSlots,
        realignable.length,
        parseLocalDate(first.lesson_date),
        toDbTime(first.start_time)
      );

      await applyChainDates(realignable, newDates);
    } catch (error: any) {
      toast({ title: "Hata", description: error.message || "İleri kaydırma başarısız", variant: "destructive" });
    } finally {
      setShifting(false);
    }
  };

  /** Is the slot before the chain's head still on the allowed side of the
   *  last completed lesson? Shared by the button state and the handler. */
  const getBackwardTarget = () => {
    const realignable = getRealignableInstances();
    if (realignable.length === 0) return null;
    const templateSlots = getTemplateSlots();
    const first = realignable[0];

    const prevSlot = getSlotBefore(
      templateSlots,
      parseLocalDate(first.lesson_date),
      toDbTime(first.start_time)
    );
    if (!prevSlot) return null;

    const minSlot = computeMinSlot();
    if (minSlot) {
      const prevDateStr = toDateStr(prevSlot.date);
      const prevStart = toDbTime(prevSlot.startTime);
      const blocked =
        prevDateStr < minSlot.lessonDate ||
        (prevDateStr === minSlot.lessonDate && prevStart < toDbTime(minSlot.startTime));
      if (blocked) return null;
    }
    return { prevSlot, realignable, templateSlots };
  };

  /** Shift chain backward by 1 slot, respecting completed boundary */
  const handleShiftBackward = async () => {
    const target = getBackwardTarget();
    if (!target) {
      toast({ title: "Bilgi", description: "Daha geriye kaydırılamaz" });
      return;
    }
    const { prevSlot, realignable, templateSlots } = target;

    setShifting(true);
    setConflicts([]);
    try {
      // Generate from the previous slot's day, then drop the same-day slots that
      // sit before it. Over-generate first: filtering an exactly-sized batch
      // used to leave the tail short, stranding the last lessons on old dates.
      const prevDateStr = toDateStr(prevSlot.date);
      const prevStart = toDbTime(prevSlot.startTime);
      const generated = generateFutureInstanceDates(
        templateSlots,
        realignable.length + templateSlots.length,
        prevSlot.date,
        undefined
      );
      const filteredDates = generated
        .filter((nd) => !(nd.lessonDate === prevDateStr && toDbTime(nd.startTime) < prevStart))
        .slice(0, realignable.length);

      if (filteredDates.length < realignable.length) {
        toast({ title: "Bilgi", description: "Daha geriye kaydırılamaz" });
        return;
      }

      await applyChainDates(realignable, filteredDates);
    } catch (error: any) {
      toast({ title: "Hata", description: error.message || "Geri kaydırma başarısız", variant: "destructive" });
    } finally {
      setShifting(false);
    }
  };

  /** Recompute canShiftBackward whenever instances, template or anchor change.
   *  Fully synchronous now — it used to run a DB query on every change. */
  useEffect(() => {
    setCanShiftBackward(getBackwardTarget() !== null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instances, lessons, lastCompletedAnchor]);

  const hasRealignableInstances = getRealignableInstances().length > 0;

  // Derived state
  const completedCount = instances.filter((i) => i.status === "completed").length;
  const totalLessons = lessonsPerWeek * 4;

  const sortedLessonsForDisplay = (() => {
    const sorted = [...instances].sort((a, b) => {
      const dateCompare = a.lesson_date.localeCompare(b.lesson_date);
      if (dateCompare !== 0) return dateCompare;
      return toDbTime(a.start_time).localeCompare(toDbTime(b.start_time));
    });

    const result = sorted.map((inst, idx) => ({
      displayIndex: idx + 1,
      lessonNumber: inst.lesson_number,
      effectiveDate: inst.lesson_date,
      startTime: inst.start_time,
      endTime: inst.end_time,
      isCompleted: inst.status === "completed",
      isOverridden: inst.original_date !== null,
      instanceId: inst.id,
    }));

    for (let i = result.length; i < totalLessons; i++) {
      result.push({
        displayIndex: i + 1,
        lessonNumber: i + 1,
        effectiveDate: "",
        startTime: "",
        endTime: "",
        isCompleted: false,
        isOverridden: false,
        instanceId: undefined,
      });
    }

    return result;
  })();

  const handleLessonsPerWeekChange = (newCount: number) => {
    const newTotal = newCount * 4;
    if (newTotal < completedCount) {
      toast({
        title: "Uyarı",
        description: `Haftalık ders sayısı ${newCount}'e düşürülemez çünkü bu döngüde zaten ${completedCount} ders tamamlanmış (toplam hak: ${newTotal}).`,
        variant: "destructive",
      });
      return;
    }
    setLessonsPerWeek(newCount);
  };

  return {
    // State
    name,
    setName,
    lessonsPerWeek,
    lessons,
    lessonDates,
    originalLessonDates,
    loading,
    shifting,
    showConfirm,
    setShowConfirm,
    showResetConfirm,
    setShowResetConfirm,
    updateRemainingDays,
    setUpdateRemainingDays,
    conflicts,
    completedCount,
    totalLessons,
    sortedLessonsForDisplay,
    canShiftBackward,
    hasRealignableInstances,

    // Handlers
    handleLessonsPerWeekChange,
    updateLesson,
    updateLessonDate,
    handleDateSubmit,
    handleMarkLastLesson,
    handleUndoLastLesson,
    handleResetAllLessons,
    confirmDateUpdate,
    handleSubmit,
    handleDeleteStudent,
    handleArchiveStudent,
    handleRealignChain,
    handleShiftForward,
    handleShiftBackward,
  };
}
