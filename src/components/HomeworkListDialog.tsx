import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Calendar, Download, FileImage, File, Edit, Trash2 } from "lucide-react";
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

  const handleDownload = async (homework: Homework) => {
    try {
      // Extract file path from public URL
      const urlParts = homework.file_url.split('/homework-files/');
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
      a.download = homework.file_name;
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

  const handleDelete = async (homeworkId: string, fileUrl: string) => {
    try {
      // Delete file from storage
      const urlParts = fileUrl.split('/homework-files/');
      if (urlParts.length >= 2) {
        // Decode the path to handle special characters
        const filePath = decodeURIComponent(urlParts[1]);
        await supabase.storage
          .from('homework-files')
          .remove([filePath]);
      }

      // Delete record from database
      const { error } = await supabase
        .from('homework_submissions')
        .delete()
        .eq('id', homeworkId);

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

  const canEdit = (homework: Homework) => {
    if (isTeacher) {
      return homework.teacher_id === currentUserId;
    } else {
      return homework.student_id === currentUserId;
    }
  };

  const isUploadedByStudent = (homework: Homework) => {
    // uploaded_by_user_id student_id'ye eşitse öğrenci yükledi
    return homework.uploaded_by_user_id === homework.student_id;
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

          <div className="space-y-3 py-4">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : homeworks.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">Henüz ödev yok</p>
              </div>
            ) : (
              homeworks.map((homework) => {
                const uploadedByStudent = isUploadedByStudent(homework);
                const cardColorClass = uploadedByStudent 
                  ? "border-l-4 border-l-red-500 bg-red-50 dark:bg-red-950/20" 
                  : "border-l-4 border-l-blue-500 bg-blue-50 dark:bg-blue-950/20";
                
                return (
                  <Card key={homework.id} className={cardColorClass}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="mt-1">
                          {getFileIcon(homework.file_type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm mb-1">{homework.title}</h4>
                          {homework.description && (
                            <p className="text-sm text-muted-foreground mb-2">
                              {homework.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            <Badge variant="outline" className="text-xs">
                              <Calendar className="h-3 w-3 mr-1" />
                              {format(new Date(homework.created_at), "dd MMM yyyy", { locale: tr })}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {homework.file_name}
                            </Badge>
                            <Badge 
                              variant="outline" 
                              className={uploadedByStudent ? "text-red-700 border-red-300" : "text-blue-700 border-blue-300"}
                            >
                              {uploadedByStudent ? "Öğrenci" : "Öğretmen"}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDownload(homework)}
                            >
                              <Download className="h-4 w-4 mr-1" />
                              İndir
                            </Button>
                            {canEdit(homework) && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setEditHomework(homework)}
                                >
                                  <Edit className="h-4 w-4 mr-1" />
                                  Düzenle
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => setDeleteId(homework.id)}
                                >
                                  <Trash2 className="h-4 w-4 mr-1" />
                                  Sil
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ödevi Sil</AlertDialogTitle>
            <AlertDialogDescription>
              Bu ödevi silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const homework = homeworks.find(h => h.id === deleteId);
                if (homework) handleDelete(homework.id, homework.file_url);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog */}
      {editHomework && (
        <EditHomeworkDialog
          open={!!editHomework}
          onOpenChange={(open) => !open && setEditHomework(null)}
          homeworkId={editHomework.id}
          currentTitle={editHomework.title}
          currentDescription={editHomework.description}
          onSuccess={fetchHomeworks}
        />
      )}
    </>
  );
}