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
import { format, addDays, parseISO, isBefore } from "date-fns";
import { Ban } from "lucide-react";

interface LessonTrackerProps {
  studentId: string;
  studentName: string;
  teacherId: string;
}

interface LessonDates {
  [key: string]: string;
}

interface LessonOverride {
  id: string;
  original_date: string;
  new_date: string | null;
  is_cancelled: boolean;
}

export function LessonTracker({ studentId, studentName, teacherId }: LessonTrackerProps) {
  const [completedLessons, setCompletedLessons] = useState<number[]>([]);
  const [lessonDates, setLessonDates] = useState<LessonDates>({});
  const [studentLessonDays, setStudentLessonDays] = useState<number[]>([]);
  const [lessonOverrides, setLessonOverrides] = useState<LessonOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingLesson, setPendingLesson] = useState<number | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Guard: Don't fetch if IDs are missing or empty (e.g., during logout)
    if (!studentId || !teacherId) {
      setLoading(false);
      return;
    }
    
    // CRITICAL: Fetch schedule FIRST before tracking, to ensure studentLessonDays is populated
    const loadData = async () => {
      await fetchStudentSchedule();
      await fetchLessonOverrides();
      await fetchTracking();
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

      const days = data.map((lesson: any) => lesson.day_of_week);
      setStudentLessonDays(days);
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

  const fetchTracking = async () => {
    try {
      // CRITICAL: Get the MOST RECENT tracking record by ordering by updated_at DESC
      // This ensures consistent results when multiple records exist
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

  const calculateLessonDates = (markedLessonNumber: number, markedDate: Date): LessonDates => {
    if (studentLessonDays.length === 0) return {};

    const dates: LessonDates = {};
    const totalLessons = studentLessonDays.length * 4; // 4 weeks
    
    // Set the marked lesson's date
    dates[markedLessonNumber.toString()] = format(markedDate, "yyyy-MM-dd");
    
    // Calculate dates for lessons BEFORE the marked lesson (going backwards)
    let currentDate = new Date(markedDate);
    currentDate.setHours(0, 0, 0, 0);
    
    for (let lessonCount = markedLessonNumber - 1; lessonCount >= 1; lessonCount--) {
      // Find the previous lesson day (going backwards)
      let daysToSubtract = 1;
      let prevDate = addDays(currentDate, -daysToSubtract);
      
      while (!studentLessonDays.includes(prevDate.getDay())) {
        daysToSubtract++;
        prevDate = addDays(currentDate, -daysToSubtract);
      }
      
      currentDate = prevDate;
      dates[lessonCount.toString()] = format(currentDate, "yyyy-MM-dd");
    }
    
    // Calculate dates for lessons AFTER the marked lesson (going forwards)
    currentDate = new Date(markedDate);
    currentDate.setHours(0, 0, 0, 0);
    
    for (let lessonCount = markedLessonNumber + 1; lessonCount <= totalLessons; lessonCount++) {
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
      // CRITICAL: Ensure student lesson days are loaded before calculating dates
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

      // If this is the first time marking a lesson, calculate all dates based on the marked lesson
      if (Object.keys(lessonDates).length === 0) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        newLessonDates = calculateLessonDates(pendingLesson, today);
        
        // Double check that dates were calculated correctly
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
      }

      // CRITICAL: Get the most recent tracking record ID first, then update by ID
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

      // Update teacher balance
      await updateTeacherBalance();

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

  const updateTeacherBalance = async () => {
    try {
      // Get lesson duration
      const { data: lessonData } = await supabase
        .from("student_lessons")
        .select("start_time, end_time")
        .eq("student_id", studentId)
        .eq("teacher_id", teacherId)
        .limit(1)
        .single();

      if (!lessonData) return;

      const startTime = new Date(`2000-01-01T${lessonData.start_time}`);
      const endTime = new Date(`2000-01-01T${lessonData.end_time}`);
      const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);

      // Check if teacher balance exists
      const { data: existingBalance } = await supabase
        .from("teacher_balance")
        .select("*")
        .eq("teacher_id", teacherId)
        .maybeSingle();

      if (existingBalance) {
        // Update existing balance
        await supabase
          .from("teacher_balance")
          .update({
            total_minutes: existingBalance.total_minutes + durationMinutes,
            completed_regular_lessons: existingBalance.completed_regular_lessons + 1,
            regular_lessons_minutes: existingBalance.regular_lessons_minutes + durationMinutes,
          })
          .eq("teacher_id", teacherId);
      } else {
        // Create new balance
        await supabase.from("teacher_balance").insert({
          teacher_id: teacherId,
          total_minutes: durationMinutes,
          completed_regular_lessons: 1,
          completed_trial_lessons: 0,
          regular_lessons_minutes: durationMinutes,
          trial_lessons_minutes: 0,
        });
      }
    } catch (error) {
      console.error("Error updating teacher balance:", error);
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

  // Build sorted lesson data with overrides applied
  const getSortedLessons = () => {
    const lessonsWithDates: { lessonNumber: number; originalDate: string; effectiveDate: string; isCancelled: boolean }[] = [];
    
    for (let i = 1; i <= totalLessonsPerMonth; i++) {
      const originalDate = lessonDates[i.toString()];
      if (!originalDate) continue;
      
      const override = lessonOverrides.find((o) => o.original_date === originalDate);
      const isCancelled = override?.is_cancelled || false;
      const effectiveDate = override && override.new_date && !isCancelled 
        ? override.new_date 
        : originalDate;
      
      lessonsWithDates.push({
        lessonNumber: i,
        originalDate,
        effectiveDate,
        isCancelled,
      });
    }
    
    // Sort by effective date (chronological order)
    lessonsWithDates.sort((a, b) => {
      // Cancelled lessons go to their original position
      if (a.isCancelled && b.isCancelled) return a.originalDate.localeCompare(b.originalDate);
      if (a.isCancelled) return a.originalDate.localeCompare(b.effectiveDate);
      if (b.isCancelled) return a.effectiveDate.localeCompare(b.originalDate);
      return a.effectiveDate.localeCompare(b.effectiveDate);
    });
    
    return lessonsWithDates;
  };

  const sortedLessons = getSortedLessons();

  // Create a map from display position to lesson data
  const getDisplayLessonData = (displayPosition: number) => {
    if (Object.keys(lessonDates).length === 0) {
      // No dates yet, show sequential numbers
      return {
        lessonNumber: displayPosition,
        displayDate: null,
        isCancelled: false,
        isOverridden: false,
      };
    }
    
    // Find the lesson at this display position from sorted array
    const lessonData = sortedLessons[displayPosition - 1];
    if (!lessonData) {
      return {
        lessonNumber: displayPosition,
        displayDate: null,
        isCancelled: false,
        isOverridden: false,
      };
    }
    
    return {
      lessonNumber: lessonData.lessonNumber,
      displayDate: lessonData.effectiveDate,
      isCancelled: lessonData.isCancelled,
      isOverridden: lessonData.effectiveDate !== lessonData.originalDate,
    };
  };

  if (loading) {
    return <div className="animate-pulse h-40 bg-muted rounded-lg"></div>;
  }

  return (
    <>
      <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
        {/* İşlenen Dersler */}
        <div className="flex items-center gap-2 border-2 border-primary/30 rounded-xl p-2 sm:p-2.5 bg-gradient-to-br from-primary/5 to-secondary/5 shadow-sm w-full sm:w-auto overflow-x-auto">
          <div className="flex flex-col gap-1.5">
            {Array.from({ length: rowConfig.rows }, (_, rowIndex) => (
              <div key={rowIndex} className="flex gap-1.5">
                {Array.from({ length: rowConfig.buttonsPerRow }, (_, colIndex) => {
                  const displayPosition = rowIndex * rowConfig.buttonsPerRow + colIndex + 1;
                  if (displayPosition > totalLessonsPerMonth) return null;

                  const lessonData = getDisplayLessonData(displayPosition);
                  const { lessonNumber, displayDate, isCancelled, isOverridden } = lessonData;
                  const isCompleted = completedLessons.includes(lessonNumber);

                  return (
                    <div key={displayPosition} className="flex flex-col items-center gap-0.5">
                      <button
                        onClick={() => handleLessonClick(lessonNumber)}
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
                        title={isCancelled ? `Ders ${displayPosition} - İptal Edildi` : `Ders ${displayPosition}`}
                      >
                        {isCancelled ? <Ban className="h-4 w-4" /> : displayPosition}
                      </button>
                      {displayDate && (
                        <span className={`text-[10px] whitespace-nowrap ${
                          isOverridden ? "text-amber-600 font-medium" : "text-muted-foreground"
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
