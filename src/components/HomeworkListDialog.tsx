import { useState, useEffect, useCallback, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { AlertDialogTrigger } from "@radix-ui/react-alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Calendar, FileImage, File, Edit2, Trash2, Eye, Download, X, Upload, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { EditHomeworkDialog } from "./EditHomeworkDialog";
import { UploadHomeworkDialog } from "./UploadHomeworkDialog";
import { downloadFileNative } from "@/lib/nativeDownload";
import { getResourceIcon } from "@/lib/resourceUtils";
import { Capacitor } from "@capacitor/core";

interface HomeworkListDialogProps {
  /** Dialog kabuğu olmadan sayfa içinde çizilir (öğrenci panelinde sekme). */
  inline?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  teacherId: string;
  currentUserId: string;
  isTeacher?: boolean;
  /**
   * Kartın dibinde yapışık "Ödev yükle" düğmesi. Yalnızca öğretmen paneli
   * açar; öğrenci panelinin kendi yükleme akışı var ve değişmiyor.
   */
  allowUpload?: boolean;
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
  /** Doluysa satır yüklenmiş dosya değil, ödev olarak verilmiş bir kaynak. */
  resource_id: string | null;
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
    resource_id: string | null;
  }[];
}

interface PreviewState {
  url: string;
  type: 'image' | 'pdf';
}

/** "16 Eyl 14:32" — bu yılın ödevinde yıl yazmaz (önceden "16 Eyl 2026 14:32"). */
function shortDate(iso: string) {
  const d = new Date(iso);
  const pattern = d.getFullYear() === new Date().getFullYear() ? "d MMM HH:mm" : "d MMM yyyy HH:mm";
  return format(d, pattern, { locale: tr });
}

