import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { ClipboardList, LogOut, Moon, Sun, Upload } from "lucide-react";

import { PanelShell } from "@/components/panel/PanelShell";
import { PanelHeader } from "@/components/panel/PanelHeader";
import { PanelSection } from "@/components/panel/PanelSection";
import { PanelMenu } from "@/components/panel/PanelMenu";
import { CountBox, CountStrip, ProgressBar } from "@/components/panel/PanelBits";
import { ZoomButton } from "@/components/panel/ZoomButton";
import { NotificationBell } from "@/components/NotificationBell";
import { ThemeToggleButton } from "@/components/ThemeToggleButton";
import { useTheme } from "next-themes";
import { ContactDialog } from "@/components/ContactDialog";
import { UploadHomeworkDialog } from "@/components/UploadHomeworkDialog";
import { HomeworkListDialog } from "@/components/HomeworkListDialog";
import { TopicList } from "@/components/teacher/TopicList";

import { useAuth } from "@/hooks/useAuth";
import { useStudentTopics } from "@/hooks/useStudentTopics";
import { useStudentPanel } from "@/hooks/useStudentPanel";
import { useAndroidBackButton, useAppResume, useMinuteTick } from "@/hooks/usePanelPlatform";
import { initPushNotifications } from "@/lib/pushNotifications";
import { getDayName, parseLocalDate } from "@/lib/lessonTypes";
import { railColumns } from "@/lib/panelFormat";
import type { Topic } from "@/lib/types";

/**
 * Öğrenci paneli — tek sayfa.
 *
 * Sekme yok: ders saatleri, paket ilerlemesi, ödevler ve konular aynı
 * sayfada. Ödevler ekranda listelenmiyor — iki düğme kendi diyaloğunu açıyor.
 * Öğrenci yalnızca kendisine açılmış kaynakları görür; hiçbir şeyi
 * işaretlemez.
 */
