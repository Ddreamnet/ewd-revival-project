import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, X, Plus, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface HomeworkItem {
  id: string;
  title: string;
  description: string;
  file: File | null;
}

interface UploadHomeworkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  teacherId: string;
  onSuccess?: () => void;
  uploadedByUserId?: string; // Kim yüklüyor (öğrenci veya öğretmen)
}

export function UploadHomeworkDialog({ 
  open, 
  onOpenChange, 
  studentId, 
  teacherId,
  uploadedByUserId,
  onSuccess 
}: UploadHomeworkDialogProps) {
  const [homeworks, setHomeworks] = useState<HomeworkItem[]>([
    { id: crypto.randomUUID(), title: "", description: "", file: null }
  ]);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const acceptedFileTypes = "image/jpeg,image/jpg,image/png,image/webp,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  const addHomework = () => {
    setHomeworks([...homeworks, { id: crypto.randomUUID(), title: "", description: "", file: null }]);
  };

  const removeHomework = (id: string) => {
    if (homeworks.length === 1) {
      toast({
        title: "Uyarı",
        description: "En az bir ödev olmalıdır",
        variant: "destructive",
      });
      return;
    }
    setHomeworks(homeworks.filter(hw => hw.id !== id));
  };

  const updateHomework = (id: string, field: keyof HomeworkItem, value: string | File | null) => {
    setHomeworks(homeworks.map(hw => 
      hw.id === id ? { ...hw, [field]: value } : hw
    ));
  };

  const handleFileChange = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
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
      updateHomework(id, 'file', selectedFile);
    }
  };

  const handleSubmit = async () => {
    // Validate all homeworks
    for (const hw of homeworks) {
      if (!hw.title.trim()) {
        toast({
          title: "Hata",
          description: "Tüm ödevlerin başlığı zorunludur",
          variant: "destructive",
        });
        return;
      }
      if (!hw.file) {
        toast({
          title: "Hata",
          description: "Tüm ödevler için dosya seçilmelidir",
          variant: "destructive",
        });
        return;
      }
    }

    setUploading(true);

    try {
      // Upload all homeworks
      for (const hw of homeworks) {
        if (!hw.file) continue;

        // Upload file to storage
        const fileExt = hw.file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const uploaderId = uploadedByUserId || studentId;
        const filePath = `${studentId}/${uploaderId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('homework-files')
          .upload(filePath, hw.file);

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
            title: hw.title.trim(),
            description: hw.description.trim() || null,
            file_url: publicUrl,
            file_type: hw.file.type,
            file_name: hw.file.name,
            uploaded_by_user_id: uploadedByUserId || studentId,
          });

        if (insertError) throw insertError;
      }

      toast({
        title: "Başarılı",
        description: `${homeworks.length} ödev başarıyla yüklendi`,
      });

      // Reset form
      setHomeworks([{ id: crypto.randomUUID(), title: "", description: "", file: null }]);
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Hata",
        description: error.message || "Ödevler yüklenemedi",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Ödev Yükle</DialogTitle>
          <DialogDescription>
            Bir veya birden fazla ödev yükleyebilirsiniz
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4 py-4">
            {homeworks.map((homework, index) => (
              <Card key={homework.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-sm">Ödev #{index + 1}</h4>
                    {homeworks.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeHomework(homework.id)}
                        disabled={uploading}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Ödev Başlığı *</Label>
                    <Input
                      value={homework.title}
                      onChange={(e) => updateHomework(homework.id, 'title', e.target.value)}
                      placeholder="Örn: İngilizce Kompozisyon"
                      disabled={uploading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Açıklama</Label>
                    <Textarea
                      value={homework.description}
                      onChange={(e) => updateHomework(homework.id, 'description', e.target.value)}
                      placeholder="Ödev hakkında ek bilgiler..."
                      rows={2}
                      disabled={uploading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Dosya *</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="file"
                        accept={acceptedFileTypes}
                        onChange={(e) => handleFileChange(homework.id, e)}
                        disabled={uploading}
                        className="cursor-pointer"
                      />
                      {homework.file && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => updateHomework(homework.id, 'file', null)}
                          disabled={uploading}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    {homework.file && (
                      <p className="text-sm text-muted-foreground">
                        Seçili: {homework.file.name}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}

            <Button
              type="button"
              variant="outline"
              onClick={addHomework}
              disabled={uploading}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Daha Fazla Ödev Ekle
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Desteklenen formatlar: JPG, PNG, WEBP, PDF, DOCX (Maks. 10MB)
            </p>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setHomeworks([{ id: crypto.randomUUID(), title: "", description: "", file: null }]);
              onOpenChange(false);
            }}
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
                {homeworks.length > 1 ? `${homeworks.length} Ödevi Yükle` : 'Yükle'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}