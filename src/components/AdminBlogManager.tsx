import { useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { BlogPostEditor } from "./BlogPostEditor";
import { useAllBlogPosts, useCreateBlogPost, useUpdateBlogPost, useDeleteBlogPost, generateSlug, type BlogPost } from "@/hooks/useBlogPosts";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Eye, ArrowLeft, ImageIcon } from "lucide-react";

interface AdminBlogManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type View = "list" | "edit";

export function AdminBlogManager({ open, onOpenChange }: AdminBlogManagerProps) {
  const [view, setView] = useState<View>("list");
  const [editingPost, setEditingPost] = useState<Partial<BlogPost> | null>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [slugManual, setSlugManual] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const { data: posts, isLoading } = useAllBlogPosts();
  const createPost = useCreateBlogPost();
  const updatePost = useUpdateBlogPost();
  const deletePost = useDeleteBlogPost();

  const resetForm = () => {
    setTitle(""); setSlug(""); setExcerpt(""); setContent(""); setCoverImageUrl(""); setSlugManual(false);
    setEditingPost(null);
  };

  const startNew = () => {
    resetForm();
    setView("edit");
  };

  const startEdit = (post: BlogPost) => {
    setEditingPost(post);
    setTitle(post.title);
    setSlug(post.slug);
    setExcerpt(post.excerpt || "");
    setContent(post.content || "");
    setCoverImageUrl(post.cover_image_url || "");
    setSlugManual(true);
    setView("edit");
  };

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!slugManual) setSlug(generateSlug(val));
  };

  const handleCoverUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop();
    const path = `covers/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("blog-media").upload(path, file);
    if (error) { toast({ title: "Hata", description: error.message, variant: "destructive" }); return; }
    const { data } = supabase.storage.from("blog-media").getPublicUrl(path);
    setCoverImageUrl(data.publicUrl);
  }, [toast]);

  const save = async (status: "draft" | "published") => {
    if (!title.trim() || !slug.trim()) {
      toast({ title: "Hata", description: "Başlık ve slug zorunludur", variant: "destructive" });
      return;
    }

    const payload = {
      title: title.trim(),
      slug: slug.trim(),
      excerpt: excerpt.trim() || null,
      content: content || null,
      cover_image_url: coverImageUrl || null,
      status,
      published_at: status === "published" ? (editingPost?.published_at || new Date().toISOString()) : null,
    };

    if (editingPost?.id) {
      await updatePost.mutateAsync({ id: editingPost.id, ...payload });
    } else {
      await createPost.mutateAsync(payload);
    }
    setView("list");
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bu yazıyı silmek istediğinize emin misiniz?")) return;
    await deletePost.mutateAsync(id);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setView("list"); resetForm(); } onOpenChange(v); }}>
      <DialogContent className="w-[calc(100%-1rem)] max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {view === "edit" && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setView("list"); resetForm(); }}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            {view === "list" ? "Blog Yönetimi" : editingPost?.id ? "Yazıyı Düzenle" : "Yeni Yazı"}
          </DialogTitle>
        </DialogHeader>

        {view === "list" && (
          <div className="space-y-4">
            <Button onClick={startNew} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" /> Yeni Yazı
            </Button>

            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : !posts?.length ? (
              <p className="text-center text-muted-foreground py-8">Henüz blog yazısı yok.</p>
            ) : (
              <div className="space-y-2">
                {posts.map((post) => (
                  <Card key={post.id} className="p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{post.title}</span>
                        <Badge variant={post.status === "published" ? "default" : "secondary"} className="text-xs shrink-0">
                          {post.status === "published" ? "Yayında" : "Taslak"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">/{post.slug}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {post.status === "published" && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                          <a href={`/blog/${post.slug}`} target="_blank" rel="noopener noreferrer"><Eye className="h-4 w-4" /></a>
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(post)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(post.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {view === "edit" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Başlık *</Label>
                <Input value={title} onChange={(e) => handleTitleChange(e.target.value)} placeholder="Blog yazısı başlığı" />
              </div>
              <div>
                <Label>Slug *</Label>
                <Input value={slug} onChange={(e) => { setSlug(e.target.value); setSlugManual(true); }} placeholder="url-friendly-slug" />
              </div>
            </div>

            <div>
              <Label>Kısa Özet</Label>
              <Textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} placeholder="Blog yazısının kısa özeti..." rows={2} />
            </div>

            <div>
              <Label>Kapak Görseli</Label>
              <div className="flex items-center gap-3 mt-1">
                {coverImageUrl && (
                  <img src={coverImageUrl} alt="Kapak" className="h-20 w-32 object-cover rounded-md border" />
                )}
                <Button type="button" variant="outline" size="sm" onClick={() => coverInputRef.current?.click()}>
                  <ImageIcon className="h-4 w-4 mr-2" /> {coverImageUrl ? "Değiştir" : "Yükle"}
                </Button>
                <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
              </div>
            </div>

            <div>
              <Label>İçerik</Label>
              <div className="mt-1">
                <BlogPostEditor content={content} onChange={setContent} />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2 border-t">
              <Button onClick={() => save("draft")} variant="outline" disabled={createPost.isPending || updatePost.isPending}>
                Taslak Kaydet
              </Button>
              <Button onClick={() => save("published")} disabled={createPost.isPending || updatePost.isPending}>
                {editingPost?.status === "published" ? "Güncelle" : "Yayınla"}
              </Button>
              {editingPost?.id && editingPost.status === "published" && (
                <Button onClick={() => save("draft")} variant="secondary" disabled={updatePost.isPending}>
                  Yayından Kaldır
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
