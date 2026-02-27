import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Users, LogOut, FolderOpen, ChevronDown, ChevronRight, Settings, Clock, Plus, Trash2, ExternalLink, FileText, Video, Link as LinkIcon, Image, UserPlus, Archive, RotateCcw, FileUser, PenSquare } from "lucide-react";
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
import { getDayName, formatTime } from "@/lib/lessonTypes";
import { getResourceIcon } from "@/lib/resourceUtils";
import type { Teacher, Student, Topic, Resource } from "@/lib/types";

export function AdminDashboard() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [expandedStudents, setExpandedStudents] = useState<Set<string>>(new Set());
  const [studentTopics, setStudentTopics] = useState<Map<string, Topic[]>>(new Map());
  const [studentCompletedTopics, setStudentCompletedTopics] = useState<Map<string, Topic[]>>(new Map());
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    fetchTeachers();
  }, []);

  const fetchTeachers = async () => {
    try {
      // Fetch all teachers
      const { data: teachersData, error: teachersError } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .eq("role", "teacher")
        .order("full_name");

      if (teachersError) throw teachersError;

      // For each teacher, fetch their students
      const teachersWithStudents = await Promise.all(
        (teachersData || []).map(async (teacher) => {
          const { data: studentsData, error: studentsError } = await supabase
            .from("students")
            .select(
              `
              id,
              student_id,
              is_archived,
              about_text,
              profiles!students_student_id_fkey (
                full_name,
                email
              )
            `
            )
            .eq("teacher_id", teacher.user_id);

          if (studentsError) throw studentsError;

          // Fetch lessons for each student
          const { data: lessonsData, error: lessonsError } = await supabase
            .from("student_lessons")
            .select("*")
            .eq("teacher_id", teacher.user_id);

          if (lessonsError) throw lessonsError;

          // Combine students with their lessons
          const studentsWithLessons = (studentsData || []).map((student) => ({
            ...student,
            is_archived: student.is_archived || false,
            about_text: student.about_text || null,
            lessons: (lessonsData || [])
              .filter((lesson) => lesson.student_id === student.student_id)
              .map((lesson) => ({
                id: lesson.id,
                dayOfWeek: lesson.day_of_week,
                startTime: lesson.start_time,
                endTime: lesson.end_time,
                note: lesson.note,
              })),
          }));

          return {
            ...teacher,
            students: studentsWithLessons,
          };
        })
      );

      setTeachers(teachersWithStudents);
    } catch (error: any) {
      toast({
        title: "Hata",
        description: "Öğretmenler yüklenemedi",
        variant: "destructive",
      });
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
      // Fetch topics if not already loaded
      if (!studentTopics.has(studentId)) {
        await fetchStudentTopics(student.student_id, studentId);
      }
    }
    setExpandedStudents(newExpanded);
  };

  const fetchStudentTopics = async (studentUserId: string, studentId: string) => {
    try {
      // Fetch all data in parallel
      const [studentTopicsResponse, globalTopicsResponse, completionResponse] = await Promise.all([
        // 1) Student-specific topics
        supabase
          .from("topics")
          .select("*, resources (*)")
          .eq("student_id", studentUserId)
          .order("order_index"),
        
        // 2) Global topics
        supabase
          .from("global_topics")
          .select("*, global_topic_resources(*)")
          .order("order_index"),
        
        // 3) Completion data
        supabase
          .from("student_resource_completion")
          .select("*")
          .eq("student_id", studentUserId)
      ]);

      if (studentTopicsResponse.error) throw studentTopicsResponse.error;
      if (globalTopicsResponse.error) throw globalTopicsResponse.error;
      if (completionResponse.error) throw completionResponse.error;

      const studentTopicsData = studentTopicsResponse.data || [];
      const globalTopicsData = globalTopicsResponse.data || [];
      const completionData = completionResponse.data || [];

      // Create completion map
      const completionMap = new Map();
      completionData.forEach((completion: any) => {
        completionMap.set(completion.resource_id, completion);
      });

      // Process student-specific topics (for CRUD)
      const processedStudentTopics = studentTopicsData.map((topic) => ({
        ...topic,
        resources: (topic.resources || [])
          .map((resource: any) => {
            const completion = completionMap.get(resource.id);
            return {
              ...resource,
              is_completed: completion?.is_completed || false,
            };
          })
          .sort((a: any, b: any) => a.order_index - b.order_index),
        isGlobal: false,
      }));

      setStudentTopics((prev) => new Map(prev).set(studentId, processedStudentTopics));

      // Process all topics for "İşlenen Konular" view (global + student-specific with completion)
      const studentTopicTitles = new Set(processedStudentTopics.map((t) => t.title));
      
      const processedGlobalTopics = globalTopicsData
        .filter((topic) => !studentTopicTitles.has(topic.title))
        .map((topic) => {
          const globalResources = (topic.global_topic_resources || [])
            .map((res: any) => {
              const completion = completionMap.get(res.id);
              return {
                id: res.id,
                title: res.title,
                description: res.description,
                resource_type: res.resource_type,
                resource_url: res.resource_url,
                order_index: res.order_index,
                is_completed: completion?.is_completed || false,
              };
            })
            .sort((a: any, b: any) => a.order_index - b.order_index);

          const allResourcesCompleted =
            globalResources.length > 0 && globalResources.every((resource: any) => resource.is_completed);

          return {
            id: topic.id,
            title: topic.title,
            description: topic.description,
            is_completed: allResourcesCompleted,
            order_index: topic.order_index,
            resources: globalResources,
            isGlobal: true,
          };
        });

      // Combine all topics for completed topics view
      const allTopics = [...processedStudentTopics, ...processedGlobalTopics].sort((a, b) => {
        if (a.isGlobal && !b.isGlobal) return 1;
        if (!a.isGlobal && b.isGlobal) return -1;
        return a.order_index - b.order_index;
      });

      setStudentCompletedTopics((prev) => new Map(prev).set(studentId, allTopics));
    } catch (error: any) {
      toast({
        title: "Hata",
        description: "Konular yüklenemedi",
        variant: "destructive",
      });
    }
  };

  // getDayName, formatTime, and getResourceIcon are now imported from shared modules

  const openStudentSettings = (student: Student) => {
    setEditingStudent(student);
    setShowEditStudent(true);
  };

  const openTeacherSettings = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    setShowEditTeacher(true);
  };


  const handleAddTopic = async (title: string, description: string) => {
    if (!selectedStudentForTopic) return;

    try {
      const student = selectedTeacher?.students.find((s) => s.id === selectedStudentForTopic);
      if (!student) return;

      const topics = studentTopics.get(selectedStudentForTopic) || [];
      const nextOrderIndex = topics.length > 0 ? Math.max(...topics.map((t) => t.order_index)) + 1 : 0;

      const { error } = await supabase.from("topics").insert({
        teacher_id: profile?.user_id,
        student_id: student.student_id,
        title,
        description: description || null,
        order_index: nextOrderIndex,
      });

      if (error) throw error;

      toast({
        title: "Başarılı",
        description: "Konu başarıyla oluşturuldu",
      });

      await fetchStudentTopics(student.student_id, selectedStudentForTopic);
    } catch (error: any) {
      toast({
        title: "Hata",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleAddResource = async (title: string, description: string, resourceType: string, resourceUrl: string) => {
    if (!selectedTopicForResource) return;

    try {
      const topics = Array.from(studentTopics.values()).flat();
      const topic = topics.find((t) => t.id === selectedTopicForResource);
      if (!topic) return;

      const nextOrderIndex = topic.resources.length > 0 ? Math.max(...topic.resources.map((r) => r.order_index)) + 1 : 0;

      const { error } = await supabase.from("resources").insert({
        topic_id: selectedTopicForResource,
        title,
        description: description || null,
        resource_type: resourceType,
        resource_url: resourceUrl,
        order_index: nextOrderIndex,
      });

      if (error) throw error;

      toast({
        title: "Başarılı",
        description: "Kaynak başarıyla eklendi",
      });

      // Refresh topics for this student
      const studentId = Array.from(studentTopics.entries()).find(([_, topics]) => 
        topics.some((t) => t.id === selectedTopicForResource)
      )?.[0];
      
      if (studentId) {
        const student = selectedTeacher?.students.find((s) => s.id === studentId);
        if (student) {
          await fetchStudentTopics(student.student_id, studentId);
        }
      }
    } catch (error: any) {
      toast({
        title: "Hata",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEditTopic = async (id: string, title: string, description: string) => {
    try {
      const { error } = await supabase
        .from("topics")
        .update({ title, description: description || null })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Başarılı",
        description: "Konu güncellendi",
      });

      // Refresh topics
      const studentId = Array.from(studentTopics.entries()).find(([_, topics]) => 
        topics.some((t) => t.id === id)
      )?.[0];
      
      if (studentId) {
        const student = selectedTeacher?.students.find((s) => s.id === studentId);
        if (student) {
          await fetchStudentTopics(student.student_id, studentId);
        }
      }
    } catch (error: any) {
      toast({
        title: "Hata",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEditResource = async (
    id: string,
    title: string,
    description: string,
    resourceType: string,
    resourceUrl: string
  ) => {
    try {
      const { error } = await supabase
        .from("resources")
        .update({
          title,
          description: description || null,
          resource_type: resourceType,
          resource_url: resourceUrl,
        })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Başarılı",
        description: "Kaynak güncellendi",
      });

      // Refresh topics
      const studentId = Array.from(studentTopics.entries()).find(([_, topics]) =>
        topics.some((t) => t.resources.some((r) => r.id === id))
      )?.[0];

      if (studentId) {
        const student = selectedTeacher?.students.find((s) => s.id === studentId);
        if (student) {
          await fetchStudentTopics(student.student_id, studentId);
        }
      }
    } catch (error: any) {
      toast({
        title: "Hata",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteTopic = async (topicId: string, studentId: string, studentUserId: string) => {
    try {
      const { error } = await supabase.from("topics").delete().eq("id", topicId);

      if (error) throw error;

      toast({
        title: "Başarılı",
        description: "Konu silindi",
      });

      await fetchStudentTopics(studentUserId, studentId);
    } catch (error: any) {
      toast({
        title: "Hata",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteResource = async (resourceId: string, studentId: string, studentUserId: string) => {
    try {
      const { error } = await supabase.from("resources").delete().eq("id", resourceId);

      if (error) throw error;

      toast({
        title: "Başarılı",
        description: "Kaynak silindi",
      });

      await fetchStudentTopics(studentUserId, studentId);
    } catch (error: any) {
      toast({
        title: "Hata",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRestoreStudent = async (studentId: string) => {
    try {
      const { error } = await supabase
        .from("students")
        .update({ is_archived: false, archived_at: null })
        .eq("id", studentId);

      if (error) throw error;

      toast({
        title: "Başarılı",
        description: "Öğrenci başarıyla geri alındı",
      });

      fetchTeachers();
    } catch (error: any) {
      toast({
        title: "Hata",
        description: error.message,
        variant: "destructive",
      });
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Teachers List */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Öğretmenler
                    </CardTitle>
                    <CardDescription>{teachers.length} öğretmen kayıtlı</CardDescription>
                  </div>
                  <Button onClick={() => setShowCreateTeacher(true)} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Oluştur
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {teachers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Henüz öğretmen yok.</p>
                ) : (
                  teachers.map((teacher) => (
                    <Card
                      key={teacher.user_id}
                      className={`cursor-pointer transition-colors hover:bg-accent ${
                        selectedTeacher?.user_id === teacher.user_id ? "ring-2 ring-primary" : ""
                      }`}
                      onClick={() => setSelectedTeacher(teacher)}
                    >
                      <CardContent className="p-3">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="font-medium">{teacher.full_name}</h4>
                            <p className="text-sm text-muted-foreground">{teacher.email}</p>
                          <Badge variant="outline" className="mt-1">
                              {teacher.students.filter(s => !s.is_archived).length} öğrenci
                            </Badge>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              openTeacherSettings(teacher);
                            }}
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </CardContent>
            </Card>
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
                    <Button
                      variant={activeTab === "students" ? "default" : "ghost"}
                      className="rounded-b-none text-xs sm:text-sm px-2 sm:px-4 whitespace-nowrap flex-shrink-0"
                      onClick={() => setActiveTab("students")}
                    >
                      Öğrenciler
                    </Button>
                    <Button
                      variant={activeTab === "schedule" ? "default" : "ghost"}
                      className="rounded-b-none text-xs sm:text-sm px-2 sm:px-4 whitespace-nowrap flex-shrink-0"
                      onClick={() => setActiveTab("schedule")}
                    >
                      Ders programı
                    </Button>
                    <Button
                      variant={activeTab === "payments" ? "default" : "ghost"}
                      className="rounded-b-none text-xs sm:text-sm px-2 sm:px-4 whitespace-nowrap flex-shrink-0"
                      onClick={() => setActiveTab("payments")}
                    >
                      Ödemeler
                    </Button>
                  </div>

                  {activeTab === "students" && (
                    <div className="space-y-3">
                      <div className="flex justify-end mb-3">
                        <Button onClick={() => setShowCreateStudent(true)} size="sm">
                          <UserPlus className="h-4 w-4 mr-2" />
                          Öğrenci Oluştur
                        </Button>
                      </div>
                      
                      {/* Active Students */}
                      {(() => {
                        const activeStudents = selectedTeacher.students.filter(s => !s.is_archived);
                        const archivedStudents = selectedTeacher.students.filter(s => s.is_archived);
                        
                        return (
                          <>
                            {activeStudents.length === 0 ? (
                              <p className="text-sm text-muted-foreground text-center py-8">
                                Bu öğretmenin henüz aktif öğrencisi yok.
                              </p>
                            ) : (
                              activeStudents.map((student) => (
                                <Card key={student.id} className="border">
                                  <Collapsible>
                                    <CardContent className="p-3">
                                      <div className="flex justify-between items-start">
                                        <CollapsibleTrigger
                                          className="flex items-center gap-2 flex-1 text-left"
                                          onClick={() => toggleStudent(student.id, student)}
                                        >
                                          {expandedStudents.has(student.id) ? (
                                            <ChevronDown className="h-4 w-4" />
                                          ) : (
                                            <ChevronRight className="h-4 w-4" />
                                          )}
                                          <div className="flex-1">
                                            <h4 className="font-medium">{student.profiles.full_name}</h4>
                                            <p className="text-sm text-muted-foreground">{student.profiles.email}</p>

                                            {student.lessons.length > 0 && (
                                              <div className="mt-1 space-y-1">
                                                {student.lessons.slice(0, 2).map((lesson, index) => (
                                                  <div key={index} className="flex items-center gap-1">
                                                    <Clock className="h-3 w-3 text-muted-foreground" />
                                                    <span className="text-xs text-muted-foreground">
                                                      {getDayName(lesson.dayOfWeek)} {formatTime(lesson.startTime)}-
                                                      {formatTime(lesson.endTime)}
                                                    </span>
                                                  </div>
                                                ))}
                                                {student.lessons.length > 2 && (
                                                  <span className="text-xs text-muted-foreground">
                                                    +{student.lessons.length - 2} ders daha
                                                  </span>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        </CollapsibleTrigger>

                                        <div className="flex items-center gap-1">
                                          <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setStudentAboutData({
                                                studentId: student.student_id,
                                                studentName: student.profiles.full_name,
                                                aboutText: student.about_text
                                              });
                                              setShowStudentAbout(true);
                                            }}
                                            title="Öğrenci hakkında"
                                          >
                                            <FileUser className="h-4 w-4" />
                                          </Button>
                                          <Button variant="ghost" size="sm" onClick={() => openStudentSettings(student)}>
                                            <Settings className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      </div>

                                      <CollapsibleContent className="mt-4">
                                        <div className="pl-6 border-t pt-3 space-y-6">
                                          {/* İşlenen Konular Bölümü - En az bir kaynağı tamamlanmış konular */}
                                          <div className="space-y-3">
                                            <div className="flex justify-between items-center">
                                              <h5 className="font-medium text-sm">İşlenen Konular</h5>
                                              {(() => {
                                                const allTopics = studentCompletedTopics.get(student.id) || [];
                                                const topicsWithCompletedResources = allTopics.filter(t => t.resources.some(r => r.is_completed));
                                                const fullyCompletedCount = topicsWithCompletedResources.filter(t => t.is_completed).length;
                                                const totalCompletedResources = topicsWithCompletedResources.reduce((sum, t) => sum + t.resources.filter(r => r.is_completed).length, 0);
                                                return (
                                                  <Badge variant="secondary">
                                                    {totalCompletedResources} kaynak işlendi ({fullyCompletedCount} konu tam)
                                                  </Badge>
                                                );
                                              })()}
                                            </div>

                                            {(() => {
                                              const topicsWithCompletedResources = studentCompletedTopics.get(student.id)?.filter(t => 
                                                t.resources.some(r => r.is_completed)
                                              ) || [];
                                              
                                              if (topicsWithCompletedResources.length === 0) {
                                                return (
                                                  <p className="text-sm text-muted-foreground py-2">
                                                    Henüz işlenmiş kaynak yok.
                                                  </p>
                                                );
                                              }
                                              return (
                                                <div className="space-y-2 max-h-80 overflow-y-auto">
                                                  {topicsWithCompletedResources.map((topic) => {
                                                    const completedResourcesCount = topic.resources.filter(r => r.is_completed).length;
                                                    const totalResourcesCount = topic.resources.length;
                                                    const isFullyCompleted = topic.is_completed || completedResourcesCount === totalResourcesCount;
                                                    
                                                    return (
                                                      <Card 
                                                        key={topic.id} 
                                                        className={`border-l-4 ${
                                                          isFullyCompleted 
                                                            ? "border-l-green-500 bg-green-50/50 dark:bg-green-950/20" 
                                                            : "border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20"
                                                        }`}
                                                      >
                                                        <Collapsible>
                                                          <CardContent className="p-3">
                                                            <CollapsibleTrigger className="flex items-center gap-2 w-full text-left">
                                                              <Checkbox checked={isFullyCompleted} className="h-4 w-4" disabled />
                                                              <div className="flex-1">
                                                                <span className="text-sm font-medium">{topic.title}</span>
                                                                {topic.isGlobal && (
                                                                  <Badge variant="outline" className="ml-2 text-xs">Global</Badge>
                                                                )}
                                                              </div>
                                                              <Badge variant="secondary" className="text-xs">
                                                                {completedResourcesCount}/{totalResourcesCount} kaynak
                                                              </Badge>
                                                              <ChevronRight className="h-4 w-4" />
                                                            </CollapsibleTrigger>
                                                            <CollapsibleContent className="mt-2 pl-6 space-y-1">
                                                              {topic.resources.filter(r => r.is_completed).map((resource) => (
                                                                <div key={resource.id} className="flex items-center gap-2 py-1">
                                                                  <Checkbox checked={true} className="h-3 w-3" disabled />
                                                                  {getResourceIcon(resource.resource_type)}
                                                                  <span
                                                                    className="text-xs flex-1 cursor-pointer hover:text-primary"
                                                                    onClick={() => window.open(resource.resource_url, "_blank")}
                                                                  >
                                                                    {resource.title}
                                                                  </span>
                                                                </div>
                                                              ))}
                                                            </CollapsibleContent>
                                                          </CardContent>
                                                        </Collapsible>
                                                      </Card>
                                                    );
                                                  })}
                                                </div>
                                              );
                                            })()}
                                          </div>

                                          {/* Öğrenciye Özel Konular Bölümü (CRUD) */}
                                          <div className="space-y-3 border-t pt-3">
                                            <div className="flex justify-between items-center">
                                              <h5 className="font-medium text-sm">Öğrenciye Özel Konular</h5>
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                  setSelectedStudentForTopic(student.id);
                                                  setShowAddTopic(true);
                                                }}
                                              >
                                                <Plus className="h-3 w-3 mr-1" />
                                                Konu Ekle
                                              </Button>
                                            </div>

                                            {(studentTopics.get(student.id) || []).length === 0 ? (
                                              <p className="text-sm text-muted-foreground py-2">
                                                Bu öğrenciye özel konu henüz eklenmemiş.
                                              </p>
                                            ) : (
                                              <div className="space-y-2">
                                                {(studentTopics.get(student.id) || []).map((topic) => (
                                                  <Card key={topic.id} className="border">
                                                    <Collapsible>
                                                      <CardContent className="p-2">
                                                        <div className="flex items-center gap-2">
                                                          <CollapsibleTrigger className="flex items-center gap-1">
                                                            <ChevronRight className="h-3 w-3" />
                                                          </CollapsibleTrigger>
                                                          <Checkbox checked={topic.is_completed} className="h-4 w-4" disabled />
                                                          <span className="text-sm flex-1">{topic.title}</span>
                                                          <Badge variant="secondary" className="text-xs">
                                                            {topic.resources.length} kaynak
                                                          </Badge>
                                                          <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => {
                                                              setSelectedTopicForResource(topic.id);
                                                              setShowAddResource(true);
                                                            }}
                                                          >
                                                            <Plus className="h-3 w-3" />
                                                          </Button>
                                                          <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => {
                                                              setEditingTopic(topic);
                                                              setShowEditTopic(true);
                                                            }}
                                                          >
                                                            <Settings className="h-3 w-3" />
                                                          </Button>
                                                          <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() =>
                                                              handleDeleteTopic(topic.id, student.id, student.student_id)
                                                            }
                                                          >
                                                            <Trash2 className="h-3 w-3 text-destructive" />
                                                          </Button>
                                                        </div>

                                                        <CollapsibleContent className="mt-2 space-y-1">
                                                          {topic.resources.map((resource) => (
                                                            <div key={resource.id} className="flex items-center gap-2 pl-8">
                                                              <Checkbox checked={resource.is_completed} className="h-3 w-3" disabled />
                                                              {getResourceIcon(resource.resource_type)}
                                                              <span
                                                                className="text-xs flex-1 cursor-pointer hover:text-primary"
                                                                onClick={() => window.open(resource.resource_url, "_blank")}
                                                              >
                                                                {resource.title}
                                                              </span>
                                                              <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => {
                                                                  setEditingResource(resource);
                                                                  setShowEditResource(true);
                                                                }}
                                                              >
                                                                <Settings className="h-3 w-3" />
                                                              </Button>
                                                              <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() =>
                                                                  handleDeleteResource(resource.id, student.id, student.student_id)
                                                                }
                                                              >
                                                                <Trash2 className="h-3 w-3 text-destructive" />
                                                              </Button>
                                                            </div>
                                                          ))}
                                                        </CollapsibleContent>
                                                      </CardContent>
                                                    </Collapsible>
                                                  </Card>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </CollapsibleContent>
                                    </CardContent>
                                  </Collapsible>
                                </Card>
                              ))
                            )}

                            {/* Arşivlenmiş Öğrenciler */}
                            {archivedStudents.length > 0 && (
                              <div className="mt-6 pt-4 border-t">
                                <div className="flex items-center gap-2 mb-3">
                                  <Archive className="h-4 w-4 text-muted-foreground" />
                                  <h4 className="font-medium text-sm text-muted-foreground">Arşivlenmiş Öğrenciler</h4>
                                  <Badge variant="secondary" className="text-xs">{archivedStudents.length}</Badge>
                                </div>
                                <div className="space-y-2">
                                  {archivedStudents.map((student) => (
                                    <Card key={student.id} className="border bg-muted/30 opacity-70">
                                      <CardContent className="p-3">
                                        <div className="flex justify-between items-center">
                                          <div className="flex items-center gap-2">
                                            <Archive className="h-4 w-4 text-muted-foreground" />
                                            <div>
                                              <h4 className="font-medium text-sm">{student.profiles.full_name}</h4>
                                              <p className="text-xs text-muted-foreground">{student.profiles.email}</p>
                                            </div>
                                          </div>
                                          <Button 
                                            variant="outline" 
                                            size="sm"
                                            onClick={() => handleRestoreStudent(student.id)}
                                          >
                                            <RotateCcw className="h-3 w-3 mr-1" />
                                            Geri Al
                                          </Button>
                                        </div>
                                      </CardContent>
                                    </Card>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
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

      <GlobalTopicsManager open={showGlobalTopics} onOpenChange={setShowGlobalTopics} isAdmin={true} />
      
      <CreateTeacherDialog
        open={showCreateTeacher}
        onOpenChange={setShowCreateTeacher}
        onSuccess={fetchTeachers}
      />

      {editingTeacher && (
        <EditTeacherDialog
          open={showEditTeacher}
          onOpenChange={setShowEditTeacher}
          onTeacherUpdated={fetchTeachers}
          teacherId={editingTeacher.user_id}
          currentName={editingTeacher.full_name}
        />
      )}

      {selectedTeacher && (
        <>
          <CreateStudentDialog
            open={showCreateStudent}
            onOpenChange={setShowCreateStudent}
            onStudentCreated={fetchTeachers}
            teacherId={selectedTeacher.user_id}
          />

          {editingStudent && (
            <EditStudentDialog
              open={showEditStudent}
              onOpenChange={setShowEditStudent}
              onStudentUpdated={fetchTeachers}
              studentId={editingStudent.id}
              currentName={editingStudent.profiles.full_name}
              currentLessons={editingStudent.lessons}
            />
          )}
        </>
      )}

      <AddTopicDialog
        open={showAddTopic}
        onOpenChange={setShowAddTopic}
        onAddTopic={handleAddTopic}
      />

      <AddResourceDialog
        open={showAddResource}
        onOpenChange={setShowAddResource}
        onAddResource={handleAddResource}
      />

      <EditTopicDialog
        open={showEditTopic}
        onOpenChange={setShowEditTopic}
        onEditTopic={handleEditTopic}
        topic={editingTopic}
      />

      <EditResourceDialog
        open={showEditResource}
        onOpenChange={setShowEditResource}
        onEditResource={handleEditResource}
        resource={editingResource}
      />

      {studentAboutData && (
        <StudentAboutDialog
          key={studentAboutData.studentId}
          open={showStudentAbout}
          onOpenChange={(open) => {
            setShowStudentAbout(open);
            if (!open) {
              setStudentAboutData(null);
            }
          }}
          studentId={studentAboutData.studentId}
          studentName={studentAboutData.studentName}
          aboutText={studentAboutData.aboutText}
          isReadOnly={false}
          onSaved={async () => {
            await fetchTeachers();
            setStudentAboutData(null);
          }}
        />
      )}

      <AdminBlogManager open={showBlogManager} onOpenChange={setShowBlogManager} />
    </div>
  );
}
