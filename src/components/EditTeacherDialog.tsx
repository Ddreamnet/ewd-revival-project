import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface EditTeacherDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTeacherUpdated: () => void;
  teacherId: string;
  currentName: string;
}

export function EditTeacherDialog({
  open,
  onOpenChange,
  onTeacherUpdated,
  teacherId,
  currentName,
}: EditTeacherDialogProps) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setName(currentName);
    }
  }, [open, currentName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast({
        title: "Hata",
        description: "Öğretmen adı gereklidir",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: name.trim() })
        .eq("user_id", teacherId);

      if (error) throw error;

      toast({
        title: "Başarılı",
        description: "Öğretmen bilgileri güncellendi",
      });

      onTeacherUpdated();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Hata",
        description: error.message || "Öğretmen bilgileri güncellenemedi",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTeacher = async () => {
    setLoading(true);
    try {
      // Check if teacher has students
      const { data: students, error: studentsError } = await supabase
        .from("students")
        .select("id")
        .eq("teacher_id", teacherId);

      if (studentsError) throw studentsError;

      if (students && students.length > 0) {
        toast({
          title: "Uyarı",
          description: `Bu öğretmenin ${students.length} öğrencisi var. Öğretmeni silmeden önce öğrencileri başka bir öğretmene atayın veya silin.`,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Delete all related data
      // 1. Delete global topics and resources created by this teacher
      const { data: globalTopics } = await supabase
        .from("global_topics")
        .select("id")
        .eq("teacher_id", teacherId);

      if (globalTopics && globalTopics.length > 0) {
        const globalTopicIds = globalTopics.map((t) => t.id);
        await supabase.from("global_topic_resources").delete().in("global_topic_id", globalTopicIds);
        await supabase.from("global_topics").delete().in("id", globalTopicIds);
      }

      // 2. Delete trial lessons
      await supabase.from("trial_lessons").delete().eq("teacher_id", teacherId);

      // 3. Delete teacher balance
      await supabase.from("teacher_balance").delete().eq("teacher_id", teacherId);

      // 4. Delete payment history
      await supabase.from("payment_history").delete().eq("teacher_id", teacherId);

      // 5. Delete profile (user account)
      await supabase.from("profiles").delete().eq("user_id", teacherId);

      toast({
        title: "Başarılı",
        description: "Öğretmen ve tüm verileri silindi",
      });

      onTeacherUpdated();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Hata",
        description: error.message || "Öğretmen silinemedi",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Öğretmen Ayarları</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Öğretmen Adı</Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ad Soyad"
              required
            />
          </div>

          <Separator className="my-4" />

          {/* Öğretmen Silme Bölümü */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base font-medium text-destructive">Tehlikeli Alan</Label>
                <p className="text-sm text-muted-foreground">
                  Öğretmeni kalıcı olarak silmek için aşağıdaki butona tıklayın.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                const confirmed = window.confirm(
                  `${currentName} adlı öğretmeni silmek istediğinize emin misiniz? Bu öğretmenin öğrencilerinin başka bir öğretmene atandığından emin olun. Bu işlem geri alınamaz ve öğretmenin tüm verileri (global konular, deneme dersleri, bakiye bilgileri) silinecektir.`
                );
                if (confirmed) {
                  handleDeleteTeacher();
                }
              }}
              disabled={loading}
              className="w-full"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Öğretmeni Sil
            </Button>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              İptal
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Kaydet
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
