import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Trash2 } from "lucide-react";

interface StudentLesson {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

interface AddStudentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddStudent: (studentEmail: string, lessons: StudentLesson[]) => Promise<void>;
}

const daysOfWeek = [
  { value: 1, label: "Pazartesi" },
  { value: 2, label: "Salı" },
  { value: 3, label: "Çarşamba" },
  { value: 4, label: "Perşembe" },
  { value: 5, label: "Cuma" },
  { value: 6, label: "Cumartesi" },
  { value: 0, label: "Pazar" },
];

export function AddStudentDialog({ open, onOpenChange, onAddStudent }: AddStudentDialogProps) {
  const [email, setEmail] = useState("");
  const [lessons, setLessons] = useState<StudentLesson[]>([{ dayOfWeek: 1, startTime: "", endTime: "" }]);
  const [isLoading, setIsLoading] = useState(false);

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

  const updateLesson = (index: number, field: keyof StudentLesson, value: string | number) => {
    const updatedLessons = [...lessons];
    updatedLessons[index] = { ...updatedLessons[index], [field]: value };
    setLessons(updatedLessons);
  };

  const isFormValid = () => {
    return (
      email.trim() && lessons.every((lesson) => lesson.dayOfWeek !== undefined && lesson.startTime && lesson.endTime)
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid()) return;

    setIsLoading(true);
    try {
      await onAddStudent(email.trim(), lessons);
      setEmail("");
      setLessons([{ dayOfWeek: 1, startTime: "", endTime: "" }]);
      onOpenChange(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Öğrenci Ekle</DialogTitle>
          <DialogDescription>
            Sınıfınıza eklemek istediğiniz öğrencinin e-posta adresini girin. Öğrencinin platformda zaten bir hesabı
            olmalıdır.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email">Öğrenci E-postası</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ogrenci@example.com"
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

            {lessons.map((lesson, index) => (
              <div key={index} className="grid grid-cols-4 gap-3 p-4 border rounded-lg">
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
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeLesson(index)}
                    disabled={lessons.length === 1}
                    className="w-full"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}

            <p className="text-sm text-muted-foreground">Haftada en fazla 6 ders ekleyebilirsiniz.</p>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              İptal
            </Button>
            <Button type="submit" disabled={isLoading || !isFormValid()}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Öğrenci Ekle
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
