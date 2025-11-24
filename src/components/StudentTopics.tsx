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
} from "lucide-react";
import { LessonTracker } from "./LessonTracker";

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
  isGlobal?: boolean; // Global konuları ayırt etmek için
}

interface Resource {
  id: string;
  title: string;
  description: string;
  resource_type: string;
  resource_url: string;
  order_index: number;
  is_completed?: boolean;
  completed_at?: string | null;
}

interface Student {
  id: string;
  student_id: string;
  profiles: {
    full_name: string;
    email: string;
  };
}

interface StudentTopicsProps {
  student: Student;
  teacherId: string;
}

// ============================================================================
// ANA BİLEŞEN
// ============================================================================

export function StudentTopics({ student, teacherId }: StudentTopicsProps) {
  // ============================================================================
  // STATE YÖNETİMİ
  // ============================================================================

  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Öğrenci değiştiğinde konuları yeniden getir
  useEffect(() => {
    fetchTopics();
  }, [student.student_id]);

  // ============================================================================
  // VERİ ÇEKME FONKSİYONLARI
  // ============================================================================

  /**
   * Öğrenciye özel konuları ve global konuları getirir
   * Ayrıca tamamlanma durumlarını da işler
   */
  const fetchTopics = async () => {
    try {
      // 1) Öğrenciye özel konuları getir
      const studentTopicsResponse = await supabase
        .from("topics")
        .select("*, resources (*)")
        .eq("student_id", student.student_id)
        .order("order_index");

      if (studentTopicsResponse.error) throw studentTopicsResponse.error;

      // 2) Tüm global konuları getir (admin sahipliğinde, tüm öğretmenler kullanabilir)
      const { data: globalTopics, error: globalTopicsError } = await supabase
        .from("global_topics")
        .select("*, global_topic_resources(*)")
        .order("order_index");

      if (globalTopicsError) throw globalTopicsError;

      // 3) Tüm tamamlanma verilerini tek sorguda getir (URL limiti için)
      const studentTopics = studentTopicsResponse.data || [];

      const { data: completionData, error: completionError } = await supabase
        .from("student_resource_completion")
        .select("*")
        .eq("student_id", student.student_id);

      if (completionError) throw completionError;

      // Tamamlanma durumunu map olarak hazırla
      const completionMap = new Map();
      completionData.forEach((completion) => {
        completionMap.set(completion.resource_id, completion);
      });

      // 4) Öğrenciye özel konuları işle
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
        isGlobal: false,
      }));

      // 5) Global konuları işle (öğrenciye özel versiyonu olanları filtrele)
      const studentTopicTitles = new Set(processedStudentTopics.map((t) => t.title));

      const processedGlobalTopics = (globalTopics || [])
        .filter((topic) => !studentTopicTitles.has(topic.title))
        .map((topic) => {
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

          // Tüm kaynaklar tamamlanmışsa konu tamamlanmış sayılır
          const allResourcesCompleted =
            globalResources.length > 0 && globalResources.every((resource) => resource.is_completed);

          return {
            id: topic.id,
            title: topic.title,
            description: topic.description,
            is_completed: allResourcesCompleted,
            completed_at: allResourcesCompleted ? new Date().toISOString() : null,
            order_index: topic.order_index + 1000, // Global konular sona eklenir
            resources: globalResources,
            isGlobal: true,
          };
        });

      setTopics([...processedStudentTopics, ...processedGlobalTopics]);
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
      case "image":
        return <Image className="h-4 w-4" />;
      default:
        return <ExternalLink className="h-4 w-4" />;
    }
  };

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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                {/* Tamamlanma Checkbox'ı */}
                <Checkbox 
                  checked={topic.is_completed} 
                  onCheckedChange={() => toggleTopicCompletion(topic.id, topic.is_completed, topic.isGlobal || false)}
                />

                {/* Başlık ve Açıklama */}
                <CollapsibleTrigger className="flex items-center gap-2 flex-1 text-left">
                  {expandedTopics.has(topic.id) ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <div className="flex-1">
                    <h4 className="font-medium">
                      {topic.title}
                      {topic.isGlobal && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          Global
                        </Badge>
                      )}
                    </h4>
                    {topic.description && <p className="text-sm text-muted-foreground">{topic.description}</p>}
                  </div>
                </CollapsibleTrigger>

                {/* Badge - removed delete button for teachers */}
                <div className="flex items-center gap-2">
                  {topic.is_completed && <Badge variant="secondary">Tamamlandı</Badge>}
                  <Badge variant="outline">{topic.resources.length} kaynak</Badge>
                </div>
              </div>
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
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>{student.profiles.full_name} için konular</CardTitle>
              <CardDescription>
                {topics.filter((t) => t.is_completed).length} / {topics.length} konu tamamlandı
              </CardDescription>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
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

    </div>
  );
}
