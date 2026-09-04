/**
 * Öğretmen panelinin tek veri katmanı.
 *
 * Panelin bütün ekranları (Bugün, öğrenci detayı, ödev kutusu, bakiye) aynı
 * anlık görüntüden beslenir. Önceki sürümde her ekran/bileşen kendi sorgusunu
 * atıyordu: öğrenci listesi bir yerde, ders kayıtları LessonTracker içinde,
 * bakiye ayrı bir dialog'da. Aynı satırlar birden çok kez isteniyordu ve
 * öğrenci değiştikçe yeniden yükleme hissi oluşuyordu.
 *
 * Burada:
 *  - İlk boyama yerel önbellekten anında yapılır (stale-while-revalidate).
 *  - Ağ tarafında iki tur var: (1) öğrenci + paket + bakiye + ödev paralel,
 *    (2) ders kayıtları — hangi paket döngüsünün çekileceği (1)'e bağlı.
 *  - Türetilmiş her değer (sıradaki ders, bugün/bu hafta sayaçları, öğrenci
 *    ilerlemesi, ders rayı) tek kaynaktan hesaplanır; ekranlar sorgu atmaz.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { readCache, writeCache } from "@/lib/panelCache";
import { parseLocalDate, toDateStr, toInputTime, getDayName } from "@/lib/lessonTypes";

const CACHE_VERSION = 2;

export interface PanelLesson {
  id: string;
  number: number;
  /** yyyy-MM-dd */
  date: string;
  /** HH:MM */
  start: string;
  end: string;
  completed: boolean;
  /** Tarihi elle değiştirilmiş ders. */
  moved: boolean;
}

export interface PanelStudent {
  /** students.id */
  id: string;
  /** students.student_id — auth kullanıcı kimliği */
  userId: string;
  name: string;
  email: string;
  aboutText: string | null;
  zoomLink: string | null;
  cycle: number;
  lessons: PanelLesson[];
  completedCount: number;
  totalCount: number;
  /** Haftalık şablondaki ders sayısı (paket = 4 hafta). */
  lessonsPerWeek: number;
}

export interface PanelHomeworkGroup {
  batchId: string;
  title: string;
  studentId: string;
  studentName: string;
  createdAt: string;
  /** Öğrenci yükledi (öğretmenin bakması gereken) mi? */
  fromStudent: boolean;
  /** Bildirimi henüz okunmamış — "yeni". */
  unread: boolean;
  fileCount: number;
}

export interface TeacherPanelData {
  students: PanelStudent[];
  homework: PanelHomeworkGroup[];
  balanceMinutes: number;
  balanceRegularLessons: number;
  balanceTrialLessons: number;
  /** Verinin alındığı an — bayat gösterimi ayırt etmek için. */
  fetchedAt: number;
}

const EMPTY: TeacherPanelData = {
  students: [],
  homework: [],
  balanceMinutes: 0,
  balanceRegularLessons: 0,
  balanceTrialLessons: 0,
  fetchedAt: 0,
};

/* ------------------------------------------------------------------ */
/* Yükleme                                                             */
/* ------------------------------------------------------------------ */

