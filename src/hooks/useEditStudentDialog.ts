import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { LessonDates, LessonInstance, formatTime } from "@/lib/lessonTypes";
import {
  completeLesson,
  undoCompleteLesson,
  resetPackage,
  archiveStudent,
  deleteStudent,
  getNextCompletableInstance,
  getLastCompletedInstance,
} from "@/lib/lessonService";
import { TemplateSlot, generateFutureInstanceDates } from "@/lib/instanceGeneration";
import { checkTeacherConflicts, ConflictInfo } from "@/lib/conflictDetection";
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
  const [showConfirm, setShowConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [updateRemainingDays, setUpdateRemainingDays] = useState(false);
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);
  const [studentUserId, setStudentUserId] = useState("");
  const [teacherUserId, setTeacherUserId] = useState("");
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

  const initializeDialog = async () => {
    try {
      const { data, error } = await supabase
        .from("students")
        .select("student_id, teacher_id")
        .eq("id", studentId)
        .single();

      if (error || !data) return;

      const sUserId = data.student_id;
      const tUserId = data.teacher_id;
      setStudentUserId(sUserId);
      setTeacherUserId(tUserId);

      const [trackingResult, instanceResult] = await Promise.all([
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
    } catch (error: any) {
      console.error("Failed to initialize dialog:", error);
    }
  };

  const fetchInstances = async () => {
    if (!studentUserId || !teacherUserId) return;
    try {
      const [trackingResult, instanceResult] = await Promise.all([
        supabase
          .from("student_lesson_tracking")
          .select("package_cycle")
          .eq("student_id", studentUserId)
          .eq("teacher_id", teacherUserId)
          .maybeSingle(),
        supabase
          .from("lesson_instances")
          .select("*")
          .eq("student_id", studentUserId)
          .eq("teacher_id", teacherUserId)
          .in("status", ["planned", "completed"])
          .order("lesson_date", { ascending: true })
          .order("start_time", { ascending: true }),
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

  // Instance ID map for direct DB updates
  const instanceIdMap: Record<string, string> = {};
  if (instances.length > 0) {
    const sorted = [...instances].sort((a, b) => {
      const dateCompare = a.lesson_date.localeCompare(b.lesson_date);
      if (dateCompare !== 0) return dateCompare;
      return a.start_time.localeCompare(b.start_time);
    });
    sorted.forEach((inst) => {
      instanceIdMap[inst.lesson_number.toString()] = inst.id;
    });
  }

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
      const result = await completeLesson(nextInst.id, teacherUserId, studentUserId);
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
      const result = await undoCompleteLesson(lastInst.id, teacherUserId, studentUserId);
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
      const templateSlots: TemplateSlot[] = lessons.map((l) => ({
        dayOfWeek: l.dayOfWeek,
        startTime: l.startTime,
        endTime: l.endTime,
      }));
      const result = await resetPackage(studentUserId, teacherUserId, templateSlots);
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

  /** Shared logic for batch date updates with conflict checks */
  const batchUpdateInstances = async (
    changedKeys: string[],
    finalDatesRef: { current: LessonDates }
  ) => {
    const changeEntries = changedKeys
      .map((key) => {
        const instId = instanceIdMap[key];
        const inst = instId ? instances.find((i) => i.id === instId) : findInstanceForLesson(parseInt(key));
        return { key, inst };
      })
      .filter((e) => e.inst != null);

    // Parallel conflict checks (warning-only)
    const conflictResults = await Promise.all(
      changeEntries.map((e) =>
        checkTeacherConflicts(teacherUserId, finalDatesRef.current[e.key], e.inst!.start_time, e.inst!.end_time, e.inst!.id, studentUserId)
      )
    );
    const allConflicts = conflictResults.flat();
    if (allConflicts.length > 0) setConflicts(allConflicts);

    // Batch updates in parallel
    await Promise.all(
      changeEntries.map((e) =>
        supabase
          .from("lesson_instances")
          .update({
            lesson_date: finalDatesRef.current[e.key],
            original_date: e.inst!.original_date || e.inst!.lesson_date,
            rescheduled_count: e.inst!.rescheduled_count + 1,
          })
          .eq("id", e.inst!.id)
      )
    );

    return changeEntries;
  };

  const confirmDateUpdate = async () => {
    try {
      const finalDatesRef = { current: { ...lessonDates } };
      const changedKeys = Object.keys(lessonDates).filter(
        (key) => lessonDates[key] !== originalLessonDates[key]
      );

      if (updateRemainingDays && changedKeys.length > 0 && instances.length > 0) {
        // Update changed instances
        await batchUpdateInstances(changedKeys, finalDatesRef);

        // Regenerate planned instances after the last changed one
        const templateSlots: TemplateSlot[] = lessons.map((l) => ({
          dayOfWeek: l.dayOfWeek,
          startTime: l.startTime,
          endTime: l.endTime,
        }));

        const allSorted = [...instances].sort((a, b) => {
          const dc = a.lesson_date.localeCompare(b.lesson_date);
          return dc !== 0 ? dc : a.start_time.localeCompare(b.start_time);
        });

        const changedInstanceIds = new Set(changedKeys.map((k) => instanceIdMap[k]).filter(Boolean));
        let lastChangedIdx = -1;
        allSorted.forEach((inst, idx) => {
          if (changedInstanceIds.has(inst.id)) lastChangedIdx = idx;
        });

        const plannedAfterChanged = allSorted
          .slice(lastChangedIdx + 1)
          .filter((inst) => inst.status === "planned");

        if (plannedAfterChanged.length > 0) {
          const lastChangedKey = changedKeys.reduce((a, b) => (Number(a) > Number(b) ? a : b));
          const lastChangedDate = new Date(lessonDates[lastChangedKey]);
          const startDate = new Date(lastChangedDate);
          startDate.setDate(startDate.getDate() + 1);

          const futureDates = generateFutureInstanceDates(templateSlots, plannedAfterChanged.length, startDate);

          // Parallel conflict checks (warning-only)
          const futureConflictResults = await Promise.all(
            futureDates.map((fd, i) =>
              checkTeacherConflicts(teacherUserId, fd.lessonDate, fd.startTime, fd.endTime, plannedAfterChanged[i]?.id, studentUserId)
            )
          );
          const futureConflicts = futureConflictResults.flat();
          if (futureConflicts.length > 0) setConflicts(futureConflicts);

          const updateCount = Math.min(plannedAfterChanged.length, futureDates.length);
          await Promise.all(
            Array.from({ length: updateCount }, (_, i) =>
              supabase
                .from("lesson_instances")
                .update({
                  lesson_date: futureDates[i].lessonDate,
                  start_time: futureDates[i].startTime,
                  end_time: futureDates[i].endTime,
                })
                .eq("id", plannedAfterChanged[i].id)
            )
          );

          for (let i = 0; i < updateCount; i++) {
            finalDatesRef.current[plannedAfterChanged[i].lesson_number.toString()] = futureDates[i].lessonDate;
          }
        }
      } else if (changedKeys.length > 0) {
        // Only date changes, time stays the same
        await batchUpdateInstances(changedKeys, finalDatesRef);
      }

      await fetchInstances();
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

      // Atomic schedule sync via RPC
      const slots = lessons.map((l) => ({
        dayOfWeek: l.dayOfWeek,
        startTime: l.startTime,
        endTime: l.endTime,
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

  // Derived state
  const completedCount = instances.filter((i) => i.status === "completed").length;
  const totalLessons = lessonsPerWeek * 4;

  const sortedLessonsForDisplay = (() => {
    const sorted = [...instances].sort((a, b) => {
      const dateCompare = a.lesson_date.localeCompare(b.lesson_date);
      if (dateCompare !== 0) return dateCompare;
      return a.start_time.localeCompare(b.start_time);
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
  };
}
