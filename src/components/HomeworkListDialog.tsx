import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { AlertDialogTrigger } from "@radix-ui/react-alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Calendar, FileImage, File, Edit2, Trash2, Eye, Download, X } from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { EditHomeworkDialog } from "./EditHomeworkDialog";
import { downloadFileNative } from "@/lib/nativeDownload";
import { Capacitor } from "@capacitor/core";

interface HomeworkListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  teacherId: string;
  currentUserId: string;
  isTeacher?: boolean;
}

interface Homework {
  id: string;
  student_id: string;
  teacher_id: string;
  title: string;
  description: string | null;
  file_url: string;
  file_type: string;
  file_name: string;
  created_at: string;
  uploaded_by_user_id: string;
  batch_id: string;
}

interface GroupedHomework {
  batch_id: string;
  title: string;
  description: string | null;
  created_at: string;
  uploaded_by_user_id: string;
  student_id: string;
  files: {
    id: string;
    file_url: string;
    file_type: string;
    file_name: string;
  }[];
}

interface PreviewState {
  url: string;
  type: 'image' | 'pdf';
}

export function HomeworkListDialog({ 
  open, 
  onOpenChange, 
  studentId, 
  teacherId,
  currentUserId,
  isTeacher = false 
}: HomeworkListDialogProps) {
  const [homeworks, setHomeworks] = useState<Homework[]>([]);
  const [groupedHomeworks, setGroupedHomeworks] = useState<GroupedHomework[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editHomework, setEditHomework] = useState<Homework | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchHomeworks();
    }
  }, [open, studentId, teacherId]);

  // Cleanup object URL on unmount or when preview changes
  useEffect(() => {
    return () => {
      if (preview?.url) {
        URL.revokeObjectURL(preview.url);
      }
    };
  }, [preview?.url]);

  // Lock body scroll when preview is open
  useEffect(() => {
    if (preview) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [preview]);

  const fetchHomeworks = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('homework_submissions')
        .select('*')
        .eq('student_id', studentId)
        .eq('teacher_id', teacherId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setHomeworks(data || []);

      const grouped: { [key: string]: GroupedHomework } = {};
      
      (data || []).forEach((hw: Homework) => {
        if (!grouped[hw.batch_id]) {
          grouped[hw.batch_id] = {
            batch_id: hw.batch_id,
            title: hw.title,
            description: hw.description,
            created_at: hw.created_at,
            uploaded_by_user_id: hw.uploaded_by_user_id,
            student_id: hw.student_id,
            files: [],
          };
        }
        grouped[hw.batch_id].files.push({
          id: hw.id,
          file_url: hw.file_url,
          file_type: hw.file_type,
          file_name: hw.file_name,
        });
      });

      const sortedGroups = Object.values(grouped).sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setGroupedHomeworks(sortedGroups);
    } catch (error: any) {
      toast({
        title: "Hata",
        description: "Ödevler yüklenemedi",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return <FileImage className="h-5 w-5" />;
    } else if (fileType === 'application/pdf') {
      return <FileText className="h-5 w-5" />;
    } else {
      return <File className="h-5 w-5" />;
    }
  };

  const isPreviewable = (fileType: string) => {
    return fileType.startsWith('image/') || fileType === 'application/pdf';
  };

  const handlePreview = async (fileUrl: string, fileType: string) => {
    const urlParts = fileUrl.split('/homework-files/');
    if (urlParts.length < 2 || !urlParts[1]) {
      toast({ title: "Hata", description: "Dosya yolu çözümlenemedi", variant: "destructive" });
      return;
    }
    const filePath = decodeURIComponent(urlParts[1]);

    try {
      const { data, error } = await supabase.storage.from('homework-files').download(filePath);
      if (error || !data) {
        toast({ title: "Hata", description: "Dosya yüklenemedi", variant: "destructive" });
        return;
      }

      const objectUrl = URL.createObjectURL(data);

      if (fileType.startsWith('image/')) {
        setPreview({ url: objectUrl, type: 'image' });
      } else if (fileType === 'application/pdf') {
        if (Capacitor.isNativePlatform()) {
          URL.revokeObjectURL(objectUrl);
          handleSaveShare(fileUrl, filePath.split('/').pop() || 'document.pdf');
          return;
        }
        setPreview({ url: objectUrl, type: 'pdf' });
      }
    } catch {
      toast({ title: "Hata", description: "Dosya önizlemesi açılamadı", variant: "destructive" });
    }
  };

  const closePreview = useCallback(() => {
    setPreview(prev => {
      if (prev?.url) {
        // Defer revoke so React can unmount first
        const u = prev.url;
        setTimeout(() => URL.revokeObjectURL(u), 100);
      }
      return null;
    });
  }, []);

  const handleSaveShare = async (fileUrl: string, fileName: string) => {
    try {
      const urlParts = fileUrl.split('/homework-files/');
      if (urlParts.length < 2) {
        throw new Error("Invalid file URL");
      }
      const filePath = decodeURIComponent(urlParts[1]);

      const { data, error } = await supabase.storage
        .from('homework-files')
        .download(filePath);

      if (error) throw error;

      // Native platform: use Filesystem + Share
      if (Capacitor.isNativePlatform()) {
        const success = await downloadFileNative({
          url: fileUrl,
          fileName,
          blob: data,
        });
        if (!success) {
          toast({
            title: "Hata",
            description: "Dosya hazırlanamadı",
            variant: "destructive",
          });
        }
        return;
      }

      // Web: blob + anchor download
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({
        title: "Hata",
        description: "Dosya hazırlanamadı",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (batchId: string) => {
    try {
      const batchHomeworks = homeworks.filter(h => h.batch_id === batchId);
      
      const filePaths = batchHomeworks
        .map(h => h.file_url.split('/homework-files/')[1])
        .filter(Boolean)
        .map(decodeURIComponent);
      
      if (filePaths.length > 0) {
        await supabase.storage.from('homework-files').remove(filePaths);
      }

      const { error } = await supabase
        .from('homework_submissions')
        .delete()
        .eq('batch_id', batchId);

      if (error) throw error;

      toast({
        title: "Başarılı",
        description: "Ödev silindi",
      });

      fetchHomeworks();
      setDeleteId(null);
    } catch (error: any) {
      toast({
        title: "Hata",
        description: "Ödev silinemedi",
        variant: "destructive",
      });
    }
  };

  const canEdit = (group: GroupedHomework) => {
    return group.uploaded_by_user_id === currentUserId;
  };

  const isUploadedByStudent = (group: GroupedHomework) => {
    return group.uploaded_by_user_id === group.student_id;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[calc(100%-1rem)] sm:max-w-[600px] max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Ödevler</DialogTitle>
            <DialogDescription>
              Tüm ödevleri görüntüleyin
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : groupedHomeworks.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">Henüz ödev yok</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3 pr-1">
                {groupedHomeworks.map((group) => {
                  const uploadedByStudent = isUploadedByStudent(group);
                  const cardColorClass = uploadedByStudent 
                    ? "border-l-4 border-l-red-500 bg-red-50 dark:bg-red-950/20" 
                    : "border-l-4 border-l-blue-500 bg-blue-50 dark:bg-blue-950/20";
                  
                  return (
                    <Card key={group.batch_id} className={cardColorClass}>
                      <CardContent className="p-3 sm:p-4 relative pb-10">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3 mb-3">
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <h4 className="font-medium text-sm mb-1 break-words">{group.title}</h4>
                            {group.description && (
                              <p className="text-sm text-muted-foreground mb-2 break-words">
                                {group.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3 flex-shrink-0" />
                                {format(new Date(group.created_at), "dd MMM yyyy HH:mm", { locale: tr })}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {canEdit(group) && (
                              <>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => {
                                    const firstFile = homeworks.find(h => h.batch_id === group.batch_id);
                                    if (firstFile) setEditHomework(firstFile);
                                  }}
                                  title="Düzenle"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      title="Sil"
                                      className="text-destructive hover:text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Ödevi Sil</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Bu ödevi ve tüm dosyalarını silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>İptal</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleDelete(group.batch_id)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        Sil
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Files list */}
                        <div className="space-y-2 overflow-hidden">
                          {group.files.map((file) => (
                            <div
                              key={file.id}
                              className="flex items-center gap-2 bg-background/50 p-2 rounded border overflow-hidden"
                            >
                              <div className="flex-shrink-0">{getFileIcon(file.file_type)}</div>
                              <span className="text-xs sm:text-sm flex-1 truncate min-w-0" title={file.file_name}>
                                {file.file_name}
                              </span>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                {isPreviewable(file.file_type) && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handlePreview(file.file_url, file.file_type)}
                                    title="Görüntüle"
                                    className="h-8 w-8 p-0"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleSaveShare(file.file_url, file.file_name)}
                                  title="İndir"
                                  className="h-8 w-8 p-0"
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>

                        <Badge 
                          variant="outline" 
                          className={`absolute bottom-2 right-2 text-xs ${uploadedByStudent ? "text-red-700 border-red-300 dark:text-red-400 dark:border-red-800" : "text-blue-700 border-blue-300 dark:text-blue-400 dark:border-blue-800"}`}
                        >
                          {uploadedByStudent ? "Öğrenci" : "Öğretmen"}
                        </Badge>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Fullscreen preview — proper Dialog with scroll-lock and focus-trap */}
      <Dialog open={!!preview} onOpenChange={(isOpen) => { if (!isOpen) closePreview(); }}>
        <DialogContent
          className="fixed inset-0 w-screen h-screen max-w-none max-h-none translate-x-0 translate-y-0 left-0 top-0 p-0 border-0 rounded-none bg-black/95 z-[200] data-[state=open]:slide-in-from-bottom-0 data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100"
          style={{ transform: 'none' }}
          onInteractOutside={(e) => e.preventDefault()}
        >
          {/* Hidden title for accessibility */}
          <DialogTitle className="sr-only">Dosya Önizleme</DialogTitle>
          <DialogDescription className="sr-only">Dosya önizleme görünümü</DialogDescription>

          {/* Close button — always on top, always clickable */}
          <button
            type="button"
            className="absolute top-4 right-4 z-[210] w-12 h-12 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-white/20 active:bg-white/30 transition-colors"
            onClick={closePreview}
            aria-label="Kapat"
          >
            <X className="h-7 w-7" />
          </button>

          {/* Content area */}
          <div className="w-full h-full flex items-center justify-center">
            {preview?.type === 'image' && (
              <img
                src={preview.url}
                className="max-w-full max-h-full object-contain p-4"
                alt="Preview"
              />
            )}
            {preview?.type === 'pdf' && (
              <iframe
                src={preview.url}
                className="w-full h-full border-0"
                title="PDF Preview"
                style={{ pointerEvents: 'auto' }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      {editHomework && (
        <EditHomeworkDialog
          open={!!editHomework}
          onOpenChange={(open) => !open && setEditHomework(null)}
          homeworkId={editHomework.id}
          batchId={editHomework.batch_id}
          currentTitle={editHomework.title}
          currentDescription={editHomework.description}
          onSuccess={fetchHomeworks}
        />
      )}
    </>
  );
}