async function loadTeacherPanel(teacherId: string): Promise<TeacherPanelData> {
  // ── Tur 1: birbirine bağlı olmayan her şey paralel ────────────────
  const [studentsRes, trackingRes, balanceRes, homeworkRes, notifRes] = await Promise.all([
    // `select("*")`: zoom_link göçü uygulanmamış kurulumlarda sorgu patlamasın.
    supabase
      .from("students")
      .select("*, profiles!students_student_id_fkey (full_name, email)")
      .eq("teacher_id", teacherId)
      .eq("is_archived", false),
    supabase
      .from("student_lesson_tracking")
      .select("student_id, package_cycle, lessons_per_week")
      .eq("teacher_id", teacherId),
    supabase.from("teacher_balance").select("*").eq("teacher_id", teacherId).maybeSingle(),
    supabase
      .from("homework_submissions")
      .select("id, batch_id, title, student_id, created_at, uploaded_by_user_id")
      .eq("teacher_id", teacherId)
      .order("created_at", { ascending: false })
      .limit(150),
    supabase
      .from("notifications")
      .select("homework_id, is_read")
      .eq("recipient_id", teacherId)
      .eq("is_read", false)
      .limit(200),
  ]);

  if (studentsRes.error) throw studentsRes.error;

  type StudentRow = {
    id: string;
    student_id: string;
    about_text: string | null;
    zoom_link?: string | null;
    profiles: { full_name: string; email: string } | null;
  };
  const studentRows = (studentsRes.data ?? []) as unknown as StudentRow[];

  const trackingByStudent = new Map<string, { cycle: number; perWeek: number }>();
  for (const t of trackingRes.data ?? []) {
    trackingByStudent.set(t.student_id, {
      cycle: t.package_cycle ?? 1,
      perWeek: t.lessons_per_week ?? 1,
    });
  }

  // ── Tur 2: ders kayıtları — yalnızca güncel paket döngüleri ────────
  const studentIds = studentRows.map((s) => s.student_id);
  const cycles = [...new Set(studentIds.map((id) => trackingByStudent.get(id)?.cycle ?? 1))];

  let instanceRows: {
    id: string;
    student_id: string;
    lesson_number: number;
    lesson_date: string;
    start_time: string;
    end_time: string;
    status: string;
    package_cycle: number;
    is_manual_override: boolean | null;
  }[] = [];

  if (studentIds.length > 0) {
    const { data, error } = await supabase
      .from("lesson_instances")
      .select(
        "id, student_id, lesson_number, lesson_date, start_time, end_time, status, package_cycle, is_manual_override",
      )
      .eq("teacher_id", teacherId)
      .in("student_id", studentIds)
      .in("package_cycle", cycles.length > 0 ? cycles : [1])
      .in("status", ["planned", "completed"])
      .order("lesson_date", { ascending: true })
      .order("start_time", { ascending: true });
    if (error) throw error;
    instanceRows = data ?? [];
  }

  const instancesByStudent = new Map<string, typeof instanceRows>();
  for (const row of instanceRows) {
    const list = instancesByStudent.get(row.student_id);
    if (list) list.push(row);
    else instancesByStudent.set(row.student_id, [row]);
  }

  const students: PanelStudent[] = studentRows.map((row) => {
    const tracking = trackingByStudent.get(row.student_id);
    const cycle = tracking?.cycle ?? 1;
    const perWeek = tracking?.perWeek ?? 1;

    const lessons: PanelLesson[] = (instancesByStudent.get(row.student_id) ?? [])
      .filter((i) => i.package_cycle === cycle)
      .map((i) => ({
        id: i.id,
        number: i.lesson_number,
        date: i.lesson_date,
        start: toInputTime(i.start_time),
        end: toInputTime(i.end_time),
        completed: i.status === "completed",
        moved: !!i.is_manual_override,
      }));

    return {
      id: row.id,
      userId: row.student_id,
      name: row.profiles?.full_name ?? "Öğrenci",
      email: row.profiles?.email ?? "",
      aboutText: row.about_text ?? null,
      zoomLink: row.zoom_link?.trim() || null,
      cycle,
      lessons,
      completedCount: lessons.filter((l) => l.completed).length,
      totalCount: Math.max(lessons.length, perWeek * 4),
      lessonsPerWeek: perWeek,
    };
  });

  // ── Ödev kutusu: batch_id'ye göre grupla ───────────────────────────
  const nameByUserId = new Map(students.map((s) => [s.userId, s.name]));
  const unreadHomeworkIds = new Set(
    (notifRes.data ?? []).map((n) => n.homework_id).filter(Boolean) as string[],
  );

  const groups = new Map<string, PanelHomeworkGroup>();
  for (const hw of homeworkRes.data ?? []) {
    const existing = groups.get(hw.batch_id);
    if (existing) {
      existing.fileCount += 1;
      if (unreadHomeworkIds.has(hw.id)) existing.unread = true;
      continue;
    }
    groups.set(hw.batch_id, {
      batchId: hw.batch_id,
      title: hw.title,
      studentId: hw.student_id,
      studentName: nameByUserId.get(hw.student_id) ?? "Öğrenci",
      createdAt: hw.created_at,
      fromStudent: hw.uploaded_by_user_id !== teacherId,
      unread: unreadHomeworkIds.has(hw.id),
      fileCount: 1,
    });
  }

  return {
    students: sortStudentsByNextLesson(students),
    homework: [...groups.values()],
    balanceMinutes: balanceRes.data?.total_minutes ?? 0,
    balanceRegularLessons: balanceRes.data?.completed_regular_lessons ?? 0,
    balanceTrialLessons: balanceRes.data?.completed_trial_lessons ?? 0,
    fetchedAt: Date.now(),
  };
}

