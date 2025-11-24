import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Users, LogOut, FolderOpen, ChevronDown, ChevronRight, Settings, Clock, Plus, Trash2, ExternalLink, FileText, Video, Link as LinkIcon, Image, UserPlus } from "lucide-react";
import { Header } from "./Header";
import { GlobalTopicsManager } from "./GlobalTopicsManager";
import { CreateStudentDialog } from "./CreateStudentDialog";
import { CreateTeacherDialog } from "./CreateTeacherDialog";
import { EditStudentDialog } from "./EditStudentDialog";

interface Teacher {
  user_id: string;
  full_name: string;
  email: string;
  students: Student[];
}

interface Student {
  id: string;
  student_id: string;
  lessons: StudentLesson[];
  profiles: {
    full_name: string;
    email: string;
  };
}

interface StudentLesson {
  id?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export function AdminDashboard() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [expandedStudents, setExpandedStudents] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showGlobalTopics, setShowGlobalTopics] = useState(false);
  const [showCreateStudent, setShowCreateStudent] = useState(false);
  const [showCreateTeacher, setShowCreateTeacher] = useState(false);
  const [showEditStudent, setShowEditStudent] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const { profile, signOut } = useAuth();
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
            lessons: (lessonsData || [])
              .filter((lesson) => lesson.student_id === student.student_id)
              .map((lesson) => ({
                id: lesson.id,
                dayOfWeek: lesson.day_of_week,
                startTime: lesson.start_time,
                endTime: lesson.end_time,
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

  const toggleStudent = (studentId: string) => {
    const newExpanded = new Set(expandedStudents);
    if (newExpanded.has(studentId)) {
      newExpanded.delete(studentId);
    } else {
      newExpanded.add(studentId);
    }
    setExpandedStudents(newExpanded);
  };

  const getDayName = (dayOfWeek?: number) => {
    const days = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
    return dayOfWeek !== undefined ? days[dayOfWeek] : "";
  };

  const formatTime = (time?: string) => {
    if (!time) return "";
    return new Date(`2000-01-01T${time}`).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  };

  const openStudentSettings = (student: Student) => {
    setEditingStudent(student);
    setShowEditStudent(true);
  };

  const getResourceIcon = (type: string) => {
    switch (type) {
      case "video":
        return <Video className="h-4 w-4" />;
      case "pdf":
      case "document":
        return <FileText className="h-4 w-4" />;
      case "link":
        return <LinkIcon className="h-4 w-4" />;
      case "image":
        return <Image className="h-4 w-4" />;
      default:
        return <ExternalLink className="h-4 w-4" />;
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
          <div className="flex items-center gap-2">
            <Button onClick={() => setShowGlobalTopics(true)} variant="outline" size="sm">
              <FolderOpen className="h-4 w-4 mr-2" />
              Konular
            </Button>
            <Button onClick={signOut} variant="outline" size="sm">
              <LogOut className="h-4 w-4 mr-2" />
              Çıkış Yap
            </Button>
          </div>
        }
      >
        <div>
          <h1 className="text-2xl font-bold">Admin Paneli</h1>
          <p className="text-lg text-muted-foreground">Hoş geldin, {profile?.full_name}</p>
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
                              {teacher.students.length} öğrenci
                            </Badge>
                          </div>
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
                  <div className="flex gap-2 border-b mb-4">
                    <Button variant="default" className="rounded-b-none">
                      Öğrenciler
                    </Button>
                    <Button variant="ghost" className="rounded-b-none" disabled>
                      Ders programı
                    </Button>
                    <Button variant="ghost" className="rounded-b-none" disabled>
                      Ödemeler
                    </Button>
                  </div>

                  <div className="space-y-3">
                      <div className="flex justify-end mb-3">
                        <Button onClick={() => setShowCreateStudent(true)} size="sm">
                          <UserPlus className="h-4 w-4 mr-2" />
                          Öğrenci Oluştur
                        </Button>
                      </div>
                      {selectedTeacher.students.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          Bu öğretmenin henüz öğrencisi yok.
                        </p>
                      ) : (
                        selectedTeacher.students.map((student) => (
                          <Card key={student.id} className="border">
                            <Collapsible>
                              <CardContent className="p-3">
                                <div className="flex justify-between items-start">
                                  <CollapsibleTrigger
                                    className="flex items-center gap-2 flex-1 text-left"
                                    onClick={() => toggleStudent(student.id)}
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

                                   <Button variant="ghost" size="sm" onClick={() => openStudentSettings(student)}>
                                    <Settings className="h-4 w-4" />
                                  </Button>
                                </div>

                                <CollapsibleContent className="mt-4">
                                  <div className="pl-6 border-t pt-3 space-y-3">
                                    <div className="flex justify-between items-center">
                                      <h5 className="font-medium text-sm">Öğrenciye Özel Konular</h5>
                                      <Button variant="outline" size="sm">
                                        <Plus className="h-4 w-4 mr-1" />
                                        Konu Ekle
                                      </Button>
                                    </div>
                                    
                                    {/* Örnek konu kartları - teacher panelindeki StudentTopics'e benzer stil */}
                                    <div className="space-y-2">
                                      <Card className="border">
                                        <CardContent className="p-3">
                                          <div className="flex items-start justify-between">
                                            <div className="flex items-start gap-2 flex-1">
                                              <Checkbox className="mt-1" />
                                              <div className="flex-1">
                                                <h6 className="font-medium text-sm">Örnek Konu Başlığı</h6>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                  Bu öğrenciye özel oluşturulmuş konu açıklaması
                                                </p>
                                                <div className="mt-2 space-y-1">
                                                  <div className="flex items-center gap-2 pl-4">
                                                    <Checkbox className="h-3 w-3" />
                                                    {getResourceIcon("video")}
                                                    <span className="text-xs">Örnek Video Kaynağı</span>
                                                  </div>
                                                  <div className="flex items-center gap-2 pl-4">
                                                    <Checkbox className="h-3 w-3" />
                                                    {getResourceIcon("pdf")}
                                                    <span className="text-xs">Örnek PDF Kaynağı</span>
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                            <div className="flex gap-1">
                                              <Button variant="ghost" size="sm">
                                                <Plus className="h-3 w-3" />
                                              </Button>
                                              <Button variant="ghost" size="sm">
                                                <Trash2 className="h-3 w-3" />
                                              </Button>
                                            </div>
                                          </div>
                                        </CardContent>
                                      </Card>
                                    </div>
                                  </div>
                                </CollapsibleContent>
                              </CardContent>
                            </Collapsible>
                          </Card>
                        ))
                      )}
                  </div>
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
    </div>
  );
}
