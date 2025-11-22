import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
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
import { supabase } from "@/integrations/supabase/client";
import { RotateCcw } from "lucide-react";

interface LessonTrackerProps {
  studentId: string;
  studentName: string;
  teacherId: string;
}

export function LessonTracker({ studentId, studentName, teacherId }: LessonTrackerProps) {
  const [lessonsPerWeek, setLessonsPerWeek] = useState<number>(1);
  const [completedLessons, setCompletedLessons] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [pendingLesson, setPendingLesson] = useState<number | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchTracking();
  }, [studentId, teacherId]);

  const fetchTracking = async () => {
    try {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from("student_lesson_tracking")
        .select("*")
        .eq("student_id", studentId)
        .eq("teacher_id", teacherId)
        .eq("month_start_date", monthStart.toISOString().split("T")[0])
        .single();

      if (error && error.code !== "PGRST116") throw error;

      if (data) {
        setLessonsPerWeek(data.lessons_per_week);
        setCompletedLessons(data.completed_lessons || []);
      } else {
        // Create initial tracking record
        const { data: newData, error: insertError } = await supabase
          .from("student_lesson_tracking")
          .insert({
            student_id: studentId,
            teacher_id: teacherId,
            lessons_per_week: 1,
            completed_lessons: [],
            month_start_date: monthStart.toISOString().split("T")[0],
          })
          .select()
          .single();

        if (insertError) throw insertError;
        if (newData) {
          setLessonsPerWeek(newData.lessons_per_week);
          setCompletedLessons(newData.completed_lessons || []);
        }
      }
    } catch (error: any) {
      toast({
        title: "Hata",
        description: "Ders takibi yüklenemedi",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateLessonsPerWeek = async (value: number) => {
    try {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const { error } = await supabase
        .from("student_lesson_tracking")
        .update({ lessons_per_week: value })
        .eq("student_id", studentId)
        .eq("teacher_id", teacherId)
        .eq("month_start_date", monthStart.toISOString().split("T")[0]);

      if (error) throw error;

      setLessonsPerWeek(value);
      toast({
        title: "Başarılı",
        description: "Haftalık ders sayısı güncellendi",
      });
    } catch (error: any) {
      toast({
        title: "Hata",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleLessonClick = (lessonNumber: number) => {
    // Check if we can mark this lesson
    if (lessonNumber > 1 && !completedLessons.includes(lessonNumber - 1)) {
      toast({
        title: "Hata",
        description: `${lessonNumber - 1}. ders işaretlenmeden ${lessonNumber}. dersi işaretleyemezsiniz`,
        variant: "destructive",
      });
      return;
    }

    // If already completed, don't allow unchecking
    if (completedLessons.includes(lessonNumber)) {
      return;
    }

    setPendingLesson(lessonNumber);
    setShowConfirm(true);
  };

  const confirmLessonComplete = async () => {
    if (pendingLesson === null) return;

    try {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const newCompletedLessons = [...completedLessons, pendingLesson].sort((a, b) => a - b);

      const { error } = await supabase
        .from("student_lesson_tracking")
        .update({ completed_lessons: newCompletedLessons })
        .eq("student_id", studentId)
        .eq("teacher_id", teacherId)
        .eq("month_start_date", monthStart.toISOString().split("T")[0]);

      if (error) throw error;

      setCompletedLessons(newCompletedLessons);
      toast({
        title: "Başarılı",
        description: `${pendingLesson}. ders işlendi olarak işaretlendi`,
      });
    } catch (error: any) {
      toast({
        title: "Hata",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setShowConfirm(false);
      setPendingLesson(null);
    }
  };

  const handleReset = async () => {
    try {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const { error } = await supabase
        .from("student_lesson_tracking")
        .update({ completed_lessons: [] })
        .eq("student_id", studentId)
        .eq("teacher_id", teacherId)
        .eq("month_start_date", monthStart.toISOString().split("T")[0]);

      if (error) throw error;

      setCompletedLessons([]);
      toast({
        title: "Başarılı",
        description: "İşlenen dersler sıfırlandı",
      });
    } catch (error: any) {
      toast({
        title: "Hata",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setShowResetConfirm(false);
    }
  };

  const totalLessonsPerMonth = lessonsPerWeek * 4;

  // Satır yapılandırması
  const getRowConfig = () => {
    if (lessonsPerWeek === 1) return { rows: 1, buttonsPerRow: 4 };
    if (lessonsPerWeek === 2) return { rows: 2, buttonsPerRow: 4 };
    return { rows: 2, buttonsPerRow: 6 }; // 3 ders için 2 satır, 6-6
  };

  const rowConfig = getRowConfig();

  if (loading) {
    return <div className="animate-pulse h-40 bg-muted rounded-lg"></div>;
  }

  return (
    <>
      <div className="flex items-center gap-3">
        {/* Haftalık Ders Sayısı - Kid-friendly */}
        <div className="border-2 border-primary/30 rounded-xl p-2.5 bg-gradient-to-br from-primary/5 to-secondary/5 shadow-sm">
          <RadioGroup
            value={lessonsPerWeek.toString()}
            onValueChange={(value) => updateLessonsPerWeek(parseInt(value))}
            className="flex flex-col gap-1.5"
          >
            {[1, 2, 3].map((num) => (
              <div key={num} className="flex items-center space-x-2 group">
                <RadioGroupItem
                  value={num.toString()}
                  id={`lesson-${studentId}-${num}`}
                  className="h-4 w-4 border-2 border-primary data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
                <Label
                  htmlFor={`lesson-${studentId}-${num}`}
                  className="cursor-pointer text-sm font-medium text-foreground group-hover:text-primary transition-colors"
                >
                  {num}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        {/* İşlenen Dersler - Kid-friendly */}
        <div className="flex items-center gap-2 border-2 border-primary/30 rounded-xl p-2.5 bg-gradient-to-br from-primary/5 to-secondary/5 shadow-sm">
          <div className="flex flex-col gap-1.5">
            {Array.from({ length: rowConfig.rows }, (_, rowIndex) => (
              <div key={rowIndex} className="flex gap-1.5">
                {Array.from({ length: rowConfig.buttonsPerRow }, (_, colIndex) => {
                  const lessonNumber = rowIndex * rowConfig.buttonsPerRow + colIndex + 1;
                  if (lessonNumber > totalLessonsPerMonth) return null;

                  const isCompleted = completedLessons.includes(lessonNumber);
                  const canSelect = lessonNumber === 1 || completedLessons.includes(lessonNumber - 1);

                  return (
                    <button
                      key={lessonNumber}
                      onClick={() => handleLessonClick(lessonNumber)}
                      disabled={!canSelect || isCompleted}
                      className={`
                        h-8 w-8 rounded-lg border-2 transition-all duration-200 font-semibold text-xs
                        flex items-center justify-center shadow-sm
                        ${
                          isCompleted
                            ? "bg-primary text-primary-foreground border-primary scale-95 shadow-md"
                            : canSelect
                              ? "bg-background border-primary/30 hover:bg-primary/10 hover:scale-105 hover:shadow-md cursor-pointer hover:border-primary"
                              : "bg-muted/50 border-muted-foreground/20 cursor-not-allowed opacity-40"
                        }
                      `}
                      title={`Ders ${lessonNumber}`}
                    >
                      {lessonNumber}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowResetConfirm(true)}
            disabled={completedLessons.length === 0}
            className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive rounded-lg transition-colors"
            title="Sıfırla"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Onaylama Dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dersi İşaretle</AlertDialogTitle>
            <AlertDialogDescription>
              {studentName} için {pendingLesson}. dersi işlendi olarak işaretlemek istiyor musunuz?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingLesson(null)}>Reddet</AlertDialogCancel>
            <AlertDialogAction onClick={confirmLessonComplete}>Onayla</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Sıfırlama Dialog */}
      <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>İşaretlemeleri Sıfırla</AlertDialogTitle>
            <AlertDialogDescription>
              {studentName} için tüm ders işaretlemelerini sıfırlamak istiyor musunuz? Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReset}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sıfırla
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
