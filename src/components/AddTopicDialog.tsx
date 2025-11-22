// AddTopicDialog component
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface AddTopicDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId?: string;
  teacherId?: string;
  onTopicAdded?: () => void;
  onAddTopic?: (title: string, description: string) => Promise<void>;
}

export function AddTopicDialog({
  open,
  onOpenChange,
  studentId,
  teacherId,
  onTopicAdded,
  onAddTopic,
}: AddTopicDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsLoading(true);
    try {
      if (onAddTopic) {
        // Global topics mode
        await onAddTopic(title.trim(), description.trim());
      } else {
        // Student-specific topics mode
        if (!studentId || !teacherId) return;

        // Get the next order index
        const { data: existingTopics } = await supabase
          .from("topics")
          .select("order_index")
          .eq("teacher_id", teacherId)
          .eq("student_id", studentId)
          .order("order_index", { ascending: false })
          .limit(1);

        const nextOrderIndex = existingTopics && existingTopics.length > 0 ? existingTopics[0].order_index + 1 : 0;

        const { error } = await supabase.from("topics").insert({
          teacher_id: teacherId,
          student_id: studentId,
          title: title.trim(),
          description: description.trim() || null,
          order_index: nextOrderIndex,
        });

        if (error) throw error;

        toast({
          title: "Başarılı",
          description: "Konu başarıyla oluşturuldu",
        });

        onTopicAdded?.();
      }

      setTitle("");
      setDescription("");
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Hata",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Yeni Konu Ekle</DialogTitle>
          <DialogDescription>
            Öğrenci için yeni bir öğrenme konusu oluşturun. Daha sonra kaynak ekleyebilirsiniz.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="topic-title">Konu Başlığı</Label>
            <Input
              id="topic-title"
              placeholder="örn., Sebzeler, Meslekler, Günlük Rutinler"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="topic-description">Açıklama (Opsiyonel)</Label>
            <Textarea
              id="topic-description"
              placeholder="Bu konunun ne içerdiğinin kısa açıklaması..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              İptal
            </Button>
            <Button type="submit" disabled={isLoading || !title.trim()}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Konu Oluştur
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
