// ============================================================================
// ÖĞRENCİ PANELİ
// ============================================================================
// Bu bileşen öğrencilerin kendi öğrenme materyallerini görüntülemesini sağlar.
// Sadece tamamlanmış kaynakları gösterir.

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  ChevronDown,
  ChevronRight,
  LogOut,
  BookOpen,
  CheckCircle,
  Clock,
  ExternalLink,
  FileText,
  Video,
  Link as LinkIcon,
  Upload,
  ClipboardList,
} from "lucide-react";
import { Header } from "./Header";
import { StudentLessonTracker } from "./StudentLessonTracker";
import { UploadHomeworkDialog } from "./UploadHomeworkDialog";
import { HomeworkListDialog } from "./HomeworkListDialog";
import { ContactDialog } from "./ContactDialog";
import { NotificationBell } from "./NotificationBell";

// ============================================================================
// TİPLER
// ============================================================================

interface Topic {
  id: string;
  title: string;
  description: string;
  is_completed: boolean;
  completed_at: string | null;
  order_index: number;
  resources: Resource[];
}

interface Resource {
  id: string;
  title: string;
  description: string;
  resource_type: string;
  resource_url: string;
  order_index: number;
}

// ============================================================================
// ANA BİLEŞEN
// ============================================================================

export function StudentDashboard() {
  // ============================================================================
  // STATE YÖNETİMİ
  // ============================================================================

  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [listDialogOpen, setListDialogOpen] = useState(false);
  const [teacherId, setTeacherId] = useState<string>("");
  const { profile, signOut, signingOut } = useAuth();
  const { toast } = useToast();

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Profil yüklendiğinde konuları getir
  useEffect(() => {
    if (profile?.user_id) {
      fetchTopics();
    }
  }, [profile]);

  // ============================================================================
  // VERİ ÇEKME FONKSİYONLARI
  // ============================================================================

  /**
   * Öğrenciye ait tüm konuları ve global konuları getirir
   * Her kaynağın tamamlanma durumunu kontrol eder
   */
  const fetchTopics = async () => {
    try {
      // 1) Önce öğrencinin öğretmenini bul
      const { data: studentRelation, error: relationError } = await supabase
        .from("students")
        .select("teacher_id")
        .eq("student_id", profile?.user_id)
        .single();

      if (relationError) throw relationError;
      
      // Store teacher_id for homework submissions
      setTeacherId(studentRelation.teacher_id);

      // 2) Öğrenciye özel konuları getir
      const studentTopicsResponse = await supabase
        .from("topics")
        .select("*, resources (*)")
        .eq("student_id", profile?.user_id)
        .order("order_index");

      if (studentTopicsResponse.error) throw studentTopicsResponse.error;

      // 3) Tüm global konuları getir (admin sahipliğinde, tüm öğretmenler kullanabilir)
      const globalTopicsResponse = await supabase
        .from("global_topics")
        .select(
          `
    *,
    global_topic_resources (*)
  `,
        )
        .order("order_index");

      if (globalTopicsResponse.error) throw globalTopicsResponse.error;

      // 4) Kaynak ID'lerini topla
      const studentTopics = studentTopicsResponse.data || [];
      const globalTopics = globalTopicsResponse.data || [];

      const studentResourceIds = studentTopics.flatMap((topic) => topic.resources.map((resource: any) => resource.id));
      const globalResourceIds = globalTopics.flatMap((topic) =>
        topic.global_topic_resources.map((resource: any) => resource.id),
      );
      const allResourceIds = [...studentResourceIds, ...globalResourceIds];

      // 5) Tüm tamamlanma verilerini getir (filtresiz)
      let completionData: any[] = [];
      const { data: completionResponse, error: completionError } = await supabase
        .from("student_resource_completion")
        .select("resource_id, is_completed, completed_at")
        .eq("student_id", profile?.user_id);

      if (completionError) {
        console.error("Completion data error:", completionError);
        throw completionError;
      }
      completionData = completionResponse || [];

      // Tamamlanma map'ini oluştur
      const completionMap = new Map();
      completionData.forEach((completion) => {
        completionMap.set(completion.resource_id, completion);
      });

      // 6) Öğrenciye özel konuları işle
      const processedStudentTopics = studentTopics.map((topic) => ({
        ...topic,
        resources: topic.resources
          .map((resource: any) => {
            const completion = completionMap.get(resource.id);
            return {
              ...resource,
              is_completed: completion?.is_completed || false,
              completed_at: completion?.completed_at,
            };
          })
          .sort((a: Resource, b: Resource) => a.order_index - b.order_index),
      }));

      // 7) Global konuları işle - tüm konuları göster, tamamlanma durumunu işaretle
      const processedGlobalTopics = globalTopics.map((topic) => {
        const globalResources = (topic.global_topic_resources || [])
          .map((res: any) => {
            const completion = completionMap.get(res.id);
            return {
              id: res.id,
              title: res.title,
              description: res.description,
              resource_type: res.resource_type,
              resource_url: res.resource_url,
              order_index: res.order_index,
              is_completed: completion?.is_completed || false,
              completed_at: completion?.completed_at,
            };
          })
          .sort((a: Resource, b: Resource) => a.order_index - b.order_index);

        // Tüm kaynaklar tamamlanmışsa konu da tamamlanmış sayılır
        const allResourcesCompleted =
          globalResources.length > 0 && globalResources.every((resource) => resource.is_completed);

        return {
          id: `global-${topic.id}`,
          title: topic.title,
          description: topic.description,
          is_completed: allResourcesCompleted,
          completed_at: allResourcesCompleted ? new Date().toISOString() : null,
          order_index: topic.order_index + 1000,
          resources: globalResources,
        };
      });

      const allTopics = [...processedStudentTopics, ...processedGlobalTopics];
      setTopics(allTopics);
    } catch (error: any) {
      toast({
        title: "Hata",
        description: "Konular getirilemedi",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // UI FONKSİYONLARI
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

  /**
   * Kaynak tipine göre ikon döndür
   */
  const getResourceIcon = (type: string) => {
    switch (type) {
      case "video":
        return <Video className="h-4 w-4" />;
      case "pdf":
      case "document":
        return <FileText className="h-4 w-4" />;
      case "link":
        return <LinkIcon className="h-4 w-4" />;
      default:
        return <ExternalLink className="h-4 w-4" />;
    }
  };

  /**
   * Öğrenciler sadece tamamlanmış kaynakları görebilir
   */
  const getVisibleResources = (topic: Topic) => {
    // If the whole topic is marked as completed, show all resources
    if (topic.is_completed) {
      return topic.resources;
    }
    // Otherwise, only show completed resources
    return topic.resources.filter((resource: any) => resource.is_completed);
  };

  // ============================================================================
  // VERİ HAZIRLAMA
  // ============================================================================

  // Tamamlanmış ve işlenmiş konuları filtrele
  const completedTopics = topics.filter((t) => t.is_completed);
  const pendingTopics = topics.filter((t) => !t.is_completed && t.resources.some((r: any) => r.is_completed));
  const allActiveTopics = [...completedTopics, ...pendingTopics];

  // ============================================================================
  // RENDER - LOADING STATE
  // ============================================================================

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // ============================================================================
  // RENDER - ANA İÇERİK
  // ============================================================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5">
      {/* Header */}
      <Header
        rightActions={
          <>
            <NotificationBell 
              teacherId={teacherId} 
              isStudent={true}
              onNotificationClick={() => setListDialogOpen(true)}
            />
            <ContactDialog />
            <Button onClick={signOut} variant="outline" size="sm" disabled={signingOut}>
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline ml-2">{signingOut ? "Çıkış..." : "Çıkış"}</span>
            </Button>
          </>
        }
      >
        <div className="text-center">
          <h1 className="text-xl sm:text-2xl font-bold">Öğrenme Panelim</h1>
          <p className="text-sm sm:text-lg text-muted-foreground hidden sm:block">Hoş geldin, {profile?.full_name}</p>
        </div>
      </Header>

      <div className="container mx-auto p-4">
        {/* İlerleme Özeti - 2x2 Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Row 1 - Col 1: İşlenen Konular */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <BookOpen className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{allActiveTopics.length}</p>
                  <p className="text-sm text-muted-foreground">İşlenen Konular</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Row 1 - Col 2: Toplam Kaynak */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-2xl font-bold">
                    {topics.reduce((acc, topic) => acc + getVisibleResources(topic).length, 0)}
                  </p>
                  <p className="text-sm text-muted-foreground">Toplam Kaynak</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Row 2 - Col 1: İşlenen Dersler */}
          <StudentLessonTracker studentId={profile?.user_id || ""} />

          {/* Row 2 - Col 2: Ödev Kartı */}
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="h-full flex flex-col items-center justify-center gap-2 min-h-[80px]"
                  onClick={() => setUploadDialogOpen(true)}
                >
                  <Upload className="h-6 w-6 text-primary" />
                  <span className="text-sm font-medium">Yükle</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-full flex flex-col items-center justify-center gap-2 min-h-[80px]"
                  onClick={() => setListDialogOpen(true)}
                >
                  <ClipboardList className="h-6 w-6 text-primary" />
                  <span className="text-sm font-medium">Ödevler</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Öğrenme Konuları */}
        <div className="space-y-6">
          {allActiveTopics.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  Öğrendiklerimiz
                </CardTitle>
                <CardDescription>Öğrenme materyallerin</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {allActiveTopics.map((topic) => {
                  const visibleResources = getVisibleResources(topic);
                  const completedResources = topic.resources.filter((r: any) => r.is_completed);
                  const isFullyCompleted = topic.is_completed;

                  return (
                    <Card key={topic.id} className="border-l-4 border-l-primary">
                      <CardContent className="p-4">
                        <Collapsible>
                          <div className="flex items-center justify-between">
                            <CollapsibleTrigger
                              className="flex items-center gap-2 flex-1 text-left"
                              onClick={() => toggleTopic(topic.id)}
                            >
                              {expandedTopics.has(topic.id) ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                              <div className="flex-1">
                                <h4 className="font-medium">{topic.title}</h4>
                                {topic.description && (
                                  <p className="text-sm text-muted-foreground">{topic.description}</p>
                                )}
                              </div>
                            </CollapsibleTrigger>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{visibleResources.length} kaynak</Badge>
                            </div>
                          </div>

                          {/* Kaynaklar */}
                          <CollapsibleContent className="mt-4">
                            <div className="pl-6 space-y-2">
                              <h5 className="font-medium text-sm">Kaynaklar</h5>
                              {visibleResources.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                  Bu konu için henüz gösterilecek kaynak bulunmuyor.
                                </p>
                              ) : (
                                <div className="space-y-2">
                                  {visibleResources.map((resource: any) => (
                                    <div
                                      key={resource.id}
                                      className="flex items-center gap-3 p-2 bg-accent/30 rounded-md"
                                    >
                                      {resource.is_completed ? (
                                        <CheckCircle className="h-4 w-4 text-green-600" />
                                      ) : (
                                        <Clock className="h-4 w-4 text-muted-foreground" />
                                      )}
                                      {getResourceIcon(resource.resource_type)}
                                      <div className="flex-1">
                                        <button
                                          className="font-medium text-sm text-left hover:underline cursor-pointer"
                                          onClick={() => window.open(resource.resource_url, "_blank")}
                                        >
                                          {resource.title}
                                        </button>
                                        {resource.description && (
                                          <p className="text-xs text-muted-foreground">{resource.description}</p>
                                        )}
                                      </div>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => window.open(resource.resource_url, "_blank")}
                                      >
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
                })}
              </CardContent>
            </Card>
          ) : (
            <Card className="text-center py-12">
              <CardContent>
                <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Henüz Öğrenme Aktivitesi Yok</h3>
                <p className="text-muted-foreground">
                  Öğretmeniniz size keşfetmeniz için konular ve kaynaklar atayacak.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Ödev Dialogs */}
        <UploadHomeworkDialog
          open={uploadDialogOpen}
          onOpenChange={setUploadDialogOpen}
          studentId={profile?.user_id || ""}
          teacherId={teacherId}
          uploadedByUserId={profile?.user_id}
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
          studentId={profile?.user_id || ""}
          teacherId={teacherId}
          currentUserId={profile?.user_id || ""}
          isTeacher={false}
        />
      </div>
    </div>
  );
}
