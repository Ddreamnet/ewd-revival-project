import { Button } from "@/components/ui/button";
import { OrderControl } from "@/components/panel/OrderControl";
import { Highlight } from "@/components/panel/Highlight";
import { ExternalLink, Pencil, Trash2, GripVertical } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface GlobalTopicResource {
  id: string;
  title: string;
  description: string;
  resource_type: string;
  resource_url: string;
  order_index: number;
}

interface SortableResourceProps {
  resource: GlobalTopicResource;
  isAdmin: boolean;
  /** 0 tabanlı sıra ve konudaki kaynak sayısı — numarayla taşıma için. */
  index: number;
  total: number;
  onMove: (toIndex: number) => void;
  /** Arama ifadesi — eşleşen parça işaretlenir. */
  query?: string;
  onEditResource: (resource: GlobalTopicResource) => void;
  onDeleteResource: (resourceId: string) => void;
  getResourceIcon: (type: string) => JSX.Element;
}

export function SortableResource({
  resource,
  isAdmin,
  index,
  total,
  onMove,
  query = "",
  onEditResource,
  onDeleteResource,
  getResourceIcon,
}: SortableResourceProps) {
  const searching = query.trim().length > 0;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: resource.id,
    disabled: !isAdmin || searching,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    /* Tek satır — konu kartıyla aynı düzen. Telefonda eylemler ikinci
       satıra iniyordu; uzun bir kaynak listesinde her kaynak iki kat yer
       kaplıyordu. Numara (bkz. panel/OrderControl.tsx) sürüklemenin
       yanında duruyor: uzun listede kaynağı başa almak artık tek dokunuş. */
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-1.5 rounded-md bg-accent/30 px-1.5 py-1.5"
    >
      {isAdmin && (
        <OrderControl index={index} total={total} itemLabel="kaynak" onMove={onMove} />
      )}
      {isAdmin && !searching && (
        <button
          className="flex-shrink-0 cursor-grab text-muted-foreground transition-colors hover:text-foreground active:cursor-grabbing"
          aria-label={`${resource.title} sırasını sürükleyerek değiştir`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}
      <div className="flex-shrink-0">{getResourceIcon(resource.resource_type)}</div>
      <div
        className="min-w-0 flex-1 cursor-pointer"
        onClick={() => window.open(resource.resource_url, "_blank")}
      >
        <p className="truncate text-sm font-medium transition-colors hover:text-primary">
          <Highlight text={resource.title} query={query} />
        </p>
        {resource.description && (
          <p className="truncate text-xs text-muted-foreground">
            <Highlight text={resource.description} query={query} />
          </p>
        )}
      </div>
      <div className="flex flex-shrink-0 items-center gap-0.5">
        {isAdmin && (
          <>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onEditResource(resource)}
              className="h-7 w-7 p-0"
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => onDeleteResource(resource.id)}
              className="h-7 w-7 p-0"
            >
              <Trash2 className="h-3 w-3 text-destructive" />
            </Button>
          </>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => window.open(resource.resource_url, "_blank")}
          className="h-7 w-7 p-0"
        >
          <ExternalLink className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
