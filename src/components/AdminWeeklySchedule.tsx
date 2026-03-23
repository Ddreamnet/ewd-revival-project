import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Plus, Download, Trash2, CheckCircle, Undo2, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AddTrialLessonDialog } from "./AddTrialLessonDialog";
import { exportScheduleAsPNG } from "./ScheduleExportCanvas";
import { LessonOverrideDialog } from "./LessonOverrideDialog";
import { ScheduleGridCell } from "./ScheduleGridCell";
import { getLessonDateForCurrentWeek } from "@/hooks/useScheduleGrid";
import { format, addDays } from "date-fns";
import { formatTime } from "@/lib/lessonTypes";
import { completeTrialLesson, undoTrialLesson } from "@/lib/lessonService";
import { getAllTimeSlots, getAllTimeSlotsActual, fetchActualLessonsForWeek, getWeekStartForOffset, clearWeekCache, prefetchWeek, ActualLesson } from "@/hooks/useScheduleGrid";

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
  const [showTemplate, setShowTemplate] = useState(false);
  const [actualLessons, setActualLessons] = useState<ActualLesson[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const weekStart = getWeekStartForOffset(weekOffset);

  // Lesson override state
  const [selectedLesson, setSelectedLesson] = useState<StudentLesson | null>(null);
  const [selectedLessonDate, setSelectedLessonDate] = useState<Date | null>(null);
  const [selectedLessonCurrentDate, setSelectedLessonCurrentDate] = useState<Date | null>(null);
  const [selectedLessonCurrentStartTime, setSelectedLessonCurrentStartTime] = useState<string | null>(null);
  const [selectedLessonCurrentEndTime, setSelectedLessonCurrentEndTime] = useState<string | null>(null);
  const [showOverrideDialog, setShowOverrideDialog] = useState(false);
  const [selectedActualLesson, setSelectedActualLesson] = useState<ActualLesson | null>(null);

  const { toast } = useToast();

  useEffect(() => {
    if (!showTemplate) {
      Promise.all([fetchSchedule(), fetchActualSchedule()]).then(() => {
        prefetchWeek(teacherId, getWeekStartForOffset(weekOffset + 1));
        prefetchWeek(teacherId, getWeekStartForOffset(weekOffset - 1));
      });
    } else {
      fetchSchedule();
    }
  }, [teacherId]);

  useEffect(() => {
    if (!showTemplate) {
      fetchActualSchedule();
      prefetchWeek(teacherId, getWeekStartForOffset(weekOffset + 1));
      prefetchWeek(teacherId, getWeekStartForOffset(weekOffset - 1));
    }
  }, [showTemplate, weekOffset]);

  useEffect(() => {
    if (!teacherId) return;
    const channel = supabase
      .channel('admin-trial-lessons-changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'trial_lessons', filter: `teacher_id=eq.${teacherId}` }, () => {
        clearWeekCache();
        fetchSchedule();
        if (!showTemplate) fetchActualSchedule();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [teacherId, showTemplate]);

  const fetchActualSchedule = async () => {
    const fetched = await fetchActualLessonsForWeek(teacherId, weekStart);
    setActualLessons(fetched);
    const studentIds = [...new Set(fetched.map(l => l.student_id))];
    const colorMap = new Map<string, string>();
    studentIds.forEach((id, index) => { colorMap.set(id, STUDENT_COLORS[index % STUDENT_COLORS.length]); });
    studentColors.forEach((color, id) => { if (!colorMap.has(id)) colorMap.set(id, color); });
    setStudentColors(colorMap);
  };

  const fetchSchedule = async () => {
    try {
      setLoading(true);
      const { data: activeStudents, error: studentsError } = await supabase
        .from("students").select("student_id").eq("teacher_id", teacherId).eq("is_archived", false);
      if (studentsError) throw studentsError;
      const activeStudentIds = (activeStudents || []).map(s => s.student_id);

      const { data: lessonsData, error: lessonsError } = await supabase
        .from("student_lessons")
        .select("id, student_id, day_of_week, start_time, end_time, note")
        .eq("teacher_id", teacherId)
        .in("student_id", activeStudentIds.length > 0 ? activeStudentIds : ['no-students']);
      if (lessonsError) throw lessonsError;

      const studentIds = [...new Set(lessonsData?.map((l) => l.student_id) || [])];
      const { data: studentsData, error: profilesError } = await supabase
        .from("profiles").select("user_id, full_name")
        .in("user_id", studentIds.length > 0 ? studentIds : ['no-students']);
      if (profilesError) throw profilesError;

      const nameMap = new Map(studentsData?.map((s) => [s.user_id, s.full_name]) || []);
      const colorMap = new Map<string, string>();
      studentIds.forEach((id, index) => { colorMap.set(id, STUDENT_COLORS[index % STUDENT_COLORS.length]); });
      setStudentColors(colorMap);

      setLessons(lessonsData?.map((lesson) => ({ ...lesson, student_name: nameMap.get(lesson.student_id) || "Bilinmeyen", note: lesson.note })) || []);

      const { data: trialData, error: trialError } = await supabase
        .from("trial_lessons").select("*").eq("teacher_id", teacherId).order("start_time", { ascending: true });
      if (trialError) throw trialError;
      setTrialLessons(trialData || []);
    } catch {
      toast({ title: "Hata", description: "Ders programı yüklenemedi", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const timeSlots = showTemplate
    ? getAllTimeSlots(lessons, [])
    : getAllTimeSlotsActual(actualLessons, trialLessons);

  const weekEnd = addDays(weekStart, 6);
  const weekLabel = `${format(weekStart, "dd.MM")} – ${format(weekEnd, "dd.MM.yyyy")}`;

  const handleActualLessonClick = (lesson: ActualLesson) => {
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
    const originalDate = lesson.original_date ? new Date(lesson.original_date) : new Date(lesson.lesson_date);
    setSelectedLesson(syntheticLesson);
    setSelectedActualLesson(lesson);
    setSelectedLessonDate(originalDate);
    setSelectedLessonCurrentDate(new Date(lesson.lesson_date));
    setSelectedLessonCurrentStartTime(lesson.start_time);
    setSelectedLessonCurrentEndTime(lesson.end_time);
    setShowOverrideDialog(true);
  };

  const handleTrialLessonClick = (trial: TrialLesson) => {
    setSelectedTrialLesson(trial);
    setShowTrialActionDialog(true);
  };

  const handleOverrideSuccess = () => {
    clearWeekCache();
    fetchSchedule();
    if (!showTemplate) fetchActualSchedule();
  };

  const handleDeleteTrialLesson = async () => {
    if (!selectedTrialLesson) return;
    try {
      const { error } = await supabase.from("trial_lessons").delete().eq("id", selectedTrialLesson.id);
      if (error) throw error;
      toast({ title: "Başarılı", description: "Deneme dersi silindi" });
      fetchSchedule();
    } catch (error: any) {
      toast({ title: "Hata", description: error.message, variant: "destructive" });
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
      if (!result.success) throw new Error(result.error || "İşlem başarısız");
      toast({ title: "Başarılı", description: "Ders işlendi olarak işaretlendi" });
      fetchSchedule();
    } catch (error: any) {
      toast({ title: "Hata", description: error.message, variant: "destructive" });
    } finally {
      setShowMarkAlert(false);
      setSelectedTrialLesson(null);
    }
  };

  const handleMarkIncomplete = async () => {
    if (!selectedTrialLesson) return;
    try {
      const result = await undoTrialLesson(selectedTrialLesson.id, teacherId);
      if (!result.success) throw new Error(result.error || "İşlem başarısız");
      toast({ title: "Başarılı", description: "Ders işlenmedi olarak geri alındı" });
      fetchSchedule();
    } catch (error: any) {
      toast({ title: "Hata", description: error.message, variant: "destructive" });
    } finally {
      setShowUnmarkAlert(false);
      setSelectedTrialLesson(null);
    }
  };

  const handleExportPNG = async () => {
    try {
      const colorRecord: Record<string, string> = {};
      studentColors.forEach((color, studentId) => { colorRecord[studentId] = color; });
      await exportScheduleAsPNG({ lessons: lessons.map(l => ({ ...l, is_completed: false })), trialLessons, studentColors: colorRecord });
      toast({ title: "Başarılı", description: "Ders programı PNG olarak indirildi" });
    } catch {
      toast({ title: "Hata", description: "PNG oluşturulamadı", variant: "destructive" });
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
                <Download className="h-4 w-4 mr-1 sm:mr-2" />PNG İndir
              </Button>
              <Button onClick={() => setShowAddTrial(true)} size="sm" className="text-xs sm:text-sm">
                <Plus className="h-4 w-4 mr-1 sm:mr-2" />Deneme Ekle
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="text-center py-8 text-muted-foreground">Bu öğretmenin henüz ders programı yok.</CardContent>
        <AddTrialLessonDialog open={showAddTrial} onOpenChange={setShowAddTrial} teacherId={teacherId} onSuccess={fetchSchedule} />
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
                <Switch id="schedule-mode-admin" checked={showTemplate} onCheckedChange={setShowTemplate} />
                <Label htmlFor="schedule-mode-admin" className="text-xs text-muted-foreground">Kalıcı</Label>
              </div>
              <Button onClick={() => setShowAddTrial(true)} size="sm" className="text-xs sm:text-sm">
                <Plus className="h-4 w-4 mr-1 sm:mr-2" />Deneme Ekle
              </Button>
            </div>
          </div>
          {!showTemplate && (
            <div className="flex items-center justify-center gap-2 mt-3">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setWeekOffset((o) => o - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {weekOffset !== 0 && (
                <Button variant="outline" size="sm" className="text-xs h-7 px-2" onClick={() => setWeekOffset(0)}>Bu Hafta</Button>
              )}
              <span className="text-sm font-medium text-muted-foreground min-w-[140px] text-center">{weekLabel}</span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setWeekOffset((o) => o + 1)}>
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
                    <th key={day} className="border border-border p-2 bg-muted font-medium text-sm">{day}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {timeSlots.map((timeSlot) => (
                  <tr key={timeSlot}>
                    <td className="border border-border p-2 text-center font-medium text-sm bg-muted">
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
                        studentColors={studentColors}
                        onActualLessonClick={handleActualLessonClick}
                        onTrialLessonClick={handleTrialLessonClick}
                      />
                    ))}
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
        onSuccess={() => { clearWeekCache(); fetchSchedule(); if (!showTemplate) fetchActualSchedule(); }}
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
              <Button variant="outline" className="w-full justify-start gap-3" onClick={() => { setShowTrialActionDialog(false); setShowUnmarkAlert(true); }}>
                <Undo2 className="h-5 w-5 text-orange-500" />İşlendiyi Geri Al
              </Button>
            ) : (
              <Button variant="outline" className="w-full justify-start gap-3" onClick={() => { setShowTrialActionDialog(false); setShowMarkAlert(true); }}>
                <CheckCircle className="h-5 w-5 text-green-500" />İşlendi Olarak İşaretle
              </Button>
            )}
            <Button variant="outline" className="w-full justify-start gap-3 text-destructive hover:text-destructive" onClick={() => { setShowTrialActionDialog(false); setShowDeleteAlert(true); }}>
              <Trash2 className="h-5 w-5" />Deneme Dersini Sil
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showMarkAlert} onOpenChange={setShowMarkAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bu dersi işlediniz mi?</AlertDialogTitle>
            <AlertDialogDescription>Deneme dersini tamamlandı olarak işaretlemek istediğinizden emin misiniz?</AlertDialogDescription>
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
            <AlertDialogDescription>Deneme dersini işlenmedi durumuna geri almak istediğinizden emin misiniz?</AlertDialogDescription>
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
            <AlertDialogDescription>Bu deneme dersini silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTrialLesson} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Sil</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
