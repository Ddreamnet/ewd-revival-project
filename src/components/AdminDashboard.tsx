import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Users, LogOut, FolderOpen, PenSquare } from "lucide-react";
import { Header } from "./Header";
import { GlobalTopicsManager } from "./GlobalTopicsManager";
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
import { StudentAboutDialog } from "./StudentAboutDialog";
import { AdminBlogManager } from "./AdminBlogManager";
import { AdminTeacherList } from "./AdminTeacherList";
import { AdminStudentList } from "./AdminStudentList";
import { useAdminTopicsCrud } from "@/hooks/useAdminTopicsCrud";
import type { Teacher, Student, Topic, Resource } from "@/lib/types";

export function AdminDashboard() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [expandedStudents, setExpandedStudents] = useState<Set<string>>(new Set());
  const [studentTopicsMap, setStudentTopicsMap] = useState<Map<string, Topic[]>>(new Map());
  const [studentCompletedTopics, setStudentCompletedTopics] = useState<Map<string, Topic[]>>(new Map());
  const [loading, setLoading] = useState(true);

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

  const { profile, signOut, signingOut } = useAuth();
  const { toast } = useToast();

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
      const { data: teachersData, error: teachersError } = await supabase
        .from("profiles").select("user_id, full_name, email").eq("role", "teacher").order("full_name");
      if (teachersError) throw teachersError;

      const teachersWithStudents = await Promise.all(
        (teachersData || []).map(async (teacher) => {
          const { data: studentsData, error: studentsError } = await supabase
            .from("students")
            .select(`id, student_id, is_archived, about_text, profiles!students_student_id_fkey (full_name, email)`)
            .eq("teacher_id", teacher.user_id);
          if (studentsError) throw studentsError;

          const { data: lessonsData, error: lessonsError } = await supabase
            .from("student_lessons").select("*").eq("teacher_id", teacher.user_id);
          if (lessonsError) throw lessonsError;

          const studentsWithLessons = (studentsData || []).map((student) => ({
            ...student,
            is_archived: student.is_archived || false,
            about_text: student.about_text || null,
            lessons: (lessonsData || [])
              .filter((l) => l.student_id === student.student_id)
              .map((l) => ({ id: l.id, dayOfWeek: l.day_of_week, startTime: l.start_time, endTime: l.end_time, note: l.note })),
          }));

          return { ...teacher, students: studentsWithLessons };
        })
      );

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
      const { error } = await supabase.from("students").update({ is_archived: false, archived_at: null }).eq("id", studentId);
      if (error) throw error;
      toast({ title: "Başarılı", description: "Öğrenci başarıyla geri alındı" });
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
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5">
      <Header
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
      >
        <div className="text-center">
          <h1 className="text-xl sm:text-2xl font-bold">Admin Paneli</h1>
          <p className="text-sm sm:text-lg text-muted-foreground hidden sm:block">Hoş geldin, {profile?.full_name}</p>
        </div>
      </Header>

      <div className="container mx-auto p-4">
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
                  <div className="flex gap-1 sm:gap-2 border-b mb-4 overflow-x-auto pb-1">
                    {(["students", "schedule", "payments"] as const).map((tab) => (
                      <Button
                        key={tab}
                        variant={activeTab === tab ? "default" : "ghost"}
                        className="rounded-b-none text-xs sm:text-sm px-2 sm:px-4 whitespace-nowrap flex-shrink-0"
                        onClick={() => setActiveTab(tab)}
                      >
                        {tab === "students" ? "Öğrenciler" : tab === "schedule" ? "Ders programı" : "Ödemeler"}
                      </Button>
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

                  {activeTab === "schedule" && <AdminWeeklySchedule teacherId={selectedTeacher.user_id} />}
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
      <GlobalTopicsManager open={showGlobalTopics} onOpenChange={setShowGlobalTopics} isAdmin={true} />
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
              onStudentUpdated={fetchTeachers} studentId={editingStudent.id}
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
        <StudentAboutDialog key={studentAboutData.studentId} open={showStudentAbout}
          onOpenChange={(open) => { setShowStudentAbout(open); if (!open) setStudentAboutData(null); }}
          studentId={studentAboutData.studentId} studentName={studentAboutData.studentName}
          aboutText={studentAboutData.aboutText} isReadOnly={false}
          onSaved={async () => { await fetchTeachers(); setStudentAboutData(null); }} />
      )}

      <AdminBlogManager open={showBlogManager} onOpenChange={setShowBlogManager} />
    </div>
  );
}
