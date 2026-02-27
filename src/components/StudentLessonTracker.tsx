import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { BookCheck, Ban } from "lucide-react";
import { format } from "date-fns";
import { LessonDates, LessonOverrideInfo, getRowConfig } from "@/lib/lessonTypes";
import { getSortedLessons, getDisplayLessonData } from "@/lib/lessonSorting";

interface StudentLessonTrackerProps {
  studentId: string;
}

export function StudentLessonTracker({ studentId }: StudentLessonTrackerProps) {
  const [lessonsPerWeek, setLessonsPerWeek] = useState<number>(1);
  const [completedLessons, setCompletedLessons] = useState<number[]>([]);
  const [lessonDates, setLessonDates] = useState<LessonDates>({});
  const [lessonOverrides, setLessonOverrides] = useState<LessonOverrideInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchTracking();
    fetchLessonOverrides();

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

  const fetchLessonOverrides = async () => {
    try {
      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .select("teacher_id")
        .eq("student_id", studentId)
        .single();

      if (studentError) throw studentError;

      const { data, error } = await supabase
        .from("lesson_overrides")
        .select("id, original_date, new_date, is_cancelled")
        .eq("student_id", studentId)
        .eq("teacher_id", studentData.teacher_id);

      if (error) throw error;
      setLessonOverrides(data || []);
    } catch (error: any) {
      console.error("Failed to fetch lesson overrides:", error);
    }
  };

  const fetchTracking = async () => {
    try {
      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .select("teacher_id")
        .eq("student_id", studentId)
        .single();

      if (studentError) throw studentError;

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
  const rowConfig = getRowConfig(lessonsPerWeek);
  const remainingLessons = totalLessonsPerMonth - completedLessons.length;
  const sortedLessons = getSortedLessons(lessonDates, lessonOverrides, totalLessonsPerMonth);

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
      <CardContent className="p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 sm:min-w-[100px]">
            <BookCheck className="h-6 w-6 sm:h-8 sm:w-8 text-primary flex-shrink-0" />
            <div>
              <p className="text-lg sm:text-2xl font-bold">
                {completedLessons.length}/{totalLessonsPerMonth}
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground">İşlenen Dersler</p>
            </div>
          </div>
          <div className="flex flex-col gap-1.5 flex-1">
            {Array.from({ length: rowConfig.rows }, (_, rowIndex) => (
              <div key={rowIndex} className="flex gap-1.5">
                {Array.from({ length: rowConfig.buttonsPerRow }, (_, colIndex) => {
                  const displayPosition = rowIndex * rowConfig.buttonsPerRow + colIndex + 1;
                  if (displayPosition > totalLessonsPerMonth) return null;

                  const lessonData = getDisplayLessonData(sortedLessons, lessonDates, displayPosition);
                  const { lessonNumber, displayDate, isCancelled, isOverridden } = lessonData;
                  const isCompleted = completedLessons.includes(lessonNumber);

                  return (
                    <div key={displayPosition} className="flex flex-col items-center gap-0.5">
                      <div
                        className={`
                        h-8 w-8 rounded-lg border-2 transition-all duration-200
                        flex items-center justify-center text-xs font-semibold shadow-sm
                        ${
                          isCancelled
                            ? "bg-muted text-muted-foreground border-muted-foreground/30 opacity-50"
                            : isCompleted
                              ? "bg-primary text-primary-foreground border-primary scale-95 shadow-md"
                              : "bg-muted/50 border-muted-foreground/20"
                        }
                      `}
                      >
                        {isCancelled ? <Ban className="h-4 w-4" /> : displayPosition}
                      </div>
                      {displayDate && (
                        <span className={`text-[10px] whitespace-nowrap ${
                          isOverridden ? "text-amber-600 font-medium" : "text-muted-foreground"
                        }`}>
                          {format(new Date(displayDate), "dd.MM")}
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
