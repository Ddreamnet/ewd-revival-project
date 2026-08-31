import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { LessonDates, LessonInstance, toDbTime, toDateStr } from "@/lib/lessonTypes";
import {
  completeLesson,
  undoCompleteLesson,
  resetPackage,
  archiveStudent,
  deleteStudent,
  getNextCompletableInstance,
  getLastCompletedInstance,
  applyLessonDates,
  relayoutChain,
  prevFreeSlot,
  describeRescheduleError,
  type RescheduleResult,
  type ScheduleConflict,
  type TemplateSlot,
} from "@/lib/lessonService";
import { nonTemplateWeekdayWarning } from "@/lib/lessonDateCalculation";
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
  const [conflicts, setConflicts] = useState<ScheduleConflict[]>([]);
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

    // Keyed by instance id. Keying by lesson_number tied the date inputs (which
    // are listed in date order) to a number that could fall out of that order,
    // so a typed date could be applied to a different lesson.
    const dates: LessonDates = {};
    fetchedInstances.forEach((inst) => {
      dates[inst.id] = inst.lesson_date;
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

  const updateLessonDate = (instanceId: string, dateStr: string) => {
    setLessonDates({ ...lessonDates, [instanceId]: dateStr });
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

  /**
   * Apply the dates the admin typed into the lesson list.
   *
   * Only the date is sent. The server picks the matching template slot on the
   * new date — and only one that is actually free — falling back to the
   * lesson's own time when the day isn't in the template. The client used to do
   * this mapping itself by counting slots per date, which handed two lessons
   * the same time and then failed the write with a conflict.
   */
  const confirmDateUpdate = async () => {
    const changedKeys = Object.keys(lessonDates).filter(
      (key) => lessonDates[key] !== originalLessonDates[key]
    );
    if (changedKeys.length === 0) {
      setShowConfirm(false);
      return;
    }

    setShifting(true);
    setConflicts([]);
    try {
      const changed = changedKeys
        .map((id) => ({ id, inst: instances.find((i) => i.id === id) }))
        .filter((e): e is { id: string; inst: LessonInstance } => e.inst != null);

      if (changed.length === 0) {
        toast({ title: "Bilgi", description: "Güncellenecek ders bulunamadı" });
        return;
      }

      const result = await applyLessonDates(
        studentUserId,
        teacherUserId,
        changed.map((c) => ({ id: c.id, lessonDate: lessonDates[c.id] }))
      );
      if (!reportFailure(result)) return;

      // "Kalan günleri de güncelle": everything after the last lesson the admin
      // touched is re-laid onto the following free slots. The anchor comes from
      // the server's own placements, because the time of a date-only edit is
      // resolved there — anchoring on the typed date alone would let a tail
      // lesson land earlier in that same day.
      if (updateRemainingDays) {
        const movedIds = new Set(changed.map((c) => c.inst.id));
        const anchor = [...(result.placements ?? [])].sort((a, b) =>
          a.lessonDate !== b.lessonDate
            ? a.lessonDate.localeCompare(b.lessonDate)
            : toDbTime(a.startTime).localeCompare(toDbTime(b.startTime))
        ).pop();

        const tail = [...instances]
          .filter(
            (i) =>
              i.status === "planned" &&
              !movedIds.has(i.id) &&
              !i.is_manual_override &&
              (!anchor ||
                i.lesson_date > anchor.lessonDate ||
                (i.lesson_date === anchor.lessonDate &&
                  toDbTime(i.start_time) > toDbTime(anchor.startTime)))
          )
          .sort((a, b) => {
            const dc = a.lesson_date.localeCompare(b.lesson_date);
            return dc !== 0 ? dc : toDbTime(a.start_time).localeCompare(toDbTime(b.start_time));
          });

        if (anchor && tail.length > 0) {
          const tailResult = await relayoutChain(
            tail.map((i) => i.id),
            anchor.lessonDate,
            toDbTime(anchor.startTime)
          );
          if (!reportFailure(tailResult)) return;
        }
      }

      clearWeekCache();
      await fetchInstances();
      onStudentUpdated();

      const warning = nonTemplateWeekdayWarning(
        changed.map((c) => lessonDates[c.id]),
        lessons.map((l) => l.dayOfWeek)
      );
      toast({
        title: "Başarılı",
        description: warning
          ? `Ders tarihleri güncellendi. ${warning}`
          : "Ders tarihleri güncellendi",
      });

      setShowConfirm(false);
      setUpdateRemainingDays(false);
    } catch (error: any) {
      toast({ title: "Hata", description: error.message || "Tarihler güncellenemedi", variant: "destructive" });
    } finally {
      setShifting(false);
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
  // Chain control
  // =============================================
  //
  // Every one of these is a single server call. The client no longer walks the
  // template to work out dates: the server knows which slots are free (a slot
  // held by a completed lesson, a pinned lesson or another student is skipped,
  // not collided with) and does the move, the conflict check and the renumber
  // in one transaction.

  const getTemplateSlots = (): TemplateSlot[] =>
    lessons.map((l) => ({
      dayOfWeek: l.dayOfWeek,
      startTime: toDbTime(l.startTime),
      endTime: toDbTime(l.endTime),
    }));

  /** Surface a failed reschedule in the conflict panel + a toast. Returns success. */
  const reportFailure = (result: RescheduleResult): boolean => {
    if (result.success) {
      setConflicts([]);
      return true;
    }
    const message = describeRescheduleError(result);
    setConflicts(
      result.error === "conflict"
        ? [{
            studentName: result.conflict_student || "Bilinmeyen Öğrenci",
            date: result.conflict_date || "",
            timeRange: result.conflict_time || "",
            type: result.conflict_student === "Deneme Dersi" ? "trial" : "lesson",
            message,
          }]
        : [{ studentName: "", date: "", timeRange: "", type: "lesson", message }]
    );
    toast({
      title: result.error === "conflict" ? "Çakışma var" : "Hata",
      description: message,
      variant: "destructive",
    });
    return false;
  };

  /** Planned lessons the chain buttons may move — pinned ones stay put. */
  const getRealignableInstances = () =>
    [...instances]
      .filter((i) => i.status === "planned" && !i.is_manual_override)
      .sort((a, b) => {
        const dc = a.lesson_date.localeCompare(b.lesson_date);
        return dc !== 0 ? dc : toDbTime(a.start_time).localeCompare(toDbTime(b.start_time));
      });

  /** Run a chain operation with a shared busy flag and refresh. */
  const runChainOp = async (
    op: () => Promise<RescheduleResult>,
    successMessage?: string
  ) => {
    setShifting(true);
    setConflicts([]);
    try {
      const result = await op();
      if (!reportFailure(result)) return;
      clearWeekCache();
      await fetchInstances();
      onStudentUpdated();
      if (successMessage) toast({ title: "Başarılı", description: successMessage });
    } catch (error: any) {
      toast({ title: "Hata", description: error.message || "İşlem başarısız", variant: "destructive" });
    } finally {
      setShifting(false);
    }
  };

  /** Realign: pull the whole planned chain back onto the template, starting
   *  right after the last lesson that was actually taught. */
  const handleRealignChain = async () => {
    const realignable = getRealignableInstances();
    if (realignable.length === 0) {
      toast({ title: "Bilgi", description: "Hizalanacak planlı ders yok" });
      return;
    }
    const fromDate = lastCompletedAnchor?.lessonDate ?? toDateStr(new Date());
    const fromTime = lastCompletedAnchor?.startTime ?? null;
    await runChainOp(
      () => relayoutChain(realignable.map((i) => i.id), fromDate, fromTime),
      "Ders zinciri yeniden hizalandı"
    );
  };

  /** Shift the whole planned chain forward by one free slot. */
  const handleShiftForward = async () => {
    const realignable = getRealignableInstances();
    if (realignable.length === 0) return;
    const first = realignable[0];
    await runChainOp(() =>
      relayoutChain(
        realignable.map((i) => i.id),
        first.lesson_date,
        toDbTime(first.start_time)
      )
    );
  };

  /** Shift the whole planned chain back by one free slot, never past the last
   *  completed lesson or into the past. */
  const handleShiftBackward = async () => {
    const realignable = getRealignableInstances();
    if (realignable.length === 0) return;
    const first = realignable[0];
    const ids = realignable.map((i) => i.id);

    const slot = await prevFreeSlot(
      studentUserId,
      teacherUserId,
      first.lesson_date,
      toDbTime(first.start_time),
      ids
    );
    if (!slot.success || !slot.lessonDate || !slot.startTime) {
      setCanShiftBackward(false);
      toast({ title: "Bilgi", description: "Daha geriye kaydırılamaz" });
      return;
    }

    await runChainOp(() =>
      relayoutChain(ids, slot.lessonDate!, slot.startTime!, { inclusive: true })
    );
  };

  /** Is there room to shift back? Asked once per instance load, not per keystroke. */
  useEffect(() => {
    let cancelled = false;
    const realignable = getRealignableInstances();
    if (realignable.length === 0 || !studentUserId || !teacherUserId) {
      setCanShiftBackward(false);
      return;
    }
    const first = realignable[0];
    prevFreeSlot(
      studentUserId,
      teacherUserId,
      first.lesson_date,
      toDbTime(first.start_time),
      realignable.map((i) => i.id)
    )
      .then((slot) => { if (!cancelled) setCanShiftBackward(!!slot.success); })
      .catch(() => { if (!cancelled) setCanShiftBackward(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instances, studentUserId, teacherUserId]);


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
