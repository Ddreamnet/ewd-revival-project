import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AddTrialLessonDialog } from "./AddTrialLessonDialog";

interface StudentLesson {
  id: string;
  student_id: string;
  student_name: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

interface TrialLesson {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_completed: boolean;
}

interface AdminWeeklyScheduleProps {
  teacherId: string;
}

const DAYS = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
const STUDENT_COLORS = [
  "bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-300",
  "bg-green-100 text-green-800 hover:bg-green-200 border-green-300",
  "bg-purple-100 text-purple-800 hover:bg-purple-200 border-purple-300",
  "bg-orange-100 text-orange-800 hover:bg-orange-200 border-orange-300",
  "bg-pink-100 text-pink-800 hover:bg-pink-200 border-pink-300",
  "bg-cyan-100 text-cyan-800 hover:bg-cyan-200 border-cyan-300",
];

export function AdminWeeklySchedule({ teacherId }: AdminWeeklyScheduleProps) {
  const [lessons, setLessons] = useState<StudentLesson[]>([]);
  const [trialLessons, setTrialLessons] = useState<TrialLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentColors, setStudentColors] = useState<Map<string, string>>(new Map());
  const [showAddTrial, setShowAddTrial] = useState(false);
  const [selectedTrialLesson, setSelectedTrialLesson] = useState<TrialLesson | null>(null);
  const [showMarkAlert, setShowMarkAlert] = useState(false);
  const [showUnmarkAlert, setShowUnmarkAlert] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchSchedule();
  }, [teacherId]);

  const fetchSchedule = async () => {
    try {
      setLoading(true);

      // Fetch regular lessons
      const { data: lessonsData, error: lessonsError } = await supabase
        .from("student_lessons")
        .select("id, student_id, day_of_week, start_time, end_time")
        .eq("teacher_id", teacherId);

      if (lessonsError) throw lessonsError;

      // Fetch student names
      const studentIds = [...new Set(lessonsData?.map((l) => l.student_id) || [])];
      const { data: studentsData, error: studentsError } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", studentIds);

      if (studentsError) throw studentsError;

      // Create student name map
      const nameMap = new Map(studentsData?.map((s) => [s.user_id, s.full_name]) || []);

      // Assign colors to students
      const colorMap = new Map<string, string>();
      studentIds.forEach((id, index) => {
        colorMap.set(id, STUDENT_COLORS[index % STUDENT_COLORS.length]);
      });
      setStudentColors(colorMap);

      // Format lessons with names
      const formattedLessons =
        lessonsData?.map((lesson) => ({
          ...lesson,
          student_name: nameMap.get(lesson.student_id) || "Bilinmeyen",
        })) || [];

      setLessons(formattedLessons);

      // Fetch trial lessons
      const { data: trialData, error: trialError } = await supabase
        .from("trial_lessons")
        .select("*")
        .eq("teacher_id", teacherId)
        .eq("lesson_date", new Date().toISOString().split("T")[0]);

      if (trialError) throw trialError;

      setTrialLessons(trialData || []);
    } catch (error: any) {
      toast({
        title: "Hata",
        description: "Ders programı yüklenemedi",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (time: string) => {
    return new Date(`2000-01-01T${time}`).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getAllTimeSlots = () => {
    const allTimes = [
      ...lessons.map((l) => l.start_time),
      ...trialLessons.map((l) => l.start_time),
    ];
    return [...new Set(allTimes)].sort();
  };

  const getLessonForDayAndTime = (dayIndex: number, timeSlot: string) => {
    return lessons.find((l) => l.day_of_week === dayIndex && l.start_time === timeSlot);
  };

  const getTrialLessonForDayAndTime = (dayIndex: number, timeSlot: string) => {
    return trialLessons.find((l) => l.day_of_week === dayIndex && l.start_time === timeSlot);
  };

  const handleTrialLessonClick = (trial: TrialLesson) => {
    setSelectedTrialLesson(trial);
    if (trial.is_completed) {
      setShowUnmarkAlert(true);
    } else {
      setShowMarkAlert(true);
    }
  };

  const handleMarkComplete = async () => {
    if (!selectedTrialLesson) return;

    try {
      const { error } = await supabase
        .from("trial_lessons")
        .update({ is_completed: true })
        .eq("id", selectedTrialLesson.id);

      if (error) throw error;

      // Update teacher balance
      await updateTeacherBalance(selectedTrialLesson);

      toast({
        title: "Başarılı",
        description: "Ders işlendi olarak işaretlendi",
      });

      fetchSchedule();
    } catch (error: any) {
      toast({
        title: "Hata",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setShowMarkAlert(false);
      setSelectedTrialLesson(null);
    }
  };

  const handleMarkIncomplete = async () => {
    if (!selectedTrialLesson) return;

    try {
      const { error } = await supabase
        .from("trial_lessons")
        .update({ is_completed: false })
        .eq("id", selectedTrialLesson.id);

      if (error) throw error;

      // Subtract from teacher balance
      await subtractFromTeacherBalance(selectedTrialLesson);

      toast({
        title: "Başarılı",
        description: "Ders işlenmedi olarak geri alındı",
      });

      fetchSchedule();
    } catch (error: any) {
      toast({
        title: "Hata",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setShowUnmarkAlert(false);
      setSelectedTrialLesson(null);
    }
  };

  const updateTeacherBalance = async (lesson: TrialLesson) => {
    try {
      const startTime = new Date(`2000-01-01T${lesson.start_time}`);
      const endTime = new Date(`2000-01-01T${lesson.end_time}`);
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
            completed_trial_lessons: existingBalance.completed_trial_lessons + 1,
          })
          .eq("teacher_id", teacherId);
      } else {
        // Create new balance
        await supabase.from("teacher_balance").insert({
          teacher_id: teacherId,
          total_minutes: durationMinutes,
          completed_regular_lessons: 0,
          completed_trial_lessons: 1,
        });
      }
    } catch (error) {
      console.error("Error updating teacher balance:", error);
    }
  };

  const subtractFromTeacherBalance = async (lesson: TrialLesson) => {
    try {
      const startTime = new Date(`2000-01-01T${lesson.start_time}`);
      const endTime = new Date(`2000-01-01T${lesson.end_time}`);
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
            completed_trial_lessons: Math.max(0, existingBalance.completed_trial_lessons - 1),
          })
          .eq("teacher_id", teacherId);
      }
    } catch (error) {
      console.error("Error subtracting from teacher balance:", error);
    }
  };

  const timeSlots = getAllTimeSlots();

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  if (lessons.length === 0 && trialLessons.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Haftalık Ders Programı</CardTitle>
            <Button onClick={() => setShowAddTrial(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Deneme Ekle
            </Button>
          </div>
        </CardHeader>
        <CardContent className="text-center py-8 text-muted-foreground">
          Bu öğretmenin henüz ders programı yok.
        </CardContent>
        <AddTrialLessonDialog
          open={showAddTrial}
          onOpenChange={setShowAddTrial}
          teacherId={teacherId}
          onSuccess={fetchSchedule}
        />
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Haftalık Ders Programı</CardTitle>
            <Button onClick={() => setShowAddTrial(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Deneme Ekle
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="border border-border p-2 bg-muted font-medium text-sm">Saat</th>
                  {DAYS.map((day) => (
                    <th key={day} className="border border-border p-2 bg-muted font-medium text-sm">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {timeSlots.map((timeSlot) => (
                  <tr key={timeSlot}>
                    <td className="border border-border p-2 text-center font-medium text-sm bg-muted">
                      {formatTime(timeSlot)}
                    </td>
                    {DAYS.map((_, dayIndex) => {
                      const lesson = getLessonForDayAndTime(dayIndex, timeSlot);
                      const trialLesson = getTrialLessonForDayAndTime(dayIndex, timeSlot);

                      return (
                        <td key={dayIndex} className="border border-border p-2">
                          {lesson && (
                            <Badge
                              variant="outline"
                              className={`w-full justify-center py-2 ${
                                studentColors.get(lesson.student_id) || "bg-gray-100 text-gray-800"
                              }`}
                            >
                              <div className="text-center">
                                <div className="font-medium">{lesson.student_name}</div>
                                <div className="text-xs mt-1">
                                  {formatTime(lesson.start_time)} - {formatTime(lesson.end_time)}
                                </div>
                              </div>
                            </Badge>
                          )}
                          {trialLesson && (
                            <Button
                              variant="outline"
                              className={`w-full py-2 border-2 transition-all ${
                                trialLesson.is_completed
                                  ? "bg-red-50 text-red-400 border-red-200 hover:bg-red-100"
                                  : "bg-red-100 text-red-800 border-red-300 hover:bg-red-200"
                              }`}
                              onClick={() => handleTrialLessonClick(trialLesson)}
                            >
                              <div className="text-center w-full">
                                <div className="font-medium">Deneme Dersi</div>
                                <div className="text-xs mt-1">
                                  {formatTime(trialLesson.start_time)} - {formatTime(trialLesson.end_time)}
                                </div>
                              </div>
                            </Button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <AddTrialLessonDialog
        open={showAddTrial}
        onOpenChange={setShowAddTrial}
        teacherId={teacherId}
        onSuccess={fetchSchedule}
      />

      <AlertDialog open={showMarkAlert} onOpenChange={setShowMarkAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bu dersi işlediniz mi?</AlertDialogTitle>
            <AlertDialogDescription>
              Deneme dersini tamamlandı olarak işaretlemek istediğinizden emin misiniz?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction onClick={handleMarkComplete}>Onayla</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showUnmarkAlert} onOpenChange={setShowUnmarkAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>İşlenmedi olarak geri almak istiyor musunuz?</AlertDialogTitle>
            <AlertDialogDescription>
              Deneme dersini işlenmedi durumuna geri almak istediğinizden emin misiniz?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction onClick={handleMarkIncomplete}>Onayla</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
