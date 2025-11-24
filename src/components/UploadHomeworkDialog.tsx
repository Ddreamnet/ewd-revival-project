import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, X } from "lucide-react";

interface UploadHomeworkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  teacherId: string;
  onSuccess?: () => void;
}

export function UploadHomeworkDialog({ 
  open, 
  onOpenChange, 
  studentId, 
  teacherId,
  onSuccess 
}: UploadHomeworkDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const acceptedFileTypes = "image/jpeg,image/jpg,image/png,image/webp,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Check file size (max 10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast({
          title: "Hata",
          description: "Dosya boyutu en fazla 10MB olabilir",
          variant: "destructive",
        });
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast({
        title: "Hata",
        description: "Ödev başlığı zorunludur",
        variant: "destructive",
      });
      return;
    }

    if (!file) {
      toast({
        title: "Hata",
        description: "Lütfen bir dosya seçin",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      // Upload file to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${studentId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('homework-files')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('homework-files')
        .getPublicUrl(filePath);

      // Create homework submission record
      const { error: insertError } = await supabase
        .from('homework_submissions')
        .insert({
          student_id: studentId,
          teacher_id: teacherId,
          title: title.trim(),
          description: description.trim() || null,
          file_url: publicUrl,
          file_type: file.type,
          file_name: file.name,
        });

      if (insertError) throw insertError;

      toast({
        title: "Başarılı",
        description: "Ödev başarıyla yüklendi",
      });

      // Reset form
      setTitle("");
      setDescription("");
      setFile(null);
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Hata",
        description: error.message || "Ödev yüklenemedi",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Ödev Yükle</DialogTitle>
          <DialogDescription>
            Ödevinizi başlık, açıklama ve dosya ile yükleyin
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Ödev Başlığı *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Örn: İngilizce Kompozisyon"
              disabled={uploading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Açıklama</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ödev hakkında ek bilgiler..."
              rows={3}
              disabled={uploading}
            />
          </div>

          <div className="space-y-2">
            <Label>Dosya *</Label>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept={acceptedFileTypes}
                onChange={handleFileChange}
                disabled={uploading}
                className="cursor-pointer"
              />
              {file && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setFile(null)}
                  disabled={uploading}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            {file && (
              <p className="text-sm text-muted-foreground">
                Seçili dosya: {file.name}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Desteklenen formatlar: JPG, PNG, WEBP, PDF, DOCX (Maks. 10MB)
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={uploading}
          >
            İptal
          </Button>
          <Button onClick={handleSubmit} disabled={uploading}>
            {uploading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2" />
                Yükleniyor...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Yükle
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}