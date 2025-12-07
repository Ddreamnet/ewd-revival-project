import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, Undo, Redo } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { Separator } from "@/components/ui/separator";

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
  const [saving, setSaving] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
    ],
    content: aboutText || "",
    editable: !isReadOnly,
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none min-h-[150px] p-4 focus:outline-none",
      },
    },
  });

  useEffect(() => {
    if (editor && open) {
      editor.commands.setContent(aboutText || "");
      editor.setEditable(!isReadOnly);
    }
  }, [aboutText, open, editor, isReadOnly]);

  const handleSave = async () => {
    if (!editor) return;
    
    setSaving(true);
    try {
      const htmlContent = editor.getHTML();
      const { error } = await supabase
        .from("students")
        .update({ about_text: htmlContent === "<p></p>" ? null : htmlContent })
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

  if (!editor) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-primary">📝</span>
            {studentName} Hakkında
          </DialogTitle>
        </DialogHeader>

        <div className="py-2">
          {!isReadOnly && (
            <div className="flex items-center gap-1 p-2 border rounded-t-lg bg-muted/30 border-b-0">
              <Toggle
                size="sm"
                pressed={editor.isActive("bold")}
                onPressedChange={() => editor.chain().focus().toggleBold().run()}
                aria-label="Kalın"
              >
                <Bold className="h-4 w-4" />
              </Toggle>
              <Toggle
                size="sm"
                pressed={editor.isActive("italic")}
                onPressedChange={() => editor.chain().focus().toggleItalic().run()}
                aria-label="İtalik"
              >
                <Italic className="h-4 w-4" />
              </Toggle>
              <Toggle
                size="sm"
                pressed={editor.isActive("underline")}
                onPressedChange={() => editor.chain().focus().toggleUnderline().run()}
                aria-label="Altı çizili"
              >
                <UnderlineIcon className="h-4 w-4" />
              </Toggle>
              
              <Separator orientation="vertical" className="h-6 mx-1" />
              
              <Toggle
                size="sm"
                pressed={editor.isActive("bulletList")}
                onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
                aria-label="Madde listesi"
              >
                <List className="h-4 w-4" />
              </Toggle>
              <Toggle
                size="sm"
                pressed={editor.isActive("orderedList")}
                onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
                aria-label="Numaralı liste"
              >
                <ListOrdered className="h-4 w-4" />
              </Toggle>
              
              <Separator orientation="vertical" className="h-6 mx-1" />
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().undo().run()}
                disabled={!editor.can().undo()}
                className="h-8 w-8 p-0"
              >
                <Undo className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().redo().run()}
                disabled={!editor.can().redo()}
                className="h-8 w-8 p-0"
              >
                <Redo className="h-4 w-4" />
              </Button>
            </div>
          )}
          
          <div 
            className={`border rounded-lg bg-background ${!isReadOnly ? 'rounded-t-none border-t-0' : ''} ${
              isReadOnly ? 'bg-muted/20' : ''
            }`}
          >
            {isReadOnly && (!aboutText || aboutText === "<p></p>") ? (
              <div className="min-h-[150px] p-4 flex items-center justify-center">
                <span className="text-muted-foreground italic">Henüz bilgi eklenmemiş</span>
              </div>
            ) : (
              <EditorContent editor={editor} />
            )}
          </div>
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