export function HomeworkListDialog({ 
  inline = false,
  open, 
  onOpenChange, 
  studentId, 
  teacherId,
  currentUserId,
  isTeacher = false,
  allowUpload = false,
}: HomeworkListDialogProps) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [homeworks, setHomeworks] = useState<Homework[]>([]);
  const [groupedHomeworks, setGroupedHomeworks] = useState<GroupedHomework[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editHomework, setEditHomework] = useState<Homework | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open || inline) {
      fetchHomeworks();
    }
  }, [open, inline, studentId, teacherId]);

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

  /** Çark hangi öğrenci/öğretmen çifti için çoktan kalktı. */
  const loadedFor = useRef<string | null>(null);

  const fetchHomeworks = async () => {
    const listKey = `${studentId}:${teacherId}`;
    try {
      // Çark yalnızca ilk okumada. Silme, düzenleme ve yüklemeden sonraki
      // okumalarda liste yerinde kalır — her seferinde çarka dönüp geri
      // gelmesi kartı zıplatıyordu.
      if (loadedFor.current !== listKey) setLoading(true);
      const { data, error } = await supabase
        .from('homework_submissions')
        .select('*')
        .eq('student_id', studentId)
        .eq('teacher_id', teacherId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      loadedFor.current = listKey;
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
        // Dosyasız ödev boş `file_url` ile yazılır; çizilecek dosyası yok.
        if (!hw.file_url) return;
        grouped[hw.batch_id].files.push({
          id: hw.id,
          file_url: hw.file_url,
          file_type: hw.file_type,
          file_name: hw.file_name,
          resource_id: hw.resource_id,
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

  const body = (
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
                      {/* Eskiden `pb-10`: altta mutlak konumlu "Öğrenci/Öğretmen"
                          rozetine yer açmak için her kartta 40px boş satır.
                          Telefonda da düzenle/sil başlığın altına iniyordu.
                          Şimdi eylemler başlığın yanında, yükleyen ve tarih
                          tek düz satırda — renk kodu (kenar çizgisi) zaten
                          kimin yüklediğini söylüyor. */}
                      <CardContent className="p-3 sm:p-3.5">
                        <div className={`flex items-start gap-2 ${group.files.length > 0 ? "mb-2" : ""}`}>
                          <div className="min-w-0 flex-1 overflow-hidden">
                            <h4 className="break-words text-sm font-semibold leading-snug">{group.title}</h4>
                            {group.description && (
                              <p className="mt-0.5 break-words text-[13px] text-muted-foreground">
                                {group.description}
                              </p>
                            )}
                            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3 flex-shrink-0" aria-hidden />
                              <span>{shortDate(group.created_at)}</span>
                              <span aria-hidden>·</span>
                              <span
                                className={`font-semibold ${uploadedByStudent ? "text-red-700 dark:text-red-400" : "text-blue-700 dark:text-blue-400"}`}
                              >
                                {uploadedByStudent ? "Öğrenci" : "Öğretmen"}
                              </span>
                            </p>
                          </div>
                          <div className="-mr-1 -mt-1 flex flex-shrink-0 items-center">
                            {canEdit(group) && (
                              <>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8"
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
                                      className="h-8 w-8 text-destructive hover:text-destructive"
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
                        {group.files.length > 0 && (
                        <div className="space-y-1.5 overflow-hidden">
                          {group.files.map((file) =>
                            file.resource_id ? (
                              /* Ödev olarak verilmiş kaynak: depoda dosyası yok,
                                 kaynağın kendi bağlantısı açılır. Adı başlıkta
                                 yazıyor, burada tekrar edilmez. */
                              <a
                                key={file.id}
                                href={file.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex min-h-[40px] items-center gap-2 overflow-hidden rounded border bg-background/50 px-2 py-1 text-xs font-semibold sm:text-sm"
                              >
                                <span className="flex-shrink-0">
                                  {getResourceIcon(file.file_type.replace("resource/", ""), "h-5 w-5")}
                                </span>
                                <span className="min-w-0 flex-1 truncate">Kaynağı aç</span>
                                <ExternalLink className="mr-2 h-4 w-4 flex-shrink-0" aria-hidden />
                              </a>
                            ) : (
                            <div
                              key={file.id}
                              className="flex items-center gap-2 overflow-hidden rounded border bg-background/50 px-2 py-1"
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
                            ),
                          )}
                        </div>
                        )}

                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
  );

  return (
    <>
      {inline ? (
        body
      ) : (
        <Dialog open={open} onOpenChange={onOpenChange}>
          {/* animateHeight: yükleniyor → liste geçişinde kart zıplamasın, büyüsün. */}
          <DialogContent size="lg" animateHeight>
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>Ödevler</DialogTitle>
              {/* "Tüm ödevleri görüntüleyin" görünür bir cümleydi ve başlığın
                  söylediğini tekrar ediyordu; yalnızca ekran okuyucuya kaldı. */}
              <DialogDescription className="sr-only">Öğrencinin ödevleri</DialogDescription>
            </DialogHeader>
            {body}
            {allowUpload && (
              /* Yükleme listenin dibinde, kaydırırken de elin altında
                 (.ewd-sheet-foot yapışık). Eskiden öğrenci kartında
                 "Ödevler"in yanında ayrı bir düğmeydi. */
              <DialogFooter>
                <button
                  type="button"
                  className="pnl-btn pnl-btn--purple pnl-btn--block"
                  onClick={() => setUploadOpen(true)}
                >
                  <Upload className="h-4 w-4" aria-hidden />
                  Ödev yükle
                </button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>
      )}

      {allowUpload && uploadOpen && (
        <UploadHomeworkDialog
          open
          onOpenChange={setUploadOpen}
          studentId={studentId}
          teacherId={teacherId}
          uploadedByUserId={currentUserId}
          onSuccess={() => {
            setUploadOpen(false);
            // Liste açık duruyor — yeni ödev hemen altında görünsün.
            fetchHomeworks();
          }}
        />
      )}

      {/* Fullscreen preview — proper Dialog with scroll-lock and focus-trap */}
      <Dialog open={!!preview} onOpenChange={(isOpen) => { if (!isOpen) closePreview(); }}>
        <DialogContent
          bare
          className="fixed inset-0 left-0 top-0 h-screen w-screen border-0 bg-black/95 p-0 z-[200]"
          style={{ transform: 'none' }}
          onInteractOutside={(e) => e.preventDefault()}
        >
          {/* Hidden title for accessibility */}
          <DialogTitle className="sr-only">Dosya Önizleme</DialogTitle>
          <DialogDescription className="sr-only">Dosya önizleme görünümü</DialogDescription>

          {/* Close button — always on top, always clickable */}
          <button
            type="button"
            className="absolute top-10 right-4 z-[210] w-12 h-12 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-white/20 active:bg-white/30 transition-colors"
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
