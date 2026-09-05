/**
 * Öğrenci panelinin tek veri katmanı.
 *
 * Önceki sürümde aynı ekranda dört ayrı bileşen (sıradaki ders, ders saatleri,
 * ders sayacı, öğretmen ilişkisi) kendi sorgusunu atıyordu: `students` tablosu
 * dört kez, `lesson_instances` üç kez isteniyor ve üç ayrı realtime kanalı
 * açılıyordu. Burada tek anlık görüntü var; realtime tek kanal.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { readCache, writeCache } from "@/lib/panelCache";
import { toDateStr, toInputTime, parseLocalDate } from "@/lib/lessonTypes";
import type { PanelLesson } from "./useTeacherPanel";

const CACHE_VERSION = 3;  // tek tur yükleme + teacherName kaldırıldı

/** Haftalık sabit ders slotu (student_lessons şablonu). */
export interface FixedLesson {
  dayOfWeek: number;
  start: string;
  end: string;
}

export interface StudentPanelData {
  teacherId: string;
  zoomLink: string | null;
  /** Öğrencinin haftalık sabit ders saatleri. */
  fixedLessons: FixedLesson[];
  /** Güncel paketin dersleri (tarih sırasında). */
  lessons: PanelLesson[];
  completedCount: number;
  totalCount: number;
  fetchedAt: number;
}

const EMPTY: StudentPanelData = {
  teacherId: "",
  zoomLink: null,
  fixedLessons: [],
  lessons: [],
  completedCount: 0,
  totalCount: 0,
  fetchedAt: 0,
};

async function loadStudentPanel(studentUserId: string): Promise<StudentPanelData> {
  // Tek tur: dört sorgunun hepsi yalnızca `student_id` ile filtreleniyor, bu
  // yüzden öğretmen kimliğini ya da paket döngüsünü beklemeye gerek yok.
  // Önceki sürüm üç ardışık tur atıyordu (students → tracking → instances);
  // mobil bağlantıda her tur bir gidiş-dönüş gecikmesi demekti.
  const [relationRes, trackingRes, fixedRes, instancesRes] = await Promise.all([
    supabase
      .from("students")
      .select("teacher_id, zoom_link")
      .eq("student_id", studentUserId)
      .maybeSingle(),
    supabase
      .from("student_lesson_tracking")
      .select("teacher_id, package_cycle, lessons_per_week")
      .eq("student_id", studentUserId)
      .maybeSingle(),
    supabase
      .from("student_lessons")
      .select("day_of_week, start_time, end_time")
      .eq("student_id", studentUserId),
    supabase
      .from("lesson_instances")
      .select("id, lesson_number, lesson_date, start_time, end_time, status, is_manual_override, package_cycle")
      .eq("student_id", studentUserId)
      .in("status", ["planned", "completed"])
      .order("lesson_date", { ascending: true })
      .order("start_time", { ascending: true }),
  ]);

  if (relationRes.error) throw relationRes.error;

  const relation = relationRes.data;
  const teacherId = relation?.teacher_id ?? "";
  if (!teacherId) return { ...EMPTY, fetchedAt: Date.now() };

  const cycle = trackingRes.data?.package_cycle ?? 1;
  const perWeek = trackingRes.data?.lessons_per_week ?? 1;

  // Döngü filtresi istemcide: satır sayısı öğrenci başına küçük (bir paket
  // 4–12 ders) ve böylece sorgu tracking'i beklemiyor.
  const lessons: PanelLesson[] = (instancesRes.data ?? [])
    .filter((r) => r.package_cycle === cycle)
    .map((r) => ({
      id: r.id,
      number: r.lesson_number,
      date: r.lesson_date,
      start: toInputTime(r.start_time),
      end: toInputTime(r.end_time),
      completed: r.status === "completed",
      moved: !!r.is_manual_override,
    }));

  // Hafta pazartesiden başlasın (day_of_week: 0 = Pazar).
  const fixedLessons: FixedLesson[] = (fixedRes.data ?? [])
    .map((row) => ({
      dayOfWeek: row.day_of_week,
      start: toInputTime(row.start_time),
      end: toInputTime(row.end_time),
    }))
    .sort((a, b) => {
      const da = (a.dayOfWeek + 6) % 7;
      const db = (b.dayOfWeek + 6) % 7;
      return da - db || a.start.localeCompare(b.start);
    });

  return {
    teacherId,
    zoomLink: relation?.zoom_link?.trim() || null,
    fixedLessons,
    lessons,
    completedCount: lessons.filter((l) => l.completed).length,
    totalCount: Math.max(lessons.length, perWeek * 4),
    fetchedAt: Date.now(),
  };
}

/** Bugün bitmemiş ilk planlı ders. */
export function upcomingLessons(data: StudentPanelData, now: number): PanelLesson[] {
  const today = toDateStr(new Date(now));
  return data.lessons.filter((lesson) => {
    if (lesson.completed) return false;
    if (lesson.date > today) return true;
    if (lesson.date < today) return false;
    const [h, m] = lesson.end.split(":").map(Number);
    const end = parseLocalDate(lesson.date);
    end.setHours(h || 0, m || 0, 0, 0);
    return end.getTime() >= now;
  });
}

export function useStudentPanel(studentUserId: string | undefined) {
  const cacheKey = studentUserId ? `student:${studentUserId}` : null;

  const [data, setData] = useState<StudentPanelData>(() =>
    cacheKey ? (readCache<StudentPanelData>(cacheKey, CACHE_VERSION) ?? EMPTY) : EMPTY,
  );
  const [loading, setLoading] = useState(() => data.fetchedAt === 0);
  const inFlight = useRef<Promise<void> | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!studentUserId || !cacheKey) return;
    if (inFlight.current) return inFlight.current;
    const run = (async () => {
      try {
        const fresh = await loadStudentPanel(studentUserId);
        if (!mounted.current) return;
        setData(fresh);
        writeCache(cacheKey, fresh, CACHE_VERSION);
      } catch {
        // Önbellekteki görüntü ekranda kalır.
      } finally {
        if (mounted.current) setLoading(false);
        inFlight.current = null;
      }
    })();
    inFlight.current = run;
    return run;
  }, [studentUserId, cacheKey]);

  useEffect(() => {
    if (!cacheKey) return;
    const cached = readCache<StudentPanelData>(cacheKey, CACHE_VERSION);
    if (cached) {
      setData(cached);
      setLoading(false);
    }
    refresh();
  }, [cacheKey, refresh]);

  // Tek realtime kanalı: öğretmen dersi işleyince / tarih değişince tazele.
  useEffect(() => {
    if (!studentUserId) return;
    const channel = supabase
      .channel(`student-panel-${studentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "lesson_instances",
          filter: `student_id=eq.${studentUserId}`,
        },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [studentUserId, refresh]);

  return useMemo(() => ({ data, loading, refresh }), [data, loading, refresh]);
}
