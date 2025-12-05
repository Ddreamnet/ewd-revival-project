import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, Archive } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays, parse } from "date-fns";

interface StudentLesson {
  id?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  note?: string;
}

interface LessonDates {
  [key: string]: string;
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
  const [lessons, setLessons] = useState<StudentLesson[]>([{ dayOfWeek: 1, startTime: "", endTime: "", note: "" }]);
  const [completedLessons, setCompletedLessons] = useState<number[]>([]);
  const [lessonDates, setLessonDates] = useState<LessonDates>({});
  const [originalLessonDates, setOriginalLessonDates] = useState<LessonDates>({});
  const [trackingRecordId, setTrackingRecordId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [updateRemainingDays, setUpdateRemainingDays] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setName(currentName);
      setLessonsPerWeek(currentLessons.length || 1);
      setLessons(
        currentLessons.length > 0
          ? currentLessons
          : [{ dayOfWeek: 1, startTime: "", endTime: "", note: "" }]
      );
      fetchLessonTracking();
    }
  }, [open, currentName, currentLessons]);

  const fetchLessonTracking = async () => {
    try {
      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .select("student_id, teacher_id")
        .eq("id", studentId)
        .single();

      if (studentError) throw studentError;

      // CRITICAL: Get the MOST RECENT tracking record by ordering by updated_at DESC
      // This ensures consistent results when multiple records exist
      const { data: records, error } = await supabase
        .from("student_lesson_tracking")
        .select("*")
        .eq("student_id", studentData.student_id)
        .eq("teacher_id", studentData.teacher_id)
        .order("updated_at", { ascending: false })
        .limit(1);

      if (error) throw error;

      if (records && records.length > 0) {
        const data = records[0];
        setTrackingRecordId(data.id);
        setCompletedLessons((data as any).completed_lessons || []);
        const dates = (data as any).lesson_dates || {};
        setLessonDates(dates);
        setOriginalLessonDates(dates);
      } else {
        setTrackingRecordId(null);
      }
    } catch (error: any) {
      console.error("Failed to fetch lesson tracking:", error);
    }
  };

  useEffect(() => {
    if (lessonsPerWeek > lessons.length) {
      const newLessons = [...lessons];
      for (let i = lessons.length; i < lessonsPerWeek; i++) {
        newLessons.push({ dayOfWeek: 1, startTime: "", endTime: "", note: "" });
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

  const updateLessonDate = (lessonNumber: number, dateStr: string) => {
    setLessonDates({
      ...lessonDates,
      [lessonNumber.toString()]: dateStr,
    });
  };

  const recalculateRemainingDates = (fromLessonNumber: number, startDate: string): LessonDates => {
    const newDates = { ...lessonDates };
    const lessonDays = lessons.map((l) => l.dayOfWeek).sort((a, b) => a - b);
    const totalLessons = lessonsPerWeek * 4;
    
    // Set the changed lesson's date
    newDates[fromLessonNumber.toString()] = startDate;
    
    // Recalculate PREVIOUS lessons (going backwards)
    let currentDate = parse(startDate, "yyyy-MM-dd", new Date());
    currentDate.setHours(0, 0, 0, 0);
    
    for (let i = fromLessonNumber - 1; i >= 1; i--) {
      // Find the previous lesson day (going backwards)
      let daysToSubtract = 1;
      let prevDate = addDays(currentDate, -daysToSubtract);
      
      while (!lessonDays.includes(prevDate.getDay())) {
        daysToSubtract++;
        prevDate = addDays(currentDate, -daysToSubtract);
      }
      
      currentDate = prevDate;
      newDates[i.toString()] = format(currentDate, "yyyy-MM-dd");
    }
    
    // Recalculate FUTURE lessons (going forwards)
    currentDate = parse(startDate, "yyyy-MM-dd", new Date());
    currentDate.setHours(0, 0, 0, 0);
    
    for (let i = fromLessonNumber + 1; i <= totalLessons; i++) {
      // Find the next lesson day
      let daysToAdd = 1;
      let nextDate = addDays(currentDate, daysToAdd);
      
      while (!lessonDays.includes(nextDate.getDay())) {
        daysToAdd++;
        nextDate = addDays(currentDate, daysToAdd);
      }
      
      currentDate = nextDate;
      newDates[i.toString()] = format(currentDate, "yyyy-MM-dd");
    }
    
    return newDates;
  };

  const handleDateSubmit = () => {
    // Check if dates have changed
    const hasChanges = Object.keys(lessonDates).some(
      (key) => lessonDates[key] !== originalLessonDates[key]
    );

    if (hasChanges) {
      setShowConfirm(true);
    } else {
      toast({
        title: "Bilgi",
        description: "Hiçbir değişiklik yapılmadı",
      });
    }
  };

  const handleMarkLastLesson = async () => {
    try {
      const totalLessons = lessonsPerWeek * 4;
      if (completedLessons.length >= totalLessons) return;

      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .select("student_id, teacher_id")
        .eq("id", studentId)
        .single();

      if (studentError) throw studentError;

      // Get the next lesson to mark (last completed + 1, or 1 if none completed)
      const nextLesson = completedLessons.length === 0 ? 1 : Math.max(...completedLessons) + 1;
      const newCompletedLessons = [...completedLessons, nextLesson].sort((a, b) => a - b);

      // CRITICAL: Get the most recent tracking record ID and update by ID
      const { data: existingRecords } = await supabase
        .from("student_lesson_tracking")
        .select("id")
        .eq("student_id", studentData.student_id)
        .eq("teacher_id", studentData.teacher_id)
        .order("updated_at", { ascending: false })
        .limit(1);

      if (!existingRecords || existingRecords.length === 0) {
        throw new Error("Ders takip kaydı bulunamadı");
      }

      const { error } = await supabase
        .from("student_lesson_tracking")
        .update({ completed_lessons: newCompletedLessons })
        .eq("id", existingRecords[0].id);

      if (error) throw error;

      // Update teacher balance
      await updateTeacherBalance(studentData.teacher_id, studentData.student_id);

      setCompletedLessons(newCompletedLessons);
      toast({
        title: "Başarılı",
        description: `${nextLesson}. ders işaretlendi`,
      });
    } catch (error: any) {
      toast({
        title: "Hata",
        description: error.message || "Ders işaretlenemedi",
        variant: "destructive",
      });
    }
  };

  const handleUndoLastLesson = async () => {
    try {
      if (completedLessons.length === 0) return;

      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .select("student_id, teacher_id")
        .eq("id", studentId)
        .single();

      if (studentError) throw studentError;

      // Get the last completed lesson
      const lastLesson = Math.max(...completedLessons);
      const newCompletedLessons = completedLessons.filter(l => l !== lastLesson);

      // CRITICAL: Get the most recent tracking record ID and update by ID
      const { data: existingRecords } = await supabase
        .from("student_lesson_tracking")
        .select("id")
        .eq("student_id", studentData.student_id)
        .eq("teacher_id", studentData.teacher_id)
        .order("updated_at", { ascending: false })
        .limit(1);

      if (!existingRecords || existingRecords.length === 0) {
        throw new Error("Ders takip kaydı bulunamadı");
      }

      const { error } = await supabase
        .from("student_lesson_tracking")
        .update({ completed_lessons: newCompletedLessons })
        .eq("id", existingRecords[0].id);

      if (error) throw error;

      // Subtract from teacher balance
      await subtractFromTeacherBalance(studentData.teacher_id, studentData.student_id);

      setCompletedLessons(newCompletedLessons);
      toast({
        title: "Başarılı",
        description: `${lastLesson}. ders geri alındı`,
      });
    } catch (error: any) {
      toast({
        title: "Hata",
        description: error.message || "Ders geri alınamadı",
        variant: "destructive",
      });
    }
  };

  const updateTeacherBalance = async (teacherId: string, studentId: string) => {
    try {
      // Get lesson duration
      const { data: lessonData } = await supabase
        .from("student_lessons")
        .select("start_time, end_time")
        .eq("student_id", studentId)
        .eq("teacher_id", teacherId)
        .limit(1)
        .single();

      if (!lessonData) return;

      const startTime = new Date(`2000-01-01T${lessonData.start_time}`);
      const endTime = new Date(`2000-01-01T${lessonData.end_time}`);
      const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);

      // Check if teacher balance exists
      const { data: existingBalance } = await supabase
        .from("teacher_balance")
        .select("*")
        .eq("teacher_id", teacherId)
        .maybeSingle();

      if (existingBalance) {
        // Update existing balance
        await supabase
          .from("teacher_balance")
          .update({
            total_minutes: existingBalance.total_minutes + durationMinutes,
            completed_regular_lessons: existingBalance.completed_regular_lessons + 1,
            regular_lessons_minutes: existingBalance.regular_lessons_minutes + durationMinutes,
          })
          .eq("teacher_id", teacherId);
      } else {
        // Create new balance
        await supabase.from("teacher_balance").insert({
          teacher_id: teacherId,
          total_minutes: durationMinutes,
          completed_regular_lessons: 1,
          completed_trial_lessons: 0,
          regular_lessons_minutes: durationMinutes,
          trial_lessons_minutes: 0,
        });
      }
    } catch (error) {
      console.error("Error updating teacher balance:", error);
    }
  };

  const subtractFromTeacherBalance = async (teacherId: string, studentId: string) => {
    try {
      // Get lesson duration
      const { data: lessonData } = await supabase
        .from("student_lessons")
        .select("start_time, end_time")
        .eq("student_id", studentId)
        .eq("teacher_id", teacherId)
        .limit(1)
        .single();

      if (!lessonData) return;

      const startTime = new Date(`2000-01-01T${lessonData.start_time}`);
      const endTime = new Date(`2000-01-01T${lessonData.end_time}`);
      const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);

      // Get current balance
      const { data: existingBalance } = await supabase
        .from("teacher_balance")
        .select("*")
        .eq("teacher_id", teacherId)
        .maybeSingle();

      if (existingBalance) {
        // Subtract from existing balance
        await supabase
          .from("teacher_balance")
          .update({
            total_minutes: Math.max(0, existingBalance.total_minutes - durationMinutes),
            completed_regular_lessons: Math.max(0, existingBalance.completed_regular_lessons - 1),
            regular_lessons_minutes: Math.max(0, existingBalance.regular_lessons_minutes - durationMinutes),
          })
          .eq("teacher_id", teacherId);
      }
    } catch (error) {
      console.error("Error subtracting from teacher balance:", error);
    }
  };

  const handleResetAllLessons = async () => {
    try {
      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .select("student_id, teacher_id")
        .eq("id", studentId)
        .single();

      if (studentError) throw studentError;

      // CRITICAL: Get the most recent tracking record ID and update by ID
      const { data: existingRecords } = await supabase
        .from("student_lesson_tracking")
        .select("id")
        .eq("student_id", studentData.student_id)
        .eq("teacher_id", studentData.teacher_id)
        .order("updated_at", { ascending: false })
        .limit(1);

      if (!existingRecords || existingRecords.length === 0) {
        throw new Error("Ders takip kaydı bulunamadı");
      }

      // IMPORTANT: Bu fonksiyon sadece öğrencinin ders takibini sıfırlar (yeni ay için).
      // Öğretmen bu dersleri zaten işlemiş olduğundan, öğretmen bakiyesinden eksilme YAPILMAMALIDIR.
      const { error } = await supabase
        .from("student_lesson_tracking")
        .update({ 
          completed_lessons: [],
          lesson_dates: {}
        })
        .eq("id", existingRecords[0].id);

      if (error) throw error;

      setCompletedLessons([]);
      setLessonDates({});
      setOriginalLessonDates({});
      setShowResetConfirm(false);
      
      toast({
        title: "Başarılı",
        description: "Tüm dersler sıfırlandı (Öğretmen bakiyesi korundu)",
      });
    } catch (error: any) {
      toast({
        title: "Hata",
        description: error.message || "Dersler sıfırlanamadı",
        variant: "destructive",
      });
    }
  };

  const confirmDateUpdate = async () => {
    try {
      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .select("student_id, teacher_id")
        .eq("id", studentId)
        .single();

      if (studentError) throw studentError;

      let finalDates = lessonDates;

      if (updateRemainingDays) {
        // Find the first changed date
        const changedKeys = Object.keys(lessonDates).filter(
          (key) => lessonDates[key] !== originalLessonDates[key]
        );

        if (changedKeys.length > 0) {
          const firstChangedLesson = Math.min(...changedKeys.map(Number));
          finalDates = recalculateRemainingDates(firstChangedLesson, lessonDates[firstChangedLesson.toString()]);
        }
      }

      // CRITICAL: Get the most recent tracking record ID and update by ID
      const { data: existingRecords } = await supabase
        .from("student_lesson_tracking")
        .select("id")
        .eq("student_id", studentData.student_id)
        .eq("teacher_id", studentData.teacher_id)
        .order("updated_at", { ascending: false })
        .limit(1);

      if (!existingRecords || existingRecords.length === 0) {
        throw new Error("Ders takip kaydı bulunamadı");
      }

      const { error } = await supabase
        .from("student_lesson_tracking")
        .update({ lesson_dates: finalDates })
        .eq("id", existingRecords[0].id);

      if (error) throw error;

      toast({
        title: "Başarılı",
        description: "Ders tarihleri güncellendi",
      });

      setOriginalLessonDates(finalDates);
      setLessonDates(finalDates);
      setShowConfirm(false);
      setUpdateRemainingDays(false);
    } catch (error: any) {
      toast({
        title: "Hata",
        description: error.message || "Tarihler güncellenemedi",
        variant: "destructive",
      });
    }
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
        note: lesson.note || null,
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

  const handleDeleteStudent = async () => {
    setLoading(true);
    try {
      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .select("student_id, teacher_id")
        .eq("id", studentId)
        .single();

      if (studentError) throw studentError;

      // Delete all related data
      // 1. Delete student topics and resources
      const { data: topics } = await supabase
        .from("topics")
        .select("id")
        .eq("student_id", studentData.student_id)
        .eq("teacher_id", studentData.teacher_id);

      if (topics && topics.length > 0) {
        const topicIds = topics.map((t) => t.id);
        await supabase.from("resources").delete().in("topic_id", topicIds);
        await supabase.from("topics").delete().in("id", topicIds);
      }

      // 2. Delete student resource completion
      await supabase
        .from("student_resource_completion")
        .delete()
        .eq("student_id", studentData.student_id);

      // 3. Delete student lesson tracking
      await supabase
        .from("student_lesson_tracking")
        .delete()
        .eq("student_id", studentData.student_id)
        .eq("teacher_id", studentData.teacher_id);

      // 4. Delete student lessons
      await supabase
        .from("student_lessons")
        .delete()
        .eq("student_id", studentData.student_id)
        .eq("teacher_id", studentData.teacher_id);

      // 5. Delete homework submissions (both from and to student)
      await supabase
        .from("homework_submissions")
        .delete()
        .eq("student_id", studentData.student_id)
        .eq("teacher_id", studentData.teacher_id);

      // 6. Delete student-teacher relationship
      await supabase.from("students").delete().eq("id", studentId);

      // 7. Delete profile (user account)
      await supabase.from("profiles").delete().eq("user_id", studentData.student_id);

      toast({
        title: "Başarılı",
        description: "Öğrenci ve tüm verileri silindi",
      });

      onStudentUpdated();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Hata",
        description: error.message || "Öğrenci silinemedi",
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
              <div key={index} className="grid grid-cols-4 gap-3 p-3 border rounded-lg">
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

                <div className="space-y-2">
                  <Label>Not</Label>
                  <Input
                    type="text"
                    value={lesson.note || ""}
                    onChange={(e) => updateLesson(index, "note", e.target.value)}
                    placeholder="Opsiyonel"
                  />
                </div>
              </div>
            ))}
          </div>

          <Separator className="my-4" />

          {/* İşlenen Dersler Bölümü */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base font-medium">İşlenen Dersler</Label>
                <p className="text-sm text-muted-foreground">
                  Ders tarihlerini düzenleyebilir ve güncelleyebilirsiniz.
                </p>
              </div>
              <div className="flex gap-2">
                {completedLessons.length < lessonsPerWeek * 4 && (
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={handleMarkLastLesson}
                    disabled={loading}
                  >
                    Son Dersi İşaretle
                  </Button>
                )}
                {completedLessons.length > 0 && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleUndoLastLesson}
                      disabled={loading}
                    >
                      Son Dersi Geri Al
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => setShowResetConfirm(true)}
                      disabled={loading}
                    >
                      Sıfırla
                    </Button>
                  </>
                )}
              </div>
            </div>
            <div className="space-y-2">
              {Array.from({ length: lessonsPerWeek * 4 }, (_, i) => i + 1).map((lessonNumber) => (
                <div key={lessonNumber} className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className="flex items-center gap-2 flex-1">
                    <div 
                      className={`h-4 w-4 rounded-full ${
                        completedLessons.includes(lessonNumber) ? "bg-primary" : "bg-muted"
                      }`} 
                    />
                    <span className={`font-medium ${
                      completedLessons.includes(lessonNumber) ? "text-foreground" : "text-muted-foreground"
                    }`}>
                      Ders {lessonNumber}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm text-muted-foreground">Tarih:</Label>
                    <Input
                      type="date"
                      value={lessonDates[lessonNumber.toString()] || ""}
                      onChange={(e) => updateLessonDate(lessonNumber, e.target.value)}
                      className="w-40"
                    />
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="default"
                onClick={handleDateSubmit}
                disabled={loading || Object.keys(lessonDates).every(
                  (key) => lessonDates[key] === originalLessonDates[key]
                )}
                className="w-full"
              >
                Tarihleri Onayla
              </Button>
            </div>
          </div>

          <Separator className="my-4" />

          {/* Öğrenci Silme Bölümü */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base font-medium text-destructive">Tehlikeli Alan</Label>
                <p className="text-sm text-muted-foreground">
                  Öğrenciyi arşivleyin veya kalıcı olarak silin.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  const confirmed = window.confirm(
                    `${currentName} adlı öğrenciyi arşivlemek istediğinize emin misiniz? Öğrenci ders programından ve listeden kaldırılacak, ancak tüm verileri korunacaktır. İstediğiniz zaman geri alabilirsiniz.`
                  );
                  if (confirmed) {
                    setLoading(true);
                    try {
                      const { error } = await supabase
                        .from("students")
                        .update({ is_archived: true, archived_at: new Date().toISOString() })
                        .eq("id", studentId);

                      if (error) throw error;

                      toast({
                        title: "Başarılı",
                        description: "Öğrenci arşivlendi",
                      });

                      onStudentUpdated();
                      onOpenChange(false);
                    } catch (error: any) {
                      toast({
                        title: "Hata",
                        description: error.message || "Öğrenci arşivlenemedi",
                        variant: "destructive",
                      });
                    } finally {
                      setLoading(false);
                    }
                  }
                }}
                disabled={loading}
                className="w-full"
              >
                <Archive className="h-4 w-4 mr-2" />
                Arşivle
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  const confirmed = window.confirm(
                    `${currentName} adlı öğrenciyi silmek istediğinize emin misiniz? Bu işlem geri alınamaz ve öğrencinin tüm verileri (dersler, ödevler, konular, kaynaklar) silinecektir.`
                  );
                  if (confirmed) {
                    handleDeleteStudent();
                  }
                }}
                disabled={loading}
                className="w-full"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Sil
              </Button>
            </div>
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

      {/* Tarih Güncelleme Onay Dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ders Tarihlerini Güncelle</AlertDialogTitle>
            <AlertDialogDescription>
              Ders tarihlerini güncellemek istediğinize emin misiniz?
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="flex items-center space-x-2 py-4">
            <Checkbox
              id="update-remaining"
              checked={updateRemainingDays}
              onCheckedChange={(checked) => setUpdateRemainingDays(checked as boolean)}
            />
            <Label htmlFor="update-remaining" className="cursor-pointer font-normal">
              Kalan günleri de güncelle
            </Label>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setUpdateRemainingDays(false)}>İptal</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDateUpdate}>Onayla</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Ders Sıfırlama Onay Dialog */}
      <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tüm Dersleri Sıfırla</AlertDialogTitle>
            <AlertDialogDescription>
              Öğrencinin bu aydaki tüm ders kayıtları sıfırlanacaktır (yeni ay için). 
              Öğretmen bu dersleri işlediği için öğretmen bakiyesi KORUNACAKTIR ve etkilenmeyecektir.
              Bu işlem geri alınamaz. Devam etmek istiyor musunuz?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetAllLessons} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Sıfırla
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
