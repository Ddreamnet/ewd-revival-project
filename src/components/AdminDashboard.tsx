import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Users, LogOut, FolderOpen, PenSquare } from "lucide-react";
import { restoreStudent } from "@/lib/lessonService";
import { initPushNotifications } from "@/lib/pushNotifications";
import { Header } from "./Header";
import { AdminNotificationBell } from "./AdminNotificationBell";
import { CreateStudentDialog } from "./CreateStudentDialog";
import { CreateTeacherDialog } from "./CreateTeacherDialog";
import { EditStudentDialog } from "./EditStudentDialog";
import { EditTeacherDialog } from "./EditTeacherDialog";
import { AddTopicDialog } from "./AddTopicDialog";
import { AddResourceDialog } from "./AddResourceDialog";
import { EditTopicDialog } from "./EditTopicDialog";
import { EditResourceDialog } from "./EditResourceDialog";
import { AdminWeeklySchedule } from "./AdminWeeklySchedule";
import { AdminBalanceManager } from "./AdminBalanceManager";
import { AdminTeacherList } from "./AdminTeacherList";
import { AdminStudentList } from "./AdminStudentList";
import { useAdminTopicsCrud } from "@/hooks/useAdminTopicsCrud";
import type { Teacher, Student, Topic, Resource } from "@/lib/types";
import { ThemeToggleButton } from "./ThemeToggleButton";

// These three pull in the TipTap rich-text editor (~490 kB). Statically
// imported, that bundle was fetched on every admin dashboard load even though
// the dialogs open rarely — so they are code-split and mounted on demand.
const GlobalTopicsManager = lazy(() =>
  import("./GlobalTopicsManager").then((m) => ({ default: m.GlobalTopicsManager }))
);
const StudentAboutDialog = lazy(() =>
  import("./StudentAboutDialog").then((m) => ({ default: m.StudentAboutDialog }))
);
const AdminBlogManager = lazy(() =>
  import("./AdminBlogManager").then((m) => ({ default: m.AdminBlogManager }))
);

