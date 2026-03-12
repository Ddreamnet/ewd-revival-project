import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, X, Plus, ImageIcon, FolderOpen } from "lucide-react";
import { pickImageNative, isNativePlatform } from "@/lib/nativeCamera";
import { Capacitor } from "@capacitor/core";
import { CameraSource } from "@capacitor/camera";

interface UploadHomeworkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  teacherId: string;
  onSuccess?: () => void;
  uploadedByUserId?: string;
}


export function UploadHomeworkDialog({ 
  open, 
  onOpenChange, 
  studentId, 
  teacherId,
  uploadedByUserId,
  onSuccess 
}: UploadHomeworkDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const acceptedFileTypes = "image/jpeg,image/jpg,image/png,image/webp,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles) {
      const validFiles: File[] = [];
      
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        if (file.size > 10 * 1024 * 1024) {
          toast({
            title: "Hata",
            description: `${file.name} boyutu en fazla 10MB olabilir`,
            variant: "destructive",
          });
          continue;
        }
        validFiles.push(file);
      }
      
      setFiles(prev => [...prev, ...validFiles]);
    }
    
    // Reset input to allow selecting same file again
    e.target.value = '';
  };

  /** Android fallback: pick image via native camera plugin */
  const handleAndroidCameraOption = async (source: CameraSource) => {
    setShowAndroidPicker(false);
    try {
      const file = await pickImageNative(source);
      if (file) {
        setFiles(prev => [...prev, file]);
      }
    } catch (error: any) {
      toast({
        title: "Hata",
        description: "Fotoğraf alınamadı. Lütfen kamera izinlerini kontrol edin.",
        variant: "destructive",
      });
    }
  };

  /** Main file select button handler — platform-aware */
  const handleFileSelectClick = () => {
    // Android fallback: show 3-option picker because WebView file input
    // doesn't offer camera option on Android
    if (Capacitor.getPlatform() === "android") {
      setShowAndroidPicker(true);
      return;
    }
    // Web + iOS: system file chooser (iOS shows camera option natively
    // when Info.plist permissions are configured)
    fileInputRef.current?.click();
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
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

    if (files.length === 0) {
      toast({
        title: "Hata",
        description: "Lütfen en az bir dosya seçin",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      const batchId = crypto.randomUUID();
      const uploaderId = uploadedByUserId || studentId;
      const submissions = [];

      for (const file of files) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${studentId}/${uploaderId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('homework-files')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('homework-files')
          .getPublicUrl(filePath);

        submissions.push({
          batch_id: batchId,
          student_id: studentId,
          teacher_id: teacherId,
          title: title.trim(),
          description: description.trim() || null,
          file_url: publicUrl,
          file_type: file.type,
          file_name: file.name,
          uploaded_by_user_id: uploaderId,
        });
      }

      const { error: insertError } = await supabase
        .from('homework_submissions')
        .insert(submissions);

      if (insertError) throw insertError;

      toast({
        title: "Başarılı",
        description: `${files.length} dosya başarıyla yüklendi`,
      });

      setTitle("");
      setDescription("");
      setFiles([]);
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
    <Dialog open={open} onOpenChange={(v) => { if (!v) setShowAndroidPicker(false); onOpenChange(v); }}>
      <DialogContent className="w-[calc(100%-1rem)] sm:max-w-[500px] max-h-[90dvh] overflow-y-auto">
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
              className="max-h-[120px] overflow-y-auto"
            />
          </div>

          <div className="space-y-2">
            <Label>Dosyalar *</Label>
            
            {/* Hidden native file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept={acceptedFileTypes}
              onChange={handleFileChange}
              disabled={uploading}
              multiple
              className="hidden"
            />

            {/* Single file select button */}
            <Button
              type="button"
              variant="outline"
              onClick={handleFileSelectClick}
              disabled={uploading}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Dosya Seç
            </Button>

            {/* Android-only 3-option fallback picker */}
            {showAndroidPicker && (
              <div className="flex flex-col gap-2 p-3 rounded-lg border bg-muted/50 animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleAndroidCameraOption(CameraSource.Camera)}
                  disabled={uploading}
                  className="justify-start"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Fotoğraf Çek
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleAndroidCameraOption(CameraSource.Photos)}
                  disabled={uploading}
                  className="justify-start"
                >
                  <ImageIcon className="h-4 w-4 mr-2" />
                  Galeriden Seç
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => { setShowAndroidPicker(false); fileInputRef.current?.click(); }}
                  disabled={uploading}
                  className="justify-start"
                >
                  <FolderOpen className="h-4 w-4 mr-2" />
                  Dosya Seç (PDF, DOCX...)
                </Button>
              </div>
            )}

            {files.length > 0 && (
              <div className="space-y-2">
                {files.map((file, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-2 rounded min-w-0">
                    <span className="flex-1 truncate min-w-0">{file.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 flex-shrink-0"
                      onClick={() => removeFile(index)}
                      disabled={uploading}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
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
