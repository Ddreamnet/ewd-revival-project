import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Download, ChevronLeft, ChevronRight } from "lucide-react";
import { exportScheduleAsPNG } from "./ScheduleExportCanvas";
import { ScheduleGridCell } from "./ScheduleGridCell";
import { format, addDays } from "date-fns";
import { formatTime } from "@/lib/lessonTypes";
import { completeTrialLesson, undoTrialLesson } from "@/lib/lessonService";
import { getAllTimeSlots, getAllTimeSlotsActual, fetchActualLessonsForWeek, getWeekStartForOffset, clearWeekCache, prefetchWeek, ActualLesson } from "@/hooks/useScheduleGrid";

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
// Mirror AdminWeeklySchedule's palette so admin and teacher views render identically.
const STUDENT_COLORS = [
  "bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-300 dark:bg-blue-950 dark:text-blue-200 dark:hover:bg-blue-900 dark:border-blue-800",
  "bg-green-100 text-green-800 hover:bg-green-200 border-green-300 dark:bg-green-950 dark:text-green-200 dark:hover:bg-green-900 dark:border-green-800",
  "bg-purple-100 text-purple-800 hover:bg-purple-200 border-purple-300 dark:bg-purple-950 dark:text-purple-200 dark:hover:bg-purple-900 dark:border-purple-800",
  "bg-orange-100 text-orange-800 hover:bg-orange-200 border-orange-300 dark:bg-orange-950 dark:text-orange-200 dark:hover:bg-orange-900 dark:border-orange-800",
  "bg-pink-100 text-pink-800 hover:bg-pink-200 border-pink-300 dark:bg-pink-950 dark:text-pink-200 dark:hover:bg-pink-900 dark:border-pink-800",
  "bg-cyan-100 text-cyan-800 hover:bg-cyan-200 border-cyan-300 dark:bg-cyan-950 dark:text-cyan-200 dark:hover:bg-cyan-900 dark:border-cyan-800",
];

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
  
  // Güncel (default OFF) vs Kalıcı (ON) toggle
  const [showTemplate, setShowTemplate] = useState(false);
  const [actualLessons, setActualLessons] = useState<ActualLesson[]>([]);
  
  // Week navigation
  const [weekOffset, setWeekOffset] = useState(0);
  const weekStart = getWeekStartForOffset(weekOffset);
  const weekEnd = addDays(weekStart, 6);
  const weekLabel = `${format(weekStart, "dd.MM")} – ${format(weekEnd, "dd.MM.yyyy")}`;

  const { toast } = useToast();
  const DAYS = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];

  useEffect(() => {
    if (open && teacherId) {
      fetchSchedule();
    }
  }, [open, teacherId]);

  useEffect(() => {
    if (open && !showTemplate && teacherId) {
      fetchActualSchedule();
      // Prefetch adjacent weeks
      prefetchWeek(teacherId, getWeekStartForOffset(weekOffset + 1));
      prefetchWeek(teacherId, getWeekStartForOffset(weekOffset - 1));
    }
  }, [open, showTemplate, teacherId, weekOffset]);

  // Real-time listener for trial lesson updates
  useEffect(() => {
    if (!open || !teacherId) return;
    const channel = supabase.channel('trial-lessons-changes').on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'trial_lessons',
      filter: `teacher_id=eq.${teacherId}`
    }, () => {
      clearWeekCache();
      fetchSchedule();
      if (!showTemplate) fetchActualSchedule();
    }).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, teacherId, showTemplate]);

  const fetchActualSchedule = async () => {
    const lessons = await fetchActualLessonsForWeek(teacherId, weekStart);
    setActualLessons(lessons);
    // Only append colors for students not already in the stable map
    const newStudents = [...new Set(lessons.map(l => l.student_id))].filter(id => !studentColors[id]);
    if (newStudents.length > 0) {
      const colors: Record<string, string> = { ...studentColors };
      const existingCount = Object.keys(colors).length;
      newStudents.forEach((studentId, i) => {
        colors[studentId] = STUDENT_COLORS[(existingCount + i) % STUDENT_COLORS.length];
      });
      setStudentColors(colors);
    }
  };

  const fetchSchedule = async () => {
    setLoading(true);
    try {
      const { data: activeStudents, error: studentsError } = await supabase.from("students").select("student_id").eq("teacher_id", teacherId).eq("is_archived", false);
      if (studentsError) throw studentsError;
      
      const activeStudentIds = (activeStudents || []).map(s => s.student_id);
      
      const { data: lessonsData, error: lessonsError } = await supabase.from("student_lessons").select("id, student_id, day_of_week, start_time, end_time, is_completed, note").eq("teacher_id", teacherId).in("student_id", activeStudentIds.length > 0 ? activeStudentIds : ['no-students']).order("start_time", { ascending: true });
      if (lessonsError) throw lessonsError;

      const { data: trialLessonsData, error: trialLessonsError } = await supabase.from("trial_lessons").select("id, day_of_week, start_time, end_time, is_completed, lesson_date").eq("teacher_id", teacherId).order("start_time", { ascending: true });
      if (trialLessonsError) throw trialLessonsError;
      setTrialLessons(trialLessonsData || []);

      const studentIds = Array.from(new Set((lessonsData || []).map(l => l.student_id)));
      const { data: profilesData, error: profilesError } = await supabase.from("profiles").select("user_id, full_name").in("user_id", studentIds.length > 0 ? studentIds : ['no-students']);
      if (profilesError) throw profilesError;

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

      const uniqueStudents = Array.from(new Set(formattedLessons.map(l => l.student_id)));
      const colors: Record<string, string> = {};
      uniqueStudents.forEach((studentId, index) => {
        colors[studentId] = STUDENT_COLORS[index % STUDENT_COLORS.length];
      });
      setStudentColors(colors);
    } catch (error: any) {
      toast({ title: "Hata", description: "Ders programı yüklenemedi", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const computedTimeSlots = showTemplate
    ? getAllTimeSlots(lessons, [])  // Kalıcı: template only, no trials, no overrides
    : getAllTimeSlotsActual(actualLessons, trialLessons); // Güncel: actual + trials

  // Convert Record → Map once per render so ScheduleGridCell receives the
  // shape it expects without us refactoring all the call sites that read
  // studentColors[id].
  const studentColorsMap = new Map(Object.entries(studentColors));

  const handleTrialLessonClick = (lesson: TrialLesson) => {
    setSelectedTrialLesson(lesson);
    setConfirmAction(lesson.is_completed ? "incomplete" : "complete");
  };
  const handleMarkComplete = async () => {
    if (!selectedTrialLesson || processing) return;
    setProcessing(true);
    try {
      const result = await completeTrialLesson(selectedTrialLesson.id, teacherId);
      if (!result.success) {
        throw new Error(result.error || "İşlem başarısız");
      }
      toast({ title: "Başarılı", description: "Deneme dersi işlendi olarak işaretlendi" });
      await fetchSchedule();
    } catch (error: any) {
      toast({ title: "Hata", description: "İşlem başarısız oldu", variant: "destructive" });
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
      const result = await undoTrialLesson(selectedTrialLesson.id, teacherId);
      if (!result.success) {
        throw new Error(result.error || "İşlem başarısız");
      }
      toast({ title: "Başarılı", description: "Deneme dersi işlenmedi olarak işaretlendi" });
      await fetchSchedule();
    } catch (error: any) {
      toast({ title: "Hata", description: "İşlem başarısız oldu", variant: "destructive" });
    } finally {
      setSelectedTrialLesson(null);
      setConfirmAction(null);
      setProcessing(false);
    }
  };

  const timeSlots = computedTimeSlots;
  const handleExportPNG = async () => {
    try {
      await exportScheduleAsPNG({
        lessons: lessons.map(l => ({ ...l, student_name: l.student_name })),
        trialLessons,
        studentColors
      });
      toast({ title: "Başarılı", description: "Ders programı PNG olarak indirildi" });
    } catch (error) {
      toast({ title: "Hata", description: "PNG oluşturulamadı", variant: "destructive" });
    }
  };

  return <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1rem)] sm:max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <DialogTitle className="text-base sm:text-lg">Haftalık Ders Programı</DialogTitle>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Label htmlFor="schedule-mode-teacher" className="text-xs text-muted-foreground">Güncel</Label>
                <Switch
                  id="schedule-mode-teacher"
                  checked={showTemplate}
                  onCheckedChange={setShowTemplate}
                />
                <Label htmlFor="schedule-mode-teacher" className="text-xs text-muted-foreground">Kalıcı</Label>
              </div>
              {lessons.length > 0 && <Button onClick={handleExportPNG} size="sm" variant="outline" className="text-xs sm:text-sm mx-0 sm:mr-[15px]">
                  <Download className="h-4 w-4 mr-1 sm:mr-2" />
                  PNG İndir
                </Button>}
            </div>
          </div>
          {/* Week Navigation */}
          {!showTemplate && (
            <div className="flex items-center justify-center gap-2 mt-2">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setWeekOffset((o) => o - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {weekOffset !== 0 && (
                <Button variant="outline" size="sm" className="text-xs h-7 px-2" onClick={() => setWeekOffset(0)}>
                  Bu Hafta
                </Button>
              )}
              <span className="text-sm font-medium text-muted-foreground min-w-[140px] text-center">{weekLabel}</span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setWeekOffset((o) => o + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </DialogHeader>

        {loading ? <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div> : lessons.length === 0 && actualLessons.length === 0 ? <div className="text-center py-8 text-muted-foreground">
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
                    {DAYS.map((_, dayIndex) => (
                      <ScheduleGridCell
                        key={dayIndex}
                        showTemplate={showTemplate}
                        dayIndex={dayIndex}
                        timeSlot={timeSlot}
                        lessons={lessons}
                        actualLessons={actualLessons}
                        trialLessons={trialLessons}
                        weekStart={weekStart}
                        studentColors={studentColorsMap}
                        onActualLessonClick={() => { /* teacher view: real lessons are read-only */ }}
                        onTrialLessonClick={handleTrialLessonClick}
                      />
                    ))}
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
