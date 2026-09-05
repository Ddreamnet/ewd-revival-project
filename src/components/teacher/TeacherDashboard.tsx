import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { CalendarDays, LogOut, Moon, Sun, Wallet } from "lucide-react";

import { PanelShell } from "@/components/panel/PanelShell";
import { PanelHeader } from "@/components/panel/PanelHeader";
import { PanelMenu } from "@/components/panel/PanelMenu";
import { Avatar, EmptyState, SearchField } from "@/components/panel/PanelBits";
import { toneForName } from "@/lib/panelFormat";
import { NotificationBell } from "@/components/NotificationBell";
import { ThemeToggleButton } from "@/components/ThemeToggleButton";
import { useTheme } from "next-themes";
import { UploadHomeworkDialog } from "@/components/UploadHomeworkDialog";
import { HomeworkListDialog } from "@/components/HomeworkListDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  summarize,
  useTeacherPanel,
  type PanelStudent,
  type TeacherPanelData,
} from "@/hooks/useTeacherPanel";
import { useAndroidBackButton, useAppResume, useMinuteTick, usePrefetcher } from "@/hooks/usePanelPlatform";
import { initPushNotifications } from "@/lib/pushNotifications";
import { useTeacherPay } from "@/hooks/useTeacherPay";

import { supabase } from "@/integrations/supabase/client";

import { NextLessonBand } from "./NextLessonBand";
import { StudentCard } from "./StudentCard";
import { StudentWorkspace } from "./StudentWorkspace";

// Ağır bölümler ayrı parçalarda; katlı dururken indirilmez, boşta öne alınır.
const BalanceScreen = lazy(() =>
  import("./BalanceScreen").then((m) => ({ default: m.BalanceScreen })),
);
/** Haftalık program da açılana kadar inmesin — panelin açılışını yavaşlatmasın. */
const WeeklyScheduleScreen = lazy(() =>
  import("./WeeklyScheduleScreen").then((m) => ({ default: m.WeeklyScheduleScreen })),
);
const StudentAboutDialog = lazy(() =>
  import("@/components/StudentAboutDialog").then((m) => ({ default: m.StudentAboutDialog })),
);

function SectionFallback() {
  return <div className="h-32 animate-pulse rounded-3xl" style={{ background: "var(--ewd-lilac-tint)" }} />;
}

/**
 * Öğretmen paneli — tek sayfa.
 *
 * Sekme ya da başka bir sayfaya geçiş yok: sıradaki ders, öğrenciler ve
 * seçili öğrencinin konuları aynı sayfada bölüm bölüm duruyor. Ödev kutusu
 * ve haftalık program bölümleri kaldırıldı; ödev işleri seçili öğrencinin
 * çalışma alanından yürüyor.
 *
 * Bakiye ve öğrenci "hakkında" notu ekranda durmuyor; başlıktaki Bakiye
 * düğmesi ve öğrencinin Hakkında düğmesiyle diyalog olarak açılıyor.
 */
