import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface AddTrialLessonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teacherId: string;
  onSuccess: () => void;
}

export function AddTrialLessonDialog({ open, onOpenChange, teacherId, onSuccess }: AddTrialLessonDialogProps) {
  const [dayOfWeek, setDayOfWeek] = useState<string>("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const days = [
    { value: "1", label: "Pazartesi" },
    { value: "2", label: "Salı" },
    { value: "3", label: "Çarşamba" },
    { value: "4", label: "Perşembe" },
    { value: "5", label: "Cuma" },
    { value: "6", label: "Cumartesi" },
    { value: "0", label: "Pazar" },
  ];

  // Calculate the next occurrence of a specific day of week
  const getNextDayOfWeek = (targetDay: number): string => {
    const today = new Date();
    const currentDay = today.getDay(); // 0=Sunday, 1=Monday, etc.
    
    // Calculate days until target day
    let daysUntilTarget = targetDay - currentDay;
    
    // If target day is today or already passed this week, use this week's day
    // (if today, use today; if passed, still use this week for immediate display)
    if (daysUntilTarget < 0) {
      daysUntilTarget += 7; // Move to next week
    }
    
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + daysUntilTarget);
    
    return targetDate.toISOString().split("T")[0];
  };

  const handleSubmit = async () => {
    if (!dayOfWeek || !startTime || !endTime) {
      toast({
        title: "Eksik Bilgi",
        description: "Lütfen tüm alanları doldurun",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Calculate the actual lesson date based on day_of_week
      const lessonDate = getNextDayOfWeek(parseInt(dayOfWeek));
      
      const { error } = await supabase.from("trial_lessons").insert({
        teacher_id: teacherId,
        day_of_week: parseInt(dayOfWeek),
        start_time: startTime,
        end_time: endTime,
        lesson_date: lessonDate,
      });

      if (error) throw error;

      toast({
        title: "Başarılı",
        description: "Deneme dersi eklendi",
      });

      setDayOfWeek("");
      setStartTime("");
      setEndTime("");
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Hata",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1rem)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Deneme Dersi Ekle</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Gün</Label>
            <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
              <SelectTrigger>
                <SelectValue placeholder="Gün seçin" />
              </SelectTrigger>
              <SelectContent>
                {days.map((day) => (
                  <SelectItem key={day.value} value={day.value}>
                    {day.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Başlangıç Saati</Label>
            <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Bitiş Saati</Label>
            <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              İptal
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? "Ekleniyor..." : "Onayla"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
