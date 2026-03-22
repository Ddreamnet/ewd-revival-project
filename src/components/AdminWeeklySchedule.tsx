import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Download, Trash2, CheckCircle, Undo2, Calendar, Ban, X, ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AddTrialLessonDialog } from "./AddTrialLessonDialog";
import { exportScheduleAsPNG } from "./ScheduleExportCanvas";
import { LessonOverrideDialog } from "./LessonOverrideDialog";
import { getLessonDateForCurrentWeek } from "@/hooks/useScheduleGrid";
import { format, startOfWeek, addDays } from "date-fns";
import { tr } from "date-fns/locale";
import { formatTime } from "@/lib/lessonTypes";
import { completeTrialLesson } from "@/lib/lessonService";
import { subtractFromTeacherBalance as subtractBalance } from "@/lib/teacherBalance";
import { getDateForDayIndex, dayIndexToDbDayOfWeek, getAllTimeSlots, getTrialLessonForDayAndTime, getAllTimeSlotsActual, fetchActualLessonsForWeek, getActualLessonForDayAndTime, getBackToBackGroupForLesson, isSecondaryInBackToBack, getWeekStartForOffset, clearWeekCache, prefetchWeek, ActualLesson } from "@/hooks/useScheduleGrid";

interface StudentLesson {
  id: string;
  student_id: string;
  student_name: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  note?: string;
  _originalStartTime?: string;
  _originalEndTime?: string;
  _hasOverride?: boolean;
}

interface TrialLesson {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_completed: boolean;
  lesson_date: string;
}

interface AdminWeeklyScheduleProps {
  teacherId: string;
}

const DAYS = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
const STUDENT_COLORS = [
  "bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-300 dark:bg-blue-950 dark:text-blue-200 dark:hover:bg-blue-900 dark:border-blue-800",
  "bg-green-100 text-green-800 hover:bg-green-200 border-green-300 dark:bg-green-950 dark:text-green-200 dark:hover:bg-green-900 dark:border-green-800",
  "bg-purple-100 text-purple-800 hover:bg-purple-200 border-purple-300 dark:bg-purple-950 dark:text-purple-200 dark:hover:bg-purple-900 dark:border-purple-800",
  "bg-orange-100 text-orange-800 hover:bg-orange-200 border-orange-300 dark:bg-orange-950 dark:text-orange-200 dark:hover:bg-orange-900 dark:border-orange-800",
  "bg-pink-100 text-pink-800 hover:bg-pink-200 border-pink-300 dark:bg-pink-950 dark:text-pink-200 dark:hover:bg-pink-900 dark:border-pink-800",
  "bg-cyan-100 text-cyan-800 hover:bg-cyan-200 border-cyan-300 dark:bg-cyan-950 dark:text-cyan-200 dark:hover:bg-cyan-900 dark:border-cyan-800",
];