export function AdminDashboard() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [expandedStudents, setExpandedStudents] = useState<Set<string>>(new Set());
  const [studentTopicsMap, setStudentTopicsMap] = useState<Map<string, Topic[]>>(new Map());
  const [studentCompletedTopics, setStudentCompletedTopics] = useState<Map<string, Topic[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [scheduleRefreshKey, setScheduleRefreshKey] = useState(0);

  // Dialog state
  const [showGlobalTopics, setShowGlobalTopics] = useState(false);
  const [showCreateStudent, setShowCreateStudent] = useState(false);
  const [showCreateTeacher, setShowCreateTeacher] = useState(false);
  const [showEditStudent, setShowEditStudent] = useState(false);
  const [showEditTeacher, setShowEditTeacher] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [showAddTopic, setShowAddTopic] = useState(false);
  const [showAddResource, setShowAddResource] = useState(false);
  const [showEditTopic, setShowEditTopic] = useState(false);
  const [showEditResource, setShowEditResource] = useState(false);
  const [selectedStudentForTopic, setSelectedStudentForTopic] = useState<string | null>(null);
  const [selectedTopicForResource, setSelectedTopicForResource] = useState<string | null>(null);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [activeTab, setActiveTab] = useState<"students" | "schedule" | "payments">("students");
  const [showStudentAbout, setShowStudentAbout] = useState(false);
  const [showBlogManager, setShowBlogManager] = useState(false);
  const [studentAboutData, setStudentAboutData] = useState<{ studentId: string; studentName: string; aboutText: string | null } | null>(null);
  const [pendingDeepLink, setPendingDeepLink] = useState<{ studentId: string; teacherId: string } | null>(null);

  const { profile, signOut, signingOut } = useAuth();
  const { toast } = useToast();
  const pushInitRef = useRef(false);

  // Initialize push notifications for admin
  useEffect(() => {
    if (profile?.user_id && !pushInitRef.current) {
      pushInitRef.current = true;
      initPushNotifications(profile.user_id, 'admin');
    }
  }, [profile?.user_id]);

  // Capture a notification-tap deep link ("open this student's settings") from
  // the URL exactly once, then clear the URL.
  useEffect(() => {
    const capture = () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get('action') !== 'student_settings') return;
      const studentId = params.get('student_id');
      const teacherId = params.get('teacher_id');
      if (!studentId || !teacherId) return;
      setPendingDeepLink({ studentId, teacherId });
      window.history.replaceState({}, '', '/dashboard');
    };

    capture();
    window.addEventListener('popstate', capture);
    return () => window.removeEventListener('popstate', capture);
  }, []);

  // Resolve the pending link once the teacher list has loaded.
  //
  // This replaces a setInterval that polled a *stale* `teachers` array captured
  // by its closure: the effect re-ran on every teacher refetch, creating a new
  // interval each time while the old one was cleared only by a 5s timeout that
  // itself outlived unmount. And because the URL had already been cleared on
  // the first pass, the re-run found no params — so tapping the notification
  // before the data arrived silently did nothing.
  useEffect(() => {
    if (!pendingDeepLink || teachers.length === 0) return;

    const teacher = teachers.find((t) => t.user_id === pendingDeepLink.teacherId);
    if (teacher) {
      setSelectedTeacher(teacher);
      const student = teacher.students.find((s) => s.student_id === pendingDeepLink.studentId);
      if (student) {
        setEditingStudent(student);
        setShowEditStudent(true);
      }
    }
    setPendingDeepLink(null);
  }, [pendingDeepLink, teachers]);

  const fetchStudentTopics = async (studentUserId: string, studentId: string) => {
    try {
      const [studentTopicsResponse, globalTopicsResponse, completionResponse] = await Promise.all([
        supabase.from("topics").select("*, resources (*)").eq("student_id", studentUserId).order("order_index"),
        supabase.from("global_topics").select("*, global_topic_resources(*)").order("order_index"),
        supabase.from("student_resource_completion").select("*").eq("student_id", studentUserId),
      ]);

      if (studentTopicsResponse.error) throw studentTopicsResponse.error;
      if (globalTopicsResponse.error) throw globalTopicsResponse.error;
      if (completionResponse.error) throw completionResponse.error;

      const completionMap = new Map();
      (completionResponse.data || []).forEach((c: any) => completionMap.set(c.resource_id, c));

      const processedStudentTopics = (studentTopicsResponse.data || []).map((topic) => ({
        ...topic,
        resources: (topic.resources || [])
          .map((r: any) => ({ ...r, is_completed: completionMap.get(r.id)?.is_completed || false }))
          .sort((a: any, b: any) => a.order_index - b.order_index),
        isGlobal: false,
      }));

      setStudentTopicsMap((prev) => new Map(prev).set(studentId, processedStudentTopics));

      const studentTopicTitles = new Set(processedStudentTopics.map((t) => t.title));
      const processedGlobalTopics = (globalTopicsResponse.data || [])
        .filter((topic) => !studentTopicTitles.has(topic.title))
        .map((topic) => {
          const globalResources = (topic.global_topic_resources || [])
            .map((res: any) => ({
              id: res.id, title: res.title, description: res.description,
              resource_type: res.resource_type, resource_url: res.resource_url,
              order_index: res.order_index, is_completed: completionMap.get(res.id)?.is_completed || false,
            }))
            .sort((a: any, b: any) => a.order_index - b.order_index);

          return {
            id: topic.id, title: topic.title, description: topic.description,
            is_completed: globalResources.length > 0 && globalResources.every((r: any) => r.is_completed),
            order_index: topic.order_index, resources: globalResources, isGlobal: true,
          };
        });

      const allTopics = [...processedStudentTopics, ...processedGlobalTopics].sort((a, b) => {
        if (a.isGlobal && !b.isGlobal) return 1;
        if (!a.isGlobal && b.isGlobal) return -1;
        return a.order_index - b.order_index;
      });

      setStudentCompletedTopics((prev) => new Map(prev).set(studentId, allTopics));
    } catch (error: any) {
      toast({ title: "Hata", description: "Konular yüklenemedi", variant: "destructive" });
    }
  };

  const topicsCrud = useAdminTopicsCrud({
    adminUserId: profile?.user_id,
    selectedTeacherStudents: selectedTeacher?.students,
    studentTopics: studentTopicsMap,
    fetchStudentTopics,
  });

  useEffect(() => { fetchTeachers(); }, []);

  const fetchTeachers = async () => {
    try {
      // Batch: 3 parallel queries instead of 1 + N×2 sequential
      const [teachersRes, allStudentsRes, allLessonsRes] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, email").eq("role", "teacher").order("full_name"),
        supabase.from("students").select(`id, student_id, teacher_id, is_archived, about_text, profiles!students_student_id_fkey (full_name, email)`),
        supabase.from("student_lessons").select("id, student_id, teacher_id, day_of_week, start_time, end_time, note"),
      ]);

      if (teachersRes.error) throw teachersRes.error;
      if (allStudentsRes.error) throw allStudentsRes.error;
      if (allLessonsRes.error) throw allLessonsRes.error;

      // Group students and lessons by teacher_id in JS
      const studentsByTeacher = new Map<string, typeof allStudentsRes.data>();
      for (const s of allStudentsRes.data || []) {
        const list = studentsByTeacher.get(s.teacher_id) || [];
        list.push(s);
        studentsByTeacher.set(s.teacher_id, list);
      }

      const lessonsByStudent = new Map<string, typeof allLessonsRes.data>();
      for (const l of allLessonsRes.data || []) {
        const list = lessonsByStudent.get(l.student_id) || [];
        list.push(l);
        lessonsByStudent.set(l.student_id, list);
      }

      const teachersWithStudents = (teachersRes.data || []).map((teacher) => {
        const students = (studentsByTeacher.get(teacher.user_id) || []).map((student) => ({
          ...student,
          is_archived: student.is_archived || false,
          about_text: student.about_text || null,
          lessons: (lessonsByStudent.get(student.student_id) || [])
            .filter((l) => l.teacher_id === teacher.user_id)
            .map((l) => ({ id: l.id, dayOfWeek: l.day_of_week, startTime: l.start_time, endTime: l.end_time, note: l.note })),
        }));
        return { ...teacher, students };
      });

      setTeachers(teachersWithStudents);
    } catch (error: any) {
      toast({ title: "Hata", description: "Öğretmenler yüklenemedi", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const toggleStudent = async (studentId: string, student: Student) => {
    const newExpanded = new Set(expandedStudents);
    if (newExpanded.has(studentId)) {
      newExpanded.delete(studentId);
    } else {
      newExpanded.add(studentId);
      if (!studentTopicsMap.has(studentId)) {
        await fetchStudentTopics(student.student_id, studentId);
      }
    }
    setExpandedStudents(newExpanded);
  };

  const handleRestoreStudent = async (studentId: string) => {
    try {
      // Find the student record to get user IDs
      const student = teachers
        .flatMap((t) => t.students)
        .find((s) => s.id === studentId);
      if (!student) throw new Error("Öğrenci bulunamadı");

      // Find the teacher who owns this student
      const teacher = teachers.find((t) =>
        t.students.some((s) => s.id === studentId)
      );
      if (!teacher) throw new Error("Öğretmen bulunamadı");

      const result = await restoreStudent(studentId, student.student_id, teacher.user_id);
      if (!result.success) {
        throw new Error(result.error || "Geri alma başarısız");
      }

      toast({
        title: "Başarılı",
        description: `Öğrenci geri alındı${result.instances_created ? ` (${result.instances_created} ders planlandı)` : ""}`,
      });
      fetchTeachers();
    } catch (error: any) {
      toast({ title: "Hata", description: error.message, variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="ewd-panel min-h-screen">
      <Header
        title="Admin Paneli"
        subtitle={profile?.full_name ? `Hoş geldin, ${profile.full_name}` : undefined}
        badge="Yönetici"
        rightActions={
          <>
            <AdminNotificationBell adminId={profile?.user_id || ''} />
            <Button onClick={() => setShowBlogManager(true)} variant="outline" size="sm">
              <PenSquare className="h-4 w-4" />
              <span className="hidden sm:inline ml-2">Blog</span>
            </Button>
            <Button onClick={() => setShowGlobalTopics(true)} variant="outline" size="sm">
              <FolderOpen className="h-4 w-4" />
              <span className="hidden sm:inline ml-2">Konular</span>
            </Button>
            <ThemeToggleButton />
            <Button onClick={signOut} variant="outline" size="sm" disabled={signingOut}>
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline ml-2">{signingOut ? "Çıkış..." : "Çıkış"}</span>
            </Button>
          </>
        }
      />

      <div className="mx-auto max-w-[1500px] p-3 sm:p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Teachers List */}
          <div className="lg:col-span-1">
            <AdminTeacherList
              teachers={teachers}
              selectedTeacher={selectedTeacher}
              onSelectTeacher={setSelectedTeacher}
              onCreateTeacher={() => setShowCreateTeacher(true)}
              onEditTeacher={(teacher) => { setEditingTeacher(teacher); setShowEditTeacher(true); }}
            />
          </div>

          {/* Teacher Details */}
          <div className="lg:col-span-2">
            {selectedTeacher ? (
              <Card>
                <CardHeader>
                  <CardTitle>{selectedTeacher.full_name}</CardTitle>
                  <CardDescription>{selectedTeacher.email}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 flex gap-1.5 overflow-x-auto border-b-2 border-[color:var(--ewd-line)] pb-3">
                    {(["students", "schedule", "payments"] as const).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        className="ewd-tab"
                        data-active={activeTab === tab}
                        onClick={() => setActiveTab(tab)}
                      >
                        {tab === "students" ? "Öğrenciler" : tab === "schedule" ? "Ders programı" : "Ödemeler"}
                      </button>
                    ))}
                  </div>

                  {activeTab === "students" && (
                    <AdminStudentList
                      students={selectedTeacher.students}
                      expandedStudents={expandedStudents}
                      studentTopics={studentTopicsMap}
                      studentCompletedTopics={studentCompletedTopics}
                      onToggleStudent={toggleStudent}
                      onCreateStudent={() => setShowCreateStudent(true)}
                      onEditStudent={(student) => { setEditingStudent(student); setShowEditStudent(true); }}
                      onRestoreStudent={handleRestoreStudent}
                      onOpenStudentAbout={(student) => {
                        setStudentAboutData({
                          studentId: student.student_id,
                          studentName: student.profiles.full_name,
                          aboutText: student.about_text,
                        });
                        setShowStudentAbout(true);
                      }}
                      onAddTopic={(studentId) => { setSelectedStudentForTopic(studentId); setShowAddTopic(true); }}
                      onAddResource={(topicId) => { setSelectedTopicForResource(topicId); setShowAddResource(true); }}
                      onEditTopic={(topic) => { setEditingTopic(topic); setShowEditTopic(true); }}
                      onEditResource={(resource) => { setEditingResource(resource); setShowEditResource(true); }}
                      onDeleteTopic={topicsCrud.handleDeleteTopic}
                      onDeleteResource={topicsCrud.handleDeleteResource}
                    />
                  )}

                  {activeTab === "schedule" && <AdminWeeklySchedule teacherId={selectedTeacher.user_id} refreshKey={scheduleRefreshKey} />}
                  {activeTab === "payments" && <AdminBalanceManager teacherId={selectedTeacher.user_id} />}
                </CardContent>
              </Card>
            ) : (
              <Card className="h-96 flex items-center justify-center">
                <div className="text-center">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">Bir Öğretmen Seç</h3>
                  <p className="text-muted-foreground">
                    Öğretmen detaylarını görüntülemek için listeden bir öğretmen seçin
                  </p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Dialogs */}
      {showGlobalTopics && (
        <Suspense fallback={null}>
          <GlobalTopicsManager open={showGlobalTopics} onOpenChange={setShowGlobalTopics} isAdmin={true} />
        </Suspense>
      )}
      <CreateTeacherDialog open={showCreateTeacher} onOpenChange={setShowCreateTeacher} onSuccess={fetchTeachers} />
      
      {editingTeacher && (
        <EditTeacherDialog open={showEditTeacher} onOpenChange={setShowEditTeacher} onTeacherUpdated={fetchTeachers}
          teacherId={editingTeacher.user_id} currentName={editingTeacher.full_name} />
      )}

      {selectedTeacher && (
        <>
          <CreateStudentDialog open={showCreateStudent} onOpenChange={setShowCreateStudent}
            onStudentCreated={fetchTeachers} teacherId={selectedTeacher.user_id} />
          {editingStudent && (
            <EditStudentDialog open={showEditStudent} onOpenChange={setShowEditStudent}
              onStudentUpdated={() => { fetchTeachers(); setScheduleRefreshKey(prev => prev + 1); }} studentId={editingStudent.id}
              currentName={editingStudent.profiles.full_name} currentLessons={editingStudent.lessons} />
          )}
        </>
      )}

      <AddTopicDialog open={showAddTopic} onOpenChange={setShowAddTopic}
        onAddTopic={(title, desc) => topicsCrud.handleAddTopic(title, desc, selectedStudentForTopic)} />
      <AddResourceDialog open={showAddResource} onOpenChange={setShowAddResource}
        onAddResource={(title, desc, type, url) => topicsCrud.handleAddResource(title, desc, type, url, selectedTopicForResource)} />
      <EditTopicDialog open={showEditTopic} onOpenChange={setShowEditTopic}
        onEditTopic={topicsCrud.handleEditTopic} topic={editingTopic} />
      <EditResourceDialog open={showEditResource} onOpenChange={setShowEditResource}
        onEditResource={topicsCrud.handleEditResource} resource={editingResource} />

      {studentAboutData && (
        <Suspense fallback={null}>
          <StudentAboutDialog key={studentAboutData.studentId} open={showStudentAbout}
            onOpenChange={(open) => { setShowStudentAbout(open); if (!open) setStudentAboutData(null); }}
            studentId={studentAboutData.studentId} studentName={studentAboutData.studentName}
            aboutText={studentAboutData.aboutText} isReadOnly={false}
            onSaved={async () => { await fetchTeachers(); setStudentAboutData(null); }} />
        </Suspense>
      )}

      {showBlogManager && (
        <Suspense fallback={null}>
          <AdminBlogManager open={showBlogManager} onOpenChange={setShowBlogManager} />
        </Suspense>
      )}
    </div>
  );
}
