import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Save } from "lucide-react";


interface EditHomeworkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  homeworkId: string;
  batchId: string;
  currentTitle: string;
  currentDescription: string | null;
  onSuccess?: () => void;
}

export function EditHomeworkDialog({ 
  open, 
  onOpenChange, 
  homeworkId,
  batchId,
  currentTitle,
  currentDescription,
  onSuccess 
}: EditHomeworkDialogProps) {
  const [title, setTitle] = useState(currentTitle);
  const [description, setDescription] = useState(currentDescription || "");
  const [updating, setUpdating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setTitle(currentTitle);
    setDescription(currentDescription || "");
  }, [currentTitle, currentDescription, open]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast({
        title: "Hata",
        description: "Ödev başlığı zorunludur",
        variant: "destructive",
      });
      return;
    }

    setUpdating(true);

    try {
      // Update all homework submissions with the same batch_id
      const { error } = await supabase
        .from('homework_submissions')
        .update({
          title: title.trim(),
          description: description.trim() || null,
        })
        .eq('batch_id', batchId);

      if (error) throw error;

      toast({
        title: "Başarılı",
        description: "Ödev güncellendi",
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error("Update error:", error);
      toast({
        title: "Hata",
        description: error.message || "Ödev güncellenemedi",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`w-[calc(100%-1rem)] sm:max-w-[500px] max-h-[90dvh] overflow-y-auto ${BOTTOM_SHEET_CLASSES}`}>
        <DialogHeader>
          <DialogTitle>Ödevi Düzenle</DialogTitle>
          <DialogDescription>
            Ödev başlığını ve açıklamasını güncelleyin
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-title">Ödev Başlığı *</Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Örn: İngilizce Kompozisyon"
              disabled={updating}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">Açıklama</Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ödev hakkında ek bilgiler..."
              rows={3}
              disabled={updating}
              className="max-h-[120px] overflow-y-auto"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={updating}
          >
            İptal
          </Button>
          <Button onClick={handleSubmit} disabled={updating}>
            {updating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2" />
                Güncelleniyor...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Kaydet
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
