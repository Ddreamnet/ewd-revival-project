import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Calendar, Download, FileImage, File } from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

interface HomeworkListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
}

interface Homework {
  id: string;
  title: string;
  description: string | null;
  file_url: string;
  file_type: string;
  file_name: string;
  created_at: string;
}

export function HomeworkListDialog({ open, onOpenChange, studentId }: HomeworkListDialogProps) {
  const [homeworks, setHomeworks] = useState<Homework[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchHomeworks();
    }
  }, [open, studentId]);

  const fetchHomeworks = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('homework_submissions')
        .select('*')
        .eq('student_id', studentId)
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
      return <FileImage className="h-5 w-5 text-primary" />;
    } else if (fileType === 'application/pdf') {
      return <FileText className="h-5 w-5 text-red-500" />;
    } else {
      return <File className="h-5 w-5 text-blue-500" />;
    }
  };

  const handleDownload = async (homework: Homework) => {
    try {
      // Extract the file path from the public URL
      const urlParts = homework.file_url.split('/homework-files/');
      if (urlParts.length < 2) {
        throw new Error("Invalid file URL");
      }
      const filePath = urlParts[1];

      const { data, error } = await supabase.storage
        .from('homework-files')
        .download(filePath);

      if (error) throw error;

      // Create download link
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ödevlerim</DialogTitle>
          <DialogDescription>
            Yüklediğiniz tüm ödevleri görüntüleyin
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
              <p className="text-muted-foreground">Henüz ödev yüklemediniz</p>
            </div>
          ) : (
            homeworks.map((homework) => (
              <Card key={homework.id} className="border-l-4 border-l-primary">
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
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">
                          <Calendar className="h-3 w-3 mr-1" />
                          {format(new Date(homework.created_at), "dd MMM yyyy", { locale: tr })}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {homework.file_name}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownload(homework)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}