/* ------------------------------------------------------------------ */
/* Türetilmiş değerler                                                 */
/* ------------------------------------------------------------------ */

/** Bir dersin başlangıç anı (yerel saat). */
export function lessonStartAt(lesson: PanelLesson): Date {
  const d = parseLocalDate(lesson.date);
  const [h, m] = lesson.start.split(":").map(Number);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

function lessonEndAt(lesson: PanelLesson): Date {
  const d = parseLocalDate(lesson.date);
  const [h, m] = lesson.end.split(":").map(Number);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

/** Öğrencinin bir sonraki (henüz bitmemiş) planlı dersi. */
export function nextLessonOf(student: PanelStudent, now: number): PanelLesson | null {
  for (const lesson of student.lessons) {
    if (lesson.completed) continue;
    if (lessonEndAt(lesson).getTime() >= now) return lesson;
  }
  return null;
}

/**
 * İşaretlenebilecek ilk ders — paketteki en erken "planlandı" kaydı.
 *
 * Sunucudaki `rpc_complete_lesson` sıralı işaretlemeyi zorunlu kılıyor; bu da
 * onun istemci tarafındaki karşılığı. `lessons` zaten (tarih, saat) sırasında
 * geldiği için ayrı sorgu gerekmiyor — eski LessonTracker bunun için öğrenci
 * başına dört sorgu atıyordu.
 */
export function nextCompletableOf(student: PanelStudent): PanelLesson | null {
  return student.lessons.find((l) => !l.completed) ?? null;
}

/** Geri alınabilecek tek ders: en son işlenen. */
export function lastCompletedOf(student: PanelStudent): PanelLesson | null {
  for (let i = student.lessons.length - 1; i >= 0; i--) {
    if (student.lessons[i].completed) return student.lessons[i];
  }
  return null;
}

/** Öğrencinin en son işlenen derslerinin gün adları (yeniden eskiye). */
export function pastLessonDays(student: PanelStudent, limit = 2): string[] {
  return student.lessons
    .filter((l) => l.completed)
    .slice(-limit)
    .reverse()
    .map((l) => getDayName(parseLocalDate(l.date).getDay()));
}

function sortStudentsByNextLesson(students: PanelStudent[]): PanelStudent[] {
  const now = Date.now();
  return [...students].sort((a, b) => {
    const an = nextLessonOf(a, now);
    const bn = nextLessonOf(b, now);
    if (!an && !bn) return a.name.localeCompare(b.name, "tr");
    if (!an) return 1;
    if (!bn) return -1;
    return lessonStartAt(an).getTime() - lessonStartAt(bn).getTime();
  });
}

/** Haftanın pazartesi ile başlayan sınırları. */
function weekBounds(base: Date): { start: string; end: string } {
  const start = new Date(base);
  const dow = start.getDay(); // 0 = Pazar
  const daysFromMonday = dow === 0 ? 6 : dow - 1;
  start.setDate(start.getDate() - daysFromMonday);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: toDateStr(start), end: toDateStr(end) };
}

export interface TeacherPanelSummary {
  nextLesson: { student: PanelStudent; lesson: PanelLesson; minutesUntil: number } | null;
  todayCount: number;
  weekCount: number;
  /** Bugün dersi olan öğrencilerin auth kimlikleri. */
  todayStudentIds: Set<string>;
  unreadHomework: number;
}

export function summarize(data: TeacherPanelData, now: number): TeacherPanelSummary {
  const today = toDateStr(new Date(now));
  const { start, end } = weekBounds(new Date(now));

  let todayCount = 0;
  let weekCount = 0;
  const todayStudentIds = new Set<string>();
  let best: { student: PanelStudent; lesson: PanelLesson; at: number } | null = null;

  for (const student of data.students) {
    for (const lesson of student.lessons) {
      if (lesson.date === today) {
        todayCount += 1;
        todayStudentIds.add(student.userId);
      }
      if (lesson.date >= start && lesson.date <= end) weekCount += 1;
    }
    const next = nextLessonOf(student, now);
    if (next) {
      const at = lessonStartAt(next).getTime();
      if (!best || at < best.at) best = { student, lesson: next, at };
    }
  }

  return {
    nextLesson: best
      ? {
          student: best.student,
          lesson: best.lesson,
          minutesUntil: Math.max(0, Math.round((best.at - now) / 60000)),
        }
      : null,
    todayCount,
    weekCount,
    todayStudentIds,
    unreadHomework: data.homework.filter((h) => h.unread).length,
  };
}

/* ------------------------------------------------------------------ */
/* Hook                                                                */
/* ------------------------------------------------------------------ */

export interface UseTeacherPanelResult {
  data: TeacherPanelData;
  /** Ağdan hiç veri gelmemiş ve önbellek de boşsa true. */
  loading: boolean;
  /** Önbellekten çizildi, tazeleme sürüyor. */
  refreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /** Ağ turunu beklemeden yerel görüntüyü güncelle (iyimser güncelleme). */
  patch: (updater: (prev: TeacherPanelData) => TeacherPanelData) => void;
}

export function useTeacherPanel(teacherId: string | undefined): UseTeacherPanelResult {
  const cacheKey = teacherId ? `teacher:${teacherId}` : null;

  const [data, setData] = useState<TeacherPanelData>(() => {
    if (!cacheKey) return EMPTY;
    return readCache<TeacherPanelData>(cacheKey, CACHE_VERSION) ?? EMPTY;
  });
  const [loading, setLoading] = useState(() => data.fetchedAt === 0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inFlight = useRef<Promise<void> | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!teacherId || !cacheKey) return;
    if (inFlight.current) return inFlight.current;

    setRefreshing(true);
    const run = (async () => {
      try {
        const fresh = await loadTeacherPanel(teacherId);
        if (!mounted.current) return;
        setData(fresh);
        setError(null);
        writeCache(cacheKey, fresh, CACHE_VERSION);
      } catch (e) {
        if (!mounted.current) return;
        setError(e instanceof Error ? e.message : "Panel verisi yüklenemedi");
      } finally {
        if (mounted.current) {
          setLoading(false);
          setRefreshing(false);
        }
        inFlight.current = null;
      }
    })();

    inFlight.current = run;
    return run;
  }, [teacherId, cacheKey]);

  // Öğretmen değişince önbelleği yeniden oku (aynı cihazda başka hesap).
  useEffect(() => {
    if (!cacheKey) return;
    const cached = readCache<TeacherPanelData>(cacheKey, CACHE_VERSION);
    if (cached) {
      setData(cached);
      setLoading(false);
    } else {
      setData(EMPTY);
      setLoading(true);
    }
    refresh();
  }, [cacheKey, refresh]);

  const patch = useCallback(
    (updater: (prev: TeacherPanelData) => TeacherPanelData) => {
      setData((prev) => {
        const next = updater(prev);
        if (cacheKey) writeCache(cacheKey, next, CACHE_VERSION);
        return next;
      });
    },
    [cacheKey],
  );

  return useMemo(
    () => ({ data, loading, refreshing, error, refresh, patch }),
    [data, loading, refreshing, error, refresh, patch],
  );
}
