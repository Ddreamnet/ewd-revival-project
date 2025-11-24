import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface StudentLesson {
  id: string;
  student_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  student_name: string;
}

interface WeeklyScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teacherId: string;
}

const STUDENT_COLORS = [
  "bg-rose-100 border-rose-300 text-rose-900",
  "bg-blue-100 border-blue-300 text-blue-900",
  "bg-amber-100 border-amber-300 text-amber-900",
  "bg-emerald-100 border-emerald-300 text-emerald-900",
  "bg-purple-100 border-purple-300 text-purple-900",
  "bg-pink-100 border-pink-300 text-pink-900",
  "bg-cyan-100 border-cyan-300 text-cyan-900",
  "bg-orange-100 border-orange-300 text-orange-900",
  "bg-lime-100 border-lime-300 text-lime-900",
  "bg-indigo-100 border-indigo-300 text-indigo-900",
];

export function WeeklyScheduleDialog({ open, onOpenChange, teacherId }: WeeklyScheduleDialogProps) {
  const [lessons, setLessons] = useState<StudentLesson[]>([]);
  const [loading, setLoading] = useState(false);
  const [studentColors, setStudentColors] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const DAYS = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];

  useEffect(() => {
    if (open && teacherId) {
      fetchSchedule();
    }
  }, [open, teacherId]);

  const fetchSchedule = async () => {
    setLoading(true);
    try {
      // First, fetch the lessons
      const { data: lessonsData, error: lessonsError } = await supabase
        .from("student_lessons")
        .select("id, student_id, day_of_week, start_time, end_time")
        .eq("teacher_id", teacherId)
        .order("start_time", { ascending: true });

      if (lessonsError) throw lessonsError;

      // Then fetch student names separately
      const studentIds = Array.from(new Set((lessonsData || []).map(l => l.student_id)));
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", studentIds);

      if (profilesError) throw profilesError;

      // Create a map of student_id to full_name
      const studentNameMap: Record<string, string> = {};
      (profilesData || []).forEach(profile => {
        studentNameMap[profile.user_id] = profile.full_name;
      });

      const formattedLessons: StudentLesson[] = (lessonsData || []).map((lesson) => ({
        id: lesson.id,
        student_id: lesson.student_id,
        day_of_week: lesson.day_of_week,
        start_time: lesson.start_time,
        end_time: lesson.end_time,
        student_name: studentNameMap[lesson.student_id] || "Bilinmeyen",
      }));

      setLessons(formattedLessons);

      // Assign colors to students
      const uniqueStudents = Array.from(new Set(formattedLessons.map(l => l.student_id)));
      const colors: Record<string, string> = {};
      uniqueStudents.forEach((studentId, index) => {
        colors[studentId] = STUDENT_COLORS[index % STUDENT_COLORS.length];
      });
      setStudentColors(colors);

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
    try {
      return new Date(`2000-01-01T${time}`).toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return time;
    }
  };

  const getLessonsForDay = (dayIndex: number) => {
    // dayIndex: 0=Pazartesi, 6=Pazar
    // day_of_week in DB: 1=Pazartesi, 0=Pazar
    const dbDayOfWeek = dayIndex === 6 ? 0 : dayIndex + 1;
    return lessons
      .filter(l => l.day_of_week === dbDayOfWeek)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  };

  const getAllTimeSlots = () => {
    const times = new Set<string>();
    lessons.forEach(lesson => {
      times.add(lesson.start_time);
    });
    return Array.from(times).sort();
  };

  const timeSlots = getAllTimeSlots();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Haftalık Ders Programı</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : lessons.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Henüz planlanmış ders yok
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="grid grid-cols-7 gap-2 min-w-[800px]">
              {DAYS.map((day, dayIndex) => {
                const dayLessons = getLessonsForDay(dayIndex);
                return (
                  <div key={day} className="border rounded-lg overflow-hidden">
                    <div className="bg-primary/10 p-2 text-center font-semibold text-sm border-b">
                      {day}
                    </div>
                    <div className="p-2 space-y-2 min-h-[200px]">
                      {dayLessons.length === 0 ? (
                        <div className="text-xs text-muted-foreground text-center py-4">
                          Ders yok
                        </div>
                      ) : (
                        dayLessons.map((lesson) => (
                          <div
                            key={lesson.id}
                            className={`p-2 rounded border-2 ${studentColors[lesson.student_id] || "bg-gray-100 border-gray-300"}`}
                          >
                            <div className="font-medium text-xs mb-1">
                              {lesson.student_name}
                            </div>
                            <div className="text-[10px] font-mono">
                              {formatTime(lesson.start_time)} - {formatTime(lesson.end_time)}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