export function AdminWeeklySchedule({ teacherId }: AdminWeeklyScheduleProps) {
  const [lessons, setLessons] = useState<StudentLesson[]>([]);
  const [trialLessons, setTrialLessons] = useState<TrialLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentColors, setStudentColors] = useState<Map<string, string>>(new Map());
  const [showAddTrial, setShowAddTrial] = useState(false);
  const [selectedTrialLesson, setSelectedTrialLesson] = useState<TrialLesson | null>(null);
  const [showTrialActionDialog, setShowTrialActionDialog] = useState(false);
  const [showMarkAlert, setShowMarkAlert] = useState(false);
  const [showUnmarkAlert, setShowUnmarkAlert] = useState(false);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  
  // Güncel (default OFF) vs Kalıcı (ON) toggle
  const [showTemplate, setShowTemplate] = useState(false);
  const [actualLessons, setActualLessons] = useState<ActualLesson[]>([]);
  
  // Week navigation
  const [weekOffset, setWeekOffset] = useState(0);
  const weekStart = getWeekStartForOffset(weekOffset);
  
  // Back-to-back popover
  const [backToBackPopover, setBackToBackPopover] = useState<{ group: ActualLesson[]; dayIndex: number } | null>(null);
  
  // Lesson override state
  const [selectedLesson, setSelectedLesson] = useState<StudentLesson | null>(null);
  const [selectedLessonDate, setSelectedLessonDate] = useState<Date | null>(null);
  const [selectedLessonCurrentDate, setSelectedLessonCurrentDate] = useState<Date | null>(null);
  const [selectedLessonCurrentStartTime, setSelectedLessonCurrentStartTime] = useState<string | null>(null);
  const [selectedLessonCurrentEndTime, setSelectedLessonCurrentEndTime] = useState<string | null>(null);
  const [showOverrideDialog, setShowOverrideDialog] = useState(false);
  
  // For actual-mode override
  const [selectedActualLesson, setSelectedActualLesson] = useState<ActualLesson | null>(null);
  
  const { toast } = useToast();

  useEffect(() => {
    fetchSchedule();
  }, [teacherId]);

  useEffect(() => {
    if (!showTemplate) {
      fetchActualSchedule();
      // Prefetch adjacent weeks
      prefetchWeek(teacherId, getWeekStartForOffset(weekOffset + 1));
      prefetchWeek(teacherId, getWeekStartForOffset(weekOffset - 1));
    }
  }, [showTemplate, teacherId, weekOffset]);

  // Real-time listener for trial lesson updates
  useEffect(() => {
    if (!teacherId) return;

    const channel = supabase
      .channel('admin-trial-lessons-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'trial_lessons',
          filter: `teacher_id=eq.${teacherId}`,
        },
        () => {
          clearWeekCache();
          fetchSchedule();
          if (!showTemplate) fetchActualSchedule();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teacherId, showTemplate]);

  const fetchActualSchedule = async () => {
    const lessons = await fetchActualLessonsForWeek(teacherId, weekStart);
    setActualLessons(lessons);
    // Assign colors for actual lessons
    const studentIds = [...new Set(lessons.map(l => l.student_id))];
    const colorMap = new Map<string, string>();
    studentIds.forEach((id, index) => {
      colorMap.set(id, STUDENT_COLORS[index % STUDENT_COLORS.length]);
    });
    // Merge with existing colors
    studentColors.forEach((color, id) => {
      if (!colorMap.has(id)) colorMap.set(id, color);
    });
    setStudentColors(colorMap);
  };

  const fetchSchedule = async () => {
    try {
      setLoading(true);

      // First, get non-archived students for this teacher
      const { data: activeStudents, error: studentsError } = await supabase
        .from("students")
        .select("student_id")
        .eq("teacher_id", teacherId)
        .eq("is_archived", false);
      
      if (studentsError) throw studentsError;
      
      const activeStudentIds = (activeStudents || []).map(s => s.student_id);

      // Fetch regular lessons only for active students
      const { data: lessonsData, error: lessonsError } = await supabase
        .from("student_lessons")
        .select("id, student_id, day_of_week, start_time, end_time, note")
        .eq("teacher_id", teacherId)
        .in("student_id", activeStudentIds.length > 0 ? activeStudentIds : ['no-students']);

      if (lessonsError) throw lessonsError;

      // Fetch student names
      const studentIds = [...new Set(lessonsData?.map((l) => l.student_id) || [])];
      const { data: studentsData, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", studentIds.length > 0 ? studentIds : ['no-students']);

      if (profilesError) throw profilesError;

      // Create student name map
      const nameMap = new Map(studentsData?.map((s) => [s.user_id, s.full_name]) || []);

      // Assign colors to students
      const colorMap = new Map<string, string>();
      studentIds.forEach((id, index) => {
        colorMap.set(id, STUDENT_COLORS[index % STUDENT_COLORS.length]);
      });
      setStudentColors(colorMap);

      // Format lessons with names
      const formattedLessons =
        lessonsData?.map((lesson) => ({
          ...lesson,
          student_name: nameMap.get(lesson.student_id) || "Bilinmeyen",
          note: lesson.note,
        })) || [];

      setLessons(formattedLessons);

      // Fetch trial lessons
      const { data: trialData, error: trialError } = await supabase
        .from("trial_lessons")
        .select("*")
        .eq("teacher_id", teacherId)
        .order("start_time", { ascending: true });

      if (trialError) throw trialError;

      setTrialLessons(trialData || []);
    } catch (error: any) {
      toast({
        title: "Hata",
        description: "Ders programı yüklenemedi",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const computedTimeSlots = showTemplate
    ? getAllTimeSlots(lessons, [], [])
    : getAllTimeSlotsActual(actualLessons, trialLessons);

  // Week navigation label
  const weekEnd = addDays(weekStart, 6);
  const weekLabel = `${format(weekStart, "dd.MM")} – ${format(weekEnd, "dd.MM.yyyy")}`;

  // Template mode: pure template positions (no override adjustments)
  const getLessonForDayAndTime = (dayIndex: number, timeSlot: string) => {
    const dbDayOfWeek = dayIndexToDbDayOfWeek(dayIndex);
    const lesson = lessons.find((l) => l.day_of_week === dbDayOfWeek && l.start_time === timeSlot);
    if (lesson) {
      const lessonDate = getLessonDateForCurrentWeek(lesson.day_of_week);
      return { ...lesson, _originalDate: lessonDate };
    }
    return null;
  };

  const findTrialLessonForDayAndTime = (dayIndex: number, timeSlot: string) => {
    return getTrialLessonForDayAndTime(trialLessons, dayIndex, timeSlot, weekStart);
  };

  const handleLessonClick = (lesson: StudentLesson & { _originalDate?: Date }) => {
    // Template mode click: no override info, just template data
    const originalDateForOverride = lesson._originalDate || getLessonDateForCurrentWeek(lesson.day_of_week);
    
    const lessonWithOriginalTimes = {
      ...lesson,
      _originalStartTime: lesson.start_time,
      _originalEndTime: lesson.end_time,
      _hasOverride: false,
    };
    
    setSelectedLesson(lessonWithOriginalTimes);
    setSelectedLessonDate(originalDateForOverride);
    setSelectedLessonCurrentDate(originalDateForOverride);
    setSelectedLessonCurrentStartTime(lesson.start_time);
    setSelectedLessonCurrentEndTime(lesson.end_time);
    setShowOverrideDialog(true);
  };

  const handleActualLessonClick = (lesson: ActualLesson) => {
    // Convert actual lesson to the format expected by override dialog
    const syntheticLesson: StudentLesson = {
      id: lesson.id,
      student_id: lesson.student_id,
      student_name: lesson.student_name,
      day_of_week: new Date(lesson.lesson_date).getDay(),
      start_time: lesson.original_start_time || lesson.start_time,
      end_time: lesson.original_end_time || lesson.end_time,
      _originalStartTime: lesson.original_start_time || lesson.start_time,
      _originalEndTime: lesson.original_end_time || lesson.end_time,
      _hasOverride: lesson.rescheduled_count > 0,
    };
    
    const originalDate = lesson.original_date
      ? new Date(lesson.original_date)
      : new Date(lesson.lesson_date);
    
    setSelectedLesson(syntheticLesson);
    setSelectedActualLesson(lesson);
    setSelectedLessonDate(originalDate);
    setSelectedLessonCurrentDate(new Date(lesson.lesson_date));
    setSelectedLessonCurrentStartTime(lesson.start_time);
    setSelectedLessonCurrentEndTime(lesson.end_time);
    setShowOverrideDialog(true);
  };

  const handleOverrideSuccess = () => {
    clearWeekCache();
    fetchSchedule();
    if (!showTemplate) fetchActualSchedule();
  };

  const handleTrialLessonClick = (trial: TrialLesson) => {
    setSelectedTrialLesson(trial);
    setShowTrialActionDialog(true);
  };

  const handleDeleteTrialLesson = async () => {
    if (!selectedTrialLesson) return;

    try {
      const { error } = await supabase
        .from("trial_lessons")
        .delete()
        .eq("id", selectedTrialLesson.id);

      if (error) throw error;

      toast({
        title: "Başarılı",
        description: "Deneme dersi silindi",
      });

      fetchSchedule();
    } catch (error: any) {
      toast({
        title: "Hata",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setShowDeleteAlert(false);
      setShowTrialActionDialog(false);
      setSelectedTrialLesson(null);
    }
  };

  const handleMarkComplete = async () => {
    if (!selectedTrialLesson) return;

    try {
      const result = await completeTrialLesson(selectedTrialLesson.id, teacherId);
      if (!result.success) {
        throw new Error(result.error || "İşlem başarısız");
      }

      toast({
        title: "Başarılı",
        description: "Ders işlendi olarak işaretlendi",
      });

      fetchSchedule();
    } catch (error: any) {
      toast({
        title: "Hata",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setShowMarkAlert(false);
      setSelectedTrialLesson(null);
    }
  };

  const handleMarkIncomplete = async () => {
    if (!selectedTrialLesson) return;

    try {
      const { error } = await supabase
        .from("trial_lessons")
        .update({ is_completed: false })
        .eq("id", selectedTrialLesson.id);

      if (error) throw error;

      await subtractBalance({
        teacherId,
        lessonType: "trial",
        startTime: selectedTrialLesson.start_time,
        endTime: selectedTrialLesson.end_time,
      });

      toast({
        title: "Başarılı",
        description: "Ders işlenmedi olarak geri alındı",
      });

      fetchSchedule();
    } catch (error: any) {
      toast({
        title: "Hata",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setShowUnmarkAlert(false);
      setSelectedTrialLesson(null);
    }
  };

  const timeSlots = computedTimeSlots;

  const handleExportPNG = async () => {
    try {
      const colorRecord: Record<string, string> = {};
      studentColors.forEach((color, studentId) => {
        colorRecord[studentId] = color;
      });

      await exportScheduleAsPNG({
        lessons: lessons.map(l => ({
          ...l,
          is_completed: false,
        })),
        trialLessons,
        studentColors: colorRecord,
      });
      toast({
        title: "Başarılı",
        description: "Ders programı PNG olarak indirildi",
      });
    } catch (error) {
      toast({
        title: "Hata",
        description: "PNG oluşturulamadı",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  if (lessons.length === 0 && trialLessons.length === 0 && actualLessons.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <CardTitle className="text-base sm:text-lg">Haftalık Ders Programı</CardTitle>
            <div className="flex gap-2 flex-wrap">
              <Button onClick={handleExportPNG} size="sm" variant="outline" className="text-xs sm:text-sm">
                <Download className="h-4 w-4 mr-1 sm:mr-2" />
                PNG İndir
              </Button>
              <Button onClick={() => setShowAddTrial(true)} size="sm" className="text-xs sm:text-sm">
                <Plus className="h-4 w-4 mr-1 sm:mr-2" />
                Deneme Ekle
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="text-center py-8 text-muted-foreground">
          Bu öğretmenin henüz ders programı yok.
        </CardContent>
        <AddTrialLessonDialog
          open={showAddTrial}
          onOpenChange={setShowAddTrial}
          teacherId={teacherId}
          onSuccess={fetchSchedule}
        />
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <CardTitle className="text-base sm:text-lg">Haftalık Ders Programı</CardTitle>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Label htmlFor="schedule-mode-admin" className="text-xs text-muted-foreground">Güncel</Label>
                <Switch
                  id="schedule-mode-admin"
                  checked={showTemplate}
                  onCheckedChange={setShowTemplate}
                />
                <Label htmlFor="schedule-mode-admin" className="text-xs text-muted-foreground">Kalıcı</Label>
              </div>
              <Button onClick={() => setShowAddTrial(true)} size="sm" className="text-xs sm:text-sm">
                <Plus className="h-4 w-4 mr-1 sm:mr-2" />
                Deneme Ekle
              </Button>
            </div>
          </div>
          {/* Week Navigation */}
          {!showTemplate && (
            <div className="flex items-center justify-center gap-2 mt-3">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setWeekOffset((o) => o - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {weekOffset !== 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7 px-2"
                  onClick={() => setWeekOffset(0)}
                >
                  Bu Hafta
                </Button>
              )}
              <span className="text-sm font-medium text-muted-foreground min-w-[140px] text-center">
                {weekLabel}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setWeekOffset((o) => o + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[800px]">
              <thead>
                <tr>
                  <th className="border border-border p-2 bg-muted font-medium text-sm">Saat</th>
                  {DAYS.map((day) => (
                    <th key={day} className="border border-border p-2 bg-muted font-medium text-sm">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {timeSlots.map((timeSlot) => (
                  <tr key={timeSlot}>
                    <td className="border border-border p-2 text-center font-medium text-sm bg-muted">
                      {formatTime(timeSlot)}
                    </td>
                    {DAYS.map((_, dayIndex) => {
                      if (!showTemplate) {
                        // GÜNCEL MODE: render from lesson_instances + trials
                        const actualLesson = getActualLessonForDayAndTime(actualLessons, dayIndex, timeSlot, weekStart);
                        const trialLesson = findTrialLessonForDayAndTime(dayIndex, timeSlot);
                        
                        // Skip if this lesson is secondary in a back-to-back group
                        if (actualLesson && isSecondaryInBackToBack(actualLessons, dayIndex, actualLesson.id, weekStart)) {
                          return <td key={dayIndex} className="border border-border p-2"></td>;
                        }
                        
                        // Check for back-to-back group
                        const b2bGroup = actualLesson
                          ? getBackToBackGroupForLesson(actualLessons, dayIndex, actualLesson.id, weekStart)
                          : null;
                        
                        return (
                          <td key={dayIndex} className="border border-border p-2">
                            {actualLesson && b2bGroup ? (
                              // Back-to-back grouped card
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    className={`w-full justify-center py-2 cursor-pointer relative ${
                                      actualLesson.status === "completed" ? "opacity-40" : ""
                                    } ${actualLesson.rescheduled_count > 0 ? "ring-2 ring-amber-400 ring-offset-1" : ""} ${
                                      studentColors.get(actualLesson.student_id) || "bg-gray-100 text-gray-800"
                                    }`}
                                  >
                                    <div className="text-center">
                                      <div className="font-medium flex items-center justify-center gap-1">
                                        {actualLesson.rescheduled_count > 0 && <Calendar className="h-3 w-3 text-amber-600" />}
                                        {actualLesson.student_name}
                                        <Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0">{b2bGroup.length} ders</Badge>
                                      </div>
                                      {b2bGroup.map((l, idx) => (
                                        <div key={l.id} className="text-xs mt-0.5 font-mono">
                                          {formatTime(l.start_time)} - {formatTime(l.end_time)}
                                        </div>
                                      ))}
                                    </div>
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-2">
                                  <div className="flex flex-col gap-1">
                                    {b2bGroup.map((l) => (
                                      <Button
                                        key={l.id}
                                        variant="ghost"
                                        size="sm"
                                        className="justify-start text-xs"
                                        onClick={() => handleActualLessonClick(l)}
                                      >
                                        {formatTime(l.start_time)} - {formatTime(l.end_time)}
                                      </Button>
                                    ))}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            ) : actualLesson ? (
                              // Single actual lesson (or ghost)
                              <Button
                                variant="outline"
                                className={`w-full justify-center py-2 relative ${
                                  actualLesson.isGhost ? "cursor-default" : "cursor-pointer"
                                } ${
                                  !actualLesson.isGhost && actualLesson.status === "completed" ? "opacity-40" : ""
                                } ${!actualLesson.isGhost && actualLesson.rescheduled_count > 0 ? "ring-2 ring-amber-400 ring-offset-1" : ""} ${
                                  studentColors.get(actualLesson.student_id) || "bg-gray-100 text-gray-800"
                                }`}
                                onClick={() => !actualLesson.isGhost && handleActualLessonClick(actualLesson)}
                              >
                                {actualLesson.isGhost && (
                                  <AlertCircle className="absolute top-1 right-1 h-3 w-3 text-amber-500" />
                                )}
                                <div className="text-center">
                                  <div className="font-medium flex items-center justify-center gap-1">
                                    {!actualLesson.isGhost && actualLesson.rescheduled_count > 0 && <Calendar className="h-3 w-3 text-amber-600" />}
                                    {actualLesson.student_name}
                                  </div>
                                  <div className="text-xs mt-1">
                                    {formatTime(actualLesson.start_time)} - {formatTime(actualLesson.end_time)}
                                  </div>
                                </div>
                              </Button>
                            ) : trialLesson ? (
                              <Button
                                variant="outline"
                                className={`w-full py-2 border-2 transition-all ${
                                  trialLesson.is_completed
                                    ? "bg-red-50/30 text-red-300 border-red-100 hover:bg-red-50/50 opacity-40"
                                    : "bg-red-100 text-red-800 border-red-300 hover:bg-red-200"
                                }`}
                                onClick={() => handleTrialLessonClick(trialLesson)}
                              >
                                <div className="text-center w-full">
                                  <div className="font-medium">Deneme Dersi</div>
                                  <div className="text-xs mt-1">
                                    {formatTime(trialLesson.start_time)} - {formatTime(trialLesson.end_time)}
                                  </div>
                                </div>
                              </Button>
                            ) : null}
                          </td>
                        );
                      } else {
                        // KALICI MODE: template only, no trials, no overrides
                        const lesson = lessons.find((l) => l.day_of_week === dayIndexToDbDayOfWeek(dayIndex) && l.start_time === timeSlot);

                        return (
                          <td key={dayIndex} className="border border-border p-2">
                            {lesson && (
                              <div
                                className={`w-full py-2 px-3 rounded border-2 ${
                                  studentColors.get(lesson.student_id) || "bg-gray-100 text-gray-800 border-gray-300"
                                }`}
                              >
                                <div className="text-center">
                                  <div className="font-medium text-xs">
                                    {lesson.note ? `${lesson.student_name} - ${lesson.note}` : lesson.student_name}
                                  </div>
                                  <div className="text-[10px] mt-1 font-mono">
                                    {formatTime(lesson.start_time)} - {formatTime(lesson.end_time)}
                                  </div>
                                </div>
                              </div>
                            )}
                          </td>
                        );
                      }
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <AddTrialLessonDialog
        open={showAddTrial}
        onOpenChange={setShowAddTrial}
        teacherId={teacherId}
        onSuccess={() => {
          clearWeekCache();
          fetchSchedule();
          if (!showTemplate) fetchActualSchedule();
        }}
      />

      {/* Trial Lesson Action Dialog */}
      <Dialog open={showTrialActionDialog} onOpenChange={setShowTrialActionDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Deneme Dersi İşlemleri</DialogTitle>
            <DialogDescription>
              {selectedTrialLesson && `${formatTime(selectedTrialLesson.start_time)} - ${formatTime(selectedTrialLesson.end_time)}`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-4">
            {selectedTrialLesson?.is_completed ? (
              <Button
                variant="outline"
                className="w-full justify-start gap-3"
                onClick={() => {
                  setShowTrialActionDialog(false);
                  setShowUnmarkAlert(true);
                }}
              >
                <Undo2 className="h-5 w-5 text-orange-500" />
                İşlendiyi Geri Al
              </Button>
            ) : (
              <Button
                variant="outline"
                className="w-full justify-start gap-3"
                onClick={() => {
                  setShowTrialActionDialog(false);
                  setShowMarkAlert(true);
                }}
              >
                <CheckCircle className="h-5 w-5 text-green-500" />
                İşlendi Olarak İşaretle
              </Button>
            )}
            <Button
              variant="outline"
              className="w-full justify-start gap-3 text-destructive hover:text-destructive"
              onClick={() => {
                setShowTrialActionDialog(false);
                setShowDeleteAlert(true);
              }}
            >
              <Trash2 className="h-5 w-5" />
              Deneme Dersini Sil
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showMarkAlert} onOpenChange={setShowMarkAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bu dersi işlediniz mi?</AlertDialogTitle>
            <AlertDialogDescription>
              Deneme dersini tamamlandı olarak işaretlemek istediğinizden emin misiniz?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction onClick={handleMarkComplete}>Onayla</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showUnmarkAlert} onOpenChange={setShowUnmarkAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>İşlenmedi olarak geri almak istiyor musunuz?</AlertDialogTitle>
            <AlertDialogDescription>
              Deneme dersini işlenmedi durumuna geri almak istediğinizden emin misiniz?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction onClick={handleMarkIncomplete}>Onayla</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deneme Dersini Sil</AlertDialogTitle>
            <AlertDialogDescription>
              Bu deneme dersini silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTrialLesson} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Lesson Override Dialog */}
      {selectedLesson && selectedLessonDate && (
        <LessonOverrideDialog
          open={showOverrideDialog}
          onOpenChange={setShowOverrideDialog}
          studentId={selectedLesson.student_id}
          teacherId={teacherId}
          studentName={selectedLesson.student_name}
          originalDate={selectedLessonDate}
          originalDayOfWeek={selectedLesson.day_of_week}
          originalStartTime={selectedLesson._originalStartTime || selectedLesson.start_time}
          originalEndTime={selectedLesson._originalEndTime || selectedLesson.end_time}
          currentDate={selectedLessonCurrentDate || undefined}
          currentStartTime={selectedLessonCurrentStartTime || undefined}
          currentEndTime={selectedLessonCurrentEndTime || undefined}
          hasExistingOverride={selectedLesson._hasOverride || false}
          instanceId={selectedActualLesson?.id}
          onSuccess={handleOverrideSuccess}
        />
      )}
    </>
  );
}
