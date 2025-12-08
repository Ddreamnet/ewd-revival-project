import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfWeek, endOfWeek, addDays, parseISO, isWithinInterval } from "date-fns";

export interface LessonOverride {
  id: string;
  student_id: string;
  teacher_id: string;
  original_date: string;
  original_day_of_week: number;
  original_start_time: string;
  original_end_time: string;
  new_date: string | null;
  new_start_time: string | null;
  new_end_time: string | null;
  is_cancelled: boolean;
}

export function useLessonOverrides(teacherId: string) {
  const [overrides, setOverrides] = useState<LessonOverride[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOverrides = async () => {
    try {
      // Get overrides for current week and future
      const today = new Date();
      const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Monday
      
      const { data, error } = await supabase
        .from("lesson_overrides")
        .select("*")
        .eq("teacher_id", teacherId)
        .gte("original_date", format(weekStart, "yyyy-MM-dd"))
        .order("original_date", { ascending: true });

      if (error) throw error;
      setOverrides(data || []);
    } catch (error) {
      console.error("Error fetching lesson overrides:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (teacherId) {
      fetchOverrides();
    }
  }, [teacherId]);

  // Check if a lesson should be hidden (cancelled) for a specific date
  const isLessonCancelled = (studentId: string, date: Date): boolean => {
    const dateStr = format(date, "yyyy-MM-dd");
    return overrides.some(
      (o) => 
        o.student_id === studentId && 
        o.original_date === dateStr && 
        o.is_cancelled
    );
  };

  // Check if a lesson is moved to a different date/time
  const getLessonOverride = (studentId: string, date: Date): LessonOverride | null => {
    const dateStr = format(date, "yyyy-MM-dd");
    return overrides.find(
      (o) => 
        o.student_id === studentId && 
        o.original_date === dateStr && 
        !o.is_cancelled
    ) || null;
  };

  // Check if there's a moved lesson that should appear on this day
  const getMovedLessonForDate = (date: Date): LessonOverride | null => {
    const dateStr = format(date, "yyyy-MM-dd");
    return overrides.find(
      (o) => o.new_date === dateStr && !o.is_cancelled
    ) || null;
  };

  // Get effective lesson date for a specific original date
  // Returns null if cancelled, new_date if moved, original if no override
  const getEffectiveLessonDate = (studentId: string, originalDate: Date): Date | null => {
    const override = getLessonOverride(studentId, originalDate);
    
    if (!override) {
      // Check if it's cancelled
      if (isLessonCancelled(studentId, originalDate)) {
        return null;
      }
      return originalDate;
    }

    if (override.is_cancelled) {
      return null;
    }

    if (override.new_date) {
      return parseISO(override.new_date);
    }

    return originalDate;
  };

  return {
    overrides,
    loading,
    isLessonCancelled,
    getLessonOverride,
    getMovedLessonForDate,
    getEffectiveLessonDate,
    refetch: fetchOverrides,
  };
}

// Helper to calculate the date for a lesson based on day_of_week for current week
export function getLessonDateForCurrentWeek(dayOfWeek: number): Date {
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Monday
  
  // dayOfWeek: 1=Mon, 2=Tue, ..., 6=Sat, 0=Sun
  // We need to map to: 0=Mon, 1=Tue, ..., 5=Sat, 6=Sun
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  
  return addDays(weekStart, daysFromMonday);
}
