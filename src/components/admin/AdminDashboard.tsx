import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Heart, LogOut, Settings, UserPlus } from "lucide-react";

import { PanelShell } from "@/components/panel/PanelShell";
import { PanelHeader } from "@/components/panel/PanelHeader";
import { BottomTabBar, NavPills, type PanelTab } from "@/components/panel/PanelNav";
import { Avatar, EmptyState, IconButton, ScreenHeader } from "@/components/panel/PanelBits";
import { toneForName } from "@/lib/panelFormat";

import { AdminNotificationBell } from "@/components/AdminNotificationBell";
import { ThemeToggleButton } from "@/components/ThemeToggleButton";
import { CreateStudentDialog } from "@/components/CreateStudentDialog";
import { CreateTeacherDialog } from "@/components/CreateTeacherDialog";
import { EditStudentDialog } from "@/components/EditStudentDialog";
import { EditTeacherDialog } from "@/components/EditTeacherDialog";
import { AddTopicDialog } from "@/components/AddTopicDialog";
import { AddResourceDialog } from "@/components/AddResourceDialog";
import { EditTopicDialog } from "@/components/EditTopicDialog";
import { EditResourceDialog } from "@/components/EditResourceDialog";
import { AdminWeeklySchedule } from "@/components/AdminWeeklySchedule";
import { AdminBalanceManager } from "@/components/AdminBalanceManager";
import { AdminStudentList } from "@/components/AdminStudentList";

import { useAuth } from "@/hooks/useAuth";
import { useAdminBranch } from "@/hooks/useAdminBranch";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAdminTopicsCrud } from "@/hooks/useAdminTopicsCrud";
import { useAndroidBackButton, useScrollMemory } from "@/hooks/usePanelPlatform";
import { supabase } from "@/integrations/supabase/client";
import { restoreStudent } from "@/lib/lessonService";
import { loadStudentTopics } from "@/lib/topicsService";
import { initPushNotifications } from "@/lib/pushNotifications";
import { type Branch } from "@/lib/branch";
import type { Resource, Student, Teacher, Topic } from "@/lib/types";

import { TeacherRail } from "./TeacherRail";
import { BranchSwitcher } from "./BranchSwitcher";
import { SiteScreen } from "./SiteScreen";

// TipTap (~490 kB) taşıyan ağır diyaloglar — açıldıklarında indirilir.
const GlobalTopicsManager = lazy(() =>
  import("@/components/GlobalTopicsManager").then((m) => ({ default: m.GlobalTopicsManager })),
);
const StudentAboutDialog = lazy(() =>
  import("@/components/StudentAboutDialog").then((m) => ({ default: m.StudentAboutDialog })),
);
const AdminBlogManager = lazy(() =>
  import("@/components/AdminBlogManager").then((m) => ({ default: m.AdminBlogManager })),
);
const AdminSiteManager = lazy(() =>
  import("@/components/AdminSiteManager").then((m) => ({ default: m.AdminSiteManager })),
);

const ROOT = "/dashboard";

const TABS: PanelTab[] = [
  { key: "teachers", label: "Öğretmenler", shortLabel: "Öğretmenler", to: ROOT, icon: "/ewd/assets/ic/nav-dersler.svg" },
  { key: "topics", label: "Global Konular", shortLabel: "Konular", to: `${ROOT}/konular`, icon: "/ewd/assets/ic/nav-blog.svg" },
  { key: "site", label: "Site & İçerik", shortLabel: "Site", to: `${ROOT}/site`, icon: "/ewd/assets/ic/nav-iletisim.svg" },
];

function tabKeyFor(pathname: string): string {
  if (pathname.startsWith(`${ROOT}/konular`)) return "topics";
  if (pathname.startsWith(`${ROOT}/site`)) return "site";
  return "teachers";
}

type DetailTab = "students" | "schedule" | "payments";

