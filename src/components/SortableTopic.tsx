import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, ExternalLink, Pencil, GripVertical } from "lucide-react";
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
  onAddResource,
  onEditTopic,
  onDeleteTopic,
  onEditResource,
  onDeleteResource,
  onResourceDragEnd,
  getResourceIcon,
}: SortableTopicProps) {
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
    <Card ref={setNodeRef} style={style}>
      <CardHeader>
        <div className="flex justify-between items-start gap-3">
          {isAdmin && (
            <button
              className="cursor-grab active:cursor-grabbing mt-1 text-muted-foreground hover:text-foreground transition-colors"
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
            {isAdmin && (
              <>
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
              </>
            )}
          </div>
        </div>
      </CardHeader>

      {/* Resources List */}
      {topic.resources.length > 0 && (
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
      )}
    </Card>
  );
}
