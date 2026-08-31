import { useState, useEffect, useCallback } from "react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { CalendarIcon, ArrowRight, RotateCcw, AlertTriangle, History } from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { formatTime, toDbTime, toDateStr, toInputTime, parseLocalDate } from "@/lib/lessonTypes";
import { useToast } from "@/hooks/use-toast";
import {
  moveLesson,
  postponeLesson,
  revertLesson,
  nextFreeSlot,
  describeRescheduleError,
  type RescheduleResult,
} from "@/lib/lessonService";
import { clearWeekCache, type ActualLesson } from "@/hooks/useScheduleGrid";
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
  /** The lesson_instances row the admin clicked in the schedule grid. */
  lesson: ActualLesson | null;
  teacherId: string;
  onSuccess: () => void;
}

/** How a manual date change treats the lessons that come after it. */
type MoveMode = "single" | "cascade";

/**
 * The one place a lesson's date or time is changed.
 *
 * Every action here is a single server RPC that resolves the placement, checks
 * for conflicts, writes and renumbers the chain in one transaction. The dialog
 * itself does no date arithmetic and never writes to lesson_instances directly
 * — that split was what let the schedule drift out of order.
 */
export function LessonOverrideDialog({
  open,
  onOpenChange,
  lesson,
  teacherId,
  onSuccess,
}: LessonOverrideDialogProps) {
  const [newDate, setNewDate] = useState<Date | undefined>();
  const [newStartTime, setNewStartTime] = useState("");
  const [newEndTime, setNewEndTime] = useState("");
  const [moveMode, setMoveMode] = useState<MoveMode>("single");
  const [saving, setSaving] = useState(false);
  const [showPostponeConfirm, setShowPostponeConfirm] = useState(false);
  const [showRevertConfirm, setShowRevertConfirm] = useState(false);
  const [postponeTarget, setPostponeTarget] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const wasMoved = !!lesson?.original_date;
  const isCompleted = lesson?.status === "completed";

  useEffect(() => {
    if (!open || !lesson) return;
    setNewDate(parseLocalDate(lesson.lesson_date));
    setNewStartTime(toInputTime(lesson.start_time));
    setNewEndTime(toInputTime(lesson.end_time));
    setMoveMode("single");
    setError(null);
    setPostponeTarget(null);

    // Preview where "Sonraki Boş Saate Ertele" would land, so the confirmation
    // can name a real date instead of a vague promise.
    nextFreeSlot(lesson.student_id, teacherId, lesson.lesson_date, lesson.start_time, [lesson.id])
      .then((slot) => setPostponeTarget(slot.success ? slot.lessonDate ?? null : null))
      .catch(() => setPostponeTarget(null));
  }, [open, lesson, teacherId]);

  const hasChanges = (): boolean => {
    if (!lesson || !newDate) return false;
    return (
      toDateStr(newDate) !== lesson.lesson_date ||
      toDbTime(newStartTime) !== toDbTime(lesson.start_time) ||
      toDbTime(newEndTime) !== toDbTime(lesson.end_time)
    );
  };

  /** Shared result handling: one toast, one error panel, one refresh. */
  const settle = useCallback(
    (result: RescheduleResult, successMessage: string): boolean => {
      if (!result.success) {
        setError(describeRescheduleError(result));
        toast({
          title: result.error === "conflict" ? "Çakışma var" : "Hata",
          description: describeRescheduleError(result),
          variant: "destructive",
        });
        return false;
      }
      clearWeekCache();
      setError(null);
      toast({ title: "Başarılı", description: successMessage });
      onSuccess();
      onOpenChange(false);
      return true;
    },
    [toast, onSuccess, onOpenChange]
  );

  const handleMove = async () => {
    if (!lesson || !newDate) return;
    if (!hasChanges()) {
      toast({ title: "Bilgi", description: "Tarih veya saat değişikliği yapılmadı" });
      return;
    }
    if (toDbTime(newEndTime) <= toDbTime(newStartTime)) {
      setError("Bitiş saati başlangıçtan sonra olmalı.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const result = await moveLesson(
        lesson.id,
        toDateStr(newDate),
        toDbTime(newStartTime),
        toDbTime(newEndTime),
        moveMode === "cascade"
      );
      settle(
        result,
        moveMode === "cascade"
          ? `Ders ${format(newDate, "d MMMM", { locale: tr })} tarihine alındı, sonraki dersler kaydırıldı`
          : `Ders ${format(newDate, "d MMMM", { locale: tr })} tarihine alındı`
      );
    } finally {
      setSaving(false);
    }
  };

  const handlePostpone = async () => {
    if (!lesson) return;
    setSaving(true);
    setError(null);
    try {
      const result = await postponeLesson(lesson.id);
      settle(result, "Ders ertelendi, sonraki dersler kaydırıldı");
    } finally {
      setSaving(false);
      setShowPostponeConfirm(false);
    }
  };

  const handleRevert = async () => {
    if (!lesson) return;
    setSaving(true);
    setError(null);
    try {
      const result = await revertLesson(lesson.id);
      settle(result, "Ders eski tarih ve saatine döndürüldü");
    } finally {
      setSaving(false);
      setShowRevertConfirm(false);
    }
  };

  if (!lesson) return null;

  const currentDate = parseLocalDate(lesson.lesson_date);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">Ders Düzenle</DialogTitle>
            <DialogDescription className="text-sm">
              {lesson.student_name} — {format(currentDate, "d MMMM yyyy, EEEE", { locale: tr })}
              <br />
              {formatTime(lesson.start_time)} – {formatTime(lesson.end_time)}
            </DialogDescription>
          </DialogHeader>

          {wasMoved && (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-300">
              <History className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                Bu ders{" "}
                <strong>
                  {format(parseLocalDate(lesson.original_date!), "d MMMM", { locale: tr })}
                  {lesson.original_start_time ? ` ${formatTime(lesson.original_start_time)}` : ""}
                </strong>{" "}
                tarihinden taşındı. “Geri Al” eski yerine döndürür.
              </span>
            </div>
          )}

          {isCompleted && (
            <div className="rounded-md border border-muted bg-muted/50 p-2.5 text-xs text-muted-foreground">
              Bu ders işlenmiş olarak işaretli. Tarihini değiştirmek bakiyeyi etkilemez, ancak
              geçmiş kaydını değiştirir.
            </div>
          )}

          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label className="text-sm">Yeni tarih</Label>
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
                    {newDate ? format(newDate, "d MMM yyyy, EEEE", { locale: tr }) : "Tarih seçin"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-50" align="start">
                  <Calendar
                    mode="single"
                    selected={newDate}
                    onSelect={(d) => { setNewDate(d); setError(null); }}
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
                  onChange={(e) => { setNewStartTime(e.target.value); setError(null); }}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="endTime" className="text-sm">Bitiş</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={newEndTime}
                  onChange={(e) => { setNewEndTime(e.target.value); setError(null); }}
                  className="h-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Sonraki dersler ne olsun?</Label>
              <RadioGroup
                value={moveMode}
                onValueChange={(v) => setMoveMode(v as MoveMode)}
                className="gap-2"
              >
                <label
                  htmlFor="mode-single"
                  className="flex items-start gap-2.5 rounded-md border p-2.5 cursor-pointer hover:bg-muted/50"
                >
                  <RadioGroupItem value="single" id="mode-single" className="mt-0.5" />
                  <span className="text-xs leading-snug">
                    <span className="font-medium block">Yerinde kalsın</span>
                    <span className="text-muted-foreground">
                      Sadece bu ders taşınır. Ders sabitlenir; program değişse de yerinde kalır.
                    </span>
                  </span>
                </label>
                <label
                  htmlFor="mode-cascade"
                  className="flex items-start gap-2.5 rounded-md border p-2.5 cursor-pointer hover:bg-muted/50"
                >
                  <RadioGroupItem value="cascade" id="mode-cascade" className="mt-0.5" />
                  <span className="text-xs leading-snug">
                    <span className="font-medium block">Onlar da kaysın</span>
                    <span className="text-muted-foreground">
                      Bu dersten sonraki tüm planlı dersler birer boş saat ileri alınır.
                    </span>
                  </span>
                </label>
              </RadioGroup>
            </div>

            {error && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
                <div className="flex items-start gap-2 text-destructive text-xs">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              </div>
            )}

            <Button
              onClick={handleMove}
              disabled={saving || !hasChanges()}
              className="w-full"
              size="sm"
            >
              {saving ? "Kaydediliyor..." : "Dersi Taşı"}
            </Button>
          </div>

          <Separator />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPostponeConfirm(true)}
              disabled={saving || isCompleted}
              className="text-xs"
            >
              <ArrowRight className="h-3.5 w-3.5 mr-1 shrink-0" />
              Sonraki Boş Saate Ertele
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRevertConfirm(true)}
              disabled={saving || !wasMoved}
              className={cn("text-xs", !wasMoved && "opacity-50")}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1 shrink-0" />
              Geri Al
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showPostponeConfirm} onOpenChange={setShowPostponeConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sonraki Boş Saate Ertele</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>
                  {lesson.student_name} öğrencisinin{" "}
                  {format(currentDate, "d MMMM", { locale: tr })} tarihli dersi
                  {postponeTarget
                    ? ` ${format(parseLocalDate(postponeTarget), "d MMMM yyyy", { locale: tr })} tarihine alınacak.`
                    : " programdaki sonraki boş saate alınacak."}
                </p>
                <ul className="list-disc list-inside mt-3 space-y-1 text-sm">
                  <li>Bu dersten sonraki tüm planlı dersler de birer boş saat ileri kayar.</li>
                  <li>Elle sabitlenmiş dersler yerinde kalır, zincir onların etrafından dolaşır.</li>
                  <li>Öğrencinin ders hakkı değişmez.</li>
                  <li>Tek “Geri Al” ile tüm kaydırma iptal edilebilir.</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction onClick={handlePostpone}>Ertele</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showRevertConfirm} onOpenChange={setShowRevertConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Değişikliği Geri Al</AlertDialogTitle>
            <AlertDialogDescription>
              {wasMoved && lesson.original_date
                ? `Ders ${format(parseLocalDate(lesson.original_date), "d MMMM yyyy", { locale: tr })}${
                    lesson.original_start_time ? ` ${formatTime(lesson.original_start_time)}` : ""
                  } tarihine döndürülecek. Bu ders bir toplu kaydırmanın parçasıysa, o kaydırmadan sonra elle taşınmamış tüm dersler birlikte geri alınır.`
                : "Geri alınacak bir değişiklik yok."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevert}>Geri Al</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