export function StudentDashboard() {
  const { profile, signOut, signingOut } = useAuth();
  const studentId = profile?.user_id ?? "";

  const panel = useStudentPanel(studentId);
  // Kendi dil şubemizi biliyoruz — konu sorgusu profil okumasını beklemesin.
  const { allTopics, loading: topicsLoading, refetch: refetchTopics } = useStudentTopics(
    studentId,
    profile?.language,
  );
  const now = useMinuteTick();

  const [uploadOpen, setUploadOpen] = useState(false);
  const [homeworkOpen, setHomeworkOpen] = useState(false);

  const pushInit = useRef(false);
  useEffect(() => {
    if (studentId && !pushInit.current) {
      pushInit.current = true;
      initPushNotifications(studentId, "student");
    }
  }, [studentId]);

  useEffect(() => {
    if (studentId) refetchTopics();
  }, [studentId, refetchTopics]);

  useAppResume(panel.refresh);

  // Bildirim derin bağlantısı: ?action=homework → ödevler bölümüne kaydır
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("action") !== "homework") return;
    window.history.replaceState({}, "", "/dashboard");
    setHomeworkOpen(true);
  }, []);

  useAndroidBackButton(() => {
    if (uploadOpen || homeworkOpen) {
      setUploadOpen(false);
      setHomeworkOpen(false);
      return true;
    }
    return false;
  });

  /**
   * Öğrenci yalnızca kendisine açılmış kaynakları görür: konu tamamen
   * işlendiyse hepsi, değilse yalnızca işaretlenmiş kaynaklar. Hiç kaynağı
   * açılmamış konular listeye girmez.
   */
  const visibleTopics = useMemo<Topic[]>(() => {
    return allTopics
      .filter((topic) => topic.is_completed || topic.resources.some((r) => r.is_completed))
      .map((topic) =>
        topic.is_completed
          ? topic
          : { ...topic, resources: topic.resources.filter((r) => r.is_completed) },
      )
      .sort((a, b) => a.order_index - b.order_index);
  }, [allTopics]);

  const todayDow = new Date(now).getDay();

  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  /** Mobil taşma menüsü — başlık satırındaki ikincil eylemler. */
  const menuItems = [
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

  return (
    <PanelShell>
      <PanelHeader
        title="Öğrenme Panelim"
        subtitle={profile?.full_name ? `Hoş geldin, ${profile.full_name}` : undefined}
        actions={
          <>
            <NotificationBell
              variant="panel"
              userId={studentId}
              teacherId={panel.data.teacherId}
              studentId={studentId}
              isStudent
              onNotificationClick={() => setHomeworkOpen(true)}
            />
            <ContactDialog />
            {/* Masaüstünde ayrı düğmeler, mobilde tek taşma menüsü. */}
            <div className="hidden items-center gap-2 md:flex">
              <ThemeToggleButton variant="panelV2" />
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

      {/* ── Ders saatlerin ── */}
      <section className="pnl-band" aria-label="Ders saatlerin">
        <div className="pnl-wrap grid grid-cols-[minmax(0,1fr)] gap-4 py-5 lg:grid-cols-[minmax(0,1fr)_178px_178px] lg:py-5">
          <div className="pnl-next flex flex-col justify-center gap-3.5 lg:flex-row lg:items-center lg:gap-6">
            <div className="relative flex min-w-0 flex-col gap-2.5">
              <span className="pnl-next__label">DERS SAATLERİN</span>
              {panel.data.fixedLessons.length > 0 ? (
                <ul className="flex flex-wrap items-center gap-2">
                  {panel.data.fixedLessons.map((lesson, i) => {
                    const isToday = lesson.dayOfWeek === todayDow;
                    return (
                      <li
                        key={`${lesson.dayOfWeek}-${lesson.start}-${i}`}
                        className="rounded-full px-3.5 py-2 text-[14px] font-extrabold md:text-[15px]"
                        style={
                          isToday
                            ? { background: "var(--ewd-yellow)", color: "var(--ewd-yellow-ink)" }
                            : { background: "rgb(255 248 239 / 0.16)", color: "var(--ewd-on-purple)" }
                        }
                      >
                        {getDayName(lesson.dayOfWeek)} {lesson.start}–{lesson.end}
                        {isToday && " · bugün"}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <span className="pnl-next__title">
                  {panel.loading ? "Yükleniyor…" : "Ders programın henüz tanımlanmadı"}
                </span>
              )}
            </div>

            {panel.data.zoomLink ? (
              <ZoomButton
                href={panel.data.zoomLink}
                className="relative w-full shrink-0 lg:ml-auto lg:w-auto"
              />
            ) : (
              <span
                className="relative shrink-0 rounded-full px-4 py-3 text-center text-[13px] font-bold lg:ml-auto"
                style={{ background: "rgb(255 248 239 / 0.16)", color: "var(--ewd-on-purple-soft)" }}
              >
                Zoom bağlantısı henüz eklenmedi
              </span>
            )}
          </div>

          {/* Mobilde tek satırlık şerit, masaüstünde iki sayaç kartı. */}
          <div className="lg:hidden">
            <CountStrip
              items={[
                { value: panel.data.completedCount, label: "ders işlendi" },
                { value: visibleTopics.length, label: "konu öğrenildi" },
              ]}
            />
          </div>
          <div className="hidden lg:contents">
            <CountBox value={panel.data.completedCount} label="İşlenen ders" />
            <CountBox value={visibleTopics.length} label="Öğrendiğin konu" tone="yellow" />
          </div>
        </div>
      </section>

      <div className="pnl-wrap flex flex-col gap-7 py-5">
        {/* ── Paket ilerlemen + Ödevlerim — iki sütun ── */}
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2 lg:gap-5">
          <PanelSection
            title="Paket ilerlemen"
            summary={`${panel.data.completedCount} / ${panel.data.totalCount} ders`}
            hint="Bu paketteki derslerin."
          >
            <div className="pnl-card flex-1 p-4 md:p-5">
              <ProgressBar
                value={panel.data.completedCount}
                max={panel.data.totalCount}
                label={`${panel.data.completedCount} / ${panel.data.totalCount} ders`}
              />
              {panel.data.lessons.length > 0 && (
                <ul
                  className="pnl-rail mt-4"
                  style={
                    {
                      "--pnl-rail-cols": railColumns(panel.data.lessons.length),
                      "--pnl-rail-cols-sm": railColumns(panel.data.lessons.length),
                    } as React.CSSProperties
                  }
                >
                  {panel.data.lessons.map((lesson) => (
                    <li key={lesson.id} className="contents">
                      <span
                        className="pnl-lesson"
                        data-state={lesson.completed ? "done" : "todo"}
                        title={`Ders ${lesson.number} · ${lesson.start}–${lesson.end}`}
                      >
                        <span className="pnl-lesson__box">{lesson.number}</span>
                        <span className="pnl-lesson__date">
                          {format(parseLocalDate(lesson.date), "dd.MM")}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </PanelSection>

          {/* Ödevler ekranda listelenmiyor; iki düğme kendi diyaloğunu açıyor. */}
          <PanelSection title="Ödevlerim" hint="Öğretmeninin gönderdikleri ve senin yüklediklerin.">
            <div className="pnl-card grid flex-1 grid-cols-2 gap-3 p-4 md:p-5">
              <button
                type="button"
                className="flex min-h-[104px] flex-col items-center justify-center gap-2 rounded-2xl border-2 transition-colors"
                style={{ borderColor: "var(--ewd-lilac-soft)", background: "var(--ewd-surface-3)" }}
                onClick={() => setUploadOpen(true)}
              >
                <Upload className="h-6 w-6" style={{ color: "var(--ewd-purple)" }} aria-hidden="true" />
                <span className="text-[14px] font-extrabold" style={{ color: "var(--ewd-on-surface)" }}>
                  Ödev yükle
                </span>
              </button>
              <button
                type="button"
                className="flex min-h-[104px] flex-col items-center justify-center gap-2 rounded-2xl border-2 transition-colors"
                style={{ borderColor: "var(--ewd-lilac-soft)", background: "var(--ewd-surface-3)" }}
                onClick={() => setHomeworkOpen(true)}
              >
                <ClipboardList className="h-6 w-6" style={{ color: "var(--ewd-purple)" }} aria-hidden="true" />
                <span className="text-[14px] font-extrabold" style={{ color: "var(--ewd-on-surface)" }}>
                  Ödevlerim
                </span>
              </button>
            </div>
          </PanelSection>
        </div>

        {/* ── Konularım ── */}
        <PanelSection title="Konularım" hint="Derste işlediğiniz konular ve kaynaklar.">
          <TopicList topics={visibleTopics} loading={topicsLoading} />
        </PanelSection>
      </div>

      <HomeworkListDialog
        open={homeworkOpen}
        onOpenChange={setHomeworkOpen}
        studentId={studentId}
        teacherId={panel.data.teacherId}
        currentUserId={studentId}
        isTeacher={false}
      />

      {uploadOpen && (
        <UploadHomeworkDialog
          open
          onOpenChange={setUploadOpen}
          studentId={studentId}
          teacherId={panel.data.teacherId}
          uploadedByUserId={studentId}
          onSuccess={() => setUploadOpen(false)}
        />
      )}
    </PanelShell>
  );
}
