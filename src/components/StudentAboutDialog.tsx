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
import { Color } from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import { Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, Undo, Redo, Heading1, Heading2, Heading3, Palette } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface StudentAboutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  studentName: string;
  aboutText: string | null;
  isReadOnly?: boolean;
  onSaved?: () => void;
}

const COLORS = [
  { name: "Varsayılan", value: "inherit" },
  { name: "Kırmızı", value: "#ef4444" },
  { name: "Turuncu", value: "#f97316" },
  { name: "Sarı", value: "#eab308" },
  { name: "Yeşil", value: "#22c55e" },
  { name: "Mavi", value: "#3b82f6" },
  { name: "Mor", value: "#8b5cf6" },
  { name: "Pembe", value: "#ec4899" },
  { name: "Gri", value: "#6b7280" },
];

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
  const [currentAboutText, setCurrentAboutText] = useState<string | null>(aboutText);
  const [loading, setLoading] = useState(false);

  // Diyalog açıldığında veritabanından güncel veriyi çek
  useEffect(() => {
    if (open && studentId) {
      setLoading(true);
      supabase
        .from("students")
        .select("about_text")
        .eq("student_id", studentId)
        .single()
        .then(({ data, error }) => {
          if (!error && data) {
            setCurrentAboutText(data.about_text);
          }
          setLoading(false);
        });
    }
  }, [open, studentId]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      TextStyle,
      Color,
    ],
    content: "",
    editable: !isReadOnly,
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none min-h-[150px] p-4 focus:outline-none",
      },
    },
    onUpdate: ({ editor }) => {
      // Heading'den sonra boş paragraf oluşturulduğunda, heading formatını kaldır
      const { $from } = editor.state.selection;
      const currentNode = $from.parent;
      
      // Eğer boş heading'e Enter ile geçilmişse, paragraph'a dönüştür
      if (currentNode.type.name === 'heading' && currentNode.textContent === '') {
        editor.chain().setParagraph().run();
      }
    },
  });

  useEffect(() => {
    if (editor && open && !loading) {
      editor.commands.setContent(currentAboutText || "");
      editor.setEditable(!isReadOnly);
    }
  }, [currentAboutText, open, editor, isReadOnly, loading]);

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
      await onSaved?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving about text:", error);
      toast.error("Kaydetme sırasında bir hata oluştu");
    } finally {
      setSaving(false);
    }
  };

  const setColor = (color: string) => {
    if (color === "inherit") {
      // Sadece seçili metin için rengi kaldır (unsetMark kullan)
      editor?.chain().focus().unsetMark('textStyle').run();
    } else {
      editor?.chain().focus().setColor(color).run();
    }
  };

  if (!editor) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-primary">📝</span>
            {studentName} Hakkında
          </DialogTitle>
        </DialogHeader>

        <div className="py-2">
          {!isReadOnly && (
            <div className="flex flex-wrap items-center gap-1 p-2 border rounded-t-lg bg-muted/30 border-b-0">
              {/* Headings */}
              <Toggle
                size="sm"
                pressed={editor.isActive("heading", { level: 1 })}
                onPressedChange={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                aria-label="Başlık 1"
                title="Başlık 1"
              >
                <Heading1 className="h-4 w-4" />
              </Toggle>
              <Toggle
                size="sm"
                pressed={editor.isActive("heading", { level: 2 })}
                onPressedChange={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                aria-label="Başlık 2"
                title="Başlık 2"
              >
                <Heading2 className="h-4 w-4" />
              </Toggle>
              <Toggle
                size="sm"
                pressed={editor.isActive("heading", { level: 3 })}
                onPressedChange={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                aria-label="Başlık 3"
                title="Başlık 3"
              >
                <Heading3 className="h-4 w-4" />
              </Toggle>
              
              <Separator orientation="vertical" className="h-6 mx-1" />
              
              {/* Text formatting */}
              <Toggle
                size="sm"
                pressed={editor.isActive("bold")}
                onPressedChange={() => editor.chain().focus().toggleBold().run()}
                aria-label="Kalın"
                title="Kalın"
              >
                <Bold className="h-4 w-4" />
              </Toggle>
              <Toggle
                size="sm"
                pressed={editor.isActive("italic")}
                onPressedChange={() => editor.chain().focus().toggleItalic().run()}
                aria-label="İtalik"
                title="İtalik"
              >
                <Italic className="h-4 w-4" />
              </Toggle>
              <Toggle
                size="sm"
                pressed={editor.isActive("underline")}
                onPressedChange={() => editor.chain().focus().toggleUnderline().run()}
                aria-label="Altı çizili"
                title="Altı çizili"
              >
                <UnderlineIcon className="h-4 w-4" />
              </Toggle>
              
              {/* Color picker */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Yazı rengi">
                    <Palette className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2" align="start">
                  <div className="grid grid-cols-3 gap-1">
                    {COLORS.map((color) => (
                      <button
                        key={color.value}
                        onClick={() => setColor(color.value)}
                        className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted text-sm transition-colors"
                        title={color.name}
                      >
                        <div 
                          className="w-4 h-4 rounded-full border border-border"
                          style={{ backgroundColor: color.value === "inherit" ? "transparent" : color.value }}
                        />
                        <span className="text-xs">{color.name}</span>
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              
              <Separator orientation="vertical" className="h-6 mx-1" />
              
              {/* Lists */}
              <Toggle
                size="sm"
                pressed={editor.isActive("bulletList")}
                onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
                aria-label="Madde listesi"
                title="Madde listesi"
              >
                <List className="h-4 w-4" />
              </Toggle>
              <Toggle
                size="sm"
                pressed={editor.isActive("orderedList")}
                onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
                aria-label="Numaralı liste"
                title="Numaralı liste"
              >
                <ListOrdered className="h-4 w-4" />
              </Toggle>
              
              <Separator orientation="vertical" className="h-6 mx-1" />
              
              {/* Undo/Redo */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().undo().run()}
                disabled={!editor.can().undo()}
                className="h-8 w-8 p-0"
                title="Geri al"
              >
                <Undo className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().redo().run()}
                disabled={!editor.can().redo()}
                className="h-8 w-8 p-0"
                title="İleri al"
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
