import { useState, useEffect } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
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
import { Ban } from "lucide-react";
import { LessonDates, LessonOverrideInfo, LessonInstance, getRowConfig } from "@/lib/lessonTypes";
import { getSortedLessons, getDisplayLessonData } from "@/lib/lessonSorting";
import { calculateLessonDates } from "@/lib/lessonDateCalculation";
import { addRegularLessonBalance } from "@/lib/teacherBalance";

interface LessonTrackerProps {
  studentId: string;
  studentName: string;
  teacherId: string;
}

export function LessonTracker({ studentId, studentName, teacherId }: LessonTrackerProps) {
  const [completedLessons, setCompletedLessons] = useState<number[]>([]);
  const [lessonDates, setLessonDates] = useState<LessonDates>({});
  const [studentLessonDays, setStudentLessonDays] = useState<number[]>([]);
  const [lessonOverrides, setLessonOverrides] = useState<LessonOverrideInfo[]>([]);
  const [instances, setInstances] = useState<LessonInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingLesson, setPendingLesson] = useState<number | null>(null);
  const [pendingInstanceId, setPendingInstanceId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!studentId || !teacherId) {
      setLoading(false);
      return;
    }
    
    const loadData = async () => {
      await Promise.all([
        fetchStudentSchedule(),
        fetchLessonOverrides(),
        fetchTracking(),
        fetchInstances(),
      ]);
    };
    loadData();
  }, [studentId, teacherId]);

  const fetchStudentSchedule = async () => {
    try {
      const { data, error } = await supabase
        .from("student_lessons")
        .select("day_of_week")
        .eq("student_id", studentId)
        .eq("teacher_id", teacherId)
        .order("day_of_week");

      if (error) throw error;
      setStudentLessonDays(data.map((lesson: any) => lesson.day_of_week));
    } catch (error: any) {
      console.error("Failed to fetch student schedule:", error);
    }
  };

  const fetchLessonOverrides = async () => {
    try {
      const { data, error } = await supabase
        .from("lesson_overrides")
        .select("id, original_date, new_date, is_cancelled")
        .eq("student_id", studentId)
        .eq("teacher_id", teacherId);

      if (error) throw error;
      setLessonOverrides(data || []);
    } catch (error: any) {
      console.error("Failed to fetch lesson overrides:", error);
    }
  };

  const fetchInstances = async () => {
    try {
      const { data, error } = await supabase
        .from("lesson_instances")
        .select("*")
        .eq("student_id", studentId)
        .eq("teacher_id", teacherId)
        .order("lesson_number", { ascending: true });

      if (error) throw error;
      setInstances(data || []);
    } catch (error: any) {
      console.error("Failed to fetch lesson instances:", error);
    }
  };

  const fetchTracking = async () => {
    try {
      const { data: records, error } = await supabase
        .from("student_lesson_tracking")
        .select("*")
        .eq("student_id", studentId)
        .eq("teacher_id", teacherId)
        .order("updated_at", { ascending: false })
        .limit(1);

      if (error) throw error;

      if (records && records.length > 0) {
        const data = records[0];
        setCompletedLessons((data as any).completed_lessons || []);
        setLessonDates((data as any).lesson_dates || {});
      } else {
        const { data: lessonsData } = await supabase
          .from("student_lessons")
          .select("id")
          .eq("student_id", studentId)
          .eq("teacher_id", teacherId);

        const lessonsPerWeek = lessonsData?.length || 1;

        const { data: newData, error: insertError } = await supabase
          .from("student_lesson_tracking")
          .insert({
            student_id: studentId,
            teacher_id: teacherId,
            lessons_per_week: lessonsPerWeek,
            completed_lessons: [],
            lesson_dates: {},
          })
          .select()
          .single();

        if (insertError) throw insertError;
        if (newData) {
          setCompletedLessons((newData as any).completed_lessons || []);
          setLessonDates((newData as any).lesson_dates || {});
        }
      }
    } catch (error: any) {
      toast({
        title: "Hata",
        description: "Ders takibi yüklenemedi",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLessonClick = (lessonNumber: number, instanceId?: string) => {
    if (completedLessons.includes(lessonNumber)) return;
    setPendingLesson(lessonNumber);
    setPendingInstanceId(instanceId || null);
    setShowConfirm(true);
  };

  const confirmLessonComplete = async () => {
    if (pendingLesson === null) return;

    try {
      if (studentLessonDays.length === 0) {
        toast({
          title: "Hata",
          description: "Öğrenci ders günleri yüklenemedi. Lütfen sayfayı yenileyin.",
          variant: "destructive",
        });
        setShowConfirm(false);
        setPendingLesson(null);
        return;
      }

      const newCompletedLessons = [...completedLessons, pendingLesson].sort((a, b) => a - b);
      let newLessonDates = { ...lessonDates };

      if (Object.keys(lessonDates).length === 0) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const totalLessons = studentLessonDays.length * 4;
        newLessonDates = calculateLessonDates(pendingLesson, today, studentLessonDays, totalLessons);
        
        if (Object.keys(newLessonDates).length === 0) {
          toast({
            title: "Hata", 
            description: "Ders tarihleri hesaplanamadı. Lütfen tekrar deneyin.",
            variant: "destructive",
          });
          setShowConfirm(false);
          setPendingLesson(null);
          return;
        }

        // Sync calculated dates to lesson_instances
        for (const inst of instances) {
          const dateForLesson = newLessonDates[inst.lesson_number.toString()];
          if (dateForLesson) {
            await supabase
              .from("lesson_instances")
              .update({ lesson_date: dateForLesson })
              .eq("id", inst.id);
          }
        }
      }

      const { data: existingRecords } = await supabase
        .from("student_lesson_tracking")
        .select("id")
        .eq("student_id", studentId)
        .eq("teacher_id", teacherId)
        .order("updated_at", { ascending: false })
        .limit(1);

      if (!existingRecords || existingRecords.length === 0) {
        throw new Error("Ders takip kaydı bulunamadı");
      }

      const { error } = await supabase
        .from("student_lesson_tracking")
        .update({
          completed_lessons: newCompletedLessons,
          lesson_dates: newLessonDates,
        })
        .eq("id", existingRecords[0].id);

      if (error) throw error;

      // Find matching instance — prefer pendingInstanceId, fallback to lesson_number
      const matchingInstance = pendingInstanceId
        ? instances.find(i => i.id === pendingInstanceId)
        : instances.find(i => i.lesson_number === pendingLesson);
      
      if (matchingInstance) {
        await supabase
          .from("lesson_instances")
          .update({ status: "completed" })
          .eq("id", matchingInstance.id);
        
        await addRegularLessonBalance(teacherId, studentId, matchingInstance.id);
      } else {
        await addRegularLessonBalance(teacherId, studentId);
      }

      setCompletedLessons(newCompletedLessons);
      setLessonDates(newLessonDates);
      // Refresh instances
      fetchInstances();
      toast({
        title: "Başarılı",
        description: `${pendingLesson}. ders işlendi olarak işaretlendi`,
      });
    } catch (error: any) {
      toast({
        title: "Hata",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setShowConfirm(false);
      setPendingLesson(null);
      setPendingInstanceId(null);
    }
  };

  const totalLessonsPerMonth = studentLessonDays.length * 4;
  const rowConfig = getRowConfig(studentLessonDays.length);
  
  // Build instanceStartTimes map for time-aware sorting
  const instanceStartTimes: Record<string, string> = {};
  instances.forEach(inst => {
    instanceStartTimes[inst.lesson_number.toString()] = inst.start_time;
  });
  
  const sortedLessons = getSortedLessons(lessonDates, lessonOverrides, totalLessonsPerMonth, instanceStartTimes);

  if (loading) {
    return <div className="animate-pulse h-40 bg-muted rounded-lg"></div>;
  }

  return (
    <>
      <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
        <div className="flex items-center gap-2 border-2 border-primary/30 rounded-xl p-2 sm:p-2.5 bg-gradient-to-br from-primary/5 to-secondary/5 shadow-sm w-full sm:w-auto overflow-x-auto">
          <div className="flex flex-col gap-1.5">
            {Array.from({ length: rowConfig.rows }, (_, rowIndex) => (
              <div key={rowIndex} className="flex gap-1.5">
                {Array.from({ length: rowConfig.buttonsPerRow }, (_, colIndex) => {
                  const displayPosition = rowIndex * rowConfig.buttonsPerRow + colIndex + 1;
                  if (displayPosition > totalLessonsPerMonth) return null;

                  const lessonData = getDisplayLessonData(sortedLessons, lessonDates, displayPosition);
                  const { lessonNumber, displayDate, isCancelled, isOverridden } = lessonData;
                  const isCompleted = completedLessons.includes(lessonNumber);
                  
                  // Get instance time for tooltip
                  const inst = instances.find(i => i.lesson_number === lessonNumber);
                  const timeInfo = inst ? `${inst.start_time.slice(0,5)} - ${inst.end_time.slice(0,5)}` : "";

                  return (
                    <div key={displayPosition} className="flex flex-col items-center gap-0.5">
                      <button
                        onClick={() => handleLessonClick(lessonNumber, inst?.id)}
                        disabled={isCompleted || isCancelled}
                        className={`
                          h-8 w-8 rounded-lg border-2 transition-all duration-200 font-semibold text-xs
                          flex items-center justify-center shadow-sm relative
                          ${
                            isCancelled
                              ? "bg-muted text-muted-foreground border-muted-foreground/30 opacity-50 cursor-not-allowed"
                              : isCompleted
                                ? "bg-primary text-primary-foreground border-primary scale-95 shadow-md"
                                : "bg-background border-primary/30 hover:bg-primary/10 hover:scale-105 hover:shadow-md cursor-pointer hover:border-primary"
                          }
                        `}
                        title={
                          isCancelled 
                            ? `Ders ${displayPosition} - İptal Edildi` 
                            : timeInfo 
                              ? `Ders ${displayPosition} - ${timeInfo}` 
                              : `Ders ${displayPosition}`
                        }
                      >
                        {isCancelled ? <Ban className="h-4 w-4" /> : displayPosition}
                      </button>
                      {displayDate && (
                        <span className={`text-[10px] whitespace-nowrap ${
                          isOverridden ? "text-amber-600 dark:text-amber-400 font-medium" : "text-muted-foreground"
                        }`}>
                          {format(new Date(displayDate), "dd.MM")}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dersi İşaretle</AlertDialogTitle>
            <AlertDialogDescription>
              {studentName} için {pendingLesson}. dersi işlendi olarak işaretlemek istiyor musunuz?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setPendingLesson(null); setPendingInstanceId(null); }}>İptal</AlertDialogCancel>
            <AlertDialogAction onClick={confirmLessonComplete}>Onayla</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
