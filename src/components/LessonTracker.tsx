import { useState, useEffect } from "react";
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
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { LessonInstance, getRowConfig } from "@/lib/lessonTypes";
import {
  completeLesson,
  undoCompleteLesson,
  getNextCompletableInstance,
  getLastCompletedInstance,
} from "@/lib/lessonService";

interface LessonTrackerProps {
  studentId: string;
  studentName: string;
  teacherId: string;
}

export function LessonTracker({ studentId, studentName, teacherId }: LessonTrackerProps) {
  const [instances, setInstances] = useState<LessonInstance[]>([]);
  const [templateCount, setTemplateCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showUndoConfirm, setShowUndoConfirm] = useState(false);
  const [pendingInstanceId, setPendingInstanceId] = useState<string | null>(null);
  const [undoInstanceId, setUndoInstanceId] = useState<string | null>(null);
  const [nextCompletableId, setNextCompletableId] = useState<string | null>(null);
  const [lastCompletedId, setLastCompletedId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!studentId || !teacherId) {
      setLoading(false);
      return;
    }
    loadData();
  }, [studentId, teacherId]);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([fetchInstances(), fetchTemplateCount(), refreshCompletionState()]);
    setLoading(false);
  };

  const fetchInstances = async () => {
    try {
      const { data: tracking } = await supabase
        .from("student_lesson_tracking")
        .select("package_cycle")
        .eq("student_id", studentId)
        .eq("teacher_id", teacherId)
        .maybeSingle();

      const currentCycle = tracking?.package_cycle ?? 1;

      const { data, error } = await supabase
        .from("lesson_instances")
        .select("*")
        .eq("student_id", studentId)
        .eq("teacher_id", teacherId)
        .eq("package_cycle", currentCycle)
        .in("status", ["planned", "completed"])
        .order("lesson_date", { ascending: true })
        .order("start_time", { ascending: true });

      if (error) throw error;
      setInstances((data as LessonInstance[]) || []);
    } catch (error: any) {
      console.error("Failed to fetch lesson instances:", error);
    }
  };

  const fetchTemplateCount = async () => {
    const { count } = await supabase
      .from("student_lessons")
      .select("id", { count: "exact", head: true })
      .eq("student_id", studentId)
      .eq("teacher_id", teacherId);
    setTemplateCount(count ?? 0);
  };

  const refreshCompletionState = async () => {
    const [next, last] = await Promise.all([
      getNextCompletableInstance(studentId, teacherId),
      getLastCompletedInstance(studentId, teacherId),
    ]);
    setNextCompletableId(next?.id ?? null);
    setLastCompletedId(last?.id ?? null);
  };

  const handleLessonClick = (instanceId: string, isCompleted: boolean) => {
    if (isCompleted) {
      // Toggle: undo if this is the last completed
      if (instanceId !== lastCompletedId) return;
      setUndoInstanceId(instanceId);
      setShowUndoConfirm(true);
    } else {
      // Complete if this is the next completable
      if (instanceId !== nextCompletableId) return;
      setPendingInstanceId(instanceId);
      setShowConfirm(true);
    }
  };

  const confirmLessonComplete = async () => {
    if (!pendingInstanceId) return;

    try {
      const result = await completeLesson(pendingInstanceId, teacherId, studentId);

      if (!result.success) {
        toast({
          title: "Hata",
          description: result.error || "Ders işaretlenemedi",
          variant: "destructive",
        });
        return;
      }

      await fetchInstances();
      await refreshCompletionState();

      const inst = instances.find((i) => i.id === pendingInstanceId);
      toast({
        title: "Başarılı",
        description: `Ders işlendi olarak işaretlendi${inst ? ` (${format(new Date(inst.lesson_date), "dd.MM")})` : ""}`,
      });
    } catch (error: any) {
      toast({
        title: "Hata",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setShowConfirm(false);
      setPendingInstanceId(null);
    }
  };

  const confirmUndo = async () => {
    if (!undoInstanceId) return;

    try {
      const result = await undoCompleteLesson(undoInstanceId, teacherId, studentId);

      if (!result.success) {
        toast({
          title: "Hata",
          description: result.error || "Ders geri alınamadı",
          variant: "destructive",
        });
        return;
      }

      await fetchInstances();
      await refreshCompletionState();

      toast({
        title: "Başarılı",
        description: "Son ders geri alındı",
      });
    } catch (error: any) {
      toast({
        title: "Hata",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setShowUndoConfirm(false);
      setUndoInstanceId(null);
    }
  };

  const totalLessonsPerMonth = templateCount * 4;
  const rowConfig = getRowConfig(templateCount);
  const displayInstances = instances;

  if (loading) {
    return <div className="animate-pulse h-40 bg-muted rounded-lg"></div>;
  }

  return (
    <>
      <div className="flex items-center justify-center w-full">
        <div className="flex items-center border-2 border-primary/30 rounded-xl p-2 sm:p-2.5 bg-gradient-to-br from-primary/5 to-secondary/5 shadow-sm mx-auto">
          <div className="flex flex-col gap-2 sm:gap-2.5 md:gap-2">
            {Array.from({ length: rowConfig.rows }, (_, rowIndex) => (
              <div key={rowIndex} className="flex gap-2 sm:gap-2.5 justify-center">
                {Array.from({ length: rowConfig.buttonsPerRow }, (_, colIndex) => {
                  const displayPosition = rowIndex * rowConfig.buttonsPerRow + colIndex;
                  if (displayPosition >= totalLessonsPerMonth) return null;

                  const inst = displayInstances[displayPosition];
                  if (!inst) return null;

                  const isCompleted = inst.status === "completed";
                  const isNextCompletable = inst.id === nextCompletableId;
                  const isUndoable = isCompleted && inst.id === lastCompletedId;
                  const timeInfo = `${inst.start_time.slice(0, 5)} - ${inst.end_time.slice(0, 5)}`;

                  return (
                    <div key={inst.id} className="flex flex-col items-center gap-0.5">
                      <button
                        onClick={() => handleLessonClick(inst.id, isCompleted)}
                        disabled={!isNextCompletable && !isUndoable}
                        className={`
                          h-8 w-8 sm:h-9 sm:w-9 rounded-lg border-2 transition-all duration-200 font-semibold text-xs
                          flex items-center justify-center shadow-sm relative
                          ${
                            isCompleted
                              ? isUndoable
                                ? "bg-primary text-primary-foreground border-primary scale-95 shadow-md hover:bg-primary/80 hover:scale-100 cursor-pointer"
                                : "bg-primary text-primary-foreground border-primary scale-95 shadow-md cursor-default"
                              : isNextCompletable
                                ? "bg-background border-primary hover:bg-primary/10 hover:scale-105 hover:shadow-md cursor-pointer"
                                : "bg-background border-primary/30 opacity-60 cursor-not-allowed"
                          }
                        `}
                        title={isUndoable ? `Ders ${displayPosition + 1} - Geri al` : `Ders ${displayPosition + 1} - ${timeInfo}`}
                      >
                        {displayPosition + 1}
                      </button>
                      <span className={`text-[10px] whitespace-nowrap ${
                        inst.original_date && (inst as any).is_manual_override ? "text-amber-600 dark:text-amber-400 font-medium" : "text-muted-foreground"
                      }`}>
                        {format(new Date(inst.lesson_date), "dd.MM")}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Complete confirmation */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dersi İşaretle</AlertDialogTitle>
            <AlertDialogDescription>
              {studentName} için sıradaki dersi işlendi olarak işaretlemek istiyor musunuz?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingInstanceId(null)}>İptal</AlertDialogCancel>
            <AlertDialogAction onClick={confirmLessonComplete}>Onayla</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Undo confirmation */}
      <AlertDialog open={showUndoConfirm} onOpenChange={setShowUndoConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Son Dersi Geri Al</AlertDialogTitle>
            <AlertDialogDescription>
              {studentName} için son işlenen dersi geri almak istiyor musunuz? Öğretmen bakiyesi de düzeltilecektir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setUndoInstanceId(null)}>İptal</AlertDialogCancel>
            <AlertDialogAction onClick={confirmUndo}>Geri Al</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
