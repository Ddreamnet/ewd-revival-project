import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { BookCheck } from "lucide-react";
import { format } from "date-fns";

interface StudentLessonTrackerProps {
  studentId: string;
}

interface LessonDates {
  [key: string]: string;
}

export function StudentLessonTracker({ studentId }: StudentLessonTrackerProps) {
  const [lessonsPerWeek, setLessonsPerWeek] = useState<number>(1);
  const [completedLessons, setCompletedLessons] = useState<number[]>([]);
  const [lessonDates, setLessonDates] = useState<LessonDates>({});
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchTracking();

    // Set up real-time subscription
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const channel = supabase
      .channel("lesson-tracking-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "student_lesson_tracking",
          filter: `student_id=eq.${studentId}`,
        },
        (payload) => {
          if (payload.new && typeof payload.new === "object") {
            const data = payload.new as any;
            setLessonsPerWeek(data.lessons_per_week || 1);
            setCompletedLessons(data.completed_lessons || []);
            setLessonDates(data.lesson_dates || {});
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [studentId]);

  const fetchTracking = async () => {
    try {
      // Get student's teacher first
      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .select("teacher_id")
        .eq("student_id", studentId)
        .single();

      if (studentError) throw studentError;

      // CRITICAL: Get the MOST RECENT tracking record by ordering by updated_at DESC
      // This ensures consistent results when multiple records exist
      const { data: records, error } = await supabase
        .from("student_lesson_tracking")
        .select("*")
        .eq("student_id", studentId)
        .eq("teacher_id", studentData.teacher_id)
        .order("updated_at", { ascending: false })
        .limit(1);

      if (error) throw error;

      if (records && records.length > 0) {
        const data = records[0];
        setLessonsPerWeek((data as any).lessons_per_week);
        setCompletedLessons((data as any).completed_lessons || []);
        setLessonDates((data as any).lesson_dates || {});
      }
    } catch (error: any) {
      console.error("Failed to fetch lesson tracking:", error);
    } finally {
      setLoading(false);
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
  const remainingLessons = totalLessonsPerMonth - completedLessons.length;

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="animate-pulse h-20 bg-muted rounded"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 min-w-[100px]">
            <BookCheck className="h-8 w-8 text-primary flex-shrink-0" />
            <div>
              <p className="text-2x1 font-bold">
                {completedLessons.length}/{totalLessonsPerMonth}
              </p>
              <p className="text-sm text-muted-foreground">İşlenen Dersler</p>
            </div>
          </div>
          <div className="flex flex-col gap-1.5 flex-1">
            {Array.from({ length: rowConfig.rows }, (_, rowIndex) => (
              <div key={rowIndex} className="flex gap-1.5">
                {Array.from({ length: rowConfig.buttonsPerRow }, (_, colIndex) => {
                  const lessonNumber = rowIndex * rowConfig.buttonsPerRow + colIndex + 1;
                  if (lessonNumber > totalLessonsPerMonth) return null;

                  const isCompleted = completedLessons.includes(lessonNumber);
                  const lessonDate = lessonDates[lessonNumber.toString()];

                  return (
                    <div key={lessonNumber} className="flex flex-col items-center gap-0.5">
                      <div
                        className={`
                        h-8 w-8 rounded-lg border-2 transition-all duration-200
                        flex items-center justify-center text-xs font-semibold shadow-sm
                        ${
                          isCompleted
                            ? "bg-primary text-primary-foreground border-primary scale-95 shadow-md"
                            : "bg-muted/50 border-muted-foreground/20"
                        }
                      `}
                      >
                        {lessonNumber}
                      </div>
                      {lessonDate && (
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {format(new Date(lessonDate), "dd.MM")}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
