import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, Archive, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { LessonDates, LessonOverrideInfo, LessonInstance, formatTime } from "@/lib/lessonTypes";
import { recalculateRemainingDates } from "@/lib/lessonDateCalculation";
import {
  completeLesson,
  undoCompleteLesson,
  resetPackage,
  archiveStudent,
  getNextCompletableInstance,
  getLastCompletedInstance,
} from "@/lib/lessonService";
import { syncTemplateChange, TemplateSlot, generateFutureInstanceDates } from "@/lib/instanceGeneration";
import { checkTeacherConflicts, ConflictInfo } from "@/lib/conflictDetection";
import { rebuildLegacyLessonDatesFromInstances, checkNonTemplateWeekday } from "@/lib/lessonSync";
import type { StudentLessonBase } from "@/lib/types";
import { DAYS_OF_WEEK } from "@/lib/types";

interface EditStudentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStudentUpdated: () => void;
  studentId: string;
  currentName: string;
  currentLessons: StudentLessonBase[];
}

const daysOfWeek = DAYS_OF_WEEK;

export function EditStudentDialog({
  open,
  onOpenChange,
  onStudentUpdated,
  studentId,
  currentName,
  currentLessons,
}: EditStudentDialogProps) {
  const [name, setName] = useState("");
  const [lessonsPerWeek, setLessonsPerWeek] = useState(1);
  const [lessons, setLessons] = useState<StudentLessonBase[]>([{ dayOfWeek: 1, startTime: "", endTime: "", note: "" }]);
  const [lessonDates, setLessonDates] = useState<LessonDates>({});
  const [originalLessonDates, setOriginalLessonDates] = useState<LessonDates>({});
  const [instances, setInstances] = useState<LessonInstance[]>([]);
  const [trackingRecordId, setTrackingRecordId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [updateRemainingDays, setUpdateRemainingDays] = useState(false);
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);
  const { toast } = useToast();

  // Student's user_id and teacher_id for DB queries
  const [studentUserId, setStudentUserId] = useState<string>("");
  const [teacherUserId, setTeacherUserId] = useState<string>("");

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
      fetchStudentIds().then(() => {
        fetchLessonTracking();
        fetchInstances();
      });
    }
  }, [open, currentName, currentLessons]);

  const fetchStudentIds = async () => {
    const { data, error } = await supabase
      .from("students")
      .select("student_id, teacher_id")
      .eq("id", studentId)
      .single();
    if (!error && data) {
      setStudentUserId(data.student_id);
      setTeacherUserId(data.teacher_id);
    }
  };

  const fetchLessonTracking = async () => {
    try {
      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .select("student_id, teacher_id")
        .eq("id", studentId)
        .single();

      if (studentError) throw studentError;

      const { data: records, error } = await supabase
        .from("student_lesson_tracking")
        .select("*")
        .eq("student_id", studentData.student_id)
        .eq("teacher_id", studentData.teacher_id)
        .order("updated_at", { ascending: false })
        .limit(1);

      if (error) throw error;

      if (records && records.length > 0) {
        const data = records[0];
        setTrackingRecordId(data.id);
        const dates = (data as any).lesson_dates || {};
        setLessonDates(dates);
        setOriginalLessonDates(dates);
      } else {
        setTrackingRecordId(null);
      }
    } catch (error: any) {
      console.error("Failed to fetch lesson tracking:", error);
    }
  };

  const fetchLessonOverrides = async () => {
    try {
      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .select("student_id, teacher_id")
        .eq("id", studentId)
        .single();

      if (studentError) throw studentError;

      const { data, error } = await supabase
        .from("lesson_overrides")
        .select("id, original_date, new_date, is_cancelled")
        .eq("student_id", studentData.student_id)
        .eq("teacher_id", studentData.teacher_id);

      if (error) throw error;
      setLessonOverrides(data || []);
    } catch (error: any) {
      console.error("Failed to fetch lesson overrides:", error);
    }
  };

  const fetchInstances = async () => {
    try {
      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .select("student_id, teacher_id")
        .eq("id", studentId)
        .single();

      if (studentError) throw studentError;

      const { data, error } = await supabase
        .from("lesson_instances")
        .select("*")
        .eq("student_id", studentData.student_id)
        .eq("teacher_id", studentData.teacher_id)
        .in("status", ["planned", "completed"])
        .order("lesson_date", { ascending: true })
        .order("start_time", { ascending: true });

      if (error) throw error;
      setInstances((data as LessonInstance[]) || []);
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

  // Map from display key (lessonNumber string) to instanceId for direct DB updates
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
    setLessonDates({
      ...lessonDates,
      [lessonNumber.toString()]: dateStr,
    });
  };

  const handleDateSubmit = () => {
    const hasChanges = Object.keys(lessonDates).some(
      (key) => lessonDates[key] !== originalLessonDates[key]
    );

    if (hasChanges) {
      setShowConfirm(true);
    } else {
      toast({
        title: "Bilgi",
        description: "Hiçbir değişiklik yapılmadı",
      });
    }
  };

  // Find the instance for a given lesson number (for balance operations)
  const findInstanceForLesson = (lessonNumber: number): LessonInstance | undefined => {
    return instances.find((inst) => inst.lesson_number === lessonNumber);
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

      // Refresh local state
      const newCompletedLessons = [...completedLessons, instances.find(i => i.id === nextInst.id)?.lesson_number ?? (completedLessons.length + 1)].sort((a, b) => a - b);
      setCompletedLessons(newCompletedLessons);
      fetchInstances();
      toast({ title: "Başarılı", description: `Ders işaretlendi` });
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

      const newCompletedLessons = completedLessons.filter(l => l !== lastInst.lesson_number);
      setCompletedLessons(newCompletedLessons);
      fetchInstances();
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

      setCompletedLessons([]);
      setLessonDates({});
      setOriginalLessonDates({});
      setShowResetConfirm(false);
      fetchInstances();
      
      toast({
        title: "Başarılı",
        description: `Paket sıfırlandı (Yeni döngü: ${result.new_cycle}). ${result.instances_created} ders planlandı.`,
      });
    } catch (error: any) {
      toast({
        title: "Hata",
        description: error.message || "Dersler sıfırlanamadı",
        variant: "destructive",
      });
    }
  };

  const confirmDateUpdate = async () => {
    try {
      let finalDates = lessonDates;

      if (updateRemainingDays) {
        const changedKeys = Object.keys(lessonDates).filter(
          (key) => lessonDates[key] !== originalLessonDates[key]
        );

        if (changedKeys.length > 0) {
          const firstChangedLesson = Math.min(...changedKeys.map(Number));

          // Instance-based: regenerate from template slots
          if (instances.length > 0) {
            const templateSlots: TemplateSlot[] = lessons.map((l) => ({
              dayOfWeek: l.dayOfWeek,
              startTime: l.startTime,
              endTime: l.endTime,
            }));

            // First, update the directly-changed instances (including completed ones)
            for (const key of changedKeys) {
              const instId = instanceIdMap[key];
              const inst = instId ? instances.find((i) => i.id === instId) : findInstanceForLesson(parseInt(key));
              if (inst) {
                const c = await checkTeacherConflicts(
                  teacherUserId,
                  lessonDates[key],
                  inst.start_time,
                  inst.end_time,
                  inst.id,
                  studentUserId
                );
                if (c.length > 0) {
                  setConflicts(c);
                  return;
                }
                await supabase
                  .from("lesson_instances")
                  .update({
                    lesson_date: lessonDates[key],
                    original_date: inst.original_date || inst.lesson_date,
                    rescheduled_count: inst.rescheduled_count + 1,
                  })
                  .eq("id", inst.id);
              }
            }

            // Then regenerate planned instances AFTER the last changed one
            // Sort all instances chronologically to find the right starting point
            const allSorted = [...instances].sort((a, b) => {
              const dc = a.lesson_date.localeCompare(b.lesson_date);
              return dc !== 0 ? dc : a.start_time.localeCompare(b.start_time);
            });

            // Find the last changed instance's position
            const changedInstanceIds = new Set(
              changedKeys.map((k) => instanceIdMap[k]).filter(Boolean)
            );
            let lastChangedIdx = -1;
            allSorted.forEach((inst, idx) => {
              if (changedInstanceIds.has(inst.id)) lastChangedIdx = idx;
            });

            // Get planned instances after the last changed one
            const plannedAfterChanged = allSorted
              .slice(lastChangedIdx + 1)
              .filter((inst) => inst.status === "planned");

            if (plannedAfterChanged.length > 0) {
              // Start from the day after the last changed instance's new date
              const lastChangedKey = changedKeys.reduce((a, b) => 
                Number(a) > Number(b) ? a : b
              );
              const lastChangedDate = new Date(lessonDates[lastChangedKey]);
              const startDate = new Date(lastChangedDate);
              startDate.setDate(startDate.getDate() + 1);

              const futureDates = generateFutureInstanceDates(
                templateSlots,
                plannedAfterChanged.length,
                startDate
              );

              // Check conflicts for new dates
              const allConflicts: ConflictInfo[] = [];
              for (let i = 0; i < futureDates.length; i++) {
                const c = await checkTeacherConflicts(
                  teacherUserId,
                  futureDates[i].lessonDate,
                  futureDates[i].startTime,
                  futureDates[i].endTime,
                  plannedAfterChanged[i]?.id,
                  studentUserId
                );
                allConflicts.push(...c);
              }

              if (allConflicts.length > 0) {
                setConflicts(allConflicts);
                return;
              }

              // Apply to instances
              for (let i = 0; i < plannedAfterChanged.length && i < futureDates.length; i++) {
                await supabase
                  .from("lesson_instances")
                  .update({
                    lesson_date: futureDates[i].lessonDate,
                    start_time: futureDates[i].startTime,
                    end_time: futureDates[i].endTime,
                  })
                  .eq("id", plannedAfterChanged[i].id);
              }

              // Update finalDates from instances
              for (let i = 0; i < plannedAfterChanged.length && i < futureDates.length; i++) {
                finalDates = {
                  ...finalDates,
                  [plannedAfterChanged[i].lesson_number.toString()]: futureDates[i].lessonDate,
                };
              }
            }
          } else {
            // Legacy fallback
            const lessonDays = lessons.map((l) => l.dayOfWeek).sort((a, b) => a - b);
            const totalLessons = lessonsPerWeek * 4;
            finalDates = recalculateRemainingDates(
              firstChangedLesson,
              lessonDates[firstChangedLesson.toString()],
              lessonDates,
              lessonDays,
              totalLessons
            );
          }
        }
      } else {
        // OFF: only date changes, time stays the same
        // Update individual instance dates without changing times
        const changedKeys = Object.keys(lessonDates).filter(
          (key) => lessonDates[key] !== originalLessonDates[key]
        );

        for (const key of changedKeys) {
          // Use instanceIdMap for direct matching instead of lesson_number lookup
          const instId = instanceIdMap[key];
          const inst = instId ? instances.find((i) => i.id === instId) : findInstanceForLesson(parseInt(key));
          if (inst) {
            // Conflict check
            const c = await checkTeacherConflicts(
              teacherUserId,
              lessonDates[key],
              inst.start_time,
              inst.end_time,
              inst.id,
              studentUserId
            );
            if (c.length > 0) {
              setConflicts(c);
              return;
            }

            await supabase
              .from("lesson_instances")
              .update({
                lesson_date: lessonDates[key],
                original_date: inst.original_date || inst.lesson_date,
                rescheduled_count: inst.rescheduled_count + 1,
              })
              .eq("id", inst.id);
          }
        }
      }

      // Rebuild legacy JSON from instances (canonical sync)
      await rebuildLegacyLessonDatesFromInstances(studentUserId, teacherUserId);

      // Re-fetch synced dates
      const { data: syncedTracking } = await supabase
        .from("student_lesson_tracking")
        .select("lesson_dates")
        .eq("student_id", studentUserId)
        .eq("teacher_id", teacherUserId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const syncedDates = (syncedTracking as any)?.lesson_dates || finalDates;

      toast({
        title: "Başarılı",
        description: "Ders tarihleri güncellendi",
      });

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

      setOriginalLessonDates(syncedDates);
      setLessonDates(syncedDates);
      setShowConfirm(false);
      setUpdateRemainingDays(false);
      setConflicts([]);
      fetchInstances();
    } catch (error: any) {
      toast({
        title: "Hata",
        description: error.message || "Tarihler güncellenemedi",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast({
        title: "Hata",
        description: "Öğrenci adı gereklidir",
        variant: "destructive",
      });
      return;
    }

    if (!lessons.every((lesson) => lesson.dayOfWeek !== undefined && lesson.startTime && lesson.endTime)) {
      toast({
        title: "Hata",
        description: "Tüm ders programı alanlarını doldurun",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setConflicts([]);

    try {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ full_name: name.trim() })
        .eq("user_id", studentUserId);

      if (profileError) throw profileError;

      const { error: deleteError } = await supabase
        .from("student_lessons")
        .delete()
        .eq("student_id", studentUserId)
        .eq("teacher_id", teacherUserId);

      if (deleteError) throw deleteError;

      const lessonsToInsert = lessons.map((lesson) => ({
        student_id: studentUserId,
        teacher_id: teacherUserId,
        day_of_week: lesson.dayOfWeek,
        start_time: lesson.startTime,
        end_time: lesson.endTime,
        note: lesson.note || null,
      }));

      const { error: insertError } = await supabase.from("student_lessons").insert(lessonsToInsert);

      if (insertError) throw insertError;

      // Sync template change to instances (regenerate planned)
      const newSlots: TemplateSlot[] = lessons.map((l) => ({
        dayOfWeek: l.dayOfWeek,
        startTime: l.startTime,
        endTime: l.endTime,
      }));
      const totalLessonsCount = lessonsPerWeek * 4;

      if (instances.length > 0) {
        const result = await syncTemplateChange(studentUserId, teacherUserId, newSlots, totalLessonsCount);

        if (result.conflicts.length > 0) {
          setConflicts(result.conflicts);
          setLoading(false);
          return;
        }

        // Rebuild legacy JSON after template sync
        await rebuildLegacyLessonDatesFromInstances(studentUserId, teacherUserId);
      } else {
        // Bug #1 fix: No instances exist yet — generate fresh instances
        const today = new Date();
        const futureDates = generateFutureInstanceDates(newSlots, totalLessonsCount, today);

        if (futureDates.length > 0) {
          for (let i = 0; i < futureDates.length; i++) {
            await supabase.from("lesson_instances").insert({
              student_id: studentUserId,
              teacher_id: teacherUserId,
              lesson_number: i + 1,
              lesson_date: futureDates[i].lessonDate,
              start_time: futureDates[i].startTime,
              end_time: futureDates[i].endTime,
              status: "planned",
            });
          }

          // Create or update tracking record
          const lessonDatesJson: Record<string, string> = {};
          futureDates.forEach((d, idx) => {
            lessonDatesJson[(idx + 1).toString()] = d.lessonDate;
          });

          const { data: existingTracking } = await supabase
            .from("student_lesson_tracking")
            .select("id")
            .eq("student_id", studentUserId)
            .eq("teacher_id", teacherUserId)
            .limit(1);

          if (existingTracking && existingTracking.length > 0) {
            await supabase
              .from("student_lesson_tracking")
              .update({ lessons_per_week: lessonsPerWeek, lesson_dates: lessonDatesJson })
              .eq("id", existingTracking[0].id);
          } else {
            await supabase.from("student_lesson_tracking").insert({
              student_id: studentUserId,
              teacher_id: teacherUserId,
              lessons_per_week: lessonsPerWeek,
              lesson_dates: lessonDatesJson,
              completed_lessons: [],
            });
          }
        }
      }

      toast({
        title: "Başarılı",
        description: "Öğrenci ayarları güncellendi",
      });

      onStudentUpdated();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Hata",
        description: error.message || "Öğrenci ayarları güncellenemedi",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStudent = async () => {
    setLoading(true);
    try {
      const { data: topics } = await supabase
        .from("topics")
        .select("id")
        .eq("student_id", studentUserId)
        .eq("teacher_id", teacherUserId);

      if (topics && topics.length > 0) {
        const topicIds = topics.map((t) => t.id);
        await supabase.from("resources").delete().in("topic_id", topicIds);
        await supabase.from("topics").delete().in("id", topicIds);
      }

      await supabase
        .from("student_resource_completion")
        .delete()
        .eq("student_id", studentUserId);

      await supabase
        .from("student_lesson_tracking")
        .delete()
        .eq("student_id", studentUserId)
        .eq("teacher_id", teacherUserId);

      await supabase
        .from("student_lessons")
        .delete()
        .eq("student_id", studentUserId)
        .eq("teacher_id", teacherUserId);

      await supabase
        .from("homework_submissions")
        .delete()
        .eq("student_id", studentUserId)
        .eq("teacher_id", teacherUserId);

      await supabase
        .from("lesson_instances")
        .delete()
        .eq("student_id", studentUserId)
        .eq("teacher_id", teacherUserId);

      await supabase.from("students").delete().eq("id", studentId);
      await supabase.from("profiles").delete().eq("user_id", studentUserId);

      toast({
        title: "Başarılı",
        description: "Öğrenci ve tüm verileri silindi",
      });

      onStudentUpdated();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Hata",
        description: error.message || "Öğrenci silinemedi",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Build sorted lessons for the date display section
  // Uses instances if available, sorted chronologically by (lesson_date, start_time)
  const totalLessons = lessonsPerWeek * 4;

  const sortedLessonsForDisplay = (() => {
    // Instance-based display — cap at totalLessons (lpw * 4)
    if (instances.length > 0) {
      // Sort instances by date+time for chronological "Ders N" labels
      const sorted = [...instances].sort((a, b) => {
        const dateCompare = a.lesson_date.localeCompare(b.lesson_date);
        if (dateCompare !== 0) return dateCompare;
        return a.start_time.localeCompare(b.start_time);
      });

      // Take only first totalLessons entries
      const capped = sorted.slice(0, totalLessons);

      // If lesson_dates is empty (reset state), hide placeholder dates from instances
      const datesUnassigned = Object.keys(lessonDates).length === 0;

      const result = capped.map((inst, idx) => ({
        displayIndex: idx + 1,
        lessonNumber: inst.lesson_number,
        effectiveDate: datesUnassigned ? "" : inst.lesson_date,
        startTime: inst.start_time,
        endTime: inst.end_time,
        isCompleted: inst.status === "completed",
        isCancelled: inst.status === "cancelled",
        isOverridden: inst.original_date !== null,
        instanceId: inst.id,
      }));

      // Fill empty rows if fewer instances than totalLessons
      for (let i = result.length; i < totalLessons; i++) {
        result.push({
          displayIndex: i + 1,
          lessonNumber: i + 1,
          effectiveDate: "",
          startTime: "",
          endTime: "",
          isCompleted: false,
          isCancelled: false,
          isOverridden: false,
          instanceId: undefined,
        });
      }

      return result;
    }

    // Legacy fallback: use lessonDates JSON
    const lessonsWithDates: {
      displayIndex: number;
      lessonNumber: number;
      effectiveDate: string;
      startTime: string;
      endTime: string;
      isCompleted: boolean;
      isCancelled: boolean;
      isOverridden: boolean;
      instanceId?: string;
    }[] = [];

    for (let i = 1; i <= totalLessons; i++) {
      const originalDate = lessonDates[i.toString()];
      if (!originalDate) {
        lessonsWithDates.push({
          displayIndex: i,
          lessonNumber: i,
          effectiveDate: "",
          startTime: "",
          endTime: "",
          isCompleted: completedLessons.includes(i),
          isCancelled: false,
          isOverridden: false,
        });
        continue;
      }

      const override = lessonOverrides.find((o) => o.original_date === originalDate);
      const isCancelled = override?.is_cancelled || false;
      const effectiveDate = override && override.new_date && !isCancelled
        ? override.new_date
        : originalDate;

      lessonsWithDates.push({
        displayIndex: i,
        lessonNumber: i,
        effectiveDate,
        startTime: "",
        endTime: "",
        isCompleted: completedLessons.includes(i),
        isCancelled,
        isOverridden: effectiveDate !== originalDate,
      });
    }

    // Sort by effective date
    const withDates = lessonsWithDates.filter(l => l.effectiveDate);
    const withoutDates = lessonsWithDates.filter(l => !l.effectiveDate);
    withDates.sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
    return [...withDates, ...withoutDates].map((l, idx) => ({ ...l, displayIndex: idx + 1 }));
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1rem)] w-[calc(100%-1rem)] w-[calc(100%-1rem)] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Öğrenci Ayarları</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Öğrenci Adı</Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ad Soyad"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lessonsPerWeek">Haftalık Ders Sayısı</Label>
            <Select
              value={lessonsPerWeek.toString()}
              onValueChange={(value) => setLessonsPerWeek(Number(value))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                  <SelectItem key={num} value={num.toString()}>
                    {num} ders
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label className="text-base font-medium">Ders Programı</Label>
            {lessons.map((lesson, index) => (
              <div key={index} className="grid grid-cols-1 sm:grid-cols-4 gap-2 sm:gap-3 p-3 border rounded-lg">
                <div className="space-y-2">
                  <Label>Gün</Label>
                  <Select
                    value={lesson.dayOfWeek.toString()}
                    onValueChange={(value) => updateLesson(index, "dayOfWeek", Number(value))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {daysOfWeek.map((day) => (
                        <SelectItem key={day.value} value={day.value.toString()}>
                          {day.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Başlangıç</Label>
                  <Input
                    type="time"
                    value={lesson.startTime}
                    onChange={(e) => updateLesson(index, "startTime", e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Bitiş</Label>
                  <Input
                    type="time"
                    value={lesson.endTime}
                    onChange={(e) => updateLesson(index, "endTime", e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Not</Label>
                  <Input
                    type="text"
                    value={lesson.note || ""}
                    onChange={(e) => updateLesson(index, "note", e.target.value)}
                    placeholder="Opsiyonel"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Conflict warnings */}
          {conflicts.length > 0 && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 space-y-1.5">
              <div className="flex items-center gap-2 text-destructive font-medium text-sm">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Çakışma Tespit Edildi
              </div>
              {conflicts.map((c, i) => (
                <div key={i} className="text-xs text-destructive/80">
                  {c.studentName} — {c.date} {c.timeRange} ({c.type === "trial" ? "Deneme" : "Ders"})
                </div>
              ))}
            </div>
          )}

          <Separator className="my-4" />

          {/* İşlenen Dersler Bölümü */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <Label className="text-base font-medium">İşlenen Dersler</Label>
                <p className="text-sm text-muted-foreground">
                  Ders tarihlerini düzenleyebilir ve güncelleyebilirsiniz.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {completedLessons.length < lessonsPerWeek * 4 && (
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={handleMarkLastLesson}
                    disabled={loading}
                  >
                    Son Dersi İşaretle
                  </Button>
                )}
                {completedLessons.length > 0 && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleUndoLastLesson}
                      disabled={loading}
                    >
                      Son Dersi Geri Al
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => setShowResetConfirm(true)}
                      disabled={loading}
                    >
                      Sıfırla
                    </Button>
                  </>
                )}
              </div>
            </div>
            <div className="space-y-2">
              {sortedLessonsForDisplay.map((lesson) => (
                <div key={`${lesson.lessonNumber}-${lesson.instanceId || lesson.displayIndex}`} className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 border rounded-lg ${
                  lesson.isCancelled ? "opacity-50 bg-muted" : ""
                } ${lesson.isOverridden ? "border-amber-500" : ""}`}>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div 
                      className={`h-4 w-4 rounded-full shrink-0 ${
                        lesson.isCancelled 
                          ? "bg-muted-foreground" 
                          : lesson.isCompleted
                            ? "bg-primary" 
                            : "bg-muted"
                      }`} 
                    />
                    <span className={`font-medium text-sm ${
                      lesson.isCancelled 
                        ? "text-muted-foreground line-through" 
                        : lesson.isCompleted
                          ? "text-foreground" 
                          : "text-muted-foreground"
                    }`}>
                      Ders {lesson.displayIndex}
                      {lesson.isCancelled && " (İptal)"}
                    </span>
                    {lesson.startTime && lesson.endTime && (
                      <span className="text-xs text-muted-foreground ml-1 shrink-0">
                        {formatTime(lesson.startTime)} - {formatTime(lesson.endTime)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Label className={`text-sm ${lesson.isOverridden ? "text-amber-600 font-medium" : "text-muted-foreground"}`}>
                      {lesson.isOverridden ? "Yeni:" : "Tarih:"}
                    </Label>
                    <Input
                      type="date"
                      value={lessonDates[lesson.lessonNumber.toString()] || lesson.effectiveDate || ""}
                      onChange={(e) => updateLessonDate(lesson.lessonNumber, e.target.value)}
                      className={`w-full sm:w-40 ${lesson.isOverridden ? "border-amber-500" : ""}`}
                      disabled={lesson.isCancelled}
                    />
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="default"
                onClick={handleDateSubmit}
                disabled={loading || Object.keys(lessonDates).every(
                  (key) => lessonDates[key] === originalLessonDates[key]
                )}
                className="w-full"
              >
                Tarihleri Onayla
              </Button>
            </div>
          </div>

          <Separator className="my-4" />

          {/* Öğrenci Silme Bölümü */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base font-medium text-destructive">Tehlikeli Alan</Label>
                <p className="text-sm text-muted-foreground">
                  Öğrenciyi arşivleyin veya kalıcı olarak silin.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  const confirmed = window.confirm(
                    `${currentName} adlı öğrenciyi arşivlemek istediğinize emin misiniz? Öğrenci ders programından ve listeden kaldırılacak, ancak tüm verileri korunacaktır. İstediğiniz zaman geri alabilirsiniz.`
                  );
                  if (confirmed) {
                    setLoading(true);
                    try {
                      const result = await archiveStudent(studentId, studentUserId, teacherUserId);
                      if (!result.success) {
                        throw new Error(result.error || "Arşivleme başarısız");
                      }

                      toast({
                        title: "Başarılı",
                        description: "Öğrenci arşivlendi",
                      });

                      onStudentUpdated();
                      onOpenChange(false);
                    } catch (error: any) {
                      toast({
                        title: "Hata",
                        description: error.message,
                        variant: "destructive",
                      });
                    } finally {
                      setLoading(false);
                    }
                  }
                }}
                className="flex items-center gap-2"
              >
                <Archive className="h-4 w-4" />
                Arşivle
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  const confirmed = window.confirm(
                    `${currentName} adlı öğrenciyi kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz ve tüm verileri silinecektir.`
                  );
                  if (confirmed) {
                    handleDeleteStudent();
                  }
                }}
                className="flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Kalıcı Sil
              </Button>
            </div>
          </div>

          <Separator className="my-4" />

          <div className="flex gap-3">
            <Button type="submit" disabled={loading || conflicts.length > 0} className="flex-1">
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Kaydet
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              İptal
            </Button>
          </div>
        </form>

        {/* Tarih onaylama dialogu */}
        <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Ders Tarihlerini Güncelle</AlertDialogTitle>
              <AlertDialogDescription>
                Ders tarihlerini güncellemek istediğinize emin misiniz?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex items-center space-x-2 py-4">
              <Checkbox
                id="updateRemaining"
                checked={updateRemainingDays}
                onCheckedChange={(checked) => setUpdateRemainingDays(!!checked)}
              />
              <label
                htmlFor="updateRemaining"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Kalan günleri de güncelle
              </label>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>İptal</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDateUpdate}>Onayla</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Sıfırlama onaylama dialogu */}
        <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Tüm Dersleri Sıfırla</AlertDialogTitle>
              <AlertDialogDescription>
                Tüm işlenen dersleri ve tarihleri sıfırlamak istediğinize emin misiniz? 
                Bu işlem öğretmen bakiyesini etkilemez.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>İptal</AlertDialogCancel>
              <AlertDialogAction onClick={handleResetAllLessons}>Sıfırla</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
