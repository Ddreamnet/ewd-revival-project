import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Download, Calendar } from "lucide-react";
import { exportScheduleAsPNG } from "./ScheduleExportCanvas";
import { useLessonOverrides, getLessonDateForCurrentWeek, LessonOverride } from "@/hooks/useLessonOverrides";
import { format, startOfWeek, addDays } from "date-fns";

interface StudentLesson {
  id: string;
  student_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  student_name: string;
  is_completed: boolean;
  note?: string;
}
interface TrialLesson {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_completed: boolean;
  lesson_date: string;
}
interface WeeklyScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teacherId: string;
}
const STUDENT_COLORS = ["bg-rose-100 border-rose-300 text-rose-900", "bg-blue-100 border-blue-300 text-blue-900", "bg-amber-100 border-amber-300 text-amber-900", "bg-emerald-100 border-emerald-300 text-emerald-900", "bg-purple-100 border-purple-300 text-purple-900", "bg-pink-100 border-pink-300 text-pink-900", "bg-cyan-100 border-cyan-300 text-cyan-900", "bg-orange-100 border-orange-300 text-orange-900", "bg-lime-100 border-lime-300 text-lime-900", "bg-indigo-100 border-indigo-300 text-indigo-900"];
export function WeeklyScheduleDialog({
  open,
  onOpenChange,
  teacherId
}: WeeklyScheduleDialogProps) {
  const [lessons, setLessons] = useState<StudentLesson[]>([]);
  const [trialLessons, setTrialLessons] = useState<TrialLesson[]>([]);
  const [loading, setLoading] = useState(false);
  const [studentColors, setStudentColors] = useState<Record<string, string>>({});
  const [selectedTrialLesson, setSelectedTrialLesson] = useState<TrialLesson | null>(null);
  const [confirmAction, setConfirmAction] = useState<"complete" | "incomplete" | null>(null);
  const [processing, setProcessing] = useState(false);
  const {
    toast
  } = useToast();
  const { overrides, isLessonCancelled, getLessonOverride, refetch: refetchOverrides } = useLessonOverrides(teacherId);
  const DAYS = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
  useEffect(() => {
    if (open && teacherId) {
      fetchSchedule();
      refetchOverrides();
    }
  }, [open, teacherId]);

  // Real-time listener for trial lesson updates
  useEffect(() => {
    if (!open || !teacherId) return;
    const channel = supabase.channel('trial-lessons-changes').on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'trial_lessons',
      filter: `teacher_id=eq.${teacherId}`
    }, () => {
      // Refetch schedule when trial lesson is updated
      fetchSchedule();
    }).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, teacherId]);
  const fetchSchedule = async () => {
    setLoading(true);
    try {
      // First, get non-archived students for this teacher
      const {
        data: activeStudents,
        error: studentsError
      } = await supabase.from("students").select("student_id").eq("teacher_id", teacherId).eq("is_archived", false);
      if (studentsError) throw studentsError;
      
      const activeStudentIds = (activeStudents || []).map(s => s.student_id);
      
      // First, fetch the lessons only for active students
      const {
        data: lessonsData,
        error: lessonsError
      } = await supabase.from("student_lessons").select("id, student_id, day_of_week, start_time, end_time, is_completed, note").eq("teacher_id", teacherId).in("student_id", activeStudentIds.length > 0 ? activeStudentIds : ['no-students']).order("start_time", {
        ascending: true
      });
      if (lessonsError) throw lessonsError;

      // Fetch trial lessons
      const {
        data: trialLessonsData,
        error: trialLessonsError
      } = await supabase.from("trial_lessons").select("id, day_of_week, start_time, end_time, is_completed, lesson_date").eq("teacher_id", teacherId).order("start_time", {
        ascending: true
      });
      if (trialLessonsError) throw trialLessonsError;
      setTrialLessons(trialLessonsData || []);

      // Then fetch student names separately
      const studentIds = Array.from(new Set((lessonsData || []).map(l => l.student_id)));
      const {
        data: profilesData,
        error: profilesError
      } = await supabase.from("profiles").select("user_id, full_name").in("user_id", studentIds.length > 0 ? studentIds : ['no-students']);
      if (profilesError) throw profilesError;

      // Create a map of student_id to full_name
      const studentNameMap: Record<string, string> = {};
      (profilesData || []).forEach(profile => {
        studentNameMap[profile.user_id] = profile.full_name;
      });
      const formattedLessons: StudentLesson[] = (lessonsData || []).map(lesson => ({
        id: lesson.id,
        student_id: lesson.student_id,
        day_of_week: lesson.day_of_week,
        start_time: lesson.start_time,
        end_time: lesson.end_time,
        student_name: studentNameMap[lesson.student_id] || "Bilinmeyen",
        is_completed: lesson.is_completed,
        note: lesson.note
      }));
      setLessons(formattedLessons);

      // Assign colors to students
      const uniqueStudents = Array.from(new Set(formattedLessons.map(l => l.student_id)));
      const colors: Record<string, string> = {};
      uniqueStudents.forEach((studentId, index) => {
        colors[studentId] = STUDENT_COLORS[index % STUDENT_COLORS.length];
      });
      setStudentColors(colors);
    } catch (error: any) {
      toast({
        title: "Hata",
        description: "Ders programı yüklenemedi",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const formatTime = (time: string) => {
    try {
      return new Date(`2000-01-01T${time}`).toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return time;
    }
  };
  // Get the date for a specific day in the current week
  const getDateForDayIndex = (dayIndex: number): Date => {
    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Monday
    return addDays(weekStart, dayIndex);
  };

  const getAllTimeSlots = () => {
    const times = new Set<string>();
    
    // Add regular lesson times, considering overrides
    lessons.forEach(lesson => {
      const lessonDate = getLessonDateForCurrentWeek(lesson.day_of_week);
      const override = getLessonOverride(lesson.student_id, lessonDate);
      
      if (!isLessonCancelled(lesson.student_id, lessonDate)) {
        if (override && override.new_start_time) {
          times.add(override.new_start_time);
        } else {
          times.add(lesson.start_time);
        }
      }
    });
    
    trialLessons.forEach(lesson => {
      times.add(lesson.start_time);
    });
    
    // Add moved lessons that might have different times
    overrides.forEach((o) => {
      if (!o.is_cancelled && o.new_start_time) {
        times.add(o.new_start_time);
      }
    });
    
    return Array.from(times).sort();
  };
  
  const getLessonForDayAndTime = (dayIndex: number, timeSlot: string): (StudentLesson & { _isOverride?: boolean; _override?: LessonOverride }) | null => {
    // dayIndex: 0=Pazartesi, 6=Pazar
    // day_of_week in DB: 1=Pazartesi, 0=Pazar
    const dbDayOfWeek = dayIndex === 6 ? 0 : dayIndex + 1;
    const dateForDay = getDateForDayIndex(dayIndex);
    
    // First check if there's a moved lesson that should appear here
    const movedLesson = overrides.find((o) => {
      if (o.is_cancelled || !o.new_date) return false;
      const newDate = new Date(o.new_date);
      const effectiveTime = o.new_start_time || o.original_start_time;
      return format(newDate, "yyyy-MM-dd") === format(dateForDay, "yyyy-MM-dd") && effectiveTime === timeSlot;
    });
    
    if (movedLesson) {
      // Find the original lesson
      const originalLesson = lessons.find((l) => l.student_id === movedLesson.student_id);
      if (originalLesson) {
        return {
          ...originalLesson,
          start_time: movedLesson.new_start_time || movedLesson.original_start_time,
          end_time: movedLesson.new_end_time || movedLesson.original_end_time,
          _isOverride: true,
          _override: movedLesson,
        };
      }
    }
    
    // Check for regular lessons on this day
    const lesson = lessons.find(l => l.day_of_week === dbDayOfWeek && l.start_time === timeSlot);
    
    if (lesson) {
      const lessonDate = getLessonDateForCurrentWeek(lesson.day_of_week);
      
      // Check if this lesson is cancelled or moved
      if (isLessonCancelled(lesson.student_id, lessonDate)) {
        return null;
      }
      
      const override = getLessonOverride(lesson.student_id, lessonDate);
      if (override && override.new_date) {
        // This lesson is moved, don't show it here
        return null;
      }
      
      return lesson;
    }
    
    return null;
  };
  
  const getTrialLessonForDayAndTime = (dayIndex: number, timeSlot: string) => {
    const dbDayOfWeek = dayIndex === 6 ? 0 : dayIndex + 1;
    const dateForDay = getDateForDayIndex(dayIndex);
    const dateStr = format(dateForDay, "yyyy-MM-dd");
    return trialLessons.find(l => l.day_of_week === dbDayOfWeek && l.start_time === timeSlot && l.lesson_date === dateStr);
  };
  const handleTrialLessonClick = (lesson: TrialLesson) => {
    setSelectedTrialLesson(lesson);
    setConfirmAction(lesson.is_completed ? "incomplete" : "complete");
  };
  const handleMarkComplete = async () => {
    if (!selectedTrialLesson || processing) return;
    setProcessing(true);
    try {
      const {
        error
      } = await supabase.from("trial_lessons").update({
        is_completed: true
      }).eq("id", selectedTrialLesson.id);
      if (error) throw error;

      // Update teacher balance
      await updateTeacherBalance(selectedTrialLesson);
      toast({
        title: "Başarılı",
        description: "Deneme dersi işlendi olarak işaretlendi"
      });
      await fetchSchedule();
    } catch (error: any) {
      toast({
        title: "Hata",
        description: "İşlem başarısız oldu",
        variant: "destructive"
      });
    } finally {
      setSelectedTrialLesson(null);
      setConfirmAction(null);
      setProcessing(false);
    }
  };
  const handleMarkIncomplete = async () => {
    if (!selectedTrialLesson || processing) return;
    setProcessing(true);
    try {
      const {
        error
      } = await supabase.from("trial_lessons").update({
        is_completed: false
      }).eq("id", selectedTrialLesson.id);
      if (error) throw error;

      // Subtract from teacher balance
      await subtractFromTeacherBalance(selectedTrialLesson);
      toast({
        title: "Başarılı",
        description: "Deneme dersi işlenmedi olarak işaretlendi"
      });
      await fetchSchedule();
    } catch (error: any) {
      toast({
        title: "Hata",
        description: "İşlem başarısız oldu",
        variant: "destructive"
      });
    } finally {
      setSelectedTrialLesson(null);
      setConfirmAction(null);
      setProcessing(false);
    }
  };
  const subtractFromTeacherBalance = async (lesson: TrialLesson) => {
    try {
      const startTime = new Date(`2000-01-01T${lesson.start_time}`);
      const endTime = new Date(`2000-01-01T${lesson.end_time}`);
      const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);

      // Get current balance
      const {
        data: existingBalance
      } = await supabase.from("teacher_balance").select("*").eq("teacher_id", teacherId).maybeSingle();
      if (existingBalance) {
        // Subtract from existing balance
        await supabase.from("teacher_balance").update({
          total_minutes: Math.max(0, existingBalance.total_minutes - durationMinutes),
          completed_trial_lessons: Math.max(0, existingBalance.completed_trial_lessons - 1),
          trial_lessons_minutes: Math.max(0, existingBalance.trial_lessons_minutes - durationMinutes)
        }).eq("teacher_id", teacherId);
      }
    } catch (error) {
      console.error("Error subtracting from teacher balance:", error);
    }
  };
  const updateTeacherBalance = async (lesson: TrialLesson) => {
    try {
      const startTime = new Date(`2000-01-01T${lesson.start_time}`);
      const endTime = new Date(`2000-01-01T${lesson.end_time}`);
      const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);

      // Check if teacher balance exists
      const {
        data: existingBalance
      } = await supabase.from("teacher_balance").select("*").eq("teacher_id", teacherId).maybeSingle();
      if (existingBalance) {
        // Update existing balance
        await supabase.from("teacher_balance").update({
          total_minutes: existingBalance.total_minutes + durationMinutes,
          completed_trial_lessons: existingBalance.completed_trial_lessons + 1,
          trial_lessons_minutes: existingBalance.trial_lessons_minutes + durationMinutes
        }).eq("teacher_id", teacherId);
      } else {
        // Create new balance
        await supabase.from("teacher_balance").insert({
          teacher_id: teacherId,
          total_minutes: durationMinutes,
          completed_regular_lessons: 0,
          completed_trial_lessons: 1,
          regular_lessons_minutes: 0,
          trial_lessons_minutes: durationMinutes
        });
      }
    } catch (error) {
      console.error("Error updating teacher balance:", error);
    }
  };
  const timeSlots = getAllTimeSlots();
  const handleExportPNG = async () => {
    try {
      await exportScheduleAsPNG({
        lessons: lessons.map(l => ({
          ...l,
          student_name: l.student_name
        })),
        trialLessons,
        studentColors
      });
      toast({
        title: "Başarılı",
        description: "Ders programı PNG olarak indirildi"
      });
    } catch (error) {
      toast({
        title: "Hata",
        description: "PNG oluşturulamadı",
        variant: "destructive"
      });
    }
  };
  return <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1rem)] sm:max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <DialogTitle className="text-base sm:text-lg">Haftalık Ders Programı</DialogTitle>
            {lessons.length > 0 && <Button onClick={handleExportPNG} size="sm" variant="outline" className="text-xs sm:text-sm mx-0 sm:mr-[15px]">
                <Download className="h-4 w-4 mr-1 sm:mr-2" />
                PNG İndir
              </Button>}
          </div>
        </DialogHeader>

        {loading ? <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div> : lessons.length === 0 ? <div className="text-center py-8 text-muted-foreground">
            Henüz planlanmış ders yok
          </div> : <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[900px]">
              <thead>
                <tr>
                  <th className="border bg-primary/10 p-2 text-sm font-semibold w-24">Saat</th>
                  {DAYS.map(day => <th key={day} className="border bg-primary/10 p-2 text-sm font-semibold">
                      {day}
                    </th>)}
                </tr>
              </thead>
              <tbody>
                {timeSlots.map(timeSlot => <tr key={timeSlot}>
                    <td className="border bg-muted/50 p-2 text-center text-sm font-mono">
                      {formatTime(timeSlot)}
                    </td>
                    {DAYS.map((day, dayIndex) => {
                const lesson = getLessonForDayAndTime(dayIndex, timeSlot);
                const trialLesson = getTrialLessonForDayAndTime(dayIndex, timeSlot);
                const isOverride = lesson && '_isOverride' in lesson && lesson._isOverride;
                return <td key={day} className="border p-2">
                          {lesson ? <div className={`p-2 rounded border-2 transition-opacity ${lesson.is_completed ? "opacity-40" : "opacity-100"} ${isOverride ? "ring-2 ring-yellow-400" : ""} ${studentColors[lesson.student_id] || "bg-gray-100 border-gray-300"}`}>
                              <div className="font-medium text-xs mb-1 flex items-center gap-1">
                                {isOverride && <Calendar className="h-3 w-3 text-yellow-600" />}
                                {lesson.note ? `${lesson.student_name} - ${lesson.note}` : lesson.student_name}
                              </div>
                              <div className="text-[10px] font-mono">
                                {formatTime(lesson.start_time)} - {formatTime(lesson.end_time)}
                              </div>
                            </div> : trialLesson ? <div onClick={() => !processing && handleTrialLessonClick(trialLesson)} className={`p-2 rounded border-2 transition-all ${processing ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:opacity-80"} ${trialLesson.is_completed ? "bg-red-100/30 border-red-200/50 opacity-30" : "bg-red-200 border-red-400"}`}>
                              <div className={`font-medium text-xs mb-1 ${trialLesson.is_completed ? "text-red-400" : "text-red-900"}`}>
                                Deneme Dersi
                              </div>
                              <div className={`text-[10px] font-mono ${trialLesson.is_completed ? "text-red-400" : "text-red-900"}`}>
                                {formatTime(trialLesson.start_time)} - {formatTime(trialLesson.end_time)}
                              </div>
                            </div> : null}
                        </td>;
              })}
                  </tr>)}
              </tbody>
            </table>
          </div>}
      </DialogContent>

      <AlertDialog open={confirmAction === "complete"} onOpenChange={open => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deneme Dersini İşle</AlertDialogTitle>
            <AlertDialogDescription>
              Bu deneme dersini işlendi olarak işaretlemek istediğinize emin misiniz?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction onClick={handleMarkComplete}>İşlendi Olarak İşaretle</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmAction === "incomplete"} onOpenChange={open => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>İşlediyi Geri Al</AlertDialogTitle>
            <AlertDialogDescription>
              Bu deneme dersinin işlendiğini geri almak istediğinize emin misiniz?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction onClick={handleMarkIncomplete}>İşlendiyi Geri Al</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>;
}