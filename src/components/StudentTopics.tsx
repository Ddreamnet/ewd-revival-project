// ============================================================================
// ÖĞRENCİ KONULARI YÖNETİMİ
// ============================================================================
// Bu bileşen öğretmenlerin bir öğrenciye özel konu ve kaynak atamasını,
// global konuları görüntülemesini ve sürükle-bırak ile sıralama yapmasını sağlar.

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  Video,
  Link as LinkIcon,
  Image,
  Upload,
  ClipboardList,
} from "lucide-react";
import { LessonTracker } from "./LessonTracker";
import { UploadHomeworkDialog } from "./UploadHomeworkDialog";
import { HomeworkListDialog } from "./HomeworkListDialog";
import { getResourceIcon } from "@/lib/resourceUtils";
import { useStudentTopics } from "@/hooks/useStudentTopics";
import type { Topic, Resource, Student } from "@/lib/types";

// ============================================================================
// TİPLER
// ============================================================================

interface StudentTopicsProps {
  student: Pick<Student, "id" | "student_id" | "profiles">;
  teacherId: string;
}

// ============================================================================
// ANA BİLEŞEN
// ============================================================================

export function StudentTopics({ student, teacherId }: StudentTopicsProps) {
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [listDialogOpen, setListDialogOpen] = useState(false);
  const { toast } = useToast();

  // Use shared topic fetching hook
  const { allTopics: topics, loading, refetch: fetchTopics } = useStudentTopics(student.student_id);

  // Öğrenci değiştiğinde konuları yeniden getir
  useEffect(() => {
    fetchTopics();
  }, [student.student_id]);

  // ============================================================================
  // KONU YÖNETİMİ FONKSİYONLARI
  // ============================================================================

  /**
   * Bir konuyu aç/kapa
   */
  const toggleTopic = (topicId: string) => {
    const newExpanded = new Set(expandedTopics);
    if (newExpanded.has(topicId)) {
      newExpanded.delete(topicId);
    } else {
      newExpanded.add(topicId);
    }
    setExpandedTopics(newExpanded);
  };

  // ============================================================================
  // KAYNAK YÖNETİMİ FONKSİYONLARI
  // ============================================================================

  /**
   * Bir kaynağın tamamlanma durumunu değiştir
   */
  const toggleResourceCompletion = async (resourceId: string, isCompleted: boolean, isGlobalResource: boolean) => {
    try {
      const { error } = await supabase.from("student_resource_completion").upsert(
        {
          student_id: student.student_id,
          resource_id: resourceId,
          is_completed: !isCompleted,
          completed_at: !isCompleted ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "student_id,resource_id",
        },
      );

      if (error) throw error;

      toast({
        title: "Başarılı",
        description: `Kaynak ${!isCompleted ? "tamamlandı" : "tamamlanmadı olarak işaretlendi"}`,
      });

      fetchTopics();
    } catch (error: any) {
      toast({
        title: "Hata",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  /**
   * Bir konunun tamamlanma durumunu değiştir
   */
  const toggleTopicCompletion = async (topicId: string, isCompleted: boolean, isGlobal: boolean) => {
    try {
      if (isGlobal) {
        // Global konular için tüm kaynaklarını tamamlandı olarak işaretle
        const topic = topics.find(t => t.id === topicId);
        if (!topic) return;

        for (const resource of topic.resources) {
          await supabase.from("student_resource_completion").upsert(
            {
              student_id: student.student_id,
              resource_id: resource.id,
              is_completed: !isCompleted,
              completed_at: !isCompleted ? new Date().toISOString() : null,
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: "student_id,resource_id",
            },
          );
        }
      } else {
        // Individual konular için topics tablosunu güncelle
        const { error } = await supabase
          .from("topics")
          .update({
            is_completed: !isCompleted,
            completed_at: !isCompleted ? new Date().toISOString() : null,
          })
          .eq("id", topicId);

        if (error) throw error;
      }

      toast({
        title: "Başarılı",
        description: `Konu ${!isCompleted ? "tamamlandı" : "tamamlanmadı olarak işaretlendi"}`,
      });

      fetchTopics();
    } catch (error: any) {
      toast({
        title: "Hata",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // ============================================================================
  // YARDIMCI FONKSİYONLAR
  // ============================================================================

  /**
   * Öğretmenler her zaman tüm kaynakları görebilir
   */
  const getVisibleResources = (topic: Topic) => {
    return topic.resources;
  };
  // getResourceIcon is now imported from @/lib/resourceUtils

  // ============================================================================
  // RENDER - LOADING STATE
  // ============================================================================

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  // ============================================================================
  // SUB-COMPONENT - TOPIC CARD
  // ============================================================================

  /**
   * Konu kartı bileşeni
   */
  const TopicCard = ({ topic }: { topic: Topic }) => {
    const visibleResources = getVisibleResources(topic);

    return (
      <Card className="border-l-4 border-l-primary/30">
        <CardContent className="p-4">
          <Collapsible open={expandedTopics.has(topic.id)} onOpenChange={() => toggleTopic(topic.id)}>
            {/* Konu Başlığı ve Kontroller */}
            <div className="flex items-start gap-3">
              {/* Tamamlanma Checkbox'ı */}
              <Checkbox 
                checked={topic.is_completed} 
                onCheckedChange={() => toggleTopicCompletion(topic.id, topic.is_completed, topic.isGlobal || false)}
                className="mt-1 shrink-0"
              />

              {/* Başlık, Açıklama ve Badge'ler */}
              <CollapsibleTrigger className="flex-1 text-left">
                <div className="flex items-start gap-2">
                  {expandedTopics.has(topic.id) ? (
                    <ChevronDown className="h-4 w-4 mt-0.5 shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium">{topic.title}</h4>
                    {topic.description && (
                      <p className={`text-sm text-muted-foreground mt-0.5 ${
                        !expandedTopics.has(topic.id) ? 'line-clamp-2' : ''
                      }`}>
                        {topic.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {topic.isGlobal && (
                        <Badge variant="outline" className="text-xs">Global</Badge>
                      )}
                      
                      <Badge variant="outline" className="text-xs">{topic.resources.length} kaynak</Badge>
                    </div>
                  </div>
                </div>
              </CollapsibleTrigger>
            </div>

            {/* Kaynaklar Listesi (Açılabilir) */}
            <CollapsibleContent className="mt-4">
              <div className="pl-8 space-y-3">
                <div className="flex justify-between items-center">
                  <h5 className="font-medium text-sm">Kaynaklar</h5>
                </div>

                {visibleResources.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {topic.resources.length === 0 ? "Henüz kaynak yok." : "Görünür kaynak yok."}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {visibleResources.map((resource) => (
                      <div key={resource.id} className="flex items-center gap-3 p-2 bg-accent/30 rounded-md">
                        <Checkbox 
                          checked={resource.is_completed || false}
                          onCheckedChange={() => toggleResourceCompletion(resource.id, resource.is_completed || false, topic.isGlobal || false)}
                        />
                        {getResourceIcon(resource.resource_type)}
                        <div
                          className="flex-1 cursor-pointer"
                          onClick={() => window.open(resource.resource_url, "_blank")}
                        >
                          <p className="font-medium text-sm hover:text-primary transition-colors">{resource.title}</p>
                          {resource.description && (
                            <p className="text-xs text-muted-foreground">{resource.description}</p>
                          )}
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => window.open(resource.resource_url, "_blank")}>
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>
    );
  };

  // ============================================================================
  // RENDER - ANA İÇERİK
  // ============================================================================

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
            <div>
              <CardTitle>{student.profiles.full_name} için konular</CardTitle>
              <CardDescription>
                {topics.filter((t) => t.is_completed).length} / {topics.length} konu tamamlandı
              </CardDescription>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full md:w-auto">
              {/* Ödev Kartı */}
              <Card className="w-full sm:w-auto sm:min-w-[200px]">
                <CardContent className="p-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex flex-col items-center justify-center gap-1 h-16"
                      onClick={() => setUploadDialogOpen(true)}
                    >
                      <Upload className="h-4 w-4 text-primary" />
                      <span className="text-xs font-medium">Yükle</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex flex-col items-center justify-center gap-1 h-16"
                      onClick={() => setListDialogOpen(true)}
                    >
                      <ClipboardList className="h-4 w-4 text-primary" />
                      <span className="text-xs font-medium">Ödevler</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
              
              {/* İşlenen Dersler */}
              <LessonTracker
                studentId={student.student_id}
                studentName={student.profiles.full_name}
                teacherId={teacherId}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {topics.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Henüz konu yok.</p>
            </div>
          ) : (
            topics.map((topic) => <TopicCard key={topic.id} topic={topic} />)
          )}
        </CardContent>
      </Card>

      {/* Ödev Dialogs */}
      <UploadHomeworkDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        studentId={student.student_id}
        teacherId={teacherId}
        uploadedByUserId={teacherId}
        onSuccess={() => {
          toast({
            title: "Başarılı",
            description: "Ödev başarıyla yüklendi",
          });
        }}
      />

      <HomeworkListDialog
        open={listDialogOpen}
        onOpenChange={setListDialogOpen}
        studentId={student.student_id}
        teacherId={teacherId}
        currentUserId={teacherId}
        isTeacher={true}
      />
    </div>
  );
}
