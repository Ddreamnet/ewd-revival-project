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
import { format, addDays } from "date-fns";

interface LessonTrackerProps {
  studentId: string;
  studentName: string;
  teacherId: string;
}

interface LessonDates {
  [key: string]: string;
}

export function LessonTracker({ studentId, studentName, teacherId }: LessonTrackerProps) {
  const [completedLessons, setCompletedLessons] = useState<number[]>([]);
  const [lessonDates, setLessonDates] = useState<LessonDates>({});
  const [studentLessonDays, setStudentLessonDays] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingLesson, setPendingLesson] = useState<number | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchTracking();
    fetchStudentSchedule();
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

      const days = data.map((lesson: any) => lesson.day_of_week);
      setStudentLessonDays(days);
    } catch (error: any) {
      console.error("Failed to fetch student schedule:", error);
    }
  };

  const fetchTracking = async () => {
    try {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from("student_lesson_tracking")
        .select("*")
        .eq("student_id", studentId)
        .eq("teacher_id", teacherId)
        .eq("month_start_date", monthStart.toISOString().split("T")[0])
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;

      if (data) {
        setCompletedLessons((data as any).completed_lessons || []);
        setLessonDates((data as any).lesson_dates || {});
      } else {
        // Create initial tracking record based on student's lessons per week
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
            month_start_date: monthStart.toISOString().split("T")[0],
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

  const calculateLessonDates = (firstLessonDate: Date): LessonDates => {
    if (studentLessonDays.length === 0) return {};

    const dates: LessonDates = {};
    let currentDate = new Date(firstLessonDate);
    currentDate.setHours(0, 0, 0, 0);
    
    const totalLessons = studentLessonDays.length * 4; // 4 weeks

    for (let lessonCount = 1; lessonCount <= totalLessons; lessonCount++) {
      // For the first lesson, use the provided date
      if (lessonCount === 1) {
        dates[lessonCount.toString()] = format(currentDate, "yyyy-MM-dd");
        continue;
      }

      // Find the next lesson day
      let daysToAdd = 1;
      let nextDate = addDays(currentDate, daysToAdd);
      
      while (!studentLessonDays.includes(nextDate.getDay())) {
        daysToAdd++;
        nextDate = addDays(currentDate, daysToAdd);
      }
      
      currentDate = nextDate;
      dates[lessonCount.toString()] = format(currentDate, "yyyy-MM-dd");
    }

    return dates;
  };

  const handleLessonClick = (lessonNumber: number) => {
    // If already completed, don't allow unchecking
    if (completedLessons.includes(lessonNumber)) {
      return;
    }

    setPendingLesson(lessonNumber);
    setShowConfirm(true);
  };

  const confirmLessonComplete = async () => {
    if (pendingLesson === null) return;

    try {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const newCompletedLessons = [...completedLessons, pendingLesson].sort((a, b) => a - b);
      let newLessonDates = { ...lessonDates };

      // If this is the first lesson marked, calculate all dates
      if (Object.keys(lessonDates).length === 0) {
        const today = new Date();
        newLessonDates = calculateLessonDates(today);
      }

      const { error } = await supabase
        .from("student_lesson_tracking")
        .update({
          completed_lessons: newCompletedLessons,
          lesson_dates: newLessonDates,
        })
        .eq("student_id", studentId)
        .eq("teacher_id", teacherId)
        .eq("month_start_date", monthStart.toISOString().split("T")[0]);

      if (error) throw error;

      setCompletedLessons(newCompletedLessons);
      setLessonDates(newLessonDates);
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
    }
  };

  const totalLessonsPerMonth = studentLessonDays.length * 4;

  // Satır yapılandırması
  const getRowConfig = () => {
    if (studentLessonDays.length === 1) return { rows: 1, buttonsPerRow: 4 };
    if (studentLessonDays.length === 2) return { rows: 2, buttonsPerRow: 4 };
    return { rows: 2, buttonsPerRow: 6 };
  };

  const rowConfig = getRowConfig();

  if (loading) {
    return <div className="animate-pulse h-40 bg-muted rounded-lg"></div>;
  }

  return (
    <>
      <div className="flex items-center gap-3">
        {/* İşlenen Dersler */}
        <div className="flex items-center gap-2 border-2 border-primary/30 rounded-xl p-2.5 bg-gradient-to-br from-primary/5 to-secondary/5 shadow-sm">
          <div className="flex flex-col gap-1.5">
            {Array.from({ length: rowConfig.rows }, (_, rowIndex) => (
              <div key={rowIndex} className="flex gap-1.5">
                {Array.from({ length: rowConfig.buttonsPerRow }, (_, colIndex) => {
                  const lessonNumber = rowIndex * rowConfig.buttonsPerRow + colIndex + 1;
                  if (lessonNumber > totalLessonsPerMonth) return null;

                  const isCompleted = completedLessons.includes(lessonNumber);
                  const lessonDate = lessonDates[lessonNumber.toString()];

                  return (
                    <div key={lessonNumber} className="flex flex-col items-center gap-0.5">
                      <button
                        onClick={() => handleLessonClick(lessonNumber)}
                        disabled={isCompleted}
                        className={`
                          h-8 w-8 rounded-lg border-2 transition-all duration-200 font-semibold text-xs
                          flex items-center justify-center shadow-sm
                          ${
                            isCompleted
                              ? "bg-primary text-primary-foreground border-primary scale-95 shadow-md"
                              : "bg-background border-primary/30 hover:bg-primary/10 hover:scale-105 hover:shadow-md cursor-pointer hover:border-primary"
                          }
                        `}
                        title={`Ders ${lessonNumber}`}
                      >
                        {lessonNumber}
                      </button>
                      {lessonDate && (
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {format(new Date(lessonDate), "dd.MM")}
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

      {/* Onaylama Dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dersi İşaretle</AlertDialogTitle>
            <AlertDialogDescription>
              {studentName} için {pendingLesson}. dersi işlendi olarak işaretlemek istiyor musunuz?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingLesson(null)}>İptal</AlertDialogCancel>
            <AlertDialogAction onClick={confirmLessonComplete}>Onayla</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
