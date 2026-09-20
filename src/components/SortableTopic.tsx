import { useState, useEffect } from "react";
import { OrderControl } from "@/components/panel/OrderControl";
import { Highlight } from "@/components/panel/Highlight";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Trash2, ExternalLink, Pencil, GripVertical, ChevronDown } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { SortableResource } from "./SortableResource";

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

interface SortableTopicProps {
  topic: GlobalTopic;
  isAdmin: boolean;
  expandAll: boolean;
  /** 0 tabanlı sıra ve toplam — numarayla taşıma için. */
  index: number;
  total: number;
  onMoveTopic: (fromIndex: number, toIndex: number) => void;
  onMoveResource: (topicId: string, fromIndex: number, toIndex: number) => void;
  /** Arama ifadesi — eşleşen parça işaretlenir. */
  query?: string;
  onAddResource: (topicId: string) => void;
  onEditTopic: (topic: GlobalTopic) => void;
  onDeleteTopic: (topicId: string) => void;
  onEditResource: (resource: GlobalTopicResource) => void;
  onDeleteResource: (resourceId: string) => void;
  onResourceDragEnd: (event: any, topicId: string) => void;
  getResourceIcon: (type: string) => JSX.Element;
}

export function SortableTopic({
  topic,
  isAdmin,
  expandAll,
  index,
  total,
  onMoveTopic,
  onMoveResource,
  query = "",
  onAddResource,
  onEditTopic,
  onDeleteTopic,
  onEditResource,
  onDeleteResource,
  onResourceDragEnd,
  getResourceIcon,
}: SortableTopicProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Sync with expandAll prop
  useEffect(() => {
    setIsOpen(expandAll);
  }, [expandAll]);

  // Arama açıkken sürükleme kapalı: ekranda liste süzülmüş olduğu için
  // "şunun üstüne bırak" hareketi gerçek sırada başka bir yere denk geliyor.
  // Numarayla taşıma açık kalıyor — aramanın amacı da o zaten.
  const searching = query.trim().length > 0;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: topic.id,
    disabled: !isAdmin || searching,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const resourceSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card ref={setNodeRef} style={style}>
        <CollapsibleTrigger asChild>
          {/* Tek satır: eylemler ikinci satıra sarmıyor, kart iki kat
              kısaldı. p-6 masaüstünde 24px'ti — bir başlık ve üç ikon için
              fazla. "8 kaynak" rozeti yerine çıplak sayı: yanındaki ok zaten
              neyin açılacağını söylüyor. */}
          <CardHeader className="cursor-pointer p-2.5 transition-colors hover:bg-muted/50 sm:p-3">
            <div className="flex items-start gap-1.5">
              {isAdmin && (
                <OrderControl
                  index={index}
                  total={total}
                  itemLabel="konu"
                  onMove={(to) => onMoveTopic(index, to)}
                  className="mt-0.5"
                />
              )}
              {isAdmin && !searching && (
                <button
                  className="mt-1 flex-shrink-0 cursor-grab text-muted-foreground transition-colors hover:text-foreground active:cursor-grabbing"
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`${topic.title} sırasını sürükleyerek değiştir`}
                  {...attributes}
                  {...listeners}
                >
                  <GripVertical className="h-4 w-4" />
                </button>
              )}
              {/* Yönetici değilse numara kontrolü yok; arama sırasında yine de
                  "kaçıncı sırada" görünsün. */}
              {!isAdmin && searching && (
                <span className="mt-0.5 shrink-0 rounded-md px-1.5 text-[13px] font-semibold tabular-nums text-muted-foreground">
                  {index + 1}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <CardTitle className="text-[15px] leading-snug">
                  <Highlight text={topic.title} query={query} />
                </CardTitle>
                {topic.description && (
                  <CardDescription className="mt-1.5 text-xs leading-relaxed">
                    <Highlight text={topic.description} query={query} />
                  </CardDescription>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                    {topic.resources.length}
                  </span>
                  {topic.resources.length > 0 && (
                    <ChevronDown className={`h-4 w-4 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  )}
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onAddResource(topic.id)}
                      className="h-7 w-7 p-0"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEditTopic(topic)}
                      className="h-7 w-7 p-0"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      onClick={() => onDeleteTopic(topic.id)}
                      className="h-7 w-7 p-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        {/* Resources List */}
        {topic.resources.length > 0 && (
          <CollapsibleContent>
            <CardContent>
              <div className="space-y-2">
                <h5 className="font-medium text-sm">Kaynaklar</h5>
                <DndContext
                  sensors={resourceSensors}
                  collisionDetection={closestCenter}
                  onDragEnd={(event) => onResourceDragEnd(event, topic.id)}
                >
                  <SortableContext
                    items={topic.resources.map((r) => r.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {topic.resources.map((resource, resourceIndex) => (
                      <SortableResource
                        key={resource.id}
                        resource={resource}
                        isAdmin={isAdmin}
                        index={resourceIndex}
                        total={topic.resources.length}
                        onMove={(to) => onMoveResource(topic.id, resourceIndex, to)}
                        query={query}
                        onEditResource={onEditResource}
                        onDeleteResource={onDeleteResource}
                        getResourceIcon={getResourceIcon}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              </div>
            </CardContent>
          </CollapsibleContent>
        )}
      </Card>
    </Collapsible>
  );
}
