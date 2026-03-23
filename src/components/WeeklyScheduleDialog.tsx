import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Download, Calendar, ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";
import { exportScheduleAsPNG } from "./ScheduleExportCanvas";
import { getLessonDateForCurrentWeek } from "@/hooks/useScheduleGrid";
import { format, startOfWeek, addDays } from "date-fns";
import { formatTime } from "@/lib/lessonTypes";
import { completeTrialLesson, undoTrialLesson } from "@/lib/lessonService";
import { getDateForDayIndex, dayIndexToDbDayOfWeek, getAllTimeSlots, getTrialLessonForDayAndTime as findTrialLesson, getAllTimeSlotsActual, fetchActualLessonsForWeek, getActualLessonsForDayAndTime, getBackToBackGroupForLesson, isSecondaryInBackToBack, getWeekStartForOffset, clearWeekCache, prefetchWeek, ActualLesson } from "@/hooks/useScheduleGrid";

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
const STUDENT_COLORS = ["bg-rose-100 border-rose-300 text-rose-900 dark:bg-rose-950 dark:border-rose-800 dark:text-rose-200", "bg-blue-100 border-blue-300 text-blue-900 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-200", "bg-amber-100 border-amber-300 text-amber-900 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200", "bg-emerald-100 border-emerald-300 text-emerald-900 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-200", "bg-purple-100 border-purple-300 text-purple-900 dark:bg-purple-950 dark:border-purple-800 dark:text-purple-200", "bg-pink-100 border-pink-300 text-pink-900 dark:bg-pink-950 dark:border-pink-800 dark:text-pink-200", "bg-cyan-100 border-cyan-300 text-cyan-900 dark:bg-cyan-950 dark:border-cyan-800 dark:text-cyan-200", "bg-orange-100 border-orange-300 text-orange-900 dark:bg-orange-950 dark:border-orange-800 dark:text-orange-200", "bg-lime-100 border-lime-300 text-lime-900 dark:bg-lime-950 dark:border-lime-800 dark:text-lime-200", "bg-indigo-100 border-indigo-300 text-indigo-900 dark:bg-indigo-950 dark:border-indigo-800 dark:text-indigo-200"];

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
    // Assign colors for actual lessons too
    const uniqueStudents = [...new Set(lessons.map(l => l.student_id))];
    const colors: Record<string, string> = { ...studentColors };
    uniqueStudents.forEach((studentId, index) => {
      if (!colors[studentId]) {
        colors[studentId] = STUDENT_COLORS[index % STUDENT_COLORS.length];
      }
    });
    setStudentColors(colors);
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
    ? getAllTimeSlots(lessons, [], [])  // Kalıcı: template only, no trials, no overrides
    : getAllTimeSlotsActual(actualLessons, trialLessons); // Güncel: actual + trials

  // Template mode: pure template positions (no override adjustments)
  const getLessonForDayAndTime = (dayIndex: number, timeSlot: string): StudentLesson | null => {
    const dbDayOfWeek = dayIndexToDbDayOfWeek(dayIndex);
    return lessons.find(l => l.day_of_week === dbDayOfWeek && l.start_time === timeSlot) || null;
  };
  
  const getTrialLessonForDayAndTime = (dayIndex: number, timeSlot: string) => {
    return findTrialLesson(trialLessons, dayIndex, timeSlot, weekStart);
  };

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
      const { error } = await supabase.from("trial_lessons").update({ is_completed: false }).eq("id", selectedTrialLesson.id);
      if (error) throw error;

      await subtractBalanceFn({
        teacherId,
        lessonType: "trial",
        startTime: selectedTrialLesson.start_time,
        endTime: selectedTrialLesson.end_time,
      });
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
                    {DAYS.map((day, dayIndex) => {
                      if (!showTemplate) {
                        // ACTUAL MODE
                        const slotLessons = getActualLessonsForDayAndTime(actualLessons, dayIndex, timeSlot, weekStart);
                        const trialLesson = getTrialLessonForDayAndTime(dayIndex, timeSlot);
                        
                        // Filter out secondary back-to-back
                        const visibleLessons = slotLessons.filter(
                          (l) => !isSecondaryInBackToBack(actualLessons, dayIndex, l.id, weekStart)
                        );
                        
                        if (visibleLessons.length === 0 && !trialLesson) {
                          return <td key={day} className="border p-2"></td>;
                        }

                        const isMulti = visibleLessons.length > 1 || (visibleLessons.length >= 1 && trialLesson);

                        return <td key={day} className="border p-1">
                          <div className="flex gap-0.5 h-full">
                            {visibleLessons.map(actualLesson => {
                              const b2bGroup = getBackToBackGroupForLesson(actualLessons, dayIndex, actualLesson.id, weekStart);
                              
                              if (b2bGroup) {
                                return <div key={actualLesson.id} className={`${isMulti ? 'flex-1 min-w-0' : 'w-full'} p-2 rounded border-2 transition-opacity ${
                                  actualLesson.status === "completed" ? "opacity-40" : "opacity-100"
                                } ${actualLesson.is_manual_override ? "ring-2 ring-yellow-400" : ""} ${
                                  studentColors[actualLesson.student_id] || "bg-gray-100 border-gray-300"
                                }`}>
                                  <div className={`font-medium ${isMulti ? 'text-[10px]' : 'text-xs'} mb-1 flex items-center gap-1`}>
                                    {actualLesson.is_manual_override && <Calendar className="h-3 w-3 text-yellow-600 shrink-0" />}
                                    <span className="truncate">{actualLesson.student_name}</span>
                                    <Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0">{b2bGroup.length} ders</Badge>
                                  </div>
                                  {!isMulti && b2bGroup.map(l => (
                                    <div key={l.id} className="text-[10px] font-mono">
                                      {formatTime(l.start_time)} - {formatTime(l.end_time)}
                                    </div>
                                  ))}
                                </div>;
                              }
                              
                              return <div key={actualLesson.id} className={`${isMulti ? 'flex-1 min-w-0' : 'w-full'} p-2 rounded border-2 transition-opacity relative ${
                                actualLesson.status === "completed" && !actualLesson.isGhost ? "opacity-40" : "opacity-100"
                              } ${!actualLesson.isGhost && actualLesson.is_manual_override ? "ring-2 ring-yellow-400" : ""} ${
                                studentColors[actualLesson.student_id] || "bg-gray-100 border-gray-300"
                              }`}>
                                {actualLesson.isGhost && (
                                  <AlertCircle className="absolute top-1 right-1 h-3 w-3 text-amber-500" />
                                )}
                                <div className={`font-medium ${isMulti ? 'text-[10px]' : 'text-xs'} mb-1 flex items-center gap-1`}>
                                  {!actualLesson.isGhost && actualLesson.is_manual_override && <Calendar className="h-3 w-3 text-yellow-600 shrink-0" />}
                                  <span className="truncate">{actualLesson.student_name}</span>
                                </div>
                                <div className={`${isMulti ? 'text-[9px]' : 'text-[10px]'} font-mono`}>
                                  {formatTime(actualLesson.start_time)} - {formatTime(actualLesson.end_time)}
                                </div>
                              </div>;
                            })}
                            {trialLesson && visibleLessons.length === 0 ? (
                              <div onClick={() => !processing && handleTrialLessonClick(trialLesson)} className={`w-full p-2 rounded border-2 transition-all ${processing ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:opacity-80"} ${trialLesson.is_completed ? "bg-red-100/30 border-red-200/50 opacity-30" : "bg-red-200 border-red-400"}`}>
                                <div className={`font-medium text-xs mb-1 ${trialLesson.is_completed ? "text-red-400" : "text-red-900"}`}>
                                  Deneme Dersi
                                </div>
                                <div className={`text-[10px] font-mono ${trialLesson.is_completed ? "text-red-400" : "text-red-900"}`}>
                                  {formatTime(trialLesson.start_time)} - {formatTime(trialLesson.end_time)}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </td>;
                      } else {
                        // KALICI MODE: template only, no trials, no overrides, display-only
                        const dbDayOfWeek = dayIndexToDbDayOfWeek(dayIndex);
                        const lesson = lessons.find(l => l.day_of_week === dbDayOfWeek && l.start_time === timeSlot);
                        return <td key={day} className="border p-2">
                          {lesson ? <div className={`p-2 rounded border-2 ${studentColors[lesson.student_id] || "bg-gray-100 border-gray-300"}`}>
                              <div className="font-medium text-xs mb-1">
                                {lesson.note ? `${lesson.student_name} - ${lesson.note}` : lesson.student_name}
                              </div>
                              <div className="text-[10px] font-mono">
                                {formatTime(lesson.start_time)} - {formatTime(lesson.end_time)}
                              </div>
                            </div> : null}
                        </td>;
                      }
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
