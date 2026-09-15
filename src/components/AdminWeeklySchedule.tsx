import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Plus, Download, Trash2, CheckCircle, Undo2, ChevronLeft, ChevronRight, CalendarX, Move, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { hataGoster } from "@/lib/notify";
import { AddTrialLessonDialog } from "./AddTrialLessonDialog";
import { exportScheduleAsPNG } from "./ScheduleExportCanvas";
import { LessonOverrideDialog } from "./LessonOverrideDialog";
import { ScheduleGridCell } from "./ScheduleGridCell";
import { EditStudentDialog } from "./EditStudentDialog";
import type { StudentLessonBase } from "@/lib/types";

import { format, addDays } from "date-fns";
import { formatTime, toDbTime, toDateStr } from "@/lib/lessonTypes";
import { completeTrialLesson, undoTrialLesson, gunuErtele, moveLesson, describeRescheduleWarnings } from "@/lib/lessonService";
import { getAllTimeSlots, getAllTimeSlotsActual, fetchActualLessonsForWeek, getWeekStartForOffset, clearWeekCache, prefetchWeek, ActualLesson } from "@/hooks/useScheduleGrid";

interface StudentLesson {
  id: string;
  student_id: string;
  student_name: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
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

interface AdminWeeklyScheduleProps {
  teacherId: string;
  refreshKey?: number;
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

export function AdminWeeklySchedule({ teacherId, refreshKey }: AdminWeeklyScheduleProps) {
  const [lessons, setLessons] = useState<StudentLesson[]>([]);
  const [trialLessons, setTrialLessons] = useState<TrialLesson[]>([]);
  const [loading, setLoading] = useState(true);
  /**
   * Onay diyaloglarındaki işlem sürerken ikinci tık girmesin.
   *
   * Radix `AlertDialogAction` tıklanınca diyaloğu kapatıyor, ama kapanma
   * animasyonu bitene kadar düğme DOM'da ve tıklanabilir kalıyor. Deneme dersi
   * tamamlama/geri alma bakiyeye yazdığı için o aralık mükerrer kayda açıktı.
   */
  const [busy, setBusy] = useState(false);
  const [studentColors, setStudentColors] = useState<Map<string, string>>(new Map());
  const [showAddTrial, setShowAddTrial] = useState(false);
  const [selectedTrialLesson, setSelectedTrialLesson] = useState<TrialLesson | null>(null);
  const [showTrialActionDialog, setShowTrialActionDialog] = useState(false);
  const [showMarkAlert, setShowMarkAlert] = useState(false);
  const [showUnmarkAlert, setShowUnmarkAlert] = useState(false);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);
  /** "Bu günü ertele" onayı bekleyen gün — öğretmen hasta olduğunda tek tık. */
  const [ertelenecekGun, setErtelenecekGun] = useState<Date | null>(null);
  const [gunErteleniyor, setGunErteleniyor] = useState(false);
  /** Taşınmak üzere seçilmiş ders: sürüklenen ya da "Taşı" ile işaretlenen. */
  const [tasinan, setTasinan] = useState<ActualLesson | null>(null);
  /** Takvimden açılan öğrenci ayarları — paket listesinin ikinci kapısı. */
  const [paketOgrencisi, setPaketOgrencisi] = useState<
    { recordId: string; userId: string; name: string } | null
  >(null);
  const [ogrenciKayitlari, setOgrenciKayitlari] = useState<Map<string, string>>(new Map());
  const [actualLessons, setActualLessons] = useState<ActualLesson[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const weekStart = getWeekStartForOffset(weekOffset);

  // Reschedule dialog state — the clicked instance is all the dialog needs.
  const [showOverrideDialog, setShowOverrideDialog] = useState(false);
  const [selectedActualLesson, setSelectedActualLesson] = useState<ActualLesson | null>(null);

  const { toast } = useToast();

  // Template data (student_lessons + trials) — reloaded per teacher.
  useEffect(() => {
    fetchSchedule();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId, refreshKey]);

  // Actual data (lesson_instances) — reloaded per teacher, week and mode.
  // These two effects both fired on mount before, so selecting a teacher ran
  // fetchActualSchedule twice and double-fetched the week.
  useEffect(() => {
    if (showTemplate) return;
    fetchActualSchedule();
    prefetchWeek(teacherId, getWeekStartForOffset(weekOffset + 1));
    prefetchWeek(teacherId, getWeekStartForOffset(weekOffset - 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId, refreshKey, showTemplate, weekOffset]);

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
    // Only append colors for students not already in the stable map
    const newStudentIds = [...new Set(fetched.map(l => l.student_id))].filter(id => !studentColors.has(id));
    if (newStudentIds.length > 0) {
      const colorMap = new Map(studentColors);
      newStudentIds.forEach((id) => { colorMap.set(id, STUDENT_COLORS[colorMap.size % STUDENT_COLORS.length]); });
      setStudentColors(colorMap);
    }
  };

  const fetchSchedule = async () => {
    try {
      setLoading(true);

      // Step 1: students + trial_lessons in parallel (independent)
      const [studentsRes, trialRes] = await Promise.all([
        supabase.from("students").select("id, student_id").eq("teacher_id", teacherId).eq("is_archived", false),
        supabase.from("trial_lessons").select("*").eq("teacher_id", teacherId).order("start_time", { ascending: true }),
      ]);
      if (studentsRes.error) throw studentsRes.error;
      if (trialRes.error) throw trialRes.error;

      const activeStudentIds = (studentsRes.data || []).map(s => s.student_id);
      setOgrenciKayitlari(new Map((studentsRes.data || []).map(s => [s.student_id, s.id])));
      setTrialLessons(trialRes.data || []);

      // Step 2: lessons + profiles in parallel (depend on activeStudentIds)
      const [lessonsRes, profilesRes] = await Promise.all([
        supabase.from("student_lessons")
          .select("id, student_id, day_of_week, start_time, end_time, note")
          .eq("teacher_id", teacherId)
          .in("student_id", activeStudentIds.length > 0 ? activeStudentIds : ['no-students']),
        supabase.from("profiles").select("user_id, full_name")
          .in("user_id", activeStudentIds.length > 0 ? activeStudentIds : ['no-students']),
      ]);
      if (lessonsRes.error) throw lessonsRes.error;
      if (profilesRes.error) throw profilesRes.error;

      const nameMap = new Map(profilesRes.data?.map((s) => [s.user_id, s.full_name]) || []);
      const studentIds = [...new Set(lessonsRes.data?.map((l) => l.student_id) || [])];
      const colorMap = new Map<string, string>();
      studentIds.forEach((id, index) => { colorMap.set(id, STUDENT_COLORS[index % STUDENT_COLORS.length]); });
      setStudentColors(colorMap);

      setLessons(lessonsRes.data?.map((lesson) => ({ ...lesson, student_name: nameMap.get(lesson.student_id) || "Bilinmeyen", note: lesson.note })) || []);
    } catch {
      toast({ title: "Hata", description: "Ders programı yüklenemedi", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const timeSlots = showTemplate
    ? getAllTimeSlots(lessons, [])
    : getAllTimeSlotsActual(actualLessons, trialLessons, lessons);

  const weekEnd = addDays(weekStart, 6);
  const weekLabel = `${format(weekStart, "dd.MM")} – ${format(weekEnd, "dd.MM.yyyy")}`;

  const handleActualLessonClick = (lesson: ActualLesson) => {
    // Ghost rows are a template preview for a week with no real lessons yet;
    // there is nothing on the calendar to move.
    if (lesson.isGhost) return;
    setSelectedActualLesson(lesson);
    setShowOverrideDialog(true);
  };

  const handleTrialLessonClick = (trial: TrialLesson) => {
    setSelectedTrialLesson(trial);
    setShowTrialActionDialog(true);
  };

  /**
   * Bir günün tamamını erteler: o gün dersi olan her öğrencinin dersleri
   * birer boş saat ileri kayar. Öğretmen hasta olduğunda tek işlem.
   */
  const handleGunuErtele = async () => {
    if (!ertelenecekGun) return;
    setGunErteleniyor(true);
    try {
      const sonuc = await gunuErtele(teacherId, format(ertelenecekGun, "yyyy-MM-dd"));
      if (!sonuc.success) {
        toast({ title: "Hata", description: sonuc.error || "Gün ertelenemedi", variant: "destructive" });
        return;
      }
      const uyari = describeRescheduleWarnings(sonuc);
      toast({
        title: sonuc.students
          ? `${sonuc.students} öğrencinin dersleri kaydırıldı`
          : "Bu günde kaydırılacak ders yok",
        description: uyari ? `Çakışan saatler: ${uyari}` : undefined,
      });
      clearWeekCache();
      fetchSchedule();
      if (!showTemplate) fetchActualSchedule();
    } finally {
      setGunErteleniyor(false);
      setErtelenecekGun(null);
    }
  };

  /**
   * Sürükleyip bıraktığın (ya da "Taşı" modunda dokunduğun) hücreye taşır.
   *
   * Süre dersin kendi süresidir: 19:20–19:50 bir ders 20:00 slotuna
   * bırakıldığında 20:00–20:30 olur. Hedef doluysa işlem yine yapılır,
   * sunucu çakışmayı uyarı olarak bildirir.
   */
  const handleHedefSec = async (dayIndex: number, timeSlot: string) => {
    const ders = tasinan;
    if (!ders) return;
    setTasinan(null);

    const hedefTarih = toDateStr(addDays(weekStart, dayIndex));
    const baslangic = toDbTime(timeSlot);
    if (hedefTarih === ders.lesson_date && baslangic === toDbTime(ders.start_time)) return;

    const dk = (t: string) => {
      const [h, m] = toDbTime(t).split(":").map(Number);
      return h * 60 + m;
    };
    const sure = Math.max(1, dk(ders.end_time) - dk(ders.start_time));
    const bitisDk = dk(baslangic) + sure;
    const bitis = `${String(Math.floor(bitisDk / 60) % 24).padStart(2, "0")}:${String(bitisDk % 60).padStart(2, "0")}:00`;

    const sonuc = await moveLesson(ders.id, hedefTarih, baslangic, bitis, false);
    if (!sonuc.success) {
      toast({ title: "Hata", description: sonuc.error || "Ders taşınamadı", variant: "destructive" });
      return;
    }
    const uyari = describeRescheduleWarnings(sonuc);
    toast({
      title: uyari ? "Taşındı — o saatte başka ders de var" : "Ders taşındı",
      description: uyari ?? `${ders.student_name} · ${format(addDays(weekStart, dayIndex), "d MMMM")} ${formatTime(baslangic)}`,
    });
    clearWeekCache();
    fetchSchedule();
    if (!showTemplate) fetchActualSchedule();
  };

  const handleOverrideSuccess = () => {
    clearWeekCache();
    fetchSchedule();
    if (!showTemplate) fetchActualSchedule();
  };

  const handleDeleteTrialLesson = async () => {
    if (!selectedTrialLesson || busy) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("trial_lessons").delete().eq("id", selectedTrialLesson.id);
      if (error) throw error;
      toast({ title: "Başarılı", description: "Deneme dersi silindi" });
      fetchSchedule();
    } catch (error) {
      hataGoster(error, "İşlem tamamlanamadı");
    } finally {
      setBusy(false);
      setShowDeleteAlert(false);
      setShowTrialActionDialog(false);
      setSelectedTrialLesson(null);
    }
  };

  const handleMarkComplete = async () => {
    if (!selectedTrialLesson || busy) return;
    setBusy(true);
    try {
      const result = await completeTrialLesson(selectedTrialLesson.id, teacherId);
      if (!result.success) throw new Error(result.error || "İşlem başarısız");
      toast({ title: "Başarılı", description: "Ders işlendi olarak işaretlendi" });
      fetchSchedule();
    } catch (error) {
      hataGoster(error, "İşlem tamamlanamadı");
    } finally {
      setBusy(false);
      setShowMarkAlert(false);
      setSelectedTrialLesson(null);
    }
  };

  const handleMarkIncomplete = async () => {
    if (!selectedTrialLesson || busy) return;
    setBusy(true);
    try {
      const result = await undoTrialLesson(selectedTrialLesson.id, teacherId);
      if (!result.success) throw new Error(result.error || "İşlem başarısız");
      toast({ title: "Başarılı", description: "Ders işlenmedi olarak geri alındı" });
      fetchSchedule();
    } catch (error) {
      hataGoster(error, "İşlem tamamlanamadı");
    } finally {
      setBusy(false);
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
          {tasinan && (
            <div className="mb-3 flex items-center justify-between gap-3 rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-sm">
              <span className="flex items-center gap-2 min-w-0">
                <Move className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate">
                  <strong>{tasinan.student_name}</strong> taşınıyor — hedef saate dokunun
                </span>
              </span>
              <Button variant="ghost" size="sm" onClick={() => setTasinan(null)} className="shrink-0">
                <X className="h-4 w-4 mr-1" />
                Vazgeç
              </Button>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[800px]">
              <thead>
                <tr>
                  <th className="border border-border p-2 bg-muted font-medium text-sm">Saat</th>
                  {DAYS.map((day, dayIndex) => {
                    const gunTarihi = addDays(weekStart, dayIndex);
                    return (
                      <th key={day} className="border border-border p-2 bg-muted font-medium text-sm">
                        <div className="flex items-center justify-center gap-1.5">
                          <span>{day}</span>
                          {!showTemplate && (
                            <button
                              type="button"
                              onClick={() => setErtelenecekGun(gunTarihi)}
                              className="text-muted-foreground hover:text-destructive transition-colors"
                              title={`${day} gününün tüm derslerini ertele`}
                              aria-label={`${format(gunTarihi, "d MMMM")} gününün tüm derslerini ertele`}
                            >
                              <CalendarX className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        <div className="text-[11px] font-normal text-muted-foreground">
                          {format(gunTarihi, "dd.MM")}
                        </div>
                      </th>
                    );
                  })}
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
                        tasinan={tasinan}
                        onTasimaBasla={setTasinan}
                        onHedefSec={handleHedefSec}
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

      <AlertDialog open={!!ertelenecekGun} onOpenChange={(a) => !a && setErtelenecekGun(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bu günün tüm derslerini ertele</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>
                  {ertelenecekGun && format(ertelenecekGun, "d MMMM yyyy, EEEE")} günü dersi olan
                  her öğrencinin dersleri birer boş saate ileri alınacak.
                </p>
                <ul className="list-disc list-inside mt-3 space-y-1 text-sm">
                  <li>Her öğrencinin o günden sonraki planlı dersleri de birlikte kayar.</li>
                  <li>Elle sabitlenmiş dersler yerinde kalır.</li>
                  <li>Kimsenin ders hakkı değişmez.</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={gunErteleniyor}>Vazgeç</AlertDialogCancel>
            <AlertDialogAction onClick={handleGunuErtele} disabled={gunErteleniyor}>
              {gunErteleniyor ? "Kaydırılıyor..." : "Günü ertele"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Trial Lesson Action Dialog */}
      <Dialog open={showTrialActionDialog} onOpenChange={setShowTrialActionDialog}>
        <DialogContent size="sm">
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
            <AlertDialogAction onClick={handleMarkComplete} disabled={busy}>Onayla</AlertDialogAction>
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
            <AlertDialogAction onClick={handleMarkIncomplete} disabled={busy}>Onayla</AlertDialogAction>
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
            <AlertDialogAction onClick={handleDeleteTrialLesson} disabled={busy} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Sil</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <LessonOverrideDialog
        open={showOverrideDialog}
        onOpenChange={setShowOverrideDialog}
        lesson={selectedActualLesson}
        teacherId={teacherId}
        onSuccess={handleOverrideSuccess}
        onTasi={(l) => {
          setTasinan(l);
          setShowOverrideDialog(false);
        }}
        onPaketiAc={
          selectedActualLesson && ogrenciKayitlari.has(selectedActualLesson.student_id)
            ? (l) => {
                setPaketOgrencisi({
                  recordId: ogrenciKayitlari.get(l.student_id)!,
                  userId: l.student_id,
                  name: l.student_name,
                });
                setShowOverrideDialog(false);
              }
            : undefined
        }
      />

      {/* Paket listesinin ikinci kapısı: takvimden de aynı ekran açılıyor,
          yani iki yüzeyde farklı davranan iki ayrı liste kalmıyor. */}
      {paketOgrencisi && (
        <EditStudentDialog
          open
          onOpenChange={(acik) => !acik && setPaketOgrencisi(null)}
          onStudentUpdated={handleOverrideSuccess}
          studentId={paketOgrencisi.recordId}
          currentName={paketOgrencisi.name}
          currentLessons={lessons
            .filter((l) => l.student_id === paketOgrencisi.userId)
            .map<StudentLessonBase>((l) => ({
              id: l.id,
              dayOfWeek: l.day_of_week,
              startTime: l.start_time,
              endTime: l.end_time,
              note: l.note ?? undefined,
            }))}
        />
      )}
    </>
  );
}
