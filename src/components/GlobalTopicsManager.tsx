import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, Plus, Trash2, ExternalLink, FileText, Video, Link as LinkIcon, Pencil, GripVertical } from "lucide-react";
import { AddTopicDialog } from "./AddTopicDialog";
import { AddResourceDialog } from "./AddResourceDialog";
import { EditTopicDialog } from "./EditTopicDialog";
import { EditResourceDialog } from "./EditResourceDialog";
import { SortableTopic } from "./SortableTopic";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ============= TYPES =============
interface GlobalTopic {
  id: string;
  title: string;
  description: string;
  order_index: number;
  resources: GlobalTopicResource[];
}

interface GlobalTopicResource {
  id: string;
  title: string;
  description: string;
  resource_type: string;
  resource_url: string;
  order_index: number;
}

interface GlobalTopicsManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin?: boolean;
}

// ============= COMPONENT =============
export function GlobalTopicsManager({ open, onOpenChange, isAdmin = false }: GlobalTopicsManagerProps) {
  // State
  const [globalTopics, setGlobalTopics] = useState<GlobalTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddTopic, setShowAddTopic] = useState(false);
  const [showAddResource, setShowAddResource] = useState(false);
  const [showEditTopic, setShowEditTopic] = useState(false);
  const [showEditResource, setShowEditResource] = useState(false);
  const [selectedTopicId, setSelectedTopicId] = useState<string>("");
  const [editingTopic, setEditingTopic] = useState<GlobalTopic | null>(null);
  const [editingResource, setEditingResource] = useState<GlobalTopicResource | null>(null);
  const [expandAll, setExpandAll] = useState(false);
  const { profile } = useAuth();
  const { toast } = useToast();

  // ============= EFFECTS =============
  useEffect(() => {
    if (open && profile?.user_id) {
      fetchGlobalTopics();
    }
  }, [open, profile]);

  // ============= DATA FETCHING =============
  const fetchGlobalTopics = async () => {
    try {
      const { data, error } = await supabase
        .from("global_topics")
        .select("*, global_topic_resources(*)")

        .order("order_index", { ascending: true })
        .order("order_index", { foreignTable: "global_topic_resources", ascending: true });

      if (error) throw error;

      // Sort resources within each topic
      const topicsWithSortedResources = (data || []).map((topic) => ({
        ...topic,
        resources: (topic.global_topic_resources || []).sort(
          (a: GlobalTopicResource, b: GlobalTopicResource) => a.order_index - b.order_index,
        ),
      }));

      setGlobalTopics(topicsWithSortedResources);
    } catch (error: any) {
      toast({
        title: "Hata",
        description: "Global konular getirilemedi",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // ============= DRAG AND DROP HANDLERS =============
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleTopicDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = globalTopics.findIndex((t) => t.id === active.id);
    const newIndex = globalTopics.findIndex((t) => t.id === over.id);

    const newTopics = arrayMove(globalTopics, oldIndex, newIndex);
    
    // Optimistic update - update UI immediately
    setGlobalTopics(newTopics);

    // Batch update in background
    try {
      const topicOrders = newTopics.map((topic, index) => ({
        id: topic.id,
        order_index: index,
      }));

      const { error } = await supabase.rpc("update_global_topics_order", {
        topic_orders: topicOrders,
      });

      if (error) throw error;
    } catch (error: any) {
      // Revert on error
      toast({
        title: "Hata",
        description: "Sıra güncellenemedi",
        variant: "destructive",
      });
      fetchGlobalTopics();
    }
  };

  const handleResourceDragEnd = async (event: DragEndEvent, topicId: string) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const topic = globalTopics.find((t) => t.id === topicId);
    if (!topic) return;

    const oldIndex = topic.resources.findIndex((r) => r.id === active.id);
    const newIndex = topic.resources.findIndex((r) => r.id === over.id);

    const newResources = arrayMove(topic.resources, oldIndex, newIndex);
    
    // Optimistic update - update UI immediately
    setGlobalTopics(
      globalTopics.map((t) =>
        t.id === topicId ? { ...t, resources: newResources } : t
      )
    );

    // Batch update in background
    try {
      const resourceOrders = newResources.map((resource, index) => ({
        id: resource.id,
        order_index: index,
      }));

      const { error } = await supabase.rpc("update_global_resources_order", {
        resource_orders: resourceOrders,
      });

      if (error) throw error;
    } catch (error: any) {
      // Revert on error
      toast({
        title: "Hata",
        description: "Kaynak sırası güncellenemedi",
        variant: "destructive",
      });
      fetchGlobalTopics();
    }
  };

  // ============= TOPIC HANDLERS =============
  const handleAddTopic = async (title: string, description: string, addToEnd: boolean = false) => {
    try {
      let orderIndex = 0;

      if (addToEnd) {
        // Get max order_index to add to end
        const { data: existingTopics, error: fetchError } = await supabase
          .from("global_topics")
          .select("order_index")
          .order("order_index", { ascending: false })
          .limit(1);

        if (fetchError) throw fetchError;
        orderIndex = existingTopics && existingTopics.length > 0 ? existingTopics[0].order_index + 1 : 0;
      } else {
        // Add to beginning - get existing topics to update their order
        const { data: existingTopics, error: fetchError } = await supabase
          .from("global_topics")
          .select("id, order_index");

        if (fetchError) throw fetchError;

        // Increment order_index for all existing topics
        if (existingTopics && existingTopics.length > 0) {
          for (const topic of existingTopics) {
            const { error: updateError } = await supabase
              .from("global_topics")
              .update({ order_index: topic.order_index + 1 })
              .eq("id", topic.id);

            if (updateError) throw updateError;
          }
        }
      }

      // Insert new topic
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user?.id) {
        toast({
          title: "Hata",
          description: "Oturum bilgisi bulunamadı. Lütfen tekrar giriş yapın.",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from("global_topics")
        .insert({
          teacher_id: user.id,
          title,
          description,
          order_index: orderIndex,
        });

      if (error) throw error;

      toast({
        title: "Başarılı",
        description: "Global konu başarıyla eklendi",
      });

      fetchGlobalTopics();
      setShowAddTopic(false);
    } catch (error: any) {
      toast({
        title: "Hata",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteTopic = async (topicId: string) => {
    try {
      // Delete all resources first
      const { error: resourcesError } = await supabase
        .from("global_topic_resources")
        .delete()
        .eq("global_topic_id", topicId);

      if (resourcesError) throw resourcesError;

      // Delete the topic
      const { error } = await supabase.from("global_topics").delete().eq("id", topicId);

      if (error) throw error;

      toast({
        title: "Başarılı",
        description: "Global konu başarıyla silindi",
      });

      fetchGlobalTopics();
    } catch (error: any) {
      toast({
        title: "Hata",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // ============= RESOURCE HANDLERS =============
  const handleAddResource = async (title: string, description: string, resourceType: string, resourceUrl: string) => {
    try {
      const currentTopic = globalTopics.find((t) => t.id === selectedTopicId);
      const nextOrderIndex = currentTopic?.resources.length || 0;

      const { error } = await supabase.from("global_topic_resources").insert({
        global_topic_id: selectedTopicId,
        title,
        description,
        resource_type: resourceType,
        resource_url: resourceUrl,
        order_index: nextOrderIndex,
      });

      if (error) throw error;

      toast({
        title: "Başarılı",
        description: "Kaynak başarıyla eklendi",
      });

      fetchGlobalTopics();
      setShowAddResource(false);
    } catch (error: any) {
      toast({
        title: "Hata",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEditTopic = async (id: string, title: string, description: string) => {
    try {
      const { error } = await supabase
        .from("global_topics")
        .update({
          title,
          description,
        })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Başarılı",
        description: "Konu başarıyla güncellendi",
      });

      fetchGlobalTopics();
      setShowEditTopic(false);
    } catch (error: any) {
      toast({
        title: "Hata",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEditResource = async (
    id: string,
    title: string,
    description: string,
    resourceType: string,
    resourceUrl: string,
  ) => {
    try {
      const { error } = await supabase
        .from("global_topic_resources")
        .update({
          title,
          description,
          resource_type: resourceType,
          resource_url: resourceUrl,
        })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Başarılı",
        description: "Kaynak başarıyla güncellendi",
      });

      fetchGlobalTopics();
      setShowEditResource(false);
    } catch (error: any) {
      toast({
        title: "Hata",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteResource = async (resourceId: string) => {
    try {
      const { error } = await supabase.from("global_topic_resources").delete().eq("id", resourceId);

      if (error) throw error;

      toast({
        title: "Başarılı",
        description: "Kaynak başarıyla silindi",
      });

      fetchGlobalTopics();
    } catch (error: any) {
      toast({
        title: "Hata",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // ============= HELPER FUNCTIONS =============
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

  // ============= RENDER =============
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[calc(100%-1rem)] sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <BookOpen className="h-4 w-4 sm:h-5 sm:w-5" />
              Global Konular Yönetimi
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            <div className="space-y-4">
              {/* Header Actions */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {isAdmin 
                    ? "Herhangi bir öğrenciye atanabilecek global konuları yönetin" 
                    : "Global konular ve kaynaklar"}
                </p>
                <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                  {!loading && globalTopics.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Switch
                        id="expand-all"
                        checked={expandAll}
                        onCheckedChange={setExpandAll}
                      />
                      <Label htmlFor="expand-all" className="cursor-pointer text-xs sm:text-sm">
                        Tümünü Aç
                      </Label>
                    </div>
                  )}
                  {isAdmin && (
                    <Button onClick={() => setShowAddTopic(true)} size="sm" className="text-xs sm:text-sm">
                      <Plus className="h-4 w-4 mr-1 sm:mr-2" />
                      Konu Ekle
                    </Button>
                  )}
                </div>
              </div>

              {/* Loading State */}
              {loading && (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              )}

              {/* Empty State */}
              {!loading && globalTopics.length === 0 && (
                <Card className="text-center py-8">
                  <CardContent>
                    <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">Henüz Global Konu Yok</h3>
                    <p className="text-muted-foreground mb-4">
                      {isAdmin 
                        ? "Herhangi bir öğrenciye atanabilecek yeniden kullanılabilir konular oluşturun." 
                        : "Henüz hiç global konu eklenmemiş."}
                    </p>
                    {isAdmin && (
                      <Button onClick={() => setShowAddTopic(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        İlk Konunuzu Ekleyin
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Topics List */}
              {!loading && globalTopics.length > 0 && (
                <DndContext
                  sensors={isAdmin ? sensors : []}
                  collisionDetection={closestCenter}
                  onDragEnd={isAdmin ? handleTopicDragEnd : undefined}
                >
                  <SortableContext
                    items={globalTopics.map((t) => t.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-4">
                      {globalTopics.map((topic) => (
                        <SortableTopic
                          key={topic.id}
                          topic={topic}
                          isAdmin={isAdmin}
                          expandAll={expandAll}
                          onAddResource={(topicId) => {
                            setSelectedTopicId(topicId);
                            setShowAddResource(true);
                          }}
                          onEditTopic={(topic) => {
                            setEditingTopic(topic);
                            setShowEditTopic(true);
                          }}
                          onDeleteTopic={handleDeleteTopic}
                          onEditResource={(resource) => {
                            setEditingResource(resource);
                            setShowEditResource(true);
                          }}
                          onDeleteResource={handleDeleteResource}
                          onResourceDragEnd={handleResourceDragEnd}
                          getResourceIcon={getResourceIcon}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialogs */}
      <AddTopicDialog open={showAddTopic} onOpenChange={setShowAddTopic} onAddTopic={handleAddTopic} />

      <AddResourceDialog
        open={showAddResource}
        onOpenChange={setShowAddResource}
        onAddResource={handleAddResource}
        topicTitle={globalTopics.find((t) => t.id === selectedTopicId)?.title || ""}
      />
      <EditTopicDialog
        open={showEditTopic}
        onOpenChange={setShowEditTopic}
        onEditTopic={handleEditTopic}
        topic={editingTopic}
      />

      <EditResourceDialog
        open={showEditResource}
        onOpenChange={setShowEditResource}
        onEditResource={handleEditResource}
        resource={editingResource}
      />
    </>
  );
}
