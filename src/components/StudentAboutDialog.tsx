import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface StudentAboutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  studentName: string;
  aboutText: string | null;
  isReadOnly?: boolean;
  onSaved?: () => void;
}

export function StudentAboutDialog({
  open,
  onOpenChange,
  studentId,
  studentName,
  aboutText,
  isReadOnly = false,
  onSaved,
}: StudentAboutDialogProps) {
  const [text, setText] = useState(aboutText || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setText(aboutText || "");
  }, [aboutText, open]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("students")
        .update({ about_text: text.trim() || null })
        .eq("student_id", studentId);

      if (error) throw error;

      toast.success("Bilgiler kaydedildi");
      onOpenChange(false);
      onSaved?.();
    } catch (error) {
      console.error("Error saving about text:", error);
      toast.error("Kaydetme sırasında bir hata oluştu");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{studentName} Hakkında</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {isReadOnly ? (
            <div className="min-h-[120px] p-3 rounded-md border bg-muted/50 text-sm whitespace-pre-wrap">
              {text || <span className="text-muted-foreground italic">Henüz bilgi eklenmemiş</span>}
            </div>
          ) : (
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Öğrenci hakkında notlar..."
              className="min-h-[120px] resize-none"
            />
          )}
        </div>

        {!isReadOnly && (
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              İptal
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