export function AdminDashboard() {
  const { profile, signOut, signingOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const activeTab = tabKeyFor(location.pathname);

  // Panelin açık olduğu dil şubesi — İngilizce ve Fransızca sistemleri ayrı.
  const [branch, setBranch] = useAdminBranch();

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [scheduleRefreshKey, setScheduleRefreshKey] = useState(0);

  // Konu haritaları — öğrenci satırı açıldığında doldurulur.
  const [studentTopicsMap, setStudentTopicsMap] = useState<Map<string, Topic[]>>(new Map());
  const [studentAllTopics, setStudentAllTopics] = useState<Map<string, Topic[]>>(new Map());
  const [expandedStudents, setExpandedStudents] = useState<Set<string>>(new Set());

  // Diyalog durumları
  const [showCreateTeacher, setShowCreateTeacher] = useState(false);
  const [showCreateStudent, setShowCreateStudent] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [aboutFor, setAboutFor] = useState<Student | null>(null);
  const [showBlogManager, setShowBlogManager] = useState(false);
  const [showSiteManager, setShowSiteManager] = useState(false);
  const [addTopicFor, setAddTopicFor] = useState<string | null>(null);
  const [addResourceFor, setAddResourceFor] = useState<string | null>(null);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);

  const pushInit = useRef(false);
  useEffect(() => {
    if (profile?.user_id && !pushInit.current) {
      pushInit.current = true;
      initPushNotifications(profile.user_id, "admin");
    }
  }, [profile?.user_id]);

  /* ── Veri ─────────────────────────────────────────────────────── */

  const fetchTeachers = useCallback(async () => {
    try {
      const [teachersRes, studentsRes, lessonsRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, full_name, email, language")
          .eq("role", "teacher")
          .order("full_name"),
        supabase
          .from("students")
          .select(
            "id, student_id, teacher_id, is_archived, about_text, profiles!students_student_id_fkey (full_name, email)",
          ),
        supabase
          .from("student_lessons")
          .select("id, student_id, teacher_id, day_of_week, start_time, end_time, note"),
      ]);

      if (teachersRes.error) throw teachersRes.error;
      if (studentsRes.error) throw studentsRes.error;
      if (lessonsRes.error) throw lessonsRes.error;

      const studentsByTeacher = new Map<string, NonNullable<typeof studentsRes.data>>();
      for (const s of studentsRes.data ?? []) {
        const list = studentsByTeacher.get(s.teacher_id);
        if (list) list.push(s);
        else studentsByTeacher.set(s.teacher_id, [s]);
      }

      const lessonsByStudent = new Map<string, NonNullable<typeof lessonsRes.data>>();
      for (const l of lessonsRes.data ?? []) {
        const list = lessonsByStudent.get(l.student_id);
        if (list) list.push(l);
        else lessonsByStudent.set(l.student_id, [l]);
      }

      setTeachers(
        (teachersRes.data ?? []).map((teacher) => ({
          ...teacher,
          students: (studentsByTeacher.get(teacher.user_id) ?? []).map((student) => ({
            ...student,
            is_archived: student.is_archived || false,
            about_text: student.about_text || null,
            lessons: (lessonsByStudent.get(student.student_id) ?? [])
              .filter((l) => l.teacher_id === teacher.user_id)
              .map((l) => ({
                id: l.id,
                dayOfWeek: l.day_of_week,
                startTime: l.start_time,
                endTime: l.end_time,
                note: l.note ?? undefined,
              })),
          })),
        })) as Teacher[],
      );
    } catch {
      toast({ title: "Hata", description: "Öğretmenler yüklenemedi", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchTeachers();
  }, [fetchTeachers]);

  const fetchStudentTopics = useCallback(
    async (studentUserId: string, studentRecordId: string) => {
      try {
        const { all, own } = await loadStudentTopics(studentUserId);
        setStudentTopicsMap((prev) => new Map(prev).set(studentRecordId, own));
        setStudentAllTopics((prev) => new Map(prev).set(studentRecordId, all));
      } catch {
        toast({ title: "Hata", description: "Konular yüklenemedi", variant: "destructive" });
      }
    },
    [toast],
  );

  /* ── Şube süzgeci ─────────────────────────────────────────────── */

  // Panel yalnızca açık şubenin öğretmenlerini gösterir; öğrenciler zaten
  // öğretmenlerine bağlı olduğu için ayrı bir süzgece gerek yok.
  const branchTeachers = useMemo(
    () => teachers.filter((t) => t.language === branch),
    [teachers, branch],
  );

  const branchCounts = useMemo(
    () => ({
      en: teachers.filter((t) => t.language === "en").length,
      fr: teachers.filter((t) => t.language === "fr").length,
    }),
    [teachers],
  );

  const branchTeacherIds = useMemo(
    () => (loading ? null : branchTeachers.map((t) => t.user_id)),
    [branchTeachers, loading],
  );

  /* ── Seçili öğretmen ──────────────────────────────────────────── */

  // `useParams()` burada çalışmaz: bu bileşen `/dashboard/*` route'unun
  // altında, `ogretmen/:teacherId` ise onun içindeki iç route. Yolu doğrudan
  // okumak hem doğru hem de tek yer.
  const routeTeacherId = useMemo(() => {
    const match = location.pathname.match(/^\/dashboard\/ogretmen\/([^/]+)/);
    return match?.[1];
  }, [location.pathname]);

  const selectedTeacher = useMemo(
    () => branchTeachers.find((t) => t.user_id === routeTeacherId) ?? null,
    [branchTeachers, routeTeacherId],
  );

  // Şube değişince diğer şubede kalan öğretmen detayı boş ekran gösterirdi.
  const handleBranchChange = useCallback(
    (next: Branch) => {
      if (next === branch) return;
      setBranch(next);
      if (location.pathname.startsWith(`${ROOT}/ogretmen/`)) navigate(ROOT);
    },
    [branch, setBranch, location.pathname, navigate],
  );

  const topicsCrud = useAdminTopicsCrud({
    adminUserId: profile?.user_id,
    selectedTeacherStudents: selectedTeacher?.students,
    studentTopics: studentTopicsMap,
    fetchStudentTopics,
  });

  /* ── Bildirim derin bağlantısı ────────────────────────────────── */

  const [pendingLink, setPendingLink] = useState<{ studentId: string; teacherId: string } | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("action") !== "student_settings") return;
    const studentId = params.get("student_id");
    const teacherId = params.get("teacher_id");
    if (studentId && teacherId) setPendingLink({ studentId, teacherId });
    window.history.replaceState({}, "", ROOT);
  }, []);

  useEffect(() => {
    if (!pendingLink || teachers.length === 0) return;
    const teacher = teachers.find((t) => t.user_id === pendingLink.teacherId);
    if (teacher) {
      // Bildirim diğer şubeden gelmiş olabilir — panel o şubeye geçsin,
      // yoksa öğretmen listede olmadığı için detay boş açılırdı.
      setBranch(teacher.language);
      navigate(`${ROOT}/ogretmen/${teacher.user_id}`);
      const student = teacher.students.find((s) => s.student_id === pendingLink.studentId);
      if (student) setEditingStudent(student);
    }
    setPendingLink(null);
  }, [pendingLink, teachers, navigate, setBranch]);

  /* ── Android geri tuşu ────────────────────────────────────────── */

  useAndroidBackButton(() => {
    if (
      editingTeacher ||
      editingStudent ||
      aboutFor ||
      showBlogManager ||
      showSiteManager ||
      showCreateStudent ||
      showCreateTeacher
    ) {
      setEditingTeacher(null);
      setEditingStudent(null);
      setAboutFor(null);
      setShowBlogManager(false);
      setShowSiteManager(false);
      setShowCreateStudent(false);
      setShowCreateTeacher(false);
      return true;
    }
    if (location.pathname !== ROOT) {
      navigate(ROOT);
      return true;
    }
    return false;
  });

  /* ── Eylemler ─────────────────────────────────────────────────── */

  const toggleStudent = useCallback(
    async (studentRecordId: string, student: Student) => {
      setExpandedStudents((prev) => {
        const next = new Set(prev);
        if (next.has(studentRecordId)) next.delete(studentRecordId);
        else next.add(studentRecordId);
        return next;
      });
      if (!studentTopicsMap.has(studentRecordId)) {
        await fetchStudentTopics(student.student_id, studentRecordId);
      }
    },
    [studentTopicsMap, fetchStudentTopics],
  );

  const handleRestoreStudent = useCallback(
    async (studentRecordId: string) => {
      try {
        const teacher = teachers.find((t) => t.students.some((s) => s.id === studentRecordId));
        const student = teacher?.students.find((s) => s.id === studentRecordId);
        if (!teacher || !student) throw new Error("Öğrenci bulunamadı");

        const result = await restoreStudent(studentRecordId, student.student_id, teacher.user_id);
        if (!result.success) throw new Error(result.error || "Geri alma başarısız");

        toast({
          title: "Başarılı",
          description: `Öğrenci geri alındı${result.instances_created ? ` (${result.instances_created} ders planlandı)` : ""}`,
        });
        fetchTeachers();
      } catch (error) {
        toast({
          title: "Hata",
          description: error instanceof Error ? error.message : "Geri alma başarısız",
          variant: "destructive",
        });
      }
    },
    [teachers, toast, fetchTeachers],
  );

  const headerActions = (
    <>
      <AdminNotificationBell
        variant="panel"
        adminId={profile?.user_id ?? ""}
        teacherIds={branchTeacherIds}
      />
      {/* Gezi günlüğü — panelde bir yeri yok, tek girişi bu düğme. */}
      <IconButton label="Gezi günlüğü" onClick={() => navigate("/mytriptolove")}>
        <Heart className="h-5 w-5" />
      </IconButton>
      <ThemeToggleButton variant="panelV2" />
      <button
        type="button"
        className="pnl-btn pnl-btn--outline hidden md:inline-flex"
        onClick={signOut}
        disabled={signingOut}
      >
        {signingOut ? "Çıkış…" : "Çıkış"}
      </button>
      <IconButton label="Çıkış yap" className="md:hidden" onClick={signOut} disabled={signingOut}>
        <LogOut className="h-5 w-5" />
      </IconButton>
    </>
  );

  const studentListProps = {
    expandedStudents,
    studentTopics: studentTopicsMap,
    studentCompletedTopics: studentAllTopics,
    onToggleStudent: toggleStudent,
    onCreateStudent: () => setShowCreateStudent(true),
    onEditStudent: setEditingStudent,
    onRestoreStudent: handleRestoreStudent,
    onOpenStudentAbout: setAboutFor,
    onAddTopic: setAddTopicFor,
    onAddResource: setAddResourceFor,
    onEditTopic: setEditingTopic,
    onEditResource: setEditingResource,
    onDeleteTopic: topicsCrud.handleDeleteTopic,
    onDeleteResource: topicsCrud.handleDeleteResource,
  };

  const teacherRail = (
    <TeacherRail
      teachers={branchTeachers}
      branch={branch}
      selectedId={selectedTeacher?.user_id ?? null}
      loading={loading}
      onSelect={(t) => navigate(`${ROOT}/ogretmen/${t.user_id}`)}
      onCreate={() => setShowCreateTeacher(true)}
      onEdit={setEditingTeacher}
    />
  );

  return (
    <PanelShell hasTabBar>
      <PanelHeader
        title="Admin Paneli"
        subtitle={profile?.full_name ? `Hoş geldin, ${profile.full_name}` : undefined}
        actions={headerActions}
        nav={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="hidden md:block">
              <NavPills tabs={TABS} activeKey={activeTab} />
            </div>
            <BranchSwitcher value={branch} onChange={handleBranchChange} counts={branchCounts} />
          </div>
        }
      />

      <Routes>
        <Route
          index
          element={
            <TeachersScreen
              rail={teacherRail}
              selectedTeacher={null}
              loading={loading}
              studentListProps={studentListProps}
              scheduleRefreshKey={scheduleRefreshKey}
            />
          }
        />
        <Route
          path="ogretmen/:teacherId"
          element={
            <TeachersScreen
              rail={teacherRail}
              selectedTeacher={selectedTeacher}
              loading={loading}
              studentListProps={studentListProps}
              scheduleRefreshKey={scheduleRefreshKey}
              onBack={() => navigate(ROOT)}
              onEditTeacher={() => selectedTeacher && setEditingTeacher(selectedTeacher)}
            />
          }
        />
        <Route
          path="konular"
          element={
            <div className="pnl-wrap py-5">
              <Suspense fallback={<div className="h-40 animate-pulse rounded-3xl" style={{ background: "var(--ewd-lilac-tint)" }} />}>
                <GlobalTopicsManager
                  key={branch}
                  open
                  inline
                  isAdmin
                  language={branch}
                  onOpenChange={() => {}}
                />
              </Suspense>
            </div>
          }
        />
        <Route
          path="site"
          element={
            <div className="pnl-wrap">
              <SiteScreen
                onOpenSiteManager={() => setShowSiteManager(true)}
                onOpenBlogManager={() => setShowBlogManager(true)}
                onOpenGlobalTopics={() => navigate(`${ROOT}/konular`)}
              />
            </div>
          }
        />
        <Route path="*" element={<Navigate to={ROOT} replace />} />
      </Routes>

      <BottomTabBar tabs={TABS} activeKey={activeTab} />

      {/* ── Diyaloglar ───────────────────────────────────────────── */}
      <CreateTeacherDialog
        open={showCreateTeacher}
        onOpenChange={setShowCreateTeacher}
        onSuccess={fetchTeachers}
        defaultBranch={branch}
      />

      {editingTeacher && (
        <EditTeacherDialog
          open
          onOpenChange={(open) => !open && setEditingTeacher(null)}
          onTeacherUpdated={fetchTeachers}
          teacherId={editingTeacher.user_id}
          currentName={editingTeacher.full_name}
          currentBranch={editingTeacher.language}
        />
      )}

      {selectedTeacher && (
        <CreateStudentDialog
          open={showCreateStudent}
          onOpenChange={setShowCreateStudent}
          onStudentCreated={fetchTeachers}
          teacherId={selectedTeacher.user_id}
        />
      )}

      {editingStudent && (
        <EditStudentDialog
          open
          onOpenChange={(open) => !open && setEditingStudent(null)}
          onStudentUpdated={() => {
            fetchTeachers();
            setScheduleRefreshKey((k) => k + 1);
          }}
          studentId={editingStudent.id}
          currentName={editingStudent.profiles.full_name}
          currentLessons={editingStudent.lessons}
        />
      )}

      {aboutFor && (
        <Suspense fallback={null}>
          <StudentAboutDialog
            key={aboutFor.student_id}
            open
            onOpenChange={(open) => !open && setAboutFor(null)}
            studentId={aboutFor.student_id}
            studentName={aboutFor.profiles.full_name}
            aboutText={aboutFor.about_text ?? null}
            isReadOnly={false}
            onSaved={async () => {
              await fetchTeachers();
              setAboutFor(null);
            }}
          />
        </Suspense>
      )}

      <AddTopicDialog
        open={addTopicFor !== null}
        onOpenChange={(open) => !open && setAddTopicFor(null)}
        onAddTopic={(title, desc) => topicsCrud.handleAddTopic(title, desc, addTopicFor)}
      />
      <AddResourceDialog
        open={addResourceFor !== null}
        onOpenChange={(open) => !open && setAddResourceFor(null)}
        onAddResource={(title, desc, type, url) =>
          topicsCrud.handleAddResource(title, desc, type, url, addResourceFor)
        }
      />
      <EditTopicDialog
        open={editingTopic !== null}
        onOpenChange={(open) => !open && setEditingTopic(null)}
        onEditTopic={topicsCrud.handleEditTopic}
        topic={editingTopic}
      />
      <EditResourceDialog
        open={editingResource !== null}
        onOpenChange={(open) => !open && setEditingResource(null)}
        onEditResource={topicsCrud.handleEditResource}
        resource={editingResource}
      />

      {showBlogManager && (
        <Suspense fallback={null}>
          <AdminBlogManager open onOpenChange={setShowBlogManager} />
        </Suspense>
      )}

      {showSiteManager && (
        <Suspense fallback={null}>
          <AdminSiteManager open onOpenChange={setShowSiteManager} />
        </Suspense>
      )}
    </PanelShell>
  );
}

