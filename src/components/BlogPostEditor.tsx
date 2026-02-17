import { useCallback, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Youtube from "@tiptap/extension-youtube";
import Placeholder from "@tiptap/extension-placeholder";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Bold, Italic, Underline as UnderlineIcon, Heading1, Heading2, Heading3,
  List, ListOrdered, LinkIcon, ImageIcon, YoutubeIcon, Palette, Quote,
} from "lucide-react";
import { useState } from "react";

interface BlogPostEditorProps {
  content: string;
  onChange: (html: string) => void;
}

const COLORS = [
  "#000000", "#374151", "#991b1b", "#92400e", "#065f46",
  "#1e40af", "#5b21b6", "#9d174d", "#dc2626", "#ea580c",
  "#16a34a", "#2563eb", "#7c3aed", "#db2777",
];

export function BlogPostEditor({ content, onChange }: BlogPostEditorProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      TextStyle,
      Color,
      Image.configure({ inline: false, allowBase64: false }),
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" } }),
      Youtube.configure({ width: 640, height: 360, nocookie: true }),
      Placeholder.configure({ placeholder: "Blog yazınızı buraya yazın..." }),
    ],
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: "min-h-[300px] p-4 focus:outline-none prose prose-sm max-w-none",
      },
    },
  });

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;

    const ext = file.name.split(".").pop();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error } = await supabase.storage.from("blog-media").upload(path, file);
    if (error) {
      toast({ title: "Hata", description: "Görsel yüklenemedi: " + error.message, variant: "destructive" });
      return;
    }

    const { data: urlData } = supabase.storage.from("blog-media").getPublicUrl(path);
    editor.chain().focus().setImage({ src: urlData.publicUrl }).run();
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [editor, toast]);

  const addLink = useCallback(() => {
    if (!editor || !linkUrl) return;
    editor.chain().focus().setLink({ href: linkUrl }).run();
    setLinkUrl("");
  }, [editor, linkUrl]);

  const addYoutube = useCallback(() => {
    if (!editor || !youtubeUrl) return;
    editor.commands.setYoutubeVideo({ src: youtubeUrl });
    setYoutubeUrl("");
  }, [editor, youtubeUrl]);

  if (!editor) return null;

  const ToolBtn = ({ onClick, active, children, title }: { onClick: () => void; active?: boolean; children: React.ReactNode; title: string }) => (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      size="icon"
      className="h-8 w-8"
      onClick={onClick}
      title={title}
    >
      {children}
    </Button>
  );

  return (
    <div className="border rounded-lg overflow-hidden bg-background">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-1 p-2 border-b bg-muted/30">
        <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Kalın">
          <Bold className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="İtalik">
          <Italic className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Altı çizili">
          <UnderlineIcon className="h-4 w-4" />
        </ToolBtn>

        <div className="w-px h-8 bg-border mx-1" />

        <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })} title="H1">
          <Heading1 className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="H2">
          <Heading2 className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="H3">
          <Heading3 className="h-4 w-4" />
        </ToolBtn>

        <div className="w-px h-8 bg-border mx-1" />

        <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Madde listesi">
          <List className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Numaralı liste">
          <ListOrdered className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="Alıntı">
          <Quote className="h-4 w-4" />
        </ToolBtn>

        <div className="w-px h-8 bg-border mx-1" />

        {/* Color picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="icon" className="h-8 w-8" title="Renk">
              <Palette className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2">
            <div className="grid grid-cols-7 gap-1">
              {COLORS.map((color) => (
                <button
                  key={color}
                  className="w-6 h-6 rounded-full border border-border hover:scale-110 transition-transform"
                  style={{ backgroundColor: color }}
                  onClick={() => editor.chain().focus().setColor(color).run()}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Link */}
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant={editor.isActive("link") ? "default" : "outline"} size="icon" className="h-8 w-8" title="Link">
              <LinkIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3">
            <div className="flex gap-2">
              <Input placeholder="https://..." value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} className="h-8 text-sm" />
              <Button size="sm" className="h-8" onClick={addLink}>Ekle</Button>
            </div>
          </PopoverContent>
        </Popover>

        {/* Image upload */}
        <ToolBtn onClick={() => fileInputRef.current?.click()} title="Görsel ekle">
          <ImageIcon className="h-4 w-4" />
        </ToolBtn>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />

        {/* YouTube */}
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="icon" className="h-8 w-8" title="YouTube video">
              <YoutubeIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-3">
            <div className="flex gap-2">
              <Input placeholder="YouTube URL..." value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} className="h-8 text-sm" />
              <Button size="sm" className="h-8" onClick={addYoutube}>Ekle</Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Editor content */}
      <EditorContent editor={editor} />
    </div>
  );
}
