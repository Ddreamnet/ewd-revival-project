import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Ban } from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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
  // Current display date/time (might be different from original if already overridden)
  currentDate?: Date;
  currentStartTime?: string;
  currentEndTime?: string;
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
  onSuccess,
}: LessonOverrideDialogProps) {
  // Use current values if provided, otherwise fall back to original
  const displayDate = currentDate || originalDate;
  const displayStartTime = currentStartTime || originalStartTime;
  const displayEndTime = currentEndTime || originalEndTime;

  const [newDate, setNewDate] = useState<Date | undefined>(displayDate);
  const [newStartTime, setNewStartTime] = useState(displayStartTime.slice(0, 5));
  const [newEndTime, setNewEndTime] = useState(displayEndTime.slice(0, 5));
  const [saving, setSaving] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const { toast } = useToast();

  // Reset state when dialog opens with new lesson data
  useEffect(() => {
    if (open) {
      const dateToUse = currentDate || originalDate;
      const startTimeToUse = currentStartTime || originalStartTime;
      const endTimeToUse = currentEndTime || originalEndTime;
      setNewDate(dateToUse);
      setNewStartTime(startTimeToUse.slice(0, 5));
      setNewEndTime(endTimeToUse.slice(0, 5));
    }
  }, [open, originalDate, originalStartTime, originalEndTime, currentDate, currentStartTime, currentEndTime]);

  const formatTime = (time: string) => {
    try {
      return new Date(`2000-01-01T${time}`).toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return time;
    }
  };

  const handleSave = async () => {
    if (!newDate) {
      toast({
        title: "Hata",
        description: "Lütfen yeni tarih seçin",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      // Check if there's an existing override for this date
      const { data: existingOverride } = await supabase
        .from("lesson_overrides")
        .select("id")
        .eq("student_id", studentId)
        .eq("teacher_id", teacherId)
        .eq("original_date", format(originalDate, "yyyy-MM-dd"))
        .maybeSingle();

      if (existingOverride) {
        // Update existing override
        const { error } = await supabase
          .from("lesson_overrides")
          .update({
            new_date: format(newDate, "yyyy-MM-dd"),
            new_start_time: newStartTime + ":00",
            new_end_time: newEndTime + ":00",
            is_cancelled: false,
          })
          .eq("id", existingOverride.id);

        if (error) throw error;
      } else {
        // Create new override
        const { error } = await supabase.from("lesson_overrides").insert({
          student_id: studentId,
          teacher_id: teacherId,
          original_date: format(originalDate, "yyyy-MM-dd"),
          original_day_of_week: originalDayOfWeek,
          original_start_time: originalStartTime,
          original_end_time: originalEndTime,
          new_date: format(newDate, "yyyy-MM-dd"),
          new_start_time: newStartTime + ":00",
          new_end_time: newEndTime + ":00",
          is_cancelled: false,
        });

        if (error) throw error;
      }

      toast({
        title: "Başarılı",
        description: "Ders başarıyla ertelendi",
      });
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error saving lesson override:", error);
      toast({
        title: "Hata",
        description: error.message || "Ders ertelenemedi",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    setSaving(true);
    try {
      // Check if there's an existing override for this date
      const { data: existingOverride } = await supabase
        .from("lesson_overrides")
        .select("id")
        .eq("student_id", studentId)
        .eq("teacher_id", teacherId)
        .eq("original_date", format(originalDate, "yyyy-MM-dd"))
        .maybeSingle();

      if (existingOverride) {
        // Update existing override to cancelled
        const { error } = await supabase
          .from("lesson_overrides")
          .update({
            new_date: null,
            new_start_time: null,
            new_end_time: null,
            is_cancelled: true,
          })
          .eq("id", existingOverride.id);

        if (error) throw error;
      } else {
        // Create new cancelled override
        const { error } = await supabase.from("lesson_overrides").insert({
          student_id: studentId,
          teacher_id: teacherId,
          original_date: format(originalDate, "yyyy-MM-dd"),
          original_day_of_week: originalDayOfWeek,
          original_start_time: originalStartTime,
          original_end_time: originalEndTime,
          new_date: null,
          new_start_time: null,
          new_end_time: null,
          is_cancelled: true,
        });

        if (error) throw error;
      }

      toast({
        title: "Başarılı",
        description: "Ders bu hafta için iptal edildi",
      });
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error cancelling lesson:", error);
      toast({
        title: "Hata",
        description: error.message || "Ders iptal edilemedi",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
      setShowCancelConfirm(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ders Düzenle</DialogTitle>
            <DialogDescription>
              {studentName} - {format(originalDate, "d MMMM yyyy", { locale: tr })} {formatTime(originalStartTime)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Yeni Tarih</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !newDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {newDate ? format(newDate, "d MMMM yyyy", { locale: tr }) : "Tarih seçin"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime">Başlangıç Saati</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={newStartTime}
                  onChange={(e) => setNewStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">Bitiş Saati</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={newEndTime}
                  onChange={(e) => setNewEndTime(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="destructive"
              onClick={() => setShowCancelConfirm(true)}
              disabled={saving}
              className="w-full sm:w-auto"
            >
              <Ban className="h-4 w-4 mr-2" />
              Bu Hafta İptal Et
            </Button>
            <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dersi İptal Et</AlertDialogTitle>
            <AlertDialogDescription>
              {studentName} öğrencisinin {format(originalDate, "d MMMM yyyy", { locale: tr })} tarihli dersini sadece bu hafta için iptal etmek istediğinize emin misiniz?
              <br /><br />
              Bu işlem sadece bu haftayı etkiler. Gelecek haftalarda ders normal saatinde görünecektir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              İptal Et
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
