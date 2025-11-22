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
  Plus,
  ExternalLink,
  FileText,
  Video,
  Link as LinkIcon,
  Trash2,
  GripVertical,
  Image,
} from "lucide-react";
import { AddTopicDialog } from "./AddTopicDialog";
import { AddResourceDialog } from "./AddResourceDialog";
import { LessonTracker } from "./LessonTracker";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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
  const [showAddTopic, setShowAddTopic] = useState(false);
  const [showAddResource, setShowAddResource] = useState(false);
  const [selectedTopicId, setSelectedTopicId] = useState<string>("");
  const { toast } = useToast();

  // ============================================================================
  // DRAG AND DROP SENSÖRLERİ
  // ============================================================================

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

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
        .eq("teacher_id", teacherId)
        .eq("student_id", student.student_id)
        .order("order_index");

      if (studentTopicsResponse.error) throw studentTopicsResponse.error;

      // 2) Bu öğretmene ait global konuları getir
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

  /**
   * Bir konunun tamamlanma durumunu değiştir
   * - Global konular için: Tüm kaynakların completion durumunu güncelle
   * - Öğrenciye özel konular için: Konunun kendi completion alanını güncelle
   */
  const toggleTopicCompletion = async (topicId: string, isCompleted: boolean, isGlobal?: boolean) => {
    try {
      if (isGlobal) {
        const globalTopic = topics.find((t) => t.id === topicId && t.isGlobal);
        if (!globalTopic) return;

        const targetCompleted = !isCompleted;

        // Tüm kaynakları güncelle
        const updatePromises = globalTopic.resources.map((resource) =>
          supabase.from("student_resource_completion").upsert(
            {
              student_id: student.student_id,
              resource_id: resource.id,
              is_completed: targetCompleted,
              completed_at: targetCompleted ? new Date().toISOString() : null,
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: "student_id,resource_id",
            },
          ),
        );

        await Promise.all(updatePromises);
      } else {
        // Öğrenciye özel konu için
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

  /**
   * Bir konuyu sil
   * - Global konular için: Sadece öğrencinin görünümünden kaldır
   * - Öğrenciye özel konular için: Veritabanından sil
   */
  const handleDeleteTopic = async (topicId: string, isGlobal?: boolean) => {
    try {
      if (isGlobal) {
        toast({
          title: "Başarılı",
          description: "Global konu öğrenci görünümünden kaldırıldı",
        });

        fetchTopics();
      } else {
        const { error } = await supabase.from("topics").delete().eq("id", topicId);

        if (error) throw error;

        toast({
          title: "Başarılı",
          description: "Konu silindi",
        });

        fetchTopics();
      }
    } catch (error: any) {
      toast({
        title: "Hata",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  /**
   * Drag & drop bittiğinde konuların sırasını güncelle
   */
  const handleDragEnd = async (event: any) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      const oldIndex = topics.findIndex((topic) => topic.id === active.id);
      const newIndex = topics.findIndex((topic) => topic.id === over.id);

      const newTopics = arrayMove(topics, oldIndex, newIndex);
      setTopics(newTopics);

      // Veritabanında sıralamayı güncelle
      try {
        const studentTopicUpdates = newTopics
          .filter((topic) => !topic.isGlobal)
          .map((topic, index) => supabase.from("topics").update({ order_index: index }).eq("id", topic.id));

        const globalTopicUpdates = newTopics
          .filter((topic) => topic.isGlobal)
          .map((topic, index) => supabase.from("global_topics").update({ order_index: index }).eq("id", topic.id));

        await Promise.all([...studentTopicUpdates, ...globalTopicUpdates]);
      } catch (error: any) {
        toast({
          title: "Hata",
          description: "Sıralama güncellenemedi",
          variant: "destructive",
        });
        fetchTopics(); // Eski sıraya dön
      }
    }
  };
  const handleResourceDragEnd = async (event: any, topicId: string, isGlobal: boolean) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      const topic = topics.find((t) => t.id === topicId);
      if (!topic) return;

      const oldIndex = topic.resources.findIndex((resource) => resource.id === active.id);
      const newIndex = topic.resources.findIndex((resource) => resource.id === over.id);

      const newResources = arrayMove(topic.resources, oldIndex, newIndex);

      // Update local state
      setTopics(topics.map((t) => (t.id === topicId ? { ...t, resources: newResources } : t)));

      // Update order in database
      try {
        const table = isGlobal ? "global_topic_resources" : "resources";
        const updates = newResources.map((resource, index) =>
          supabase.from(table).update({ order_index: index }).eq("id", resource.id),
        );

        await Promise.all(updates);
      } catch (error: any) {
        toast({
          title: "Error",
          description: "Failed to update resource order",
          variant: "destructive",
        });
        fetchTopics(); // Revert to original order
      }
    }
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
   * Bir kaynağı sil
   */
  const handleDeleteResource = async (resourceId: string, isGlobalResource: boolean) => {
    try {
      const table = isGlobalResource ? "global_topic_resources" : "resources";
      const { error } = await supabase.from(table).delete().eq("id", resourceId);

      if (error) throw error;

      toast({
        title: "Başarılı",
        description: "Kaynak silindi",
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
  // SUB-COMPONENT - SORTABLE TOPIC CARD
  // ============================================================================

  // Sortable Resource Component
  const SortableResource = ({
    resource,
    topicId,
    isGlobal,
    children,
  }: {
    resource: Resource;
    topicId: string;
    isGlobal: boolean;
    children: React.ReactNode;
  }) => {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: resource.id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    };

    return (
      <div ref={setNodeRef} style={style} className="flex items-center gap-3 p-2 bg-accent/30 rounded-md">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
          <GripVertical className="h-3 w-3 text-muted-foreground" />
        </div>
        {children}
      </div>
    );
  };

  /**
   * Sürüklenebilir konu kartı bileşeni
   */
  const SortableTopicCard = ({ topic }: { topic: Topic }) => {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: topic.id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    };

    const visibleResources = getVisibleResources(topic);

    return (
      <Card ref={setNodeRef} style={style} className="border-l-4 border-l-primary/30">
        <CardContent className="p-4">
          <Collapsible open={expandedTopics.has(topic.id)} onOpenChange={() => toggleTopic(topic.id)}>
            {/* Konu Başlığı ve Kontroller */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                {/* Sürükleme Handle */}
                <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                </div>

                {/* Tamamlanma Checkbox'ı */}
                <Checkbox
                  checked={topic.is_completed}
                  onCheckedChange={() => toggleTopicCompletion(topic.id, topic.is_completed, topic.isGlobal)}
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

                {/* Badge ve Sil Butonu */}
                <div className="flex items-center gap-2">
                  {topic.is_completed && <Badge variant="secondary">Tamamlandı</Badge>}
                  <Badge variant="outline">{topic.resources.length} kaynak</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteTopic(topic.id, topic.isGlobal);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Kaynaklar Listesi (Açılabilir) */}
            <CollapsibleContent className="mt-4">
              <div className="pl-8 space-y-3">
                <div className="flex justify-between items-center">
                  <h5 className="font-medium text-sm">Kaynaklar</h5>
                  {!topic.isGlobal && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedTopicId(topic.id);
                        setShowAddResource(true);
                      }}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Kaynak Ekle
                    </Button>
                  )}
                </div>

                {visibleResources.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {topic.resources.length === 0
                      ? "Henüz kaynak yok. Öğrenciye yardımcı olmak için öğrenme materyalleri ekleyin."
                      : "Görünür kaynak yok."}
                  </p>
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={(event) => handleResourceDragEnd(event, topic.id, topic.isGlobal || false)}
                  >
                    <SortableContext items={visibleResources.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-2">
                        {visibleResources.map((resource) => (
                          <SortableResource
                            key={resource.id}
                            resource={resource}
                            topicId={topic.id}
                            isGlobal={topic.isGlobal || false}
                          >
                            <Checkbox
                              checked={resource.is_completed || false}
                              onCheckedChange={() =>
                                toggleResourceCompletion(
                                  resource.id,
                                  resource.is_completed || false,
                                  topic.isGlobal || false,
                                )
                              }
                            />
                            {getResourceIcon(resource.resource_type)}
                            <div
                              className="flex-1 cursor-pointer"
                              onClick={() => window.open(resource.resource_url, "_blank")}
                            >
                              <p className="font-medium text-sm hover:text-primary transition-colors">
                                {resource.title}
                              </p>
                              {resource.description && (
                                <p className="text-xs text-muted-foreground">{resource.description}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteResource(resource.id, topic.isGlobal || false)}
                              >
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => window.open(resource.resource_url, "_blank")}
                              >
                                <ExternalLink className="h-3 w-3" />
                              </Button>
                            </div>
                          </SortableResource>
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
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

              <Button onClick={() => setShowAddTopic(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Konu Ekle
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {topics.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Henüz konu yok. Başlamak için ilk konuyu oluşturun!</p>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={topics.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                {topics.map((topic) => (
                  <SortableTopicCard key={topic.id} topic={topic} />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>

      {/* Diyaloglar */}
      <AddTopicDialog
        open={showAddTopic}
        onOpenChange={setShowAddTopic}
        studentId={student.student_id}
        teacherId={teacherId}
        onTopicAdded={fetchTopics}
      />

      <AddResourceDialog
        open={showAddResource}
        onOpenChange={setShowAddResource}
        topicId={selectedTopicId}
        onResourceAdded={fetchTopics}
      />
    </div>
  );
}
