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
import { format } from "date-fns";
import { LessonDates, LessonOverrideInfo } from "@/lib/lessonTypes";
import { getSortedLessons } from "@/lib/lessonSorting";
import { recalculateRemainingDates } from "@/lib/lessonDateCalculation";
import { addRegularLessonBalance, subtractRegularLessonBalance } from "@/lib/teacherBalance";
import type { StudentLessonBase } from "@/lib/types";
import { DAYS_OF_WEEK } from "@/lib/types";

interface EditStudentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStudentUpdated: () => void;
  studentId: string;
  currentName: string;
  currentLessons: StudentLessonBase[];
}

const daysOfWeek = DAYS_OF_WEEK;

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
  const [lessons, setLessons] = useState<StudentLessonBase[]>([{ dayOfWeek: 1, startTime: "", endTime: "", note: "" }]);
  const [completedLessons, setCompletedLessons] = useState<number[]>([]);
  const [lessonDates, setLessonDates] = useState<LessonDates>({});
  const [originalLessonDates, setOriginalLessonDates] = useState<LessonDates>({});
  const [lessonOverrides, setLessonOverrides] = useState<LessonOverrideInfo[]>([]);
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
      fetchLessonOverrides();
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

  const fetchLessonOverrides = async () => {
    try {
      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .select("student_id, teacher_id")
        .eq("id", studentId)
        .single();

      if (studentError) throw studentError;

      const { data, error } = await supabase
        .from("lesson_overrides")
        .select("id, original_date, new_date, is_cancelled")
        .eq("student_id", studentData.student_id)
        .eq("teacher_id", studentData.teacher_id);

      if (error) throw error;
      setLessonOverrides(data || []);
    } catch (error: any) {
      console.error("Failed to fetch lesson overrides:", error);
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

  const updateLesson = (index: number, field: keyof StudentLessonBase, value: string | number) => {
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

  const handleDateSubmit = () => {
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

      const nextLesson = completedLessons.length === 0 ? 1 : Math.max(...completedLessons) + 1;
      const newCompletedLessons = [...completedLessons, nextLesson].sort((a, b) => a - b);

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

      await addRegularLessonBalance(studentData.teacher_id, studentData.student_id);

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

      const lastLesson = Math.max(...completedLessons);
      const newCompletedLessons = completedLessons.filter(l => l !== lastLesson);

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

      await subtractRegularLessonBalance(studentData.teacher_id, studentData.student_id);

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

  const handleResetAllLessons = async () => {
    try {
      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .select("student_id, teacher_id")
        .eq("id", studentId)
        .single();

      if (studentError) throw studentError;

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

      // IMPORTANT: Only resets student tracking, NOT teacher balance
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
        const changedKeys = Object.keys(lessonDates).filter(
          (key) => lessonDates[key] !== originalLessonDates[key]
        );

        if (changedKeys.length > 0) {
          const firstChangedLesson = Math.min(...changedKeys.map(Number));
          const lessonDays = lessons.map((l) => l.dayOfWeek).sort((a, b) => a - b);
          const totalLessons = lessonsPerWeek * 4;
          finalDates = recalculateRemainingDates(
            firstChangedLesson,
            lessonDates[firstChangedLesson.toString()],
            lessonDates,
            lessonDays,
            totalLessons
          );
        }
      }

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
      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .select("student_id, teacher_id")
        .eq("id", studentId)
        .single();

      if (studentError) throw studentError;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ full_name: name.trim() })
        .eq("user_id", studentData.student_id);

      if (profileError) throw profileError;

      const { error: deleteError } = await supabase
        .from("student_lessons")
        .delete()
        .eq("student_id", studentData.student_id)
        .eq("teacher_id", studentData.teacher_id);

      if (deleteError) throw deleteError;

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

      await supabase
        .from("student_resource_completion")
        .delete()
        .eq("student_id", studentData.student_id);

      await supabase
        .from("student_lesson_tracking")
        .delete()
        .eq("student_id", studentData.student_id)
        .eq("teacher_id", studentData.teacher_id);

      await supabase
        .from("student_lessons")
        .delete()
        .eq("student_id", studentData.student_id)
        .eq("teacher_id", studentData.teacher_id);

      await supabase
        .from("homework_submissions")
        .delete()
        .eq("student_id", studentData.student_id)
        .eq("teacher_id", studentData.teacher_id);

      await supabase.from("students").delete().eq("id", studentId);
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

  // Build sorted lessons for the date display section
  const totalLessons = lessonsPerWeek * 4;
  const sortedLessonsForDisplay = (() => {
    const lessonsWithDates: { lessonNumber: number; originalDate: string; effectiveDate: string; isCancelled: boolean; isOverridden: boolean }[] = [];
    
    for (let i = 1; i <= totalLessons; i++) {
      const originalDate = lessonDates[i.toString()];
      if (!originalDate) {
        lessonsWithDates.push({
          lessonNumber: i,
          originalDate: "",
          effectiveDate: "",
          isCancelled: false,
          isOverridden: false,
        });
        continue;
      }
      
      const override = lessonOverrides.find((o) => o.original_date === originalDate);
      const isCancelled = override?.is_cancelled || false;
      const effectiveDate = override && override.new_date && !isCancelled 
        ? override.new_date 
        : originalDate;
      
      lessonsWithDates.push({
        lessonNumber: i,
        originalDate,
        effectiveDate,
        isCancelled,
        isOverridden: effectiveDate !== originalDate,
      });
    }
    
    const sorted = [...lessonsWithDates].filter(l => l.originalDate).sort((a, b) => {
      if (a.isCancelled && b.isCancelled) return a.originalDate.localeCompare(b.originalDate);
      if (a.isCancelled) return a.originalDate.localeCompare(b.effectiveDate);
      if (b.isCancelled) return a.effectiveDate.localeCompare(b.originalDate);
      return a.effectiveDate.localeCompare(b.effectiveDate);
    });
    
    const lessonsWithoutDates = lessonsWithDates.filter(l => !l.originalDate);
    return [...sorted, ...lessonsWithoutDates];
  })();

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
              {sortedLessonsForDisplay.map((lesson, displayIndex) => (
                <div key={lesson.lessonNumber} className={`flex items-center gap-3 p-3 border rounded-lg ${
                  lesson.isCancelled ? "opacity-50 bg-muted" : ""
                } ${lesson.isOverridden ? "border-amber-500" : ""}`}>
                  <div className="flex items-center gap-2 flex-1">
                    <div 
                      className={`h-4 w-4 rounded-full ${
                        lesson.isCancelled 
                          ? "bg-muted-foreground" 
                          : completedLessons.includes(lesson.lessonNumber) 
                            ? "bg-primary" 
                            : "bg-muted"
                      }`} 
                    />
                    <span className={`font-medium ${
                      lesson.isCancelled 
                        ? "text-muted-foreground line-through" 
                        : completedLessons.includes(lesson.lessonNumber) 
                          ? "text-foreground" 
                          : "text-muted-foreground"
                    }`}>
                      Ders {displayIndex + 1}
                      {lesson.isCancelled && " (İptal)"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className={`text-sm ${lesson.isOverridden ? "text-amber-600 font-medium" : "text-muted-foreground"}`}>
                      {lesson.isOverridden ? "Yeni Tarih:" : "Tarih:"}
                    </Label>
                    <Input
                      type="date"
                      value={lessonDates[lesson.lessonNumber.toString()] || ""}
                      onChange={(e) => updateLessonDate(lesson.lessonNumber, e.target.value)}
                      className={`w-40 ${lesson.isOverridden ? "border-amber-500" : ""}`}
                      disabled={lesson.isCancelled}
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
                        description: error.message,
                        variant: "destructive",
                      });
                    } finally {
                      setLoading(false);
                    }
                  }
                }}
                className="flex items-center gap-2"
              >
                <Archive className="h-4 w-4" />
                Arşivle
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  const confirmed = window.confirm(
                    `${currentName} adlı öğrenciyi kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz ve tüm verileri silinecektir.`
                  );
                  if (confirmed) {
                    handleDeleteStudent();
                  }
                }}
                className="flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Kalıcı Sil
              </Button>
            </div>
          </div>

          <Separator className="my-4" />

          <div className="flex gap-3">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Kaydet
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              İptal
            </Button>
          </div>
        </form>

        {/* Tarih onaylama dialogu */}
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
                id="updateRemaining"
                checked={updateRemainingDays}
                onCheckedChange={(checked) => setUpdateRemainingDays(!!checked)}
              />
              <label
                htmlFor="updateRemaining"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Kalan günleri de güncelle
              </label>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>İptal</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDateUpdate}>Onayla</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Sıfırlama onaylama dialogu */}
        <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Tüm Dersleri Sıfırla</AlertDialogTitle>
              <AlertDialogDescription>
                Tüm işlenen dersleri ve tarihleri sıfırlamak istediğinize emin misiniz? 
                Bu işlem öğretmen bakiyesini etkilemez.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>İptal</AlertDialogCancel>
              <AlertDialogAction onClick={handleResetAllLessons}>Sıfırla</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
