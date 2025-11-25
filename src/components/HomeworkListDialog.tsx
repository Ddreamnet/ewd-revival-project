import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { AlertDialogTrigger } from "@radix-ui/react-alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Calendar, Download, FileImage, File, Edit2, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { EditHomeworkDialog } from "./EditHomeworkDialog";

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
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchHomeworks();
    }
  }, [open, studentId, teacherId]);

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

      // Group homeworks by batch_id
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

      // Sort by created_at descending
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

  const handleDownload = async (fileUrl: string, fileName: string) => {
    try {
      // Extract file path from public URL
      const urlParts = fileUrl.split('/homework-files/');
      if (urlParts.length < 2) {
        throw new Error("Invalid file URL");
      }
      // Decode the path to handle special characters
      const filePath = decodeURIComponent(urlParts[1]);

      const { data, error } = await supabase.storage
        .from('homework-files')
        .download(filePath);

      if (error) throw error;

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
        description: "Dosya indirilemedi",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (batchId: string) => {
    try {
      const batchHomeworks = homeworks.filter(h => h.batch_id === batchId);
      
      // Delete files from storage
      const filePaths = batchHomeworks
        .map(h => h.file_url.split('/homework-files/')[1])
        .filter(Boolean)
        .map(decodeURIComponent);
      
      if (filePaths.length > 0) {
        await supabase.storage.from('homework-files').remove(filePaths);
      }

      // Delete records from database
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
    // Sadece yükleyen kişi düzenleyebilir/silebilir
    return group.uploaded_by_user_id === currentUserId;
  };

  const isUploadedByStudent = (group: GroupedHomework) => {
    // uploaded_by_user_id student_id'ye eşitse öğrenci yükledi
    return group.uploaded_by_user_id === group.student_id;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ödevler</DialogTitle>
            <DialogDescription>
              Tüm ödevleri görüntüleyin
            </DialogDescription>
          </DialogHeader>

          <div className="h-[500px]">
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
              <div className="flex flex-col gap-3">
                {groupedHomeworks.map((group) => {
                  const uploadedByStudent = isUploadedByStudent(group);
                  const cardColorClass = uploadedByStudent 
                    ? "border-l-4 border-l-red-500 bg-red-50 dark:bg-red-950/20" 
                    : "border-l-4 border-l-blue-500 bg-blue-50 dark:bg-blue-950/20";
                  
                  return (
                    <Card key={group.batch_id} className={cardColorClass}>
                      <CardContent className="p-4 relative pb-8">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm mb-1">{group.title}</h4>
                            {group.description && (
                              <p className="text-sm text-muted-foreground mb-2">
                                {group.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(group.created_at), "dd MMM yyyy HH:mm", { locale: tr })}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
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
                        <div className="space-y-2">
                          {group.files.map((file) => (
                            <div
                              key={file.id}
                              className="flex items-center gap-2 bg-background/50 p-2 rounded border"
                            >
                              {getFileIcon(file.file_type)}
                              <span className="text-sm flex-1 truncate">{file.file_name}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDownload(file.file_url, file.file_name)}
                                title="İndir"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>

                        <Badge 
                          variant="outline" 
                          className={`absolute bottom-2 right-2 text-xs ${uploadedByStudent ? "text-red-700 border-red-300" : "text-blue-700 border-blue-300"}`}
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