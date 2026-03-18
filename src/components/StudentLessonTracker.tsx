import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { BookCheck } from "lucide-react";
import { format } from "date-fns";
import { LessonInstance, getRowConfig } from "@/lib/lessonTypes";

interface StudentLessonTrackerProps {
  studentId: string;
}

export function StudentLessonTracker({ studentId }: StudentLessonTrackerProps) {
  const [instances, setInstances] = useState<LessonInstance[]>([]);
  const [templateCount, setTemplateCount] = useState(0);
  const [packageCycle, setPackageCycle] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();

    // Realtime: listen to instance changes for this student
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
    await Promise.all([fetchInstances(), fetchTemplateCount(), fetchPackageCycle()]);
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

      // Get current package_cycle
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

  const fetchPackageCycle = async () => {
    try {
      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .select("teacher_id")
        .eq("student_id", studentId)
        .single();
      if (studentError) throw studentError;

      const { data } = await supabase
        .from("student_lesson_tracking")
        .select("package_cycle")
        .eq("student_id", studentId)
        .eq("teacher_id", studentData.teacher_id)
        .maybeSingle();
      setPackageCycle(data?.package_cycle ?? 1);
    } catch (error: any) {
      console.error("Failed to fetch package cycle:", error);
    }
  };

  const totalLessonsPerMonth = templateCount * 4;
  const rowConfig = getRowConfig(templateCount);
  const completedCount = instances.filter((i) => i.status === "completed").length;
  const displayInstances = instances.slice(0, totalLessonsPerMonth);

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
                {completedCount}/{totalLessonsPerMonth}
              </p>
              <div className="flex items-center gap-1.5">
                <p className="text-xs sm:text-sm text-muted-foreground">İşlenen Dersler</p>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  Döngü {packageCycle}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1.5 flex-1">
            {Array.from({ length: rowConfig.rows }, (_, rowIndex) => (
              <div key={rowIndex} className="flex gap-1.5">
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
                          h-8 w-8 rounded-lg border-2 transition-all duration-200
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
