import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Upload, X } from "lucide-react";

interface AddResourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topicId?: string;
  onResourceAdded?: () => void;
  onAddResource?: (title: string, description: string, resourceType: string, resourceUrl: string) => Promise<void>;
  topicTitle?: string;
}

const resourceTypes = [
  { value: "pdf", label: "PDF Dökümanı" },
  { value: "video", label: "Video" },
  { value: "image", label: "Resim" },
  { value: "link", label: "Web Bağlantısı" },
  { value: "document", label: "Döküman" },
  { value: "other", label: "Diğer" },
];

export function AddResourceDialog({
  open,
  onOpenChange,
  topicId,
  onResourceAdded,
  onAddResource,
  topicTitle,
}: AddResourceDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [webUrl, setWebUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        const file = files[0];
        setSelectedFile(file);

        // Auto-detect resource type based on file extension
        const extension = file.name.split(".").pop()?.toLowerCase();
        if (extension === "pdf") {
          setResourceType("pdf");
        } else if (["mp4", "avi", "mov", "wmv"].includes(extension || "")) {
          setResourceType("video");
        } else if (["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg"].includes(extension || "")) {
          setResourceType("image");
        } else if (["doc", "docx", "txt", "rtf", "pptx", "ppt"].includes(extension || "")) {
          setResourceType("document");
        } else {
          setResourceType("other");
        }

        // Auto-fill title with filename (without extension)
        if (!title) {
          const nameWithoutExtension = file.name.replace(/\.[^/.]+$/, "");
          setTitle(nameWithoutExtension);
        }
      }
    },
    [title],
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);

      // Auto-detect resource type based on file extension
      const extension = file.name.split(".").pop()?.toLowerCase();
      if (extension === "pdf") {
        setResourceType("pdf");
      } else if (["mp4", "avi", "mov", "wmv"].includes(extension || "")) {
        setResourceType("video");
      } else if (["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg"].includes(extension || "")) {
        setResourceType("image");
      } else if (["doc", "docx", "txt", "rtf", "pptx", "ppt"].includes(extension || "")) {
        setResourceType("document");
      } else {
        setResourceType("other");
      }

      // Auto-fill title with filename (without extension)
      if (!title) {
        const nameWithoutExtension = file.name.replace(/\.[^/.]+$/, "");
        setTitle(nameWithoutExtension);
      }
    }
  };

  const uploadFile = async (file: File): Promise<string> => {
    const fileExt = file.name.split(".").pop();
    const fileName = `${topicId || "global"}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage.from("learning-resources").upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from("learning-resources").getPublicUrl(fileName);

    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !resourceType) return;

    // Check if URL is required for web links
    if (resourceType === "link" && !webUrl.trim() && !selectedFile) {
      toast({
        title: "Hata",
        description: "Lütfen web bağlantısı için bir URL sağlayın",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      let resourceUrl = "";

      if (selectedFile) {
        // Upload file to Supabase storage
        resourceUrl = await uploadFile(selectedFile);
      } else if (resourceType === "link" && webUrl.trim()) {
        // Use the provided web URL
        resourceUrl = webUrl.trim();
      } else if (onAddResource) {
        // For global topics, we might not require file upload
        resourceUrl = "placeholder"; // Will be replaced by actual URL in the callback
      }

      if (onAddResource) {
        // Global resources mode
        await onAddResource(title.trim(), description.trim(), resourceType, resourceUrl);
      } else {
        // Student-specific resources mode
        if (!topicId) return;

        // Get the next order index
        const { data: existingResources } = await supabase
          .from("resources")
          .select("order_index")
          .eq("topic_id", topicId)
          .order("order_index", { ascending: false })
          .limit(1);

        const nextOrderIndex =
          existingResources && existingResources.length > 0 ? existingResources[0].order_index + 1 : 0;

        const { error } = await supabase.from("resources").insert({
          topic_id: topicId,
          title: title.trim(),
          description: description.trim() || null,
          resource_type: resourceType,
          resource_url: resourceUrl,
          order_index: nextOrderIndex,
        });

        if (error) throw error;

        toast({
          title: "Başarılı",
          description: "Kaynak başarıyla yüklendi",
        });

        onResourceAdded?.();
      }

      setTitle("");
      setDescription("");
      setResourceType("");
      setWebUrl("");
      setSelectedFile(null);
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
          <DialogTitle>Öğrenme Kaynağı Ekle</DialogTitle>
          <DialogDescription>
            {topicTitle
              ? `"${topicTitle}" konusuna yeni bir öğrenme kaynağı ekleyin.`
              : "Bu konuya yeni bir öğrenme kaynağı ekleyin."}{" "}
            Bu bir PDF, video, bağlantı veya diğer herhangi bir materyal olabilir.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="resource-title">Kaynak Başlığı</Label>
            <Input
              id="resource-title"
              placeholder="örn., Sebzeler Kelime Listesi"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="resource-type">Kaynak Türü</Label>
            <Select value={resourceType} onValueChange={setResourceType} required>
              <SelectTrigger>
                <SelectValue placeholder="Kaynak türünü seçin" />
              </SelectTrigger>
              <SelectContent>
                {resourceTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {resourceType === "link" && (
            <div className="space-y-2">
              <Label htmlFor="web-url">Web Bağlantısı URL</Label>
              <Input
                id="web-url"
                type="url"
                placeholder="https://example.com"
                value={webUrl}
                onChange={(e) => setWebUrl(e.target.value)}
                required={resourceType === "link" && !selectedFile}
              />
            </div>
          )}

          {resourceType !== "link" && (
            <div className="space-y-2">
              <Label>Dosya Yükle</Label>
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                  isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25"
                }`}
                onDrop={handleDrop}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
              >
                {selectedFile ? (
                  <div className="flex items-center justify-between p-2 bg-muted rounded">
                    <span className="text-sm truncate">{selectedFile.name}</span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedFile(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Dosyanızı buraya sürükleyip bırakın veya göz atmak için tıklayın
                      </p>
                      <input
                        type="file"
                        id="file-upload"
                        className="hidden"
                        onChange={handleFileSelect}
                        accept=".pdf,.doc,.docx,.pptx,.ppt,.txt,.mp4,.avi,.mov,.wmv,.jpg,.jpeg,.png,.gif,.bmp,.webp,.svg"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById("file-upload")?.click()}
                      >
                        Dosya Seç
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="resource-description">Açıklama (Opsiyonel)</Label>
            <Textarea
              id="resource-description"
              placeholder="Bu kaynağın kısa açıklaması..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              İptal
            </Button>
            <Button
              type="submit"
              disabled={
                isLoading ||
                !title.trim() ||
                !resourceType ||
                (!selectedFile && !onAddResource && !(resourceType === "link" && webUrl.trim()))
              }
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {resourceType === "link" && !selectedFile ? "Bağlantı Ekle" : "Kaynak Yükle"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
