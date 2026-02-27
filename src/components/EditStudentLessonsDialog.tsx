import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Trash2, GripVertical } from "lucide-react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { StudentLessonBase } from "@/lib/types";
import { DAYS_OF_WEEK } from "@/lib/types";

interface StudentData {
  name: string;
  email: string;
  lessons: StudentLessonBase[];
}

interface EditStudentLessonsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  currentData: StudentData | null;
  onSaveChanges: (studentId: string, name: string, lessons: StudentLessonBase[]) => Promise<void>;
  onRemoveStudent: (studentId: string) => Promise<void>;
}

const daysOfWeek = DAYS_OF_WEEK;

interface SortableLessonItemProps {
  lesson: StudentLessonBase;
  index: number;
  updateLesson: (index: number, field: keyof StudentLessonBase, value: string | number) => void;
  removeLesson: (index: number) => void;
  canRemove: boolean;
}

function SortableLessonItem({ lesson, index, updateLesson, removeLesson, canRemove }: SortableLessonItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: index.toString() });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="grid grid-cols-1 sm:grid-cols-[auto_1fr_1fr_1fr_auto] gap-2 sm:gap-3 p-3 sm:p-4 border rounded-lg"
    >
      <div className="flex items-center">
        <div {...attributes} {...listeners} className="cursor-grab hover:cursor-grabbing rounded hover:bg-accent">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Gün</Label>
        <Select
          value={lesson.dayOfWeek.toString()}
          onValueChange={(value) => updateLesson(index, "dayOfWeek", Number(value))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {daysOfWeek.map((day) => (
              <SelectItem key={day.value} value={day.value.toString()}>
                {day.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Başlangıç</Label>
        <Input
          type="time"
          value={lesson.startTime}
          onChange={(e) => updateLesson(index, "startTime", e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label>Bitiş</Label>
        <Input
          type="time"
          value={lesson.endTime}
          onChange={(e) => updateLesson(index, "endTime", e.target.value)}
          required
        />
      </div>

      <div className="flex items-end">
        <Button type="button" variant="outline" size="sm" onClick={() => removeLesson(index)} disabled={!canRemove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function EditStudentLessonsDialog({
  open,
  onOpenChange,
  studentId,
  currentData,
  onSaveChanges,
  onRemoveStudent,
}: EditStudentLessonsDialogProps) {
  const [name, setName] = useState("");
  const [lessons, setLessons] = useState<StudentLessonBase[]>([{ dayOfWeek: 1, startTime: "", endTime: "" }]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  useEffect(() => {
    if (currentData) {
      setName(currentData.name);
      if (currentData.lessons && currentData.lessons.length > 0) {
        setLessons(currentData.lessons);
      } else {
        setLessons([{ dayOfWeek: 1, startTime: "", endTime: "" }]);
      }
    } else {
      setName("");
      setLessons([{ dayOfWeek: 1, startTime: "", endTime: "" }]);
    }
  }, [currentData]);

  const addLesson = () => {
    if (lessons.length < 6) {
      setLessons([...lessons, { dayOfWeek: 1, startTime: "", endTime: "" }]);
    }
  };

  const removeLesson = (index: number) => {
    if (lessons.length > 1) {
      setLessons(lessons.filter((_, i) => i !== index));
    }
  };

  const updateLesson = (index: number, field: keyof StudentLessonBase, value: string | number) => {
    const updatedLessons = [...lessons];
    updatedLessons[index] = { ...updatedLessons[index], [field]: value };
    setLessons(updatedLessons);
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      setLessons((items) => {
        const oldIndex = parseInt(active.id);
        const newIndex = parseInt(over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const isFormValid = () => {
    return (
      name.trim() && lessons.every((lesson) => lesson.dayOfWeek !== undefined && lesson.startTime && lesson.endTime)
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid()) return;

    setIsLoading(true);
    try {
      await onSaveChanges(studentId, name.trim(), lessons);
      onOpenChange(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemove = async () => {
    setIsRemoving(true);
    try {
      await onRemoveStudent(studentId);
      onOpenChange(false);
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1rem)] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Öğrenci Ayarları</DialogTitle>
          <DialogDescription>Öğrencinin adını ve ders programını güncelleyin.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="student-name">Öğrenci Adı</Label>
            <Input
              id="student-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Öğrenci adını girin"
              required
            />
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label className="text-base font-medium">Ders Programı</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addLesson}
                disabled={lessons.length >= 6}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Ders Ekle
              </Button>
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext
                items={lessons.map((_, index) => index.toString())}
                strategy={verticalListSortingStrategy}
              >
                {lessons.map((lesson, index) => (
                  <SortableLessonItem
                    key={index}
                    lesson={lesson}
                    index={index}
                    updateLesson={updateLesson}
                    removeLesson={removeLesson}
                    canRemove={lessons.length > 1}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2">
            <Button type="button" variant="destructive" onClick={handleRemove} disabled={isLoading || isRemoving} className="w-full sm:w-auto">
              {isRemoving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Öğrenciyi Kaldır
            </Button>

            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading || isRemoving}
              >
                İptal
              </Button>
              <Button type="submit" disabled={isLoading || isRemoving || !isFormValid()}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Değişiklikleri Kaydet
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
