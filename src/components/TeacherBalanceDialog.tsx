import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Clock, CheckCircle2, Calendar } from "lucide-react";
import { toast } from "sonner";

interface TeacherBalanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teacherId: string;
}

interface BalanceData {
  total_minutes: number;
  completed_regular_lessons: number;
  completed_trial_lessons: number;
}

export function TeacherBalanceDialog({ open, onOpenChange, teacherId }: TeacherBalanceDialogProps) {
  const [balance, setBalance] = useState<BalanceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      fetchBalance();
    }
  }, [open, teacherId]);

  const fetchBalance = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("teacher_balance")
        .select("*")
        .eq("teacher_id", teacherId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setBalance(data);
      } else {
        setBalance({
          total_minutes: 0,
          completed_regular_lessons: 0,
          completed_trial_lessons: 0,
        });
      }
    } catch (error) {
      console.error("Error fetching balance:", error);
      toast.error("Bakiye bilgisi yüklenirken hata oluştu");
    } finally {
      setLoading(false);
    }
  };

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours} saat ${mins} dakika`;
    }
    return `${mins} dakika`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Bakiye Durumu
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg p-6 border border-primary/20">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">Toplam İşlenen Süre</p>
                <p className="text-3xl font-bold text-primary">
                  {formatMinutes(balance?.total_minutes || 0)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-card border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-4 w-4 text-blue-500" />
                  <p className="text-xs text-muted-foreground">Normal Dersler</p>
                </div>
                <p className="text-2xl font-semibold">
                  {balance?.completed_regular_lessons || 0}
                </p>
              </div>

              <div className="bg-card border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4 text-purple-500" />
                  <p className="text-xs text-muted-foreground">Deneme Dersleri</p>
                </div>
                <p className="text-2xl font-semibold">
                  {balance?.completed_trial_lessons || 0}
                </p>
              </div>
            </div>

            <div className="text-xs text-muted-foreground text-center pt-2 border-t">
              Her işlenen ders, ders süresine göre bakiyenize otomatik eklenir
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