/* ------------------------------------------------------------------ */
/* Öğretmenler ekranı                                                   */
/* ------------------------------------------------------------------ */

interface TeachersScreenProps {
  rail: React.ReactNode;
  selectedTeacher: Teacher | null;
  loading: boolean;
  studentListProps: Omit<React.ComponentProps<typeof AdminStudentList>, "students">;
  scheduleRefreshKey: number;
  onBack?: () => void;
  onEditTeacher?: () => void;
}

function TeachersScreen({
  rail,
  selectedTeacher,
  loading,
  studentListProps,
  scheduleRefreshKey,
  onBack,
  onEditTeacher,
}: TeachersScreenProps) {
  const isMobile = useIsMobile();
  const [detailTab, setDetailTab] = useState<DetailTab>("students");
  useScrollMemory("admin-teachers");

  const detail = selectedTeacher ? (
    <div className="flex flex-col gap-4">
      {!isMobile && (
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3.5">
            <Avatar name={selectedTeacher.full_name} tone={toneForName(selectedTeacher.full_name)} />
            <div className="flex min-w-0 flex-col">
              <h2
                className="truncate text-2xl font-black tracking-[-0.02em] md:text-[24px]"
                style={{ color: "var(--ewd-on-surface)" }}
              >
                {selectedTeacher.full_name}
              </h2>
              <span className="pnl-student__mail">{selectedTeacher.email}</span>
            </div>
          </div>
          <button type="button" className="pnl-btn pnl-btn--outline" onClick={onEditTeacher}>
            <Settings className="h-4 w-4" />
            Öğretmen ayarları
          </button>
        </div>
      )}

      <div className="pnl-nav">
        {(
          [
            ["students", "Öğrenciler"],
            ["schedule", "Ders programı"],
            ["payments", "Ödemeler"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className="pnl-pill pnl-pill--plain"
            data-active={detailTab === key}
            onClick={() => setDetailTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {detailTab === "students" && (
        <div className="pnl-card p-4 md:p-5">
          <AdminStudentList students={selectedTeacher.students} {...studentListProps} />
        </div>
      )}
      {detailTab === "schedule" && (
        <AdminWeeklySchedule teacherId={selectedTeacher.user_id} refreshKey={scheduleRefreshKey} />
      )}
      {detailTab === "payments" && (
        <AdminBalanceManager
          teacherId={selectedTeacher.user_id}
          branch={selectedTeacher.language}
          activeStudentCount={selectedTeacher.students.filter((s) => !s.is_archived).length}
        />
      )}
    </div>
  ) : null;

  // ── Mobil: liste veya detay, ikisi birden değil ────────────────
  if (isMobile) {
    if (selectedTeacher) {
      return (
        <div className="pnl-wrap pb-6">
          <ScreenHeader
            onBack={onBack ?? (() => {})}
            title={selectedTeacher.full_name}
            leading={
              <Avatar name={selectedTeacher.full_name} tone={toneForName(selectedTeacher.full_name)} size="sm" />
            }
            trailing={
              <IconButton label="Öğretmen ayarları" onClick={onEditTeacher}>
                <Settings className="h-5 w-5" />
              </IconButton>
            }
          />
          {detail}
        </div>
      );
    }
    return <div className="pnl-wrap py-5">{rail}</div>;
  }

  // ── Masaüstü: ray + detay ──────────────────────────────────────
  return (
    <div className="pnl-wrap grid grid-cols-[minmax(0,1fr)] gap-5 py-5 lg:grid-cols-[318px_minmax(0,1fr)]">
      {rail}
      {selectedTeacher ? (
        detail
      ) : loading ? (
        <div className="h-72 animate-pulse rounded-3xl" style={{ background: "var(--ewd-lilac-tint)" }} />
      ) : (
        <EmptyState
          title="Bir öğretmen seçin"
          text="Öğrencilerini, ders programını ve ödemelerini görmek için soldaki listeden bir öğretmen seçin."
          action={
            <span className="mt-2 inline-flex items-center gap-2 text-[13px] font-semibold" style={{ color: "var(--ewd-on-surface-faint)" }}>
              <UserPlus className="h-4 w-4" />
              Yeni öğretmen için sağ üstteki + düğmesini kullanın
            </span>
          }
        />
      )}
    </div>
  );
}
