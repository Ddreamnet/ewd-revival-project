import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, ArrowRight, CalendarClock, RotateCcw, Save, AlertTriangle } from "lucide-react";
import { format, addDays } from "date-fns";
import { tr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { formatTime as sharedFormatTime } from "@/lib/lessonTypes";
import { calculateNextLessonDate as calcNextDate } from "@/lib/lessonDateCalculation";
import { useToast } from "@/hooks/use-toast";
import { checkTeacherConflicts, ConflictInfo } from "@/lib/conflictDetection";
import { shiftLessonsForward, TemplateSlot } from "@/lib/instanceGeneration";
import { rebuildLegacyLessonDatesFromInstances, checkNonTemplateWeekday } from "@/lib/lessonSync";
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

interface LessonOverrideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  teacherId: string;
  studentName: string;
  originalDate: Date;
  originalDayOfWeek: number;
  originalStartTime: string;
  originalEndTime: string;
  currentDate?: Date;
  currentStartTime?: string;
  currentEndTime?: string;
  hasExistingOverride?: boolean;
  instanceId?: string; // lesson_instances.id for instance-based operations
  onSuccess: () => void;
}

export function LessonOverrideDialog({
  open,
  onOpenChange,
  studentId,
  teacherId,
  studentName,
  originalDate,
  originalDayOfWeek,
  originalStartTime,
  originalEndTime,
  currentDate,
  currentStartTime,
  currentEndTime,
  hasExistingOverride = false,
  instanceId,
  onSuccess,
}: LessonOverrideDialogProps) {
  const displayDate = currentDate || originalDate;
  const displayStartTime = currentStartTime || originalStartTime;
  const displayEndTime = currentEndTime || originalEndTime;

  const [newDate, setNewDate] = useState<Date | undefined>(displayDate);
  const [newStartTime, setNewStartTime] = useState(displayStartTime.slice(0, 5));
  const [newEndTime, setNewEndTime] = useState(displayEndTime.slice(0, 5));
  const [saving, setSaving] = useState(false);
  const [showPostponeConfirm, setShowPostponeConfirm] = useState(false);
  const [showRevertConfirm, setShowRevertConfirm] = useState(false);
  const [nextLessonDate, setNextLessonDate] = useState<Date | null>(null);
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      const dateToUse = currentDate || originalDate;
      const startTimeToUse = currentStartTime || originalStartTime;
      const endTimeToUse = currentEndTime || originalEndTime;
      setNewDate(dateToUse);
      setNewStartTime(startTimeToUse.slice(0, 5));
      setNewEndTime(endTimeToUse.slice(0, 5));
      setConflicts([]);
      calculateNextLessonDate(originalDate).then(setNextLessonDate);
    }
  }, [open, originalDate, originalStartTime, originalEndTime, currentDate, currentStartTime, currentEndTime]);

  const formatTime = sharedFormatTime;

  const hasDateTimeChanges = (): boolean => {
    if (!newDate) return false;
    const dateChanged = format(newDate, "yyyy-MM-dd") !== format(displayDate, "yyyy-MM-dd");
    const startTimeChanged = newStartTime !== displayStartTime.slice(0, 5);
    const endTimeChanged = newEndTime !== displayEndTime.slice(0, 5);
    return dateChanged || startTimeChanged || endTimeChanged;
  };

  const calculateNextLessonDate = async (currentDate: Date): Promise<Date | null> => {
    try {
      const { data: lessonDays, error } = await supabase
        .from("student_lessons")
        .select("day_of_week")
        .eq("student_id", studentId)
        .eq("teacher_id", teacherId);

      if (error || !lessonDays || lessonDays.length === 0) return null;
      const days = lessonDays.map((l: any) => l.day_of_week);
      return calcNextDate(currentDate, days);
    } catch {
      return null;
    }
  };

  // "Sonraki Derse Aktar" - instance-based shift
  const handlePostponeToNextLesson = async () => {
    setSaving(true);
    setConflicts([]);
    try {
      if (!instanceId) {
        toast({ title: "Hata", description: "Instance ID bulunamadı", variant: "destructive" });
        setSaving(false);
        setShowPostponeConfirm(false);
        return;
      }

      // Instance-based: shift forward using template slots
      const { data: templateSlots } = await supabase
        .from("student_lessons")
        .select("day_of_week, start_time, end_time")
        .eq("student_id", studentId)
        .eq("teacher_id", teacherId);

      if (!templateSlots || templateSlots.length === 0) {
        toast({ title: "Hata", description: "Ders programı bulunamadı", variant: "destructive" });
        setSaving(false);
        setShowPostponeConfirm(false);
        return;
      }

      const slots: TemplateSlot[] = templateSlots.map((s) => ({
        dayOfWeek: s.day_of_week,
        startTime: s.start_time,
        endTime: s.end_time,
      }));

      const result = await shiftLessonsForward(studentId, teacherId, instanceId, slots);

      if (result.conflicts.length > 0) {
        setConflicts(result.conflicts);
        setSaving(false);
        setShowPostponeConfirm(false);
        return;
      }

      if (!result.success) {
        toast({ title: "Hata", description: "Dersler kaydırılamadı", variant: "destructive" });
        setSaving(false);
        setShowPostponeConfirm(false);
        return;
      }

      // Rebuild legacy JSON from instances (compat-only, removed in Phase 6)
      await rebuildLegacyLessonDatesFromInstances(studentId, teacherId);

      toast({ title: "Başarılı", description: "Dersler kaydırıldı" });
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error postponing lesson:", error);
      toast({ title: "Hata", description: error.message || "Ders ertelenemedi", variant: "destructive" });
    } finally {
      setSaving(false);
      setShowPostponeConfirm(false);
    }
  };

  // Legacy postpone removed in Phase 3 — all operations are instance-based

  // "1 Seferlik Değiştir" with conflict check + instance update
  const handleOneTimeChange = async () => {
    if (!newDate) {
      toast({ title: "Hata", description: "Lütfen yeni tarih seçin", variant: "destructive" });
      return;
    }
    if (!hasDateTimeChanges()) {
      toast({ title: "Bilgi", description: "Tarih veya saat değişikliği yapılmadı" });
      return;
    }

    setSaving(true);
    setConflicts([]);
    try {
      const newDateStr = format(newDate, "yyyy-MM-dd");
      const newStartFull = newStartTime + ":00";
      const newEndFull = newEndTime + ":00";

      // Conflict check
      const foundConflicts = await checkTeacherConflicts(
        teacherId,
        newDateStr,
        newStartFull,
        newEndFull,
        instanceId
      );

      if (foundConflicts.length > 0) {
        setConflicts(foundConflicts);
        setSaving(false);
        return;
      }

      // Update lesson_instances (source of truth)
      if (!instanceId) {
        toast({ title: "Hata", description: "Instance ID bulunamadı", variant: "destructive" });
        setSaving(false);
        return;
      }

      const { data: currentInst } = await supabase
        .from("lesson_instances")
        .select("lesson_date, start_time, end_time, original_date, rescheduled_count")
        .eq("id", instanceId)
        .single();

      if (currentInst) {
        await supabase
          .from("lesson_instances")
          .update({
            lesson_date: newDateStr,
            start_time: newStartFull,
            end_time: newEndFull,
            original_date: currentInst.original_date || currentInst.lesson_date,
            original_start_time: currentInst.original_date ? undefined : currentInst.start_time,
            original_end_time: currentInst.original_date ? undefined : currentInst.end_time,
            rescheduled_count: currentInst.rescheduled_count + 1,
          })
          .eq("id", instanceId);

        // Compat-only: rebuild legacy JSON (removed in Phase 6)
        await rebuildLegacyLessonDatesFromInstances(studentId, teacherId);

        // Non-template weekday warning
        const check = await checkNonTemplateWeekday(studentId, teacherId, newDateStr);
        if (check.isNonTemplate) {
          toast({
            title: "Bilgi",
            description: `Seçilen tarih (${format(newDate, "d MMM", { locale: tr })}) şablon ders günlerinden (${check.templateDays.join(", ")}) farklı bir güne denk geliyor.`,
          });
        }
      }

      toast({
        title: "Başarılı",
        description: `Ders ${format(newDate, "d MMMM", { locale: tr })} tarihine taşındı`,
      });
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error saving lesson override:", error);
      toast({ title: "Hata", description: error.message || "Ders tarihi değiştirilemedi", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // "Geri Al" - reverts instance + deletes override
  const handleRevert = async () => {
    setSaving(true);
    setConflicts([]);
    try {
      // Revert instance if instanceId provided
      if (instanceId) {
        const { data: inst } = await supabase
          .from("lesson_instances")
          .select("original_date, original_start_time, original_end_time")
          .eq("id", instanceId)
          .single();

        if (inst?.original_date) {
          // Conflict check on original slot before reverting
          const revertConflicts = await checkTeacherConflicts(
            teacherId,
            inst.original_date,
            inst.original_start_time || originalStartTime,
            inst.original_end_time || originalEndTime,
            instanceId
          );

          if (revertConflicts.length > 0) {
            setConflicts(revertConflicts);
            setSaving(false);
            setShowRevertConfirm(false);
            return;
          }

          await supabase
            .from("lesson_instances")
            .update({
              lesson_date: inst.original_date,
              start_time: inst.original_start_time || originalStartTime,
              end_time: inst.original_end_time || originalEndTime,
              original_date: null,
              original_start_time: null,
              original_end_time: null,
              rescheduled_count: 0,
            })
            .eq("id", instanceId);

          await rebuildLegacyLessonDatesFromInstances(studentId, teacherId);
        }
      }

      // Delete override record
      await supabase
        .from("lesson_overrides")
        .delete()
        .eq("student_id", studentId)
        .eq("teacher_id", teacherId)
        .eq("original_date", format(originalDate, "yyyy-MM-dd"));

      toast({ title: "Başarılı", description: "Ders orijinal tarih ve saatine döndürüldü" });
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error reverting lesson override:", error);
      toast({ title: "Hata", description: error.message || "Değişiklik geri alınamadı", variant: "destructive" });
    } finally {
      setSaving(false);
      setShowRevertConfirm(false);
    }
  };

  const handleSave = async () => {
    if (hasDateTimeChanges()) {
      await handleOneTimeChange();
    } else {
      onOpenChange(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Ders Düzenle</DialogTitle>
            <DialogDescription className="text-sm">
              {studentName} - {format(originalDate, "d MMM yyyy", { locale: tr })} {formatTime(originalStartTime)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm">Tarih</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !newDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                    {newDate ? format(newDate, "d MMM yyyy", { locale: tr }) : "Tarih seçin"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-50" align="start">
                  <Calendar
                    mode="single"
                    selected={newDate}
                    onSelect={setNewDate}
                    locale={tr}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="startTime" className="text-sm">Başlangıç</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={newStartTime}
                  onChange={(e) => { setNewStartTime(e.target.value); setConflicts([]); }}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="endTime" className="text-sm">Bitiş</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={newEndTime}
                  onChange={(e) => { setNewEndTime(e.target.value); setConflicts([]); }}
                  className="h-9"
                />
              </div>
            </div>

            {/* Conflict warnings */}
            {conflicts.length > 0 && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 space-y-1.5">
                <div className="flex items-center gap-2 text-destructive font-medium text-sm">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Çakışma Tespit Edildi
                </div>
                {conflicts.map((c, i) => (
                  <div key={i} className="text-xs text-destructive/80">
                    {c.studentName} — {c.date} {c.timeRange} ({c.type === "trial" ? "Deneme" : "Ders"})
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPostponeConfirm(true)}
              disabled={saving || conflicts.length > 0}
              className="text-xs px-2"
            >
              <ArrowRight className="h-3.5 w-3.5 mr-1 shrink-0" />
              <span className="truncate">Sonraki Derse Aktar</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleOneTimeChange}
              disabled={saving || !hasDateTimeChanges() || conflicts.length > 0}
              className={cn(
                "text-xs px-2",
                (!hasDateTimeChanges() || conflicts.length > 0) && "opacity-50"
              )}
            >
              <CalendarClock className="h-3.5 w-3.5 mr-1 shrink-0" />
              <span className="truncate">1 Seferlik Değiştir</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRevertConfirm(true)}
              disabled={saving || !hasExistingOverride}
              className={cn(
                "text-xs px-2",
                !hasExistingOverride && "opacity-50"
              )}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1 shrink-0" />
              <span className="truncate">Geri Al</span>
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || conflicts.length > 0}
              className="text-xs px-2"
            >
              <Save className="h-3.5 w-3.5 mr-1 shrink-0" />
              <span className="truncate">{saving ? "Kaydediliyor..." : "Kaydet"}</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Postpone Confirmation Dialog */}
      <AlertDialog open={showPostponeConfirm} onOpenChange={setShowPostponeConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sonraki Derse Aktar</AlertDialogTitle>
            <AlertDialogDescription>
              {studentName} öğrencisinin {format(originalDate, "d MMMM yyyy", { locale: tr })} tarihli dersini sonraki derse aktarmak istediğinize emin misiniz?
              <br /><br />
              <strong>Bu işlem ile:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Bu ders {nextLessonDate ? format(nextLessonDate, "d MMMM", { locale: tr }) : "sonraki ders gününe"} tarihine kaydırılacak</li>
                <li>Sonraki tüm dersler de birer ders ileri kaydırılacak</li>
                <li>Öğrencinin ders hakkı korunacak</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction onClick={handlePostponeToNextLesson}>
              Aktar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revert Confirmation Dialog */}
      <AlertDialog open={showRevertConfirm} onOpenChange={setShowRevertConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Değişiklikleri Geri Al</AlertDialogTitle>
            <AlertDialogDescription>
              {studentName} öğrencisinin dersini orijinal tarih ve saatine ({format(originalDate, "d MMMM yyyy", { locale: tr })} {formatTime(originalStartTime)}) döndürmek istediğinize emin misiniz?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevert}>
              Geri Al
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
