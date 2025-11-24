import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface StudentLesson {
  id?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

interface EditStudentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStudentUpdated: () => void;
  studentId: string;
  currentName: string;
  currentLessons: StudentLesson[];
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

export function EditStudentDialog({
  open,
  onOpenChange,
  onStudentUpdated,
  studentId,
  currentName,
  currentLessons,
}: EditStudentDialogProps) {
  const [name, setName] = useState("");
  const [lessonsPerWeek, setLessonsPerWeek] = useState(1);
  const [lessons, setLessons] = useState<StudentLesson[]>([{ dayOfWeek: 1, startTime: "", endTime: "" }]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setName(currentName);
      setLessonsPerWeek(currentLessons.length || 1);
      setLessons(
        currentLessons.length > 0
          ? currentLessons
          : [{ dayOfWeek: 1, startTime: "", endTime: "" }]
      );
    }
  }, [open, currentName, currentLessons]);

  useEffect(() => {
    if (lessonsPerWeek > lessons.length) {
      const newLessons = [...lessons];
      for (let i = lessons.length; i < lessonsPerWeek; i++) {
        newLessons.push({ dayOfWeek: 1, startTime: "", endTime: "" });
      }
      setLessons(newLessons);
    } else if (lessonsPerWeek < lessons.length) {
      setLessons(lessons.slice(0, lessonsPerWeek));
    }
  }, [lessonsPerWeek]);

  const updateLesson = (index: number, field: keyof StudentLesson, value: string | number) => {
    const updatedLessons = [...lessons];
    updatedLessons[index] = { ...updatedLessons[index], [field]: value };
    setLessons(updatedLessons);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast({
        title: "Hata",
        description: "Öğrenci adı gereklidir",
        variant: "destructive",
      });
      return;
    }

    if (!lessons.every((lesson) => lesson.dayOfWeek !== undefined && lesson.startTime && lesson.endTime)) {
      toast({
        title: "Hata",
        description: "Tüm ders programı alanlarını doldurun",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Get student's user_id and teacher_id from the students table
      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .select("student_id, teacher_id")
        .eq("id", studentId)
        .single();

      if (studentError) throw studentError;

      // Update student name in profiles
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ full_name: name.trim() })
        .eq("user_id", studentData.student_id);

      if (profileError) throw profileError;

      // Delete existing lessons
      const { error: deleteError } = await supabase
        .from("student_lessons")
        .delete()
        .eq("student_id", studentData.student_id)
        .eq("teacher_id", studentData.teacher_id);

      if (deleteError) throw deleteError;

      // Insert new lessons
      const lessonsToInsert = lessons.map((lesson) => ({
        student_id: studentData.student_id,
        teacher_id: studentData.teacher_id,
        day_of_week: lesson.dayOfWeek,
        start_time: lesson.startTime,
        end_time: lesson.endTime,
      }));

      const { error: insertError } = await supabase.from("student_lessons").insert(lessonsToInsert);

      if (insertError) throw insertError;

      toast({
        title: "Başarılı",
        description: "Öğrenci ayarları güncellendi",
      });

      onStudentUpdated();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Hata",
        description: error.message || "Öğrenci ayarları güncellenemedi",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Öğrenci Ayarları</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Öğrenci Adı</Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ad Soyad"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lessonsPerWeek">Haftalık Ders Sayısı</Label>
            <Select
              value={lessonsPerWeek.toString()}
              onValueChange={(value) => setLessonsPerWeek(Number(value))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                  <SelectItem key={num} value={num.toString()}>
                    {num} ders
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label className="text-base font-medium">Ders Programı</Label>
            {lessons.map((lesson, index) => (
              <div key={index} className="grid grid-cols-3 gap-3 p-3 border rounded-lg">
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
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              İptal
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Kaydet
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