export function TeacherDashboard() {
  const { profile, signOut, signingOut } = useAuth();
  const teacherId = profile?.user_id ?? "";
  const isMobile = useIsMobile();

  const panel = useTeacherPanel(teacherId);
  // Ücret dil şubesi başına ayrı; öğretmen kendi şubesinin oranını görür.
  const pay = useTeacherPay(profile?.language ?? "en");
  const now = useMinuteTick();
  const summary = useMemo(() => summarize(panel.data, now), [panel.data, now]);

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /**
   * Mobilde ray, öğrenci seçilince katlanıyor. Sekiz kartlık liste 1.517px;
   * seçtiği öğrencinin konularına bakmak için her seferinde o kadar
   * kaydırmak gerekiyordu. Masaüstünde ray hep açık.
   */
  const [railOpen, setRailOpen] = useState(true);
  const [query, setQuery] = useState("");
  const workspaceRef = useRef<HTMLDivElement>(null);

  // ── Diyaloglar ───────────────────────────────────────────────────
  const [uploadFor, setUploadFor] = useState<PanelStudent | null>(null);
  const [homeworkFor, setHomeworkFor] = useState<PanelStudent | null>(null);
  const [aboutFor, setAboutFor] = useState<PanelStudent | null>(null);
  const [balanceOpen, setBalanceOpen] = useState(false);

  // ── Push bildirimleri (bir kez) ───────────────────────────────────
  const pushInit = useRef(false);
  useEffect(() => {
    if (teacherId && !pushInit.current) {
      pushInit.current = true;
      initPushNotifications(teacherId, "teacher");
    }
  }, [teacherId]);

  useAppResume(panel.refresh);

  // Katlı bölümlerin parçalarını boşta indir — açınca beklenmesin.
  usePrefetcher(
    useMemo(
      () => ({
        balance: () => import("./BalanceScreen"),
        schedule: () => import("./WeeklyScheduleScreen"),
      }),
      [],
    ),
  );

  const students = panel.data.students;

  // Masaüstünde sağ sütun boş kalmasın: seçim yoksa ilk öğrenci açılır.
  // Mobilde ray ve çalışma alanı alt alta olduğu için seçim beklenir.
  const selected = useMemo(
    () => students.find((s) => s.id === selectedId) ?? (isMobile ? null : (students[0] ?? null)),
    [students, selectedId, isMobile],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr-TR");
    if (!q) return students;
    return students.filter(
      (s) =>
        s.name.toLocaleLowerCase("tr-TR").includes(q) || s.email.toLocaleLowerCase("tr-TR").includes(q),
    );
  }, [students, query]);

  const unreadFor = useCallback(
    (student: PanelStudent) =>
      panel.data.homework.filter((h) => h.studentId === student.userId && h.unread).length,
    [panel.data.homework],
  );

  /**
   * Bir öğrencinin ödev listesini açmak, o öğrenciye ait bildirimleri okundu
   * sayar; aksi halde ödev kutusundaki "yeni" kartlar öğretmen ödeve baktıktan
   * sonra da yeni kalıyordu.
   */
  const openHomeworkFor = useCallback(
    (student: PanelStudent) => {
      setHomeworkFor(student);
      if (!panel.data.homework.some((h) => h.studentId === student.userId && h.unread)) return;

      panel.patch((prev) => ({
        ...prev,
        homework: prev.homework.map((h) =>
          h.studentId === student.userId ? { ...h, unread: false } : h,
        ),
      }));

      supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("recipient_id", teacherId)
        .eq("student_id", student.userId)
        .eq("is_read", false)
        .then(({ error }) => {
          if (error) panel.refresh();
        });
    },
    [panel, teacherId],
  );

  /** Mobilde ray ve çalışma alanı alt alta: seçince çalışma alanına kaydır. */
  const selectStudent = useCallback(
    (student: PanelStudent) => {
      setSelectedId(student.id);
      if (isMobile) {
        setRailOpen(false);
        requestAnimationFrame(() =>
          workspaceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
        );
      }
    },
    [isMobile],
  );

  // ── Bildirim derin bağlantısı: ?action=homework&student_id=… ──────
  const [pendingHomeworkId, setPendingHomeworkId] = useState<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("action") !== "homework") return;
    const studentId = params.get("student_id");
    if (studentId) setPendingHomeworkId(studentId);
    window.history.replaceState({}, "", "/dashboard");
  }, []);

  useEffect(() => {
    if (!pendingHomeworkId || students.length === 0) return;
    const student = students.find((s) => s.userId === pendingHomeworkId);
    if (student) {
      setSelectedId(student.id);
      openHomeworkFor(student);
    }
    setPendingHomeworkId(null);
  }, [pendingHomeworkId, students, openHomeworkFor]);

  // ── Android geri tuşu: açık diyalog varsa kapat, yoksa uygulamayı küçült ──
  useAndroidBackButton(() => {
    if (uploadFor || homeworkFor || aboutFor || balanceOpen) {
      setUploadFor(null);
      setHomeworkFor(null);
      setAboutFor(null);
      setBalanceOpen(false);
      return true;
    }
    return false;
  });

  const handleLessonToggled = useCallback(
    (lessonId: string, completed: boolean) => {
      panel.patch((prev: TeacherPanelData) => ({
        ...prev,
        students: prev.students.map((s) => {
          if (!s.lessons.some((l) => l.id === lessonId)) return s;
          const lessons = s.lessons.map((l) => (l.id === lessonId ? { ...l, completed } : l));
          return { ...s, lessons, completedCount: lessons.filter((l) => l.completed).length };
        }),
      }));
    },
    [panel],
  );

  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  /** Mobil taşma menüsü — başlık satırındaki ikincil eylemler. */
  const menuItems = [
    {
      label: "Ders programı",
      icon: <CalendarDays className="h-4 w-4" />,
      onSelect: () => setScheduleOpen(true),
    },
    { label: "Bakiye", icon: <Wallet className="h-4 w-4" />, onSelect: () => setBalanceOpen(true) },
    {
      label: isDark ? "Açık tema" : "Koyu tema",
      icon: isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />,
      onSelect: () => setTheme(isDark ? "light" : "dark"),
    },
    {
      label: signingOut ? "Çıkış yapılıyor…" : "Çıkış yap",
      icon: <LogOut className="h-4 w-4" />,
      onSelect: signOut,
      disabled: signingOut,
    },
  ];

  const today = format(new Date(now), "EEEE", { locale: tr });
  /** Mobilde seçim yapıldıktan sonra ray kompakt çubuğa iner. */
  const railCollapsed = isMobile && !railOpen && !!selected;

  return (
    <PanelShell>
      <PanelHeader
        title="Öğretmen Paneli"
        subtitle={profile?.full_name ? `Hoş geldin, ${profile.full_name}` : undefined}
        actions={
          <>
            <NotificationBell
              variant="panel"
              userId={teacherId}
              teacherId={teacherId}
              onNotificationClick={(studentId) => {
                const student = students.find((s) => s.userId === studentId);
                if (student) {
                  setSelectedId(student.id);
                  openHomeworkFor(student);
                }
              }}
            />
            {/* Masaüstünde ayrı düğmeler, mobilde tek taşma menüsü. */}
            <div className="hidden items-center gap-2 md:flex">
              <ThemeToggleButton variant="panelV2" />
              <button
                type="button"
                className="pnl-btn pnl-btn--soft"
                onClick={() => setScheduleOpen(true)}
              >
                <CalendarDays className="h-4 w-4" />
                Program
              </button>
              <button
                type="button"
                className="pnl-btn pnl-btn--soft"
                onClick={() => setBalanceOpen(true)}
              >
                <Wallet className="h-4 w-4" />
                Bakiye
              </button>
              <button
                type="button"
                className="pnl-btn pnl-btn--outline"
                onClick={signOut}
                disabled={signingOut}
              >
                {signingOut ? "Çıkış…" : "Çıkış"}
              </button>
            </div>
            <div className="md:hidden">
              <PanelMenu items={menuItems} />
            </div>
          </>
        }
      />

      <NextLessonBand summary={summary} />

      <div className="pnl-wrap flex flex-col gap-7 py-5">
        {/* ── Öğrenciler + seçili öğrencinin çalışma alanı ── */}
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[318px_minmax(0,1fr)]">
          {/* Masaüstünde ray yapışkan: konu listesi uzayınca öğrenci
              değiştirmek için başa dönmek gerekmiyor. */}
          <div className="flex flex-col gap-3.5 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
            {railCollapsed ? null : (
              <>
                <div className="flex flex-col gap-0.5">
                  <h2
                    className="text-[21px] font-black tracking-[-0.02em] md:text-[20px]"
                    style={{ color: "var(--ewd-on-surface)" }}
                  >
                    Öğrencilerim
                  </h2>
                  <span className="pnl-welcome">
                    {students.length} öğrenci kayıtlı · {today}
                  </span>
                </div>

                {students.length > 4 && (
                  <SearchField
                    value={query}
                    onChange={setQuery}
                    label="Öğrenci ara"
                    placeholder="Öğrenci ara…"
                  />
                )}
              </>
            )}

            {isMobile && !railOpen && selected ? (
              <button
                type="button"
                className="pnl-railbar"
                onClick={() => setRailOpen(true)}
                aria-expanded={false}
              >
                <Avatar name={selected.name} tone={toneForName(selected.name)} size="sm" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="pnl-student__name truncate">{selected.name}</span>
                  <span className="pnl-welcome">{students.length} öğrenci</span>
                </span>
                <span className="pnl-railbar__swap">Değiştir</span>
              </button>
            ) : panel.loading && students.length === 0 ? (
              <div className="flex flex-col gap-3" aria-busy="true">
                {[0, 1].map((i) => (
                  <div
                    key={i}
                    className="h-[132px] animate-pulse rounded-[22px]"
                    style={{ background: "var(--ewd-lilac-tint)" }}
                  />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                title={students.length === 0 ? "Henüz öğrenciniz yok" : "Eşleşen öğrenci yok"}
                text={
                  students.length === 0
                    ? "Yönetici size öğrenci atadığında burada listelenir."
                    : "Farklı bir isimle aramayı deneyin."
                }
              />
            ) : (
              <ul className="flex flex-col gap-3">
                {filtered.map((student) => (
                  <li key={student.id}>
                    <StudentCard
                      student={student}
                      active={student.id === selected?.id}
                      hasLessonToday={summary.todayStudentIds.has(student.userId)}
                      now={now}
                      onSelect={selectStudent}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div ref={workspaceRef} className="scroll-mt-24">
            {selected ? (
              <StudentWorkspace
                key={selected.id}
                student={selected}
                teacherId={teacherId}
                unreadHomeworkCount={unreadFor(selected)}
                onUploadHomework={() => setUploadFor(selected)}
                onOpenHomework={() => openHomeworkFor(selected)}
                onOpenAbout={() => setAboutFor(selected)}
                onLessonToggled={handleLessonToggled}
                onRefresh={panel.refresh}
              />
            ) : panel.loading ? (
              <SectionFallback />
            ) : students.length > 0 ? (
              <EmptyState
                title="Bir öğrenci seçin"
                text="Konuları ve ders rayını görmek için yukarıdaki listeden bir öğrenciye dokunun."
              />
            ) : null}
          </div>
        </div>
      </div>

      {/* ── Diyaloglar ───────────────────────────────────────────── */}
      {uploadFor && (
        <UploadHomeworkDialog
          open
          onOpenChange={(open) => !open && setUploadFor(null)}
          studentId={uploadFor.userId}
          teacherId={teacherId}
          uploadedByUserId={teacherId}
          onSuccess={() => {
            setUploadFor(null);
            panel.refresh();
          }}
        />
      )}

      {homeworkFor && (
        <HomeworkListDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setHomeworkFor(null);
              panel.refresh();
            }
          }}
          studentId={homeworkFor.userId}
          teacherId={teacherId}
          currentUserId={teacherId}
          isTeacher
        />
      )}

      {/*
        Haftalık program. Panel tek sayfa olduğu için bölüm olarak eklemek
        yerine — bakiyede olduğu gibi — başlıktaki düğmeden açılan diyalog:
        ana ekran "sıradaki ders + öğrenciler" odağını koruyor, program
        gerektiğinde tam ekrana yakın bir alanda açılıyor.
      */}
      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent className="w-[calc(100%-1rem)] sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Ders programım</DialogTitle>
          </DialogHeader>
          <Suspense fallback={<SectionFallback />}>
            <WeeklyScheduleScreen teacherId={teacherId} active={scheduleOpen} />
          </Suspense>
        </DialogContent>
      </Dialog>

      {/* Bakiye ekranda durmuyor; yalnızca bu diyalogda görünüyor. */}
      <Dialog open={balanceOpen} onOpenChange={setBalanceOpen}>
        <DialogContent className="w-[calc(100%-1rem)] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Bakiyem</DialogTitle>
          </DialogHeader>
          <Suspense fallback={<SectionFallback />}>
            <BalanceScreen
              teacherId={teacherId}
              totalMinutes={panel.data.balanceMinutes}
              regularLessons={panel.data.balanceRegularLessons}
              trialLessons={panel.data.balanceTrialLessons}
              pay={pay}
            />
          </Suspense>
        </DialogContent>
      </Dialog>

      {aboutFor && (
        <Suspense fallback={null}>
          <StudentAboutDialog
            key={aboutFor.userId}
            open
            onOpenChange={(open) => !open && setAboutFor(null)}
            studentId={aboutFor.userId}
            studentName={aboutFor.name}
            aboutText={aboutFor.aboutText}
            isReadOnly
          />
        </Suspense>
      )}

    </PanelShell>
  );
}
