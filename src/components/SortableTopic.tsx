import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: topic.id,
    disabled: !isAdmin,
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
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex justify-between items-start gap-3">
              {isAdmin && (
                <button
                  className="cursor-grab active:cursor-grabbing mt-1 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={(e) => e.stopPropagation()}
                  {...attributes}
                  {...listeners}
                >
                  <GripVertical className="h-5 w-5" />
                </button>
              )}
              <div className="flex-1">
                <CardTitle className="text-lg">{topic.title}</CardTitle>
                {topic.description && <CardDescription className="mt-1">{topic.description}</CardDescription>}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{topic.resources.length} kaynak</Badge>
                {topic.resources.length > 0 && (
                  <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                )}
                {isAdmin && (
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onAddResource(topic.id)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEditTopic(topic)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => onDeleteTopic(topic.id)}>
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
                    {topic.resources.map((resource) => (
                      <SortableResource
                        key={resource.id}
                        resource={resource}
                        isAdmin={isAdmin}
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
