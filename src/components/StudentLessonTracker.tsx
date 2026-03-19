import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { LessonInstance, getRowConfig } from "@/lib/lessonTypes";

interface StudentLessonTrackerProps {
  studentId: string;
}

export function StudentLessonTracker({ studentId }: StudentLessonTrackerProps) {
  const [instances, setInstances] = useState<LessonInstance[]>([]);
  const [templateCount, setTemplateCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel("student-instance-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "lesson_instances",
          filter: `student_id=eq.${studentId}`,
        },
        () => {
          fetchInstances();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [studentId]);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([fetchInstances(), fetchTemplateCount()]);
    setLoading(false);
  };

  const fetchInstances = async () => {
    try {
      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .select("teacher_id")
        .eq("student_id", studentId)
        .single();

      if (studentError) throw studentError;

      const { data: tracking } = await supabase
        .from("student_lesson_tracking")
        .select("package_cycle")
        .eq("student_id", studentId)
        .eq("teacher_id", studentData.teacher_id)
        .maybeSingle();

      const currentCycle = tracking?.package_cycle ?? 1;

      const { data, error } = await supabase
        .from("lesson_instances")
        .select("*")
        .eq("student_id", studentId)
        .eq("teacher_id", studentData.teacher_id)
        .eq("package_cycle", currentCycle)
        .in("status", ["planned", "completed"])
        .order("lesson_date", { ascending: true })
        .order("start_time", { ascending: true });

      if (error) throw error;
      setInstances((data as LessonInstance[]) || []);
    } catch (error: any) {
      console.error("Failed to fetch lesson instances:", error);
    }
  };

  const fetchTemplateCount = async () => {
    try {
      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .select("teacher_id")
        .eq("student_id", studentId)
        .single();

      if (studentError) throw studentError;

      const { count } = await supabase
        .from("student_lessons")
        .select("id", { count: "exact", head: true })
        .eq("student_id", studentId)
        .eq("teacher_id", studentData.teacher_id);

      setTemplateCount(count ?? 0);
    } catch (error: any) {
      console.error("Failed to fetch template count:", error);
    }
  };

  const totalLessonsPerMonth = templateCount * 4;
  const rowConfig = getRowConfig(templateCount);
  const displayInstances = instances;

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
        <div className="flex justify-center w-full">
          <div className="flex flex-col gap-2 sm:gap-2.5">
            {Array.from({ length: rowConfig.rows }, (_, rowIndex) => (
              <div key={rowIndex} className="flex gap-2 sm:gap-2.5 justify-center">
                {Array.from({ length: rowConfig.buttonsPerRow }, (_, colIndex) => {
                  const displayPosition = rowIndex * rowConfig.buttonsPerRow + colIndex;
                  if (displayPosition >= totalLessonsPerMonth) return null;

                  const inst = displayInstances[displayPosition];
                  if (!inst) return null;

                  const isCompleted = inst.status === "completed";
                  const isRescheduled = inst.original_date !== null;
                  const timeInfo = `${inst.start_time.slice(0, 5)} - ${inst.end_time.slice(0, 5)}`;

                  return (
                    <div key={inst.id} className="flex flex-col items-center gap-0.5">
                      <div
                        className={`
                          h-8 w-8 sm:h-9 sm:w-9 rounded-lg border-2 transition-all duration-200
                          flex items-center justify-center text-xs font-semibold shadow-sm
                          ${
                            isCompleted
                              ? "bg-primary text-primary-foreground border-primary scale-95 shadow-md"
                              : "bg-muted/50 border-muted-foreground/20"
                          }
                        `}
                        title={`Ders ${displayPosition + 1} - ${timeInfo}`}
                      >
                        {displayPosition + 1}
                      </div>
                      <span
                        className={`text-[10px] whitespace-nowrap ${
                          isRescheduled
                            ? "text-amber-600 dark:text-amber-400 font-medium"
                            : "text-muted-foreground"
                        }`}
                      >
                        {format(new Date(inst.lesson_date), "dd.MM")}
                      </span>
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